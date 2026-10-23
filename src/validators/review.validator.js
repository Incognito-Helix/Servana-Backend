import Joi from "joi";

export const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.base": "Rating must be a number.",
    "number.integer": "Rating must be a whole number.",
    "number.min": "Rating must be at least 1.",
    "number.max": "Rating must not exceed 5.",
    "any.required": "Rating is required.",
  }),

  comment: Joi.string().trim().max(1000).allow("", null).optional().messages({
    "string.max": "Review comment must not exceed 1000 characters.",
  }),
}).unknown(false);

export const listReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  sort: Joi.string()
    .valid("newest", "oldest", "highest_rating", "lowest_rating")
    .default("newest"),
  rating: Joi.number().integer().min(1).max(5),
}).unknown(false);

export const createReviewReplySchema = Joi.object({
  message: Joi.string().trim().min(1).max(500).required(),
}).unknown(false);
