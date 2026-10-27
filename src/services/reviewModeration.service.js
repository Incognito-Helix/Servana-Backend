import prisma from "../config/prisma.js";

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

// 1. Fetch pending review reports
export const getPendingReviewReports = async () => {
  return prisma.reviewReport.findMany({
    where: { status: "pending" },
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          moderationStatus: true,
          profile: { select: { id: true, businessName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

// 2. Hide a reported review
export const hideReview = async (adminId, reviewId) => {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      select: { id: true, profileId: true, moderationStatus: true },
    });

    if (!review) throw httpError(404, "REVIEW_NOT_FOUND", "Review not found.");

    if (review.moderationStatus === "hidden")
      throw httpError(
        409,
        "REVIEW_ALREADY_HIDDEN",
        "This review is already hidden.",
      );

    // Update review visibility
    const updated = await tx.review.updateMany({
      where: { id: reviewId, moderationStatus: "visible" },
      data: { moderationStatus: "hidden" },
    });

    if (updated.count === 0)
      throw httpError(
        409,
        "REVIEW_ALREADY_HIDDEN",
        "This review is already hidden.",
      );

    // Resolve pending reports associated with the review
    await tx.reviewReport.updateMany({
      where: { reviewId, status: "pending" },
      data: { status: "resolved", reviewedAt: new Date() },
    });

    // Recalculate rating using visible reviews only
    const aggregate = await tx.review.aggregate({
      where: { profileId: review.profileId, moderationStatus: "visible" },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.vendorProfile.update({
      where: { id: review.profileId },
      data: {
        avgRating: aggregate._avg.rating ?? 0,
        reviewCount: aggregate._count._all,
      },
    });

    // Record the administrator's action
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "REVIEW_HIDDEN",
        entityType: "Review",
        entityId: reviewId,
        details: {
          profileId: review.profileId,
          previousStatus: "visible",
          newStatus: "hidden",
        },
      },
    });

    return { reviewId, moderationStatus: "hidden" };
  });
};

// 3. Dismiss a review report
export const dismissReviewReport = async (adminId, reportId) => {
  return prisma.$transaction(async (tx) => {
    const report = await tx.reviewReport.findUnique({
      where: { id: reportId },
    });

    if (!report) throw httpError(404, "REPORT_NOT_FOUND", "Report not found.");

    if (report.status !== "pending")
      throw httpError(
        409,
        "REPORT_ALREADY_REVIEWED",
        "This report has already been reviewed.",
      );

    const updated = await tx.reviewReport.updateMany({
      where: { id: reportId, status: "pending" },
      data: { status: "dismissed", reviewedAt: new Date() },
    });

    if (updated.count === 0)
      throw httpError(
        409,
        "REPORT_ALREADY_REVIEWED",
        "This report has already been reviewed.",
      );

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "REVIEW_REPORT_DISMISSED",
        entityType: "ReviewReport",
        entityId: reportId,
        details: { reviewId: report.reviewId },
      },
    });

    return { reportId, status: "dismissed" };
  });
};
