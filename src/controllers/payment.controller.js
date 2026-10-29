import {
  initializePayment,
  getPaymentStatus,
} from "../services/payment.service.js"

export const initializePaymentController = async (req, res, next) => {
  try {
    const data = await initializePayment(req.user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getPaymentStatusController = async (req, res, next) => {
  try {
    const data = await getPaymentStatus(req.user.id, req.params.reference);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
