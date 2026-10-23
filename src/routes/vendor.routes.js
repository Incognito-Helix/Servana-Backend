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
  // verifyNinSchema,
  signUploadSchema,
} from "../validators/vendor.validator.js";
import {
  createVendorProfile,
  getMyVendorProfile,
  getVendorProfile,
  updateVendorProfile,
  submitVendorProfile,
  // verifyVendorNinController,
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

import { signUpload } from "../controllers/upload.controller.js";

import {
  revealContactController,
  contactTapController,
} from "../controllers/contact.controller.js";

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
// router.post(
//   "/profile/verify-nin",
//   auth,
//   requireRole("vendor"),
//   validate(verifyNinSchema),
//   verifyVendorNinController,
// );

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
router.post("/:id/contact", auth, revealContactController);
router.post("/:id/contact-tap", auth, contactTapController);

router.get("/:id/working-hours", getVendorWorkingHours);

router.get("/:id/open-now", getVendorOpenNow);

router.post(
  "/:id/uploads/sign",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(signUploadSchema),
  signUpload,
);

export default router;
