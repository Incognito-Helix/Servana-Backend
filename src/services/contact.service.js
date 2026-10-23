import prisma from "../config/prisma.js";
export const DAILY_REVEAL_LIMIT = 20;
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const startOfLagosDay = () => {
  const lagosNow = new Date(Date.now() + LAGOS_OFFSET_MS);
  lagosNow.setUTCHours(0, 0, 0, 0);
  return new Date(lagosNow.getTime() - LAGOS_OFFSET_MS);
};

const loadRevealableProfile = async (userId, profileId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      userId: true,
      status: true,
      phone: true,
      whatsapp: true,
    },
  });

  if (!profile || profile.status !== "approved") {
    throw httpError(404, "PROFILE_NOT_FOUND", "Vendor profile not found.");
  }

  if (profile.userId === userId) {
    throw httpError(
      403,
      "OWN_PROFILE",
      "You cannot reveal the contact of your own profile.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });

  if (!user?.emailVerified) {
    throw httpError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Verify your email to see vendor contact details.",
    );
  }

  return profile;
};

const findBoostInEffect = async (profileId) => {
  const now = new Date();

  const boost = await prisma.boost.findFirst({
    where: {
      profileId,
      status: "active",
      startAt: { lte: now },
      endAt: { gte: now },
    },
    orderBy: { type: "asc" }, // top_spot sorts before zone_boost
    select: { id: true },
  });

  return boost?.id ?? null;
};

export const revealContact = async (userId, profileId) => {
  const profile = await loadRevealableProfile(userId, profileId);

  // Different vendors this user has already revealed today. Opening a vendor
  // again does not count, so it is only blocked when it would be a new one.
  const today = await prisma.profileEvent.findMany({
    where: {
      viewerId: userId,
      type: "contact_tap",
      createdAt: { gte: startOfLagosDay() },
    },
    distinct: ["profileId"],
    select: { profileId: true },
  });

  const alreadyToday = today.some((event) => event.profileId === profile.id);

  if (!alreadyToday && today.length >= DAILY_REVEAL_LIMIT) {
    throw httpError(
      429,
      "RATE_LIMIT_EXCEEDED",
      `You can reveal contacts for up to ${DAILY_REVEAL_LIMIT} vendors a day. Try again tomorrow.`,
    );
  }

  const boostId = await findBoostInEffect(profile.id);

  await prisma.$transaction([
    // The first reveal creates the record. Later ones change nothing.
    prisma.contactReveal.upsert({
      where: {
        profileId_customerId: { profileId: profile.id, customerId: userId },
      },
      create: { profileId: profile.id, customerId: userId },
      update: {},
    }),
    prisma.profileEvent.create({
      data: {
        profileId: profile.id,
        type: "contact_tap",
        boostId,
        viewerId: userId,
      },
    }),
  ]);

  return { phone: profile.phone, whatsapp: profile.whatsapp };
};

export const recordContactTap = async (userId, profileId) => {
  const profile = await loadRevealableProfile(userId, profileId);

  const revealed = await prisma.contactReveal.findUnique({
    where: {
      profileId_customerId: { profileId: profile.id, customerId: userId },
    },
    select: { id: true },
  });

  if (!revealed) {
    throw httpError(
      403,
      "CONTACT_NOT_REVEALED",
      "Reveal the contact before using it.",
    );
  }

  const boostId = await findBoostInEffect(profile.id);

  await prisma.profileEvent.create({
    data: {
      profileId: profile.id,
      type: "contact_tap",
      boostId,
      viewerId: userId,
    },
  });
};
