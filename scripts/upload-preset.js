import dotenv from "dotenv";
dotenv.config();

import cloudinary from "../src/config/cloudinary.js";

const name = process.env.CLOUDINARY_UPLOAD_PRESET || "servana_signed";

cloudinary.api
  .create_upload_preset({
    name,
    unsigned: false,
    folder: "servana/uploads",
    allowed_formats: "jpg,png,webp",
    resource_type: "image",
    max_bytes: 5242880, // <-- 5MB
    use_filename: false,
    unique_filename: true,
    overwrite: false,
    eager: [
      {
        width: 150,
        height: 150,
        crop: "fill",
        gravity: "auto",
        fetch_format: "auto",
        quality: "auto",
      },
      {
        width: 400,
        height: 400,
        crop: "fill",
        gravity: "auto",
        fetch_format: "auto",
        quality: "auto",
      },
    ],
    eager_async: true,
  })
  .then((r) => console.log("Preset created:", r.name))
  .catch((e) => {
    if (e.error && /already exists/i.test(e.error.message)) {
      return cloudinary.api
        .update_upload_preset(name, {
          unsigned: false,
          folder: "servana/uploads",
          allowed_formats: "jpg,png,webp",
          max_bytes: 5242880,
        })
        .then(() => console.log("Preset updated:", name));
    }
    console.error(e);
    process.exit(1);
  });
