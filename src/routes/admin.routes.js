import express from "express";
import auth from "../middlewares/auth.js";
import requireRole from "../middlewares/role.js";
import {
  getPendingVendorReviewsController,
  approveVendorProfileController,
  rejectVendorProfileController,
} from "../controllers/admin.controller.js";
import validate from "../middlewares/validate.js";
import { createBoostSchema } from "../validators/boost.validator.js";
import {
  createBoostController,
  cancelBoostController,
} from "../controllers/boost.controller.js";

const router = express.Router();

router.get(
  "/vendor-reviews",
  auth,
  requireRole("admin"),
  getPendingVendorReviewsController,
);

router.patch(
  "/vendor-reviews/:profileId/approve",
  auth,
  requireRole("admin"),
  approveVendorProfileController,
);

router.patch(
  "/vendor-reviews/:profileId/reject",
  auth,
  requireRole("admin"),
  rejectVendorProfileController,
);

router.post(
  "/boosts",
  auth,
  requireRole("admin"),
  validate(createBoostSchema),
  createBoostController,
);

router.patch(
  "/boosts/:boostId/cancel",
  auth,
  requireRole("admin"),
  cancelBoostController,
);

export default router;
