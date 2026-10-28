import { randomUUID } from "node:crypto";
import prisma from "../config/prisma.js";

const durationDays = { daily: 1, weekly: 7, monthly: 30 };
const dayMs = 24 * 60 * 60 * 1000;

// Base prices are in kobo, indexed by boost type and duration.
export const BOOST_BASE_PRICES_KOBO = {
  zone_boost: { daily: 50_000, weekly: 300_000, monthly: 1_000_000 },
  top_spot: { daily: 100_000, weekly: 600_000, monthly: 2_000_000 },
};

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const renew_window_ms = 24 * 60 * 60 * 1000;
const resolveStartAt = async (profileId, zoneIds, now = new Date()) => {
  const current = await prisma.boost.findMany({
    where: {
      profileId,
      status: "active",
      endAt: { gte: now },
      zones: {
        some: {
          zoneId: { in: zoneIds },
        },
      },
    },
    select: { endAt: true },
  });

  const tooEarly = current.some(
    (boost) => boost.endAt.getTime() - now.getTime() > renew_window_ms,
  );

  if (tooEarly) {
    throw httpError(
      409,
      "BOOST_OVERLAP",
      "You already have a boost running in one of these zones. You can renew it when it has less than 24 hours left.",
    );
  }

  return current.reduce(
    (latest, boost) => (boost.endAt > latest ? boost.endAt : latest),
    now,
  );
};

const validationError = (fieldErrors) =>
  httpError(400, "VALIDATION_ERROR", "Validation Error", fieldErrors);

const validateBoostRequest = async ({ profileId, categoryId, zoneIds }) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true, userId: true, status: true },
  });

  if (!profile) {
    throw httpError(404, "PROFILE_NOT_FOUND", "Vendor profile not found.");
  }

  if (profile.status !== "approved") {
    throw httpError(
      409,
      "INVALID_PROFILE_STATUS",
      "Only approved vendors can be boosted.",
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });

  if (!category || !category.isActive) {
    throw validationError({ categoryId: "Category not found or inactive." });
  }

  const listed = await prisma.vendorCategory.findFirst({
    where: { profileId, categoryId },
    select: { id: true },
  });

  if (!listed) {
    throw validationError({
      categoryId: "The vendor is not listed in this category.",
    });
  }

  const zones = await prisma.zone.findMany({
    where: { id: { in: zoneIds }, isActive: true },
    select: { id: true, boostPriceMultiplier: true },
  });

  if (zones.length !== zoneIds.length) {
    throw validationError({
      zoneIds: "One or more zones were not found or are inactive.",
    });
  }

  return { profile, zones };
};

export const quoteBoost = async ({
  profileId,
  categoryId,
  type,
  durationType,
  zoneIds,
}) => {
  const { zones } = await validateBoostRequest({
    profileId,
    categoryId,
    zoneIds,
  });

  const basePriceKobo = BOOST_BASE_PRICES_KOBO[type]?.[durationType];

  if (!basePriceKobo || !durationDays[durationType]) {
    throw validationError({
      durationType: "Unsupported boost type or duration.",
    });
  }

  const zoneQuotes = zones.map((zone) => {
    const multiplier = Number(zone.boostPriceMultiplier);
    const priceKobo = Math.round(basePriceKobo * multiplier);

    return {
      zoneId: zone.id,
      multiplier,
      priceKobo,
    };
  });

  const totalPriceKobo = zoneQuotes.reduce(
    (total, zone) => total + zone.priceKobo,
    0,
  );

  return {
    type,
    durationType,
    durationDays: durationDays[durationType],
    currency: "NGN",
    basePriceKobo,
    zones: zoneQuotes,
    totalPriceKobo,
    totalPriceNaira: totalPriceKobo / 100,
  };
};

const toBoost = (boost) => ({
  id: boost.id,
  profileId: boost.profileId,
  categoryId: boost.categoryId,
  type: boost.type,
  status: boost.status,
  startAt: boost.startAt,
  endAt: boost.endAt,
  zoneIds: (boost.zones ?? []).map((item) => item.zoneId),
});

export const createBoost = async ({
  profileId,
  categoryId,
  type,
  durationType,
  zoneIds,
}) => {
  await validateBoostRequest({ profileId, categoryId, zoneIds });

  if (!durationDays[durationType] || !BOOST_BASE_PRICES_KOBO[type]) {
    throw validationError({
      durationType: "Unsupported boost type or duration.",
    });
  }

  const startAt = await resolveStartAt(profileId, zoneIds);
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
      zones: {
        create: zoneIds.map((zoneId) => ({ zoneId })),
      },
    },
    include: { zones: { select: { zoneId: true } } },
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

export const createPendingBoost = async ({
  profileId,
  categoryId,
  type,
  durationType,
  zoneIds,
}) => {
  const { profile } = await validateBoostRequest({
    profileId,
    categoryId,
    zoneIds,
  });

  const quote = await quoteBoost({
    profileId,
    categoryId,
    type,
    durationType,
    zoneIds,
  });

  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + quote.durationDays * dayMs);

  const paystackReference = `servana_${randomUUID()}`;

  return prisma.$transaction(async (tx) => {
    const boost = await tx.boost.create({
      data: {
        profileId,
        categoryId,
        type,
        status: "pending",
        startAt,
        endAt,
        zones: {
          create: zoneIds.map((zoneId) => ({ zoneId })),
        },
      },
      include: {
        zones: { select: { zoneId: true } },
      },
    });

    const payment = await tx.payment.create({
      data: {
        userId: profile.userId,
        boostId: boost.id,
        paystackReference,
        amountKobo: quote.totalPriceKobo,
        currency: quote.currency,
        status: "pending",
      },
    });

    return {
      boost: toBoost(boost),
      payment: {
        id: payment.id,
        reference: payment.paystackReference,
        amountKobo: payment.amountKobo,
        currency: payment.currency,
        status: payment.status,
      },
    };
  });
};

export const activateBoost = async (boostId, now = new Date()) => {
  return prisma.$transaction(async (tx) => {
    const boost = await tx.boost.findUnique({
      where: { id: boostId },
      include: { zones: { select: { zoneId: true } } },
    });

    if (!boost) {
      throw httpError(404, "BOOST_NOT_FOUND", "Boost not found.");
    }

    if (boost.status === "active") {
      return toBoost(boost);
    }

    if (boost.status !== "pending") {
      throw httpError(
        409,
        "INVALID_BOOST_STATUS",
        "Only pending boosts can be activated.",
      );
    }

    const durationMs = boost.endAt.getTime() - boost.startAt.getTime();
    const zoneIds = boost.zones.map((item) => item.zoneId);

    const current = await tx.boost.findMany({
      where: {
        id: { not: boost.id },
        profileId: boost.profileId,
        status: "active",
        endAt: { gt: now },
        zones: { some: { zoneId: { in: zoneIds } } },
      },
      select: { endAt: true },
    });

    const startAt = current.reduce(
      (latest, item) => (item.endAt > latest ? item.endAt : latest),
      now,
    );

    const endAt = new Date(startAt.getTime() + durationMs);

    const updatedCount = await tx.boost.updateMany({
      where: { id: boost.id, status: "pending" },
      data: { status: "active", startAt, endAt },
    });

    if (updatedCount.count !== 1) {
      throw httpError(
        409,
        "INVALID_BOOST_STATUS",
        "The boost status changed before activation.",
      );
    }

    const updated = await tx.boost.findUnique({
      where: { id: boost.id },
      include: { zones: { select: { zoneId: true } } },
    });

    return toBoost(updated);
  });
};
