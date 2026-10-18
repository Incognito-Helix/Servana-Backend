
import { getPendingVendorReviews,
         approveVendorProfile,
         rejectVendorProfile,
 } from "../services/vendor.service.js";

export const getPendingVendorReviewsController = async (req, res, next) => {
  try {
    const profiles = await getPendingVendorReviews();

    return res.status(200).json({
      success: true,
      data: { profiles },
    });
  } catch (error) {
    return next(error);
  }
};

export const approveVendorProfileController = async (req, res, next) => {
  try {
    const profile = await approveVendorProfile(req.params.profileId);

    return res.status(200).json({
      success: true,
      message: "Vendor profile approved successfully.",
      data: { profile },
    });

  } catch (error) {
    return next(error);
  }
};

export const rejectVendorProfileController = async (req, res, next) => {
  try{
    const profile = await rejectVendorProfile(
      req.params.profileId,
      req.body.reason,
    );


    return res.status(200).json({
      success: true,
      message: "Vendor profile rejected successfully.",
      data: { profile },
    });

  }catch(error) {
    return next(error);
  }
}
