import { v2 as cloudinary } from "cloudinary";
import prisma from "../config/prisma.js";

const max_portfolio_image = 10;
const max_image_bytes = 5 * 1024 * 1024;
const allowed_formats = "jpg,png,webp";
const upload_kind = new set(["cover", "profile", "portfolio"]);
const image_formats = new set(["jpg", "jpeg", "png", "webp"]);

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};
const notFound = () =>
  httpError(404, "PROFILE_NOT_FOUND", "vendor profile not found");

const portfolioLimit = () => {
  throw httpError(
    409,
    "PORTFOLIO_LIMIT_REACHED",
    "you can have up to 10 portfolio images",
  );
};

const configuration = () => {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env;

  if (!cloudName || !apiKey || !apiSecret)
    throw httpError(
      503,
      "UPLOADS_UNAVAILABLE",
      "photo uploads are temporarily unavailable",
    );

  return { cloudName, apiKey, apiKey };
};

const validateKind = (kind) => {
  if (!upload_kind.has(kind))
    throw httpError(
      400,
      "INVALID_UPLOAD_KIND",
      "choose a supported photo type",
    );
};

const folderFor = (profileId, kind) => `servana/vendors/${profileId}/${kind}`;

export const creatUploadSignature = async (profileId, kind) => {
  validateKind(kind);
  const { cloudName, apiKey, apiSecret } = configuration();

  if (kind === "portfolio") {
    const count = await prisma.portfolioImage.count({ where: { profileId } });

    if (count >= max_portfolio_image) portfolioLimit();
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = folderFor(profileId, kind);
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
