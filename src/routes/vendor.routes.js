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
  confirmUploadSchema,
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

import {
  signUpload,
  confirmUpload,
  deletePortfolioImage,
} from "../controllers/upload.controller.js";

import {
  revealContactController,
  contactTapController,
  hiredResponseController,
} from "../controllers/contact.controller.js";

import {
  createReviewController,
  listReviewsController,
} from "../controllers/review.controller.js";

import {
  createReviewSchema,
  listReviewsQuerySchema,
} from "../validators/review.validator.js";
import validateQuery from "../middlewares/validateQuery.js";

import { quoteBoostController } from "../controllers/boost.controller.js";

import { quoteBoostSchema } from "../validators/boost.validator.js";
import { vendorCategoriesSchema } from "../validators/catalog.validator.js";
import { setVendorCategoriesController } from "../controllers/catalog.controller.js";

const router = express.Router();

router.post(
  "/boosts/quote",
  auth,
  requireRole("vendor"),
  validate(quoteBoostSchema),
  quoteBoostController,
);

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
  "/:id/reviews",
  auth,
  requireRole("customer"),
  validate(createReviewSchema),
  createReviewController,
);

router.get(
  "/:id/reviews",
  validateQuery(listReviewsQuerySchema),
  listReviewsController,
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
// Primary service plus up to 3 others. Replaces the whole set each time.
router.put(
  "/:id/categories",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(vendorCategoriesSchema),
  setVendorCategoriesController,
);
router.post("/:id/contact", auth, revealContactController);
router.post("/:id/contact-tap", auth, contactTapController);

router.patch(
  "/:id/hired-response",
  auth,
  requireRole("customer"),
  hiredResponseController,
);

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

router.post(
  "/:id/uploads/confirm",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  validate(confirmUploadSchema),
  confirmUpload,
);

router.delete(
  "/:id/portfolio/:imageId",
  auth,
  requireRole("vendor"),
  requireOwnership((req) => getProfileOwnerId(req.params.id)),
  deletePortfolioImage,
);

export default router;
