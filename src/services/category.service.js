import prisma from "../config/prisma.js";

// Services under this group are the only ones allowed to work remotely (PRD 5.3).
export const REMOTE_GROUP_SLUG = "tech-and-creative";

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const validationError = (fieldErrors) =>
  httpError(400, "VALIDATION_ERROR", "Validation Error", fieldErrors);

const categoryNotFound = () =>
  httpError(404, "CATEGORY_NOT_FOUND", "Category not found.");

const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

const slugTaken = () =>
  httpError(409, "SLUG_TAKEN", "That slug is already used.", {
    slug: "That slug is already used.",
  });

const toCategory = (category) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  icon: category.icon,
  isActive: category.isActive,
  parentId: category.parentId,
});

// Public list for pickers and filters: active groups with their active
// services. supportsRemote tells the frontend when to show "Works remotely".
export const listActiveCategories = async () => {
  const groups = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { name: "asc" },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    slug: group.slug,
    icon: group.icon,
    supportsRemote: group.slug === REMOTE_GROUP_SLUG,
    children: group.children.map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      icon: child.icon,
    })),
  }));
};

// Admin list: everything, including deactivated categories.
export const listAllCategories = async () => {
  const groups = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: { children: { orderBy: { name: "asc" } } },
  });

  return groups.map((group) => ({
    ...toCategory(group),
    children: group.children.map(toCategory),
  }));
};

export const createCategory = async ({ name, slug, icon, parentId }) => {
  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, isActive: true },
    });

    if (!parent) {
      throw validationError({ parentId: "Parent category not found." });
    }

    // Only two levels: groups (Beauty) and services (Hair).
    if (parent.parentId) {
      throw validationError({
        parentId: "Services can only be added under a top level group.",
      });
    }

    if (!parent.isActive) {
      throw validationError({ parentId: "The parent group is deactivated." });
    }
  }

  const finalSlug = slug || slugify(name);

  if (!finalSlug) {
    throw validationError({ slug: "Could not build a slug from this name." });
  }

  try {
    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        icon: icon || null,
        parentId: parentId || null,
      },
    });

    return toCategory(category);
  } catch (error) {
    if (error.code === "P2002") throw slugTaken();
    throw error;
  }
};

// Soft deactivation only. Nothing is deleted, so vendors and boosts that point
// at a category keep working, and it can be switched back on.
export const updateCategory = async (categoryId, { name, icon, isActive }) => {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: { select: { isActive: true } } },
  });

  if (!existing) throw categoryNotFound();

  if (isActive === true && existing.parent && !existing.parent.isActive) {
    throw httpError(
      409,
      "PARENT_INACTIVE",
      "Turn the parent group back on first.",
    );
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (icon !== undefined) data.icon = icon || null;
  if (isActive !== undefined) data.isActive = isActive;

  const operations = [
    prisma.category.update({ where: { id: categoryId }, data }),
  ];

  // Switching a group off switches its services off too.
  if (isActive === false && !existing.parentId) {
    operations.push(
      prisma.category.updateMany({
        where: { parentId: categoryId },
        data: { isActive: false },
      }),
    );
  }

  const [category] = await prisma.$transaction(operations);

  return toCategory(category);
};

// Vendor picks one primary service and up to 3 others. The whole set is
// replaced each time, which keeps the onboarding step simple to save.
export const setVendorCategories = async (
  profileId,
  { primaryCategoryId, otherCategoryIds = [] },
) => {
  if (otherCategoryIds.includes(primaryCategoryId)) {
    throw validationError({
      otherCategoryIds: "Your primary service cannot also be an other service.",
    });
  }

  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true, worksRemotely: true },
  });

  if (!profile) {
    throw httpError(404, "PROFILE_NOT_FOUND", "Vendor profile not found.");
  }

  const wantedIds = [primaryCategoryId, ...otherCategoryIds];

  const categories = await prisma.category.findMany({
    where: { id: { in: wantedIds }, isActive: true },
    include: { parent: { select: { slug: true, isActive: true } } },
  });

  // Every id must be an active service (not a group) under an active group.
  const usable = categories.filter(
    (category) => category.parentId && category.parent?.isActive,
  );

  if (usable.length !== wantedIds.length) {
    throw validationError({
      categories: "One or more services were not found or are not available.",
    });
  }

  // A paid boost is tied to a category, so that category cannot be dropped
  // while the boost is running or waiting for payment.
  const current = await prisma.vendorCategory.findMany({
    where: { profileId },
    select: { categoryId: true },
  });

  const removedIds = current
    .map((item) => item.categoryId)
    .filter((id) => !wantedIds.includes(id));

  if (removedIds.length) {
    const boosted = await prisma.boost.findFirst({
      where: {
        profileId,
        categoryId: { in: removedIds },
        status: { in: ["pending", "active"] },
        endAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (boosted) {
      throw httpError(
        409,
        "CATEGORY_HAS_ACTIVE_BOOST",
        "You have a boost running in a service you are removing. Keep it until the boost ends.",
      );
    }
  }

  const primary = usable.find((category) => category.id === primaryCategoryId);
  const remoteAllowed = primary.parent.slug === REMOTE_GROUP_SLUG;

  // Changing the primary service away from Tech and creative switches remote
  // work off, so bad data cannot persist.
  const clearRemote = profile.worksRemotely && !remoteAllowed;

  const operations = [
    prisma.vendorCategory.deleteMany({ where: { profileId } }),
    prisma.vendorCategory.createMany({
      data: wantedIds.map((categoryId) => ({
        profileId,
        categoryId,
        isPrimary: categoryId === primaryCategoryId,
      })),
    }),
  ];

  if (clearRemote) {
    operations.push(
      prisma.vendorProfile.update({
        where: { id: profileId },
        data: { worksRemotely: false },
      }),
    );
  }

  await prisma.$transaction(operations);

  const byId = new Map(usable.map((category) => [category.id, category]));

  return {
    categories: wantedIds.map((id) => ({
      id,
      name: byId.get(id).name,
      slug: byId.get(id).slug,
      parentId: byId.get(id).parentId,
      isPrimary: id === primaryCategoryId,
    })),
    worksRemotely: clearRemote ? false : profile.worksRemotely,
    remoteAllowed,
  };
};
