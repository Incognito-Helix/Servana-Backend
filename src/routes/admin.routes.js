import express from "express";
import auth from "../middlewares/auth.js";
import requireRole from "../middlewares/role.js";
import {
  getPendingVendorReviewsController,
  approveVendorProfileController,
  rejectVendorProfileController,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.get(
  "/vendor-reviews",
  auth,
  requireRole("admin"),
  getPendingVendorReviewsController,
);

router.patch(
  "/vendor-reviews//approve",
  auth,
  requireRole("admin"),
  approveVendorProfileController,
);

router.patch(
  "/vendor-reviews//reject",
  auth,
  requireRole("admin"),
  rejectVendorProfileController,
);

export default router;
