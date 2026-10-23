import prisma from "../config/prisma.js";

const durationDays = { daily: 1, weekly: 7, monthly: 30 };
const dayMs = 24 * 60 * 60 * 1000;

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const validationError = (fieldErrors) =>
  httpError(400, "VALIDATION_ERROR", "Validation Error", fieldErrors);

const toBoost = (boost) => ({
  id: boost.id,
  profileId: boost.profileId,
  categoryId: boost.categoryId,
  type: boost.type,
  status: boost.status,
  startAt: boost.startAt,
  endAt: boost.endAt,
  zoneIds: boost.zones.map((item) => item.zoneId),
});

export const createBoost = async ({
  profileId,
  categoryId,
  type,
  durationType,
  zoneIds,
}) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true, status: true },
  });

  if (!profile)
    throw httpError(404, "profile_not_found", "vendor profile not found");

  if (profile.status !== "approved")
    throw httpError(
      409,
      "invalid_profile_status",
      "only approved vendors can be boosted",
    );

  const category = await prisma.category.findUnique({
    where: { id: profileId },
    select: { id: true, isActive: true },
  });

  if (!category || !category.isActive)
    throw validationError({ categoryId: "category not found" });

  const listed = await prisma.vendorCategory.findFirst({
    where: { profileId, categoryId },
    select: { id: true },
  });

  if (!listed)
    throw validationError({
      categoryId: "the vendor is not listed in this category",
    });

  const zones = await prisma.zone.findMany({
    where: { id: { in: zoneIds }, isActive: true },
    select: { id: true },
  });

  if (zones.length !== zoneIds.length)
    throw validationError({ zoneIds: "one or more zones were not found" });

  const startAt = new Date();
  const endAt = new Date(
    startAt.getTime() + durationDays[durationType] * dayMs,
  );
  const boost = await prisma.boost.create({
    data: {
      profileId,
      categoryId,
      type,
      status: "active",
      startAt,
      endAt,
      zones: { create: zoneIds.map((zoneId) => ({ zoneId })) },
    },
    include: { zones: { select: { zoneIds: true } } },
  });
  return toBoost(boost);
};

export const cancelBoost = async (boostId) => {
  const existing = await prisma.boost.findUnique({
    where: { id: boostId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw httpError(404, "BOOST_NOT_FOUND", "Boost not found.");
  }

  if (existing.status !== "active" && existing.status !== "pending") {
    throw httpError(
      409,
      "INVALID_BOOST_STATUS",
      "Only active or pending boosts can be cancelled.",
    );
  }

  const boost = await prisma.boost.update({
    where: { id: boostId },
    data: { status: "cancelled" },
    include: { zones: { select: { zoneId: true } } },
  });

  return toBoost(boost);
};
