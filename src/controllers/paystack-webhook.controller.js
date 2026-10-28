
import {
  verifyPaystackSignature,
  processPaystackEvent,
} from "../services/paystack-webhook.service.js";

export const paystackWebhookController = async (req, res, next) => {
  try {
    const signature = req.get("x-paystack-signature");

    const isValid = verifyPaystackSignature(
      req.body,
      signature,
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack webhook signature.",
      });
    }

    let event;

    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook JSON payload.",
      });
    }

    const result = await processPaystackEvent(event);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
