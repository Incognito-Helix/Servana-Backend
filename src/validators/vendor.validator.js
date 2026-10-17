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

const SOCIAL_PLATFORMS = ["instagram", "tiktok", "x", "facebook", "other"];

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
  socialLinks: Joi.array()
    .max(5)
    .items(
      Joi.object({
        platform: Joi.string()
          .valid(...SOCIAL_PLATFORMS)
          .required()
          .messages({
            "any.only": "Choose a supported social platform.",
            "any.required": "Social platform is required.",
          }),
        url: Joi.string()
          .trim()
          .uri({ scheme: ["http", "https"] })
          .required()
          .messages({
            "string.uri": "Social link must be a valid HTTP or HTTPS URL.",
            "any.required": "Social link URL is required.",
          }),
      }).unknown(false),
    )
    .unique("platform")
    .messages({
      "array.max": "You can add a maximum of 5 social links.",
      "array.unique": "Each social platform can only be added once.",
    }),

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
  worksRemotely: Joi.boolean().messages({
    "boolean.base": "works remotely must be true or false",
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

export const submitVendorProfileSchema = Joi.object({
  onboardingStep: Joi.number().valid(6).required().messages({
    "any.required": "Complete all onboarding steps before submitting.",
    "number.base": "Onboarding step must be a number.",
    "any.only": "Complete all onboarding steps before submitting.",
  }),
}).options(options);

const serviceFields = {
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Service name is required.",
    "string.min": "Service name must be at least 2 characters long.",
    "string.max": "Service name must not exceed 100 characters.",
    "any.required": "Service name is required.",
  }),

  priceMin: Joi.number().integer().min(0).required().messages({
    "number.base": "Minimum price must be a number.",
    "number.integer": "Minimum price must be a whole number.",
    "number.min": "Minimum price cannot be negative.",
    "any.required": "Service name is required.",
  }),

  priceMax: Joi.number().integer().min(0).allow(null).messages({
    "number.base": "Maximum price must be a number.",
    "number.integer": "Maximum price must be a whole number.",
    "number.min": "Maximum price cannot be negative.",
  }),

  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Service description must not exceed 500 characters.",
  }),
};

export const createServiceSchema = Joi.object(serviceFields)
  .fork(["priceMax"], (schema) => schema.optional())
  .custom((value, helpers) => {
    if (value.priceMax != null && value.priceMax < value.priceMin) {
      return helpers.error("service.priceRange");
    }
    return value;
  })
  .messages({
    "Service.priceRange":
      "Maximum price must be greater than or equal to minimum price.",
  })
  .options(options);

export const updateServiceSchema = Joi.object(serviceFields)
  .fork(["name", "priceMin"], (schema) => schema.optional())
  .min(1)
  .custom((value, helpers) => {
    if (
      value.priceMin !== undefined &&
      value.priceMax != null &&
      value.priceMax < value.priceMin
    ) {
      return helpers.error("service.priceRange");
    }

    return value;
  })
  .messages({
    "service.priceRange":
      "Maximum price must be greater than or equal to minimum price.",
  })
  .options(options);

const workingHoursFields = {
  dayOfWeek: Joi.number().integer().min(0).max(6).required().messages({
    "number.base": "Day of week must be a number.",
    "number.integer": "Day of week must be a whole number.",
    "number.min": "Day of week must be between 0 and 6.",
    "number.max": "Day of week must be between 0 and 6.",
    "any.required": "Day of week is required.",
  }),

  openTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .allow(null)
    .messages({
      "string.pattern.base": "Opening time must use HH:mm format.",
    }),

  closeTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .allow(null)
    .messages({
      "string.pattern.base": "Closing time must use HH:mm format.",
    }),

  isClosed: Joi.boolean().default(false),
};

export const workingHoursSchema = Joi.object(workingHoursFields)
  .custom((value, helpers) => {
    if (value.isClosed) {
      return value;
    }

    if (!value.openTime || !value.closeTime) {
      return helpers.error("workingHours.timeRequired");
    }

    if (value.openTime >= value.closeTime) {
      return helpers.error("workingHours.invalidRange");
    }

    return value;
  })
  .messages({
    "workingHours.timeRequired":
      "Opening and closing times are required when the vendor is open.",
    "workingHours.invalidRange":
      "Closing time must be later than opening time.",
  })
  .options(options);

export const workingHoursListSchema = Joi.array()
  .items(workingHoursSchema)
  .min(1)
  .max(7)
  .unique("dayOfWeek")
  .messages({
    "array.min": "At least one working-hours entry is required.",
    "array.max": "Working hours cannot contain more than seven entries.",
    "array.unique": "Each day of the week can only appear once.",
  });

export const signUploadSchema = Joi.object({
  kind: Joi.string()
    .valid("cover", "profile", "portfolio")
    .required()
    .messages({
      "any.only": "kind must be cover, profile or portfolio",
      "any.required": "kind is required",
    }),
}).optional(options);
