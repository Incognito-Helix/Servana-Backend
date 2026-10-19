import { randomBytes } from "node:crypto";
import prisma from "../config/prisma.js";
import { verifyNinWithMock } from "./verification/ninVerification.mock.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCATION_COOLDOWN_DAYS = 7;
const nin_max_attempts = 3;

// Columns a vendor can set themselves. Everything else on the row (status,
// slug, ratings, verification, userId) is controlled by the server.
const EDITABLE_FIELDS = [
  "businessName",
  "about",
  "phone",
  "whatsapp",
  "state",
  "city",
  "zoneId",
  "latitude",
  "longitude",
  "streetAddress",
  "offersHomeService",
  "serviceRadiusKm",
  "onboardingStep",
  "worksRemotely",
];

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const validationError = (fieldErrors) =>
  httpError(400, "VALIDATION_ERROR", "Validation Error", fieldErrors);

const notFound = () =>
  httpError(404, "PROFILE_NOT_FOUND", "Vendor profile not found.");

// What anyone can see. This is an allowlist, so a new column on the table
// stays private until it is added here on purpose. Phone, WhatsApp, street
// address and exact coordinates are never public.
const toPublic = (profile) => ({
  id: profile.id,
  slug: profile.slug,
  businessName: profile.businessName,
  about: profile.about,
  state: profile.state,
  city: profile.city,
  zoneId: profile.zoneId,
  offersHomeService: profile.offersHomeService,
  serviceRadiusKm: profile.serviceRadiusKm,
  worksRemotely: profile.worksRemotely,
  coverImageUrl: profile.coverImageUrl,
  profileImageUrl: profile.profileImageUrl,
  isVerified: profile.isVerified,
  avgRating: Number(profile.avgRating),
  reviewCount: profile.reviewCount,
  createdAt: profile.createdAt,
  socialLinks: (profile.socialLinks ?? []).map(({ platform, url }) => ({
    platform,
    url,
  })),
});

// What the vendor sees on their own profile.
const toOwner = (profile) => ({
  ...toPublic(profile),
  phone: profile.phone,
  whatsapp: profile.whatsapp,
  streetAddress: profile.streetAddress,
  latitude: profile.latitude,
  longitude: profile.longitude,
  onboardingStep: profile.onboardingStep,
  status: profile.status,
  rejectionReason: profile.rejectionReason,
  locationChangedAt: profile.locationChangedAt,
  updatedAt: profile.updatedAt,
});

const slugify = (name) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "") || "vendor";

// The slug never changes after creation, so it is only built here.
const uniqueSlug = async (businessName) => {
  const base = slugify(businessName);
  let slug = base;

  while (await prisma.vendorProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }

  return slug;
};

const isUniqueViolation = (error, column) =>
  error.code === "P2002" &&
  String(error.meta?.target ?? "")
    .toLowerCase()
    .includes(column);

const phoneTaken = () =>
  httpError(
    409,
    "PHONE_ALREADY_IN_USE",
    "This phone number is already used by another vendor.",
    { phone: "This phone number is already used by another vendor." },
  );

