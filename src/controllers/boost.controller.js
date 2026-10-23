import { createBoost, cancelBoost } from "../services/boost.service.js";

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
