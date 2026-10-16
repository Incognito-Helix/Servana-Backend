import {
  saveWorkingHours,
  getWorkingHours,
  isVendorOpenNow,
} from "../services/vendor.service.js";

export const saveVendorWorkingHours = async (req, res, next) => {
  try {
    const workingHours = await saveWorkingHours(
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Working hours saved successfully.",
      data: { workingHours },
    });
  } catch (error) {
    return next(error);
  }
};

export const getVendorWorkingHours = async (req, res, next) => {
  try {
    const workingHours = await getWorkingHours(req.params.id);

    return res.status(200).json({
      success: true,
      data: { workingHours },
    });
  } catch (error) {
    return next(error);
  }
};

export const getVendorOpenNow = async (req, res, next) => {
  try {
    const isOpen = await isVendorOpenNow(req.params.id);

    return res.status(200).json({
      success: true,
      data: { isOpen },
    });
  } catch (error) {
    return next(error);
  }
};
