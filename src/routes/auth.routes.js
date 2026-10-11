import express from "express";
import {
  sendEmailOtp,
  verifyEmail,
} from "../controllers/emailOtp.controller.js";
import register from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/send-email-otp", sendEmailOtp);
router.post("/verify-email", verifyEmail);

export default router;
