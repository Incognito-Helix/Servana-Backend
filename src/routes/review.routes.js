import express from "express";
import auth from "../middlewares/auth.js";
import requireRole from "../middlewares/role.js";
import validate from "../middlewares/validate.js";

import { createReviewReplySchema } from "../validators/review.validator.js";

import { createReviewReplyController } from "../controllers/review.controller.js";

const router = express.Router();

router.post(
  "/:id/reply",
  auth,
  requireRole("vendor"),
  validate(createReviewReplySchema),
  createReviewReplyController,
);

export default router;
