import "dotenv/config";
import cloudinary from "../src/config/cloudinary.js";

const name = process.env.CLOUDINARY_UPLOAD_PRESET || "servana_signed";
const thumb = (size) => ({
  width: size,
  height: size,
  crop: "fill",
  gravity: "auto",
  fetch_format: "auto",
  quality: "auto",
});

const settings = {
  unsigned: false,
  folder: "servana/uploads",
  allowed_formats: "jpg,png,webp",
  resource_type: "image",
  use_filename: false,
  unique_filename: true,
  overwrite: false,
  eager: [
    { width: 150, height: 150, crop: "fill", gravity: "auto", fetch_format: "auto", quality: "auto" },
    { width: 400, height: 400, crop: "fill", gravity: "auto", fetch_format: "auto", quality: "auto" },
  ],
  eager_async: true,
};

try {
  const r = await cloudinary.api.create_upload_preset({ name, ...settings });
  console.log("Preset created:", r.name);
} catch (e) {
  if (e?.error?.http_code === 409) {
    await cloudinary.api.update_upload_preset(name, settings);
    console.log("Preset updated:", name);
  } else {
    console.error("Cloudinary error:", e?.error?.message || e?.message);
    process.exit(1);
  }
}

