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
  createPendingBoostController,
  activateBoostController,
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
// Stand ins for checkout and the Paystack webhook, for testing and the demo.
router.post(
  "/boosts/pending",
  auth,
  requireRole("admin"),
  validate(createBoostSchema),
  createPendingBoostController,
);

router.patch(
  "/boosts/:boostId/activate",
  auth,
  requireRole("admin"),
  activateBoostController,
);
export default router;
