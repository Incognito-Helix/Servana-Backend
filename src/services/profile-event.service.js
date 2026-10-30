import prisma from "../config/prisma.js";

export const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

export const findActiveBoostId = async (profileId) => {
  const now = new Date();

  const boost = await prisma.boost.findFirst({
    where: {
      profileId,
      status: "active",
      startAt: { lte: now },
      endAt: { gte: now },
    },
    orderBy: { type: "asc" },
    select: { id: true },
  });

  return boost?.id ?? null;
};

export const recordProfileEvent = async ({
  profileId,
  type,
  viewerId = null,
  boostId,
}) => {
  const attributedBoostId =
    boostId === undefined ? await findActiveBoostId(profileId) : boostId;

  if (type === "view" && viewerId) {
    const since = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS);

    const existingView = await prisma.profileEvent.findFirst({
      where: {
        profileId,
        type: "view",
        viewerId,
        createdAt: { gte: since },
      },
      select: { id: true },
    });

    if (existingView) return null;
  }

  return prisma.profileEvent.create({
    data: {
      profileId,
      type,
      boostId: attributedBoostId,
      viewerId,
    },
  });
};
