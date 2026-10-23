import express from "express";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"];
const PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || "servana_signed";
const FOLDER = "servana/uploads";

// POST /api/uploads/sign  { type: "image/png", size: 123456 }
router.post("/sign", (req, res) => {
  const { type, size } = req.body || {};

  if (!ALLOWED_MIME.includes(type)) {
    return res
      .status(400)
      .json({ error: "Only JPEG, PNG and WebP images are allowed." });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return res.status(400).json({ error: "File must be 5 MB or smaller." });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, upload_preset: PRESET, folder: FOLDER };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET,
  );

  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    uploadPreset: PRESET,
    folder: FOLDER,
    timestamp,
    signature,
  });
});

// POST /api/uploads/confirm  { publicId }
router.post("/confirm", async (req, res) => {
  const { publicId } = req.body || {};
  if (!publicId || !publicId.startsWith(FOLDER + "/")) {
    return res.status(400).json({ error: "Invalid publicId." });
  }
  try {
    const asset = await cloudinary.api.resource(publicId);
    if (asset.bytes > MAX_BYTES || !ALLOWED_FORMATS.includes(asset.format)) {
      await cloudinary.uploader.destroy(publicId);
      return res
        .status(400)
        .json({ error: "File rejected: wrong type or over 5 MB." });
    }
    res.json({
      publicId: asset.public_id,
      url: asset.secure_url,
      thumbnails: {
        small: cloudinary.url(asset.public_id, {
          width: 150,
          height: 150,
          crop: "fill",
          gravity: "auto",
          fetch_format: "auto",
          quality: "auto",
          secure: true,
        }),
        medium: cloudinary.url(asset.public_id, {
          width: 400,
          height: 400,
          crop: "fill",
          gravity: "auto",
          fetch_format: "auto",
          quality: "auto",
          secure: true,
        }),
      },
    });
  } catch {
    res.status(404).json({ error: "Upload not found." });
  }
});

export default router;
