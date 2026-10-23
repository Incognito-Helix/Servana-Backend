import {
  createReview,
  listReviews,
  createReviewReply,
  reportReview,
} from "../services/review.service.js";

export const createReviewController = async (req, res, next) => {
  try {
    const review = await createReview(req.user.id, req.params.id, req.body);

    return res.status(201).json({
      success: true,
      data: { review },
    });
  } catch (error) {
    return next(error);
  }
};

export const listReviewsController = async (req, res, next) => {
  try {
    const result = await listReviews(req.params.id, req.validatedQuery);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
export const createReviewReplyController = async (req, res, next) => {
  try {
    const reply = await createReviewReply(
      req.user.id,
      req.params.id,
      req.body.message,
    );

    return res.status(201).json({ success: true, data: { reply } });
  } catch (error) {
    next(error);
  }
};

export const reportReviewController = async (req, res, next) => {
  try {
    const report = await reportReview(
      req.user.id,
      req.params.id,
      req.body.reason,
    );

    return res.status(201).json({
      success: true,
      message: "Review reported successfully.",
      data: {
        report: {
          id: report.id,
          reviewId: report.reviewId,
          createdAt: report.createdAt,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};
