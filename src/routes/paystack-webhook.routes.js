
import { Router } from "express";
import { paystackWebhookController } from "../controllers/paystack-webhook.controller.js";

const router = Router();

router.post("/", paystackWebhookController);

export default router;
