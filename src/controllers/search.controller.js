import { searchVendors } from "../services/search.service.js";

export const searchVendorsController = async (req, res, next) => {
  try {
    const result = await searchVendors(req.validatedQuery);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
