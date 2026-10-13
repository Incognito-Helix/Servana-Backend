import express from "express";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import requireRole from "../middlewares/role.js";
import requireOwnership from "../middlewares/ownership.js";
import validate from "../middlewares/validate.js";
import {
  createVendorProfileSchema,
  updateVendorProfileSchema,
} from "../validators/vendor.validator.js";
import {
  createVendorProfile,
  getMyVendorProfile,
  getVendorProfile,
  updateVendorProfile,
} from "../controllers/vendor.controller.js";
import { getProfileOwnerId } from "../services/vendor.service.js";

const router = express.Router();

// "/profile" must stay above "/:id", or Express would read "profile" as an id.
router.post(
  "/profile",
  auth,
  requireRole("vendor"),
  validate(createVendorProfileSchema),
  createVendorProfile,
);
router.get("/profile", auth, requireRole("vendor"), getMyVendorProfile);

router.get("/:id", optionalAuth, getVendorProfile);
router.patch(
  "/:id",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(updateVendorProfileSchema),
  updateVendorProfile,
);

export default router;