// Turns the validated request into the columns to write, and applies the
// rules that depend on more than one field or on what is already saved.
const buildChanges = async (input, existing = null) => {
  const current = existing || {};
  const data = {};

  for (const field of EDITABLE_FIELDS) {
    if (input[field] === undefined) continue;
    data[field] = input[field] === "" ? null : input[field];
  }

  // Latitude and longitude only make sense together.
  if ((data.latitude === undefined) !== (data.longitude === undefined)) {
    throw validationError({
      latitude: "Send latitude and longitude together.",
    });
  }

  // A zone must exist. If the vendor picked a new zone and sent no
  // coordinates, the zone's centre point is used.
  if (data.zoneId !== undefined) {
    const zone = await prisma.zone.findFirst({
      where: { id: data.zoneId, isActive: true },
    });

    if (!zone) throw validationError({ zoneId: "Zone not found." });

    if (data.latitude === undefined && data.zoneId !== current.zoneId) {
      data.latitude = zone.centerLatitude;
      data.longitude = zone.centerLongitude;
    }
  }

  // WhatsApp defaults to the phone number.
  if (data.phone && data.whatsapp === undefined && !current.whatsapp) {
    data.whatsapp = data.phone;
  }

  // The travel radius only exists while home service is on.
  const homeService = data.offersHomeService ?? current.offersHomeService;
  const radius =
    data.serviceRadiusKm !== undefined
      ? data.serviceRadiusKm
      : current.serviceRadiusKm;

  if (homeService && radius == null) {
    throw validationError({
      serviceRadiusKm: "Travel radius is required for home service.",
    });
  }

  if (!homeService && radius != null) data.serviceRadiusKm = null;

  if (data.worksRemotely === true) {
    const primary = existing
      ? await prisma.vendorCategory.findFirst({
          where: { profileId: existing.id, isPrimary: true },
          include: { category: { include: { parent: true } } },
        })
      : null;

    const group = primary?.category.parent ?? primary?.category;

    if (group?.slug !== "tech-and-creative") {
      throw validationError({
        worksRemotely:
          "working remotely is only for the tech and creative services",
      });
    }
  }

  if (data.onboardingStep !== undefined) {
    data.onboardingStep = Math.max(
      current.onboardingStep ?? 1,
      data.onboardingStep,
    );
  }

  const moved = ["zoneId", "latitude", "longitude"].some(
    (field) => data[field] !== undefined && data[field] !== current[field],
  );

  if (moved) {
    if (existing && existing.status !== "draft" && existing.locationChangedAt) {
      const nextChange = new Date(
        existing.locationChangedAt.getTime() + LOCATION_COOLDOWN_DAYS * DAY_MS,
      );

      if (nextChange > new Date()) {
        throw httpError(
          403,
          "LOCATION_COOLDOWN",
          `You can change your location again on ${nextChange.toISOString().slice(0, 10)}.`,
        );
      }
    }

    data.locationChangedAt = new Date();
  }

  return data;
};

export const createProfile = async (userId, input) => {
  const alreadyHasOne = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (alreadyHasOne) {
    throw httpError(
      409,
      "PROFILE_ALREADY_EXISTS",
      "You already have a vendor profile.",
    );
  }

  const data = await buildChanges(input);

  if (input.socialLinks?.length) {
    data.socialLinks = {
      create: input.socialLinks,
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const profile = await prisma.vendorProfile.create({
        data: {
          ...data,
          userId,
          slug: await uniqueSlug(data.businessName),
        },
        include: { socialLinks: true },
      });

      return toOwner(profile);
    } catch (error) {
      if (isUniqueViolation(error, "phone")) throw phoneTaken();
      // Someone took the same slug between our check and the insert.
      if (isUniqueViolation(error, "slug")) continue;
      if (isUniqueViolation(error, "user")) {
        throw httpError(
          409,
          "PROFILE_ALREADY_EXISTS",
          "You already have a vendor profile.",
        );
      }
      throw error;
    }
  }

  throw httpError(
    409,
    "SLUG_UNAVAILABLE",
    "Could not create the profile. Please try again.",
  );
};

export const getOwnProfile = async (userId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId },
    include: { socialLinks: true },
  });
  if (!profile) throw notFound();

  return toOwner(profile);
};

// Approved profiles are public. Any other status is only visible to the owner,
// and everyone else gets a 404 so the profile's existence is not revealed.
export const getProfile = async (profileId, viewerId = null) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    include: { socialLinks: true },
  });

  if (!profile) throw notFound();

  if (viewerId && profile.userId === viewerId) return toOwner(profile);

  if (profile.status !== "approved") throw notFound();

  return toPublic(profile);
};

