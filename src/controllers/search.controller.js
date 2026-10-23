import crypto from "node:crypto";
import { searchVendors } from "../services/search.service.js";

export const searchVendorsController = async (req, res, next) => {
  try {
    const rotationSeed =
      req.validatedQuery.rotationSeed ?? crypto.randomInt(0, 1_000_000_000);

    const result = await searchVendors({
      ...req.validatedQuery,
      rotationSeed,
    });

    return res.status(200).json({
      success: true,
      data: { ...result, rotationSeed },
    });
  } catch (error) {
    return next(error);
  }
};
