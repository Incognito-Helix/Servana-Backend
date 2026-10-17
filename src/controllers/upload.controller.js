import { creatUploadSignature } from "../services/upload.service.js";

export const signUpload = async (req, resizeBy, next) => {
  try {
    const data = await creatUploadSignature(req.params.id, req.body.kind);
    return resizeBy.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
