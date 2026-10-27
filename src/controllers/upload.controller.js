import {
  creatUploadSignature,
  confirmVendorUpload,
  removePortfolioImage,
} from "../services/upload.service.js";

export const signUpload = async (req, res, next) => {
  try {
    const data = await creatUploadSignature(req.params.id, req.body.kind);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const confirmUpload = async (req, res, next) => {
  try {
    const data = await confirmVendorUpload(
      req.params.id,
      req.body.kind,
      req.body.publicId,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const deletePortfolioImage = async (req, res, next) => {
  try {
    const data = await removePortfolioImage(req.params.id, req.params.imageId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
