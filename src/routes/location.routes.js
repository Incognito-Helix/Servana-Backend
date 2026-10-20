import express from "express";
import auth from "../middlewares/auth.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import requireRole from "../middlewares/role.js";
import validate from "../middlewares/validate.js";
import validateQuery from "../middlewares/validateQuery.js";
import {
  suggestQuerySchema,
  recentLocationSchema,
} from "../validators/location.validator.js";
import {
  suggestLocationsController,
  saveRecentLocationController,
} from "../controllers/location.controller.js";

const router = express.Router();

router.get(
  "/suggest",
  optionalAuth,
  validateQuery(suggestQuerySchema),
  suggestLocationsController,
);

router.post(
  "/recent",
  auth,
  requireRole("customer"),
  validate(recentLocationSchema),
  saveRecentLocationController,
);

export default router;
