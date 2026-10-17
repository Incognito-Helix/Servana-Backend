import { v2 as cloudinary } from "cloudinary";
import prisma from "../config/prisma.js";

const max_portfolio_image = 10;
const max_image_bytes = 5 * 1024 * 1024;
const allowed_formats = "jpg,png,webp";

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

export const creatUploadSignature = async (profileId, kind) => {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env;

  if (!cloudName || !apiKey || !apiSecret)
    throw new Error("cloudinary is not configured");

  if (kind === "portfolio") {
    const count = await prisma.portfolioImage.count({ where: { profileId } });

    if (count >= max_portfolio_image) {
      throw httpError(
        409,
        "PORTFOLIO_LIMIT_REACHED",
        "you can have up to 10 portfolio images",
      );
    }
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `servana/vendors/${profileId}/${kind}`;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, allowed_formats },
    apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    allowedFormats: allowed_formats,
    maxBytes: max_image_bytes,
  };
};
