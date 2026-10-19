import express from "express";
import auth from "../middlewares/auth.js";
import requireRole from "../middlewares/role.js";
import validate from "../middlewares/validate.js";
import { verifyNinSchema } from "../validators/vendor.validator.js";
import { verifyVendorNinController } from "../controllers/vendor.controller.js";

const router = express.Router();

router.post(
  "/nin",
  auth,
  requireRole("vendor"),
  validate(verifyNinSchema),
  verifyVendorNinController,
);

export default router;
