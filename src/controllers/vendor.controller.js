import {
  createProfile,
  getOwnProfile,
  getProfile,
  updateProfile,
  submitProfileForReview,
  verifyVendorNin,
} from "../services/vendor.service.js";

export const createVendorProfile = async (req, res, next) => {
  try {
    const profile = await createProfile(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: "Vendor profile created.",
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyVendorProfile = async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.user.id);

    return res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    return next(error);
  }
};

// req.user is only set when the caller sent a valid token.
export const getVendorProfile = async (req, res, next) => {
  try {
    const profile = await getProfile(req.params.id, req.user?.id);

    return res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    return next(error);
  }
};

export const updateVendorProfile = async (req, res, next) => {
  try {
    const profile = await updateProfile(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Vendor profile updated.",
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

export const submitVendorProfile = async (req, res, next) => {
  try {
    const profile = await submitProfileForReview(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Vendor profile submitted for review.",
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyVendorNinController = async (req, res, next) => {
  try {
    const verification = await verifyVendorNin(req.user.id, req.body.nin);

    return res.status(200).json({
      success: true,
      message:
        verification.status === "passed"
          ? "NIN verification successful."
          : "NIN verification failed.",
      data: { verification },
    });
  } catch (error) {
    return next(error);
  }
};