export const updateProfile = async (profileId, input) => {
  const existing = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
  });

  if (!existing) throw notFound();

  const data = await buildChanges(input, existing);

  if (input.socialLinks !== undefined) {
    data.socialLinks = {
      deleteMany: {},
      create: input.socialLinks,
    };
  }

  try {
    const profile = await prisma.vendorProfile.update({
      where: { id: existing.id },
      data,
    });

    return toOwner(profile);
  } catch (error) {
    if (isUniqueViolation(error, "phone")) throw phoneTaken();
    throw error;
  }
};

// Used by the ownership middleware.
export const getProfileOwnerId = async (profileId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { userId: true },
  });

  return profile ? profile.userId : null;
};

export const submitProfileForReview = async (userId) => {
  const existing = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!existing) throw notFound();

  if (existing.status !== "draft" && existing.status !== "rejected") {
    throw httpError(
      409,
      "INVALID_PROFILE_STATUS",
      "Only draft or rejected profiles can be submitted for review.",
    );
  }

  if (existing.onboardingStep < 6) {
    throw validationError({
      onboardingStep: "Complete all onboarding steps before submitting.",
    });
  }

  if (
    existing.zoneId == null ||
    existing.latitude == null ||
    existing.longitude == null
  ) {
    throw validationError({ zoneId: "choose your location before submitting" });
  }
  if (!existing.isVerified)
    throw validationError({ nin: "verify your NIN before submitting" });

  const profile = await prisma.vendorProfile.update({
    where: { id: existing.id },
    data: {
      status: "pending",
      rejectionReason: null,
    },
    include: { socialLinks: true },
  });

  return toOwner(profile);
};

export const getPendingVendorReviews = async () => {
  return prisma.vendorProfile.findMany({
    where: { status: "pending" },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      businessName: true,
      about: true,
      phone: true,
      whatsapp: true,
      state: true,
      city: true,
      streetAddress: true,
      onboardingStep: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      zone: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
        },
      },
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      socialLinks: true,
      services: true,
      portfolioImages: true,
      workingHours: true,
      verifications: {
        select: {
          status: true,
          failedReason: true,
          checkedAt: true,
          ninLast4: true,
        },
        orderBy: { checkedAt: "desc" },
      },
    },
  });
};

const ensurePendingProfile = async (profileId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true, status: true },
  });

  if (!profile) throw notFound();

  if (profile.status !== "pending") {
    throw httpError(
      409,
      "INVALID_PROFILE_STATUS",
      "Only pending vendor profiles can be reviewed.",
    );
  }
  return profile;
};

export const approveVendorProfile = async (profileId) => {
  await ensurePendingProfile(profileId);

  const profile = await prisma.vendorProfile.update({
    where: { id: profileId },
    data: {
      status: "approved",
      rejectionReason: null,
    },
    include: { socialLinks: true },
  });
  return toOwner(profile);
};

export const rejectVendorProfile = async (profileId, reason) => {
  if (typeof reason !== "string" || !reason.trim()) {
    throw validationError({
      reason: "A rejection reasin is required.",
    });
  }

  await ensurePendingProfile(profileId);

  const profile = await prisma.vendorProfile.update({
    where: { id: profileId },
    data: {
      status: "rejected",
      rejectionReason: reason.trim(),
    },
    include: { socialLinks: true },
  });
  return toOwner(profile);
};

export const createService = async (profileId, input) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  if (!profile) throw notFound();

  if (input.priceMax != null && input.priceMax < input.priceMin) {
    throw validationError({
      priceMax: "Maximum price must be greater than or equal to minimum price.",
    });
  }

  return prisma.service.create({
    data: {
      profileId,
      name: input.name,
      priceMin: input.priceMin,
      priceMax: input.priceMax ?? null,
    },
  });
};

export const getServices = async (profileId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  if (!profile) throw notFound();

  return prisma.service.findMany({
    where: { profileId },
    orderBy: { name: "asc" },
  });
};

