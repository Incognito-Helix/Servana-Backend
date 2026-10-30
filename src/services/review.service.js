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
        where: {
          profileId,
          moderationStatus: "visible",
        },
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
    moderationStatus: "visible",
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

        customer: { select: { firstName: true, lastName: true } },

        reply: { select: { message: true, createdAt: true } },
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

export const createReviewReply = async (vendorId, reviewId, message) => {
  // 1. Check if the review exists
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, profile: { select: { userId: true } } },
  });

  if (!review) throw httpError(404, "REVIEW_NOT_FOUND", "Review not found.");

  // 2. Verify vendor ownership
  if (review.profile.userId !== vendorId)
    throw httpError(
      403,
      "FORBIDDEN",
      "You can only reply to reviews on your own profile.",
    );

  // 3. Check vendor account status
  const vendor = await prisma.user.findUnique({
    where: { id: vendorId },
    select: { role: true, status: true },
  });

  if (!vendor || vendor.role !== "vendor" || vendor.status !== "active")
    throw httpError(
      403,
      "VENDOR_ONLY",
      "Only active vendors can reply to reviews.",
    );

  // 5. Check whether a reply already exists
  const existingReply = await prisma.reviewReply.findUnique({
    where: { reviewId },
  });

  if (existingReply)
    throw httpError(
      409,
      "REPLY_ALREADY_EXISTS",
      "You have already replied to this review.",
    );

  // 6. Create the reply
  try {
    return await prisma.reviewReply.create({
      data: {
        reviewId,
        message,
      },
    });
  } catch (error) {
    // Protect against simultaneous duplicate requests
    if (error.code === "P2002") {
      throw httpError(
        409,
        "REPLY_ALREADY_EXISTS",
        "You have already replied to this review.",
      );
    }

    throw error;
  }
};

export const reportReview = async (reporterId, reviewId, reason) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, moderationStatus: true },
  });
  if (!review || review.moderationStatus === "hidden")
    throw httpError(404, "REVIEW_NOT_FOUND", "Review not found");

  const reporter = await prisma.user.findUnique({
    where: { id: reporterId },
    select: { role: true, status: true },
  });

  if (
    !reporter ||
    reporter.status !== "active" ||
    !["customer", "vendor"].includes(reporter.role)
  )
    throw httpError(
      403,
      "FORBIDDEN",
      "only active customers and vendors can report reviews",
    );

  try {
    return await prisma.reviewReport.create({
      data: { reviewId, reporterId, reason },
    });
  } catch (error) {
    if (error.code === "P2002")
      throw httpError(
        409,
        "REPORT_ALREADY_EXISTS",
        "You have already reported this review.",
      );
    throw error;
  }
};
