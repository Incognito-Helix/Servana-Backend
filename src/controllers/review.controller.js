-- Active: 1791226795682@@127.0.0.1@5432
import {
  createReview,
  listReviews,
  createReviewReply,
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
