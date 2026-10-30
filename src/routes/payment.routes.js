import express from "express";
import auth from "../middlewares/auth.js";
import requireRole from "../middlewares/role.js";
import validate from "../middlewares/validate.js";
import { quoteBoostSchema } from "../validators/boost.validator.js";
import {
  initializePaymentController,
  getPaymentStatusController,
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post(
  "/initialize",
  auth,
  requireRole("vendor"),
  validate(quoteBoostSchema),
  initializePaymentController,
);

router.get(
  "/:reference",
  auth,
  requireRole("vendor"),
  getPaymentStatusController,
);

export default router;
