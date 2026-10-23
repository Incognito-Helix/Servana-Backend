import prisma from "../config/prisma.js";

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

export const createReview = async (customerId, profileId, data) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { id: profileId },
    select: { id: true, status: true, userId: true },
  });
  if (!profile || profile.status !== "approved") {
    throw httpError(404, "PROFILE_NOT_FOUND", "Vendor profile is not found.");
  }

  if (profile.userId === customerId) {
    throw httpError(
      403,
      "OWN_PROFILE",
      "You cannot review your own vendor profile.",
    );
  }
  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { role: true, status: true },
  });

  if (
    !customer ||
    customer.role !== "customer" ||
    customer.status !== "active"
  ) {
    throw httpError(
      403,
      "CUSTOMER_ONLY",
      "Only active customer accounts can submit reviews.",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          profileId,
          customerId,
          rating: data.rating,
          comment: data.comment?.trim() || null,
        },
      });
      const aggregate = await tx.review.aggregate({
        where: { profileId },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await tx.vendorProfile.update({
        where: { id: profileId },
        data: {
          avgRating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count._all,
        },
      });

      return review;
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw httpError(
        409,
        "REVIEW_ALREADY_EXISTS",
        "You have already reviewed this vendor.",
      );
    }

    throw error;
  }
};

export const listReviews = async (profileId, query) => {
  const profile = await prisma.vendorProfile.findFirst({
    where: { id: profileId, status: "approved" },
    select: { id: true },
  });

  if (!profile) {
    throw httpError(404, "PROFILE_NOT_FOUND", "Vendor profile not found.");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const where = {
    profileId,
    ...(query.rating ? { rating: query.rating } : {}),
  };

  const orderBy = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    highest_rating: { rating: "desc" },
    lowest_rating: { rating: "asc" },
  }[query.sort ?? "newest"];

  const [reviews, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      orderBy: [orderBy, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
