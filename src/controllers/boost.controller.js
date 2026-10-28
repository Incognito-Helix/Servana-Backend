import prisma from "../config/prisma.js";
import {
  createBoost,
  cancelBoost,
  quoteBoost,
  createPendingBoost,
  activateBoost,
} from "../services/boost.service.js";

export const quoteBoostController = async (req, res, next) => {
  try {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!profile) {
      const error = new Error("Vendor profile not found.");
      error.status = 404;
      error.code = "PROFILE_NOT_FOUND";
      return next(error);
    }
    const quote = await quoteBoost(req.body);

    return res.status(200).json({
      success: true,
      message: "Boost quote generated successfully.",
      data: { quote },
    });
  } catch (error) {
    return next(error);
  }
};

export const createBoostController = async (req, res, next) => {
  try {
    const boost = await createBoost(req.body);

    return res.status(201).json({
      success: true,
      message: "Boost created successfully.",
      data: { boost },
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelBoostController = async (req, res, next) => {
  try {
    const boost = await cancelBoost(req.params.boostId);

    return res.status(200).json({
      success: true,
      message: "Boost cancelled successfully.",
      data: { boost },
    });
  } catch (error) {
    return next(error);
  }
};

export const createPendingBoostController = async (req, res, next) => {
  try {
    const result = await createPendingBoost(req.body);

    return res.status(201).json({
      success: true,
      message: "Pending boost and payment created.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const activateBoostController = async (req, res, next) => {
  try {
    const boost = await activateBoost(req.params.boostId);
    return res.status(200).json({
      success: true,
      message: "Boost activated.",
      data: { boost },
    });
  } catch (error) {
    return next(error);
  }
};
