import express from "express";
import register from "../controllers/auth.controller.js";
import login from "../controllers/login.controller.js";
import { logout, me } from "../controllers/session.controller.js";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import registerSchema from "../validators/auth.validator.js";
import loginSchema from "../validators/login.validator.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", auth, logout);
router.get("/me", auth, me);

export default router;
