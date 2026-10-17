import express from "express";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import requireRole from "../middlewares/role.js";
import requireOwnership from "../middlewares/ownership.js";
import validate from "../middlewares/validate.js";
import {
  createVendorProfileSchema,
  updateVendorProfileSchema,
  submitVendorProfileSchema,
  createServiceSchema,
  updateServiceSchema,
  workingHoursListSchema,
} from "../validators/vendor.validator.js";
import {
  createVendorProfile,
  getMyVendorProfile,
  getVendorProfile,
  updateVendorProfile,
  submitVendorProfile,
} from "../controllers/vendor.controller.js";

import {
  createVendorService,
  getVendorServices,
  updateVendorService,
  deleteVendorService,
} from "../controllers/service.controller.js";
import { getProfileOwnerId } from "../services/vendor.service.js";

import {
  saveVendorWorkingHours,
  getVendorWorkingHours,
  getVendorOpenNow,
} from "../controllers/working-hours.controller.js";

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

router.post(
  "/profile/submit",
  auth,
  requireRole("vendor"),
  validate(submitVendorProfileSchema),
  submitVendorProfile,
);

router.post(
  "/:id/services",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(createServiceSchema),
  createVendorService,
);

router.get("/:id/services", getVendorServices);

router.patch(
  "/:id/services/:serviceId",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(updateServiceSchema),
  updateVendorService,
);

router.delete(
  "/:id/services/:serviceId",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  deleteVendorService,
);

router.put(
  "/:id/working-hours",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(workingHoursListSchema),
  saveVendorWorkingHours,
);

router.get("/:id/working-hours", getVendorWorkingHours);

router.get("/:id/open-now", getVendorOpenNow);

export default router;
