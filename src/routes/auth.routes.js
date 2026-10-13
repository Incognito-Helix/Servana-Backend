import express from "express";
import register from "../controllers/auth.controller.js";
import login from "../controllers/login.controller.js";
import { logout, me } from "../controllers/session.controller.js";
import {
  sendEmailOtp,
  verifyEmail,
} from "../controllers/emailOtp.controller.js";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import registerSchema from "../validators/auth.validator.js";
import loginSchema from "../validators/login.validator.js";
import googleAuth from "../controllers/google.controller.js";
import googleSchema from "../validators/google.validator.js";

const router = express.Router();

// Registration and email verification
router.post("/register", validate(registerSchema), register);
router.post("/send-email-otp", sendEmailOtp);
router.post("/verify-email", verifyEmail);

// Login and session management
router.post("/login", validate(loginSchema), login);
router.post("/logout", auth, logout);
router.get("/me", auth, me);
router.post("/google", validate(googleSchema), googleAuth);

// Google authentication
router.post("/google", validate(googleSchema), googleAuth);

// Password reset
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
