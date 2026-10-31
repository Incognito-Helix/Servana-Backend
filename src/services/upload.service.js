import cloudinary from "../config/cloudinary.js";
import prisma from "../config/prisma.js";

const max_portfolio_image = 10;
const max_image_bytes = 5 * 1024 * 1024;
const allowed_formats = "jpg,png,webp";
const upload_kind = new Set(["cover", "profile", "portfolio"]);
const image_formats = new Set(["jpg", "jpeg", "png", "webp"]);

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const lockPhotoProfile = async (tx, profileId) => {
  const profiles = await tx.$queryRaw`
    SELECT "id" FROM "vendor_profiles" WHERE "id" = ${profileId} FOR UPDATE
  `;
  if (!profiles.length) {
    const error = new Error("Vendor profile not found.");
    error.status = 404;
    error.code = "PROFILE_NOT_FOUND";
    throw error;
  }
};

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

  return { cloudName, apiKey, apiSecret };
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

const validatePublicId = (profileId, kind, publicId) => {
  validateKind(kind);
  const folder = folderFor(profileId, kind);
  if (
    typeof publicId !== "string" ||
    !publicId.startsWith(`${folder}/`) ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(publicId.slice(folder.length + 1))
  ) {
    throw httpError(
      400,
      "INVALID_UPLOAD_ASSET",
      "This upload does not belong to this vendor and photo type.",
    );
  }
};

const photoSnapshot = async (tx, profileId, kind) => {
  const profile = await tx.vendorProfile.findUnique({
    where: { id: profileId },
    select: {
      coverImageUrl: true,
      profileImageUrl: true,
      portfolioImages: {
        select: { id: true, url: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!profile)
    throw httpError(404, "PROFILE_NOT_FOUND", "vendor profile not found");
  return { kind, ...profile };
};

const verifiedAssetUrl = async (profileId, kind, publicId) => {
  validatePublicId(profileId, kind, publicId);
  const { cloudName } = configuration();
  let asset;
  try {
    asset = await cloudinary.api.resource(publicId, {
      resource_type: "image",
      type: "upload",
    });
  } catch (error) {
    if (error?.http_code === 404 || error?.error?.http_code === 404) {
      throw httpError(
        404,
        "UPLOAD_NOT_FOUND",
        "The uploaded image was not found.",
      );
    }
    throw httpError(
      502,
      "UPLOAD_VERIFICATION_FAILED",
      "The uploaded image could not be verified. Please try saving it again.",
    );
  }
  let url;
  try {
    url = new URL(asset?.secure_url);
  } catch {
    // Not a valid URL. url stays null and the check below rejects it.
  }
  if (
    asset?.public_id !== publicId ||
    asset.resource_type !== "image" ||
    asset.type !== "upload" ||
    !image_formats.has(asset.format) ||
    !Number.isSafeInteger(asset.bytes) ||
    asset.bytes <= 0 ||
    asset.bytes > max_image_bytes ||
    !url ||
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith(`/${cloudName}/image/upload/`)
  ) {
    throw httpError(
      400,
      "INVALID_UPLOAD_ASSET",
      "Choose a JPEG, PNG or WebP image no larger than 5 MB",
    );
  }
  return cloudinary.url(publicId, {
    cloud_name: cloudName,
    secure: true,
    resource_type: "image",
    type: "upload",
    format: asset.format,
    force_version: false,
  });
};

// Turns a saved delivery URL back into its Cloudinary public id, for example
// https://res.cloudinary.com/<cloud>/image/upload/servana/vendors/<id>/cover/abc.jpg
// becomes servana/vendors/<id>/cover/abc.
const publicIdFromUrl = (deliveryUrl) => {
  const marker = "/image/upload/";
  const index =
    typeof deliveryUrl === "string" ? deliveryUrl.indexOf(marker) : -1;
  if (index === -1) return null;

  return (
    deliveryUrl
      .slice(index + marker.length)
      .replace(/\.(?:jpe?g|png|webp)$/, "") || null
  );
};

// Removes a photo file from Cloudinary after the database change is saved.
// Best effort: if Cloudinary is down, the photo is already gone from the
// profile, so we log it instead of failing the vendor's request.
const destroyAsset = async (deliveryUrl) => {
  const publicId = publicIdFromUrl(deliveryUrl);

  // Only ever delete files inside the vendor folders this app created.
  if (!publicId || !publicId.startsWith("servana/vendors/")) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (error) {
    console.error(
      `Cloudinary cleanup failed for ${publicId}:`,
      error?.message || error,
    );
  }
};

export const confirmVendorUpload = async (profileId, kind, publicId) => {
  const url = await verifiedAssetUrl(profileId, kind, publicId);
  let replacedUrl = null;

  const snapshot = await prisma.$transaction(
    async (tx) => {
      await lockPhotoProfile(tx, profileId);
      if (kind === "portfolio") {
        const images = await tx.portfolioImage.findMany({
          where: { profileId },
          select: { id: true, url: true, sortOrder: true },
        });
        const assetIdentity = (deliveryUrl) =>
          deliveryUrl.replace(/\.(?:jpe?g|png|webp)$/, "");
        if (
          !images.some(
            (image) => assetIdentity(image.url) === assetIdentity(url),
          )
        ) {
          if (images.length >= max_portfolio_image) throw portfolioLimit();
          const sortOrder = images.reduce(
            (next, image) => Math.max(next, image.sortOrder + 1),
            0,
          );
          await tx.portfolioImage.create({
            data: { profileId, url, sortOrder },
          });
        }
      } else {
        const column = kind === "cover" ? "coverImageUrl" : "profileImageUrl";
        const current = await tx.vendorProfile.findUnique({
          where: { id: profileId },
          select: { [column]: true },
        });
        if (current?.[column] && current[column] !== url) {
          replacedUrl = current[column];
        }
        await tx.vendorProfile.update({
          where: { id: profileId },
          data: { [column]: url },
        });
      }
      return photoSnapshot(tx, profileId, kind);
    },
    { isolationLevel: "ReadCommitted" },
  );

  if (replacedUrl) await destroyAsset(replacedUrl);
  return snapshot;
};

export const removePortfolioImage = async (profileId, imageId) => {
  let removedUrl = null;

  const snapshot = await prisma.$transaction(
    async (tx) => {
      await lockPhotoProfile(tx, profileId);
      const image = await tx.portfolioImage.findFirst({
        where: { id: imageId, profileId },
        select: { id: true, url: true },
      });
      if (!image) {
        throw httpError(404, "IMAGE_NOT_FOUND", "Portfolio image not found.");
      }
      const profile = await tx.vendorProfile.findUnique({
        where: { id: profileId },
        select: { status: true },
      });
      const count = await tx.portfolioImage.count({
        where: { profileId },
      });
      if (["pending", "approved"].includes(profile.status) && count <= 1) {
        throw httpError(
          409,
          "PORTFOLIO_IMAGE_REQUIRED",
          "Add another portfolio image before removing the last one.",
        );
      }
      await tx.portfolioImage.delete({ where: { id: image.id } });
      removedUrl = image.url;
      return photoSnapshot(tx, profileId, "portfolio");
    },
    { isolationLevel: "ReadCommitted" },
  );

  // After the delete is saved, so a Cloudinary hiccup cannot undo it.
  await destroyAsset(removedUrl);

  return snapshot;
};