export const updateService = async (profileId, serviceId, input) => {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, profileId },
  });

  if (!service) {
    throw httpError(404, "SERVICE_NOT_FOUND", "Service is not found.");
  }

  const priceMin = input.priceMin ?? service.priceMin;
  const priceMax =
    input.priceMax !== undefined ? input.priceMax : service.priceMax;

  if (priceMax != null && priceMax < priceMin) {
    throw validationError({
      priceMax: "Maximum price must be greater than or equal to minimum price.",
    });
  }
  return prisma.service.update({
    where: { id: serviceId },
    data: input,
  });
};

export const deleteService = async (profileId, serviceId) => {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, profileId },
    select: { id: true },
  });

  if (!service) {
    throw httpError(404, "SERVICE_NOT_FOUND", "service not found.");
  }

  await prisma.service.delete({
    where: { id: serviceId },
  });

  return { message: "Service deleted successfully." };
};

const validateWorkingHours = (hours) => {
  if (hours.isClosed) {
    return;
  }

  if (!hours.openTime || !hours.closeTime) {
    throw validationError({
      openTime:
        "Opening and closing times are required when the vendor is open.",
    });
  }

  if (hours.openTime >= hours.closeTime) {
    throw validationError({
      closeTime: "Closing time must be later than opening time.",
    });
  }
};

export const saveWorkingHours = async (profileId, hoursList) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  if (!profile) {
    throw notFound();
  }

  for (const hours of hoursList) {
    validateWorkingHours(hours);
  }

  return prisma.$transaction(
    hoursList.map((hours) =>
      prisma.workingHours.upsert({
        where: {
          profileId_dayOfWeek: {
            profileId,
            dayOfWeek: hours.dayOfWeek,
          },
        },
        create: {
          profileId,
          dayOfWeek: hours.dayOfWeek,
          openTime: hours.isClosed ? null : hours.openTime,
          closeTime: hours.isClosed ? null : hours.closeTime,
          isClosed: hours.isClosed ?? false,
        },
        update: {
          openTime: hours.isClosed ? null : hours.openTime,
          closeTime: hours.isClosed ? null : hours.closeTime,
          isClosed: hours.isClosed ?? false,
        },
      }),
    ),
  );
};

export const getWorkingHours = async (profileId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  if (!profile) {
    throw notFound();
  }

  return prisma.workingHours.findMany({
    where: { profileId },
    orderBy: { dayOfWeek: "asc" },
  });
};

export const isVendorOpenNow = async (profileId) => {
  const hours = await getWorkingHours(profileId);

  const now = new Date();

  const lagosTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const parts = Object.fromEntries(
    lagosTime.map(({ type, value }) => [type, value]),
  );

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = weekdays.indexOf(parts.weekday);
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);

  const today = hours.find((item) => item.dayOfWeek === dayOfWeek);

  if (!today || today.isClosed || !today.openTime || !today.closeTime) {
    return false;
  }

  const [openHour, openMinute] = today.openTime.split(":").map(Number);
  const [closeHour, closeMinute] = today.closeTime.split(":").map(Number);

  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};

export const verifyVendorNin = async (userId, nin) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true, isVerified: true },
  });

  if (!profile) {
    throw notFound();
  }

  if (profile.isVerified)
    throw httpError(
      409,
      "NIN_ALREADY_VERIFIED",
      "your NIN has already been verified",
    );

  const attemptsToday = await prisma.verification.count({
    where: {
      profileId: profile.id,
      checkedAt: { gte: new Date(Date.now() - DAY_MS) },
    },
  });

  if (attemptsToday >= nin_max_attempts)
    throw httpError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "too many NIN attempts. please try again in 24 hours",
    );

  const result = await verifyNinWithMock(nin);
  const ninLast4 = nin.slice(-4);

  return prisma.$transaction(async (tx) => {
    const verification = await tx.verification.create({
      data: {
        profileId: profile.id,
        ninLast4,
        status: result.status,
        failedReason: result.failedReason,
      },
      select: {
        id: true,
        ninLast4: true,
        status: true,
        failedReason: true,
        checkedAt: true,
      },
    });
    await tx.vendorProfile.update({
      where: { id: profile.id },
      data: { isVerified: result.status === "passed" },
    });

    return verification;
  });
};
