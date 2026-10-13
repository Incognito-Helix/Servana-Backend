import Joi from "joi";

// Rough bounding box around Lagos State. The demo only allows vendors here.
export const LAGOS_BOUNDS = {
  minLat: 6.3,
  maxLat: 6.75,
  minLng: 2.7,
  maxLng: 4.35,
};

const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_IN_TEXT = /(?:\+?\d[\s().-]?){10,}/;

// Accepts 0803..., 234803... and +234803..., and always returns +234803...
const nigerianPhone = (value, helpers) => {
  const compact = value.replace(/[\s().-]/g, "");
  const match = compact.match(/^(?:\+234|234|0)([789][01]\d{8})$/);
  return match ? `+234${match[1]}` : helpers.error("phone.invalid");
};

const noContactDetails = (value, helpers) =>
  EMAIL_IN_TEXT.test(value) || PHONE_IN_TEXT.test(value)
    ? helpers.error("about.contact")
    : value;

const phoneField = (label) =>
  Joi.string()
    .trim()
    .custom(nigerianPhone)
    .messages({
      "string.empty": `${label} is required.`,
      "phone.invalid": `${label} must be a valid Nigerian number, like 0803 123 4567 or +234 803 123 4567.`,
    });

const optionalText = (label, max) =>
  Joi.string()
    .trim()
    .max(max)
    .allow("", null)
    .messages({
      "string.max": `${label} must not exceed ${max} characters.`,
    });

const fields = {
  businessName: Joi.string().trim().min(2).max(80).messages({
    "string.empty": "Business name is required.",
    "string.min": "Business name must be at least 2 characters long.",
    "string.max": "Business name must not exceed 80 characters.",
  }),

  about: Joi.string()
    .trim()
    .max(500)
    .allow("", null)
    .custom(noContactDetails)
    .messages({
      "string.max": "About must not exceed 500 characters.",
      "about.contact": "About cannot contain phone numbers or email addresses.",
    }),

  phone: phoneField("Phone"),
  whatsapp: phoneField("WhatsApp"),

  state: optionalText("State", 60),
  city: optionalText("City", 60),
  streetAddress: optionalText("Street address", 200),

  zoneId: Joi.string().uuid().messages({
    "string.guid": "Zone is not valid.",
  }),

  latitude: Joi.number()
    .min(LAGOS_BOUNDS.minLat)
    .max(LAGOS_BOUNDS.maxLat)
    .messages({
      "number.base": "Latitude must be a number.",
      "number.min": "Location must be inside Lagos.",
      "number.max": "Location must be inside Lagos.",
    }),

  longitude: Joi.number()
    .min(LAGOS_BOUNDS.minLng)
    .max(LAGOS_BOUNDS.maxLng)
    .messages({
      "number.base": "Longitude must be a number.",
      "number.min": "Location must be inside Lagos.",
      "number.max": "Location must be inside Lagos.",
    }),

  offersHomeService: Joi.boolean().messages({
    "boolean.base": "Home service must be true or false.",
  }),

  serviceRadiusKm: Joi.number().integer().min(1).max(50).messages({
    "number.base": "Travel radius must be a number.",
    "number.integer": "Travel radius must be a whole number of kilometres.",
    "number.min": "Travel radius must be at least 1 km.",
    "number.max": "Travel radius must not exceed 50 km.",
  }),

  onboardingStep: Joi.number().integer().min(1).max(6).messages({
    "number.base": "Onboarding step must be a number.",
    "number.integer": "Onboarding step must be a whole number.",
    "number.min": "Onboarding step must be between 1 and 6.",
    "number.max": "Onboarding step must be between 1 and 6.",
  }),
};

const options = { abortEarly: false, stripUnknown: true };

// Rules that look at several fields together (home service needs a radius,
// latitude and longitude come as a pair) live in the service, because on an
// update they depend on what is already saved.
export const createVendorProfileSchema = Joi.object({
  ...fields,
  businessName: fields.businessName.required().messages({
    "any.required": "Business name is required.",
  }),
}).options(options);

export const updateVendorProfileSchema = Joi.object(fields).options(options);
