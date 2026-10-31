import Joi from "joi";
import { LAGOS_BOUNDS } from "./vendor.validator.js";

const options = { abortEarly: false, stripUnknown: true };

const slugField = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60)
  .messages({
    "string.pattern.base":
      "Slug can only use lowercase letters, numbers and single dashes.",
    "string.max": "Slug must not exceed 60 characters.",
  });

const nameField = Joi.string().trim().min(2).max(60).messages({
  "string.empty": "Name is required.",
  "string.min": "Name must be at least 2 characters long.",
  "string.max": "Name must not exceed 60 characters.",
  "any.required": "Name is required.",
});

const iconField = Joi.string().trim().max(100).allow("", null).messages({
  "string.max": "Icon must not exceed 100 characters.",
});

// Vendor: pick one primary service and up to 3 others (PRD 4.2).
export const vendorCategoriesSchema = Joi.object({
  primaryCategoryId: Joi.string().uuid().required().messages({
    "string.guid": "Primary service is not valid.",
    "any.required": "Choose your primary service.",
  }),
  otherCategoryIds: Joi.array()
    .items(Joi.string().uuid())
    .max(3)
    .unique()
    .default([])
    .messages({
      "array.max": "You can add up to 3 other services.",
      "array.unique": "Each service can only be chosen once.",
      "string.guid": "Service is not valid.",
    }),
}).options(options);

export const createCategorySchema = Joi.object({
  name: nameField.required(),
  slug: slugField,
  icon: iconField,
  // Empty for a top level group, or the group this service belongs to.
  parentId: Joi.string().uuid().allow(null).messages({
    "string.guid": "Parent category is not valid.",
  }),
}).options(options);

export const updateCategorySchema = Joi.object({
  name: nameField,
  icon: iconField,
  isActive: Joi.boolean().messages({
    "boolean.base": "isActive must be true or false.",
  }),
})
  .min(1)
  .messages({ "object.min": "Send at least one field to update." })
  .options(options);

const latitudeField = Joi.number()
  .min(LAGOS_BOUNDS.minLat)
  .max(LAGOS_BOUNDS.maxLat)
  .messages({
    "number.base": "Latitude must be a number.",
    "number.min": "Location must be inside Lagos.",
    "number.max": "Location must be inside Lagos.",
    "any.required": "Latitude is required.",
  });

const longitudeField = Joi.number()
  .min(LAGOS_BOUNDS.minLng)
  .max(LAGOS_BOUNDS.maxLng)
  .messages({
    "number.base": "Longitude must be a number.",
    "number.min": "Location must be inside Lagos.",
    "number.max": "Location must be inside Lagos.",
    "any.required": "Longitude is required.",
  });

const multiplierField = Joi.number().min(0.1).max(10).precision(2).messages({
  "number.base": "Price multiplier must be a number.",
  "number.min": "Price multiplier must be at least 0.1.",
  "number.max": "Price multiplier must not exceed 10.",
});

const placeField = (label) =>
  Joi.string()
    .trim()
    .min(2)
    .max(60)
    .messages({
      "string.min": `${label} must be at least 2 characters long.`,
      "string.max": `${label} must not exceed 60 characters.`,
    });

export const createZoneSchema = Joi.object({
  name: nameField.required(),
  slug: slugField,
  state: placeField("State").default("Lagos"),
  city: placeField("City").default("Lagos"),
  centerLatitude: latitudeField.required(),
  centerLongitude: longitudeField.required(),
  boostPriceMultiplier: multiplierField.default(1),
}).options(options);

export const updateZoneSchema = Joi.object({
  name: nameField,
  state: placeField("State"),
  city: placeField("City"),
  centerLatitude: latitudeField,
  centerLongitude: longitudeField,
  boostPriceMultiplier: multiplierField,
  isActive: Joi.boolean().messages({
    "boolean.base": "isActive must be true or false.",
  }),
})
  .min(1)
  .messages({ "object.min": "Send at least one field to update." })
  .options(options);

export const updateBoostPriceSchema = Joi.object({
  type: Joi.string().valid("zone_boost", "top_spot").required().messages({
    "any.only": "Type must be zone_boost or top_spot.",
    "any.required": "Type is required.",
  }),
  durationType: Joi.string()
    .valid("daily", "weekly", "monthly")
    .required()
    .messages({
      "any.only": "Duration must be daily, weekly or monthly.",
      "any.required": "Duration is required.",
    }),
  // Kobo, so ₦500 is 50000.
  priceKobo: Joi.number()
    .integer()
    .min(100)
    .max(100000000)
    .required()
    .messages({
      "number.base": "Price must be a number.",
      "number.integer": "Price must be a whole number of kobo.",
      "number.min": "Price must be at least ₦1 (100 kobo).",
      "number.max": "Price is too large.",
      "any.required": "Price is required.",
    }),
}).options(options);
