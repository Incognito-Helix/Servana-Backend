import Joi from "joi";

export const suggestQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(50).messages({
    "string.base": "Search text must be text.",
    "string.empty": "Search text cannot be empty.",
    "string.max": "Search text must be 50 characters or fewer.",
  }),

  latitude: Joi.number().min(-90).max(90).messages({
    "number.base": "Latitude must be a number.",
    "number.min": "Latitude must be between -90 and 90.",
    "number.max": "Latitude must be between -90 and 90.",
  }),

  longitude: Joi.number().min(-180).max(180).messages({
    "number.base": "Longitude must be a number.",
    "number.min": "Longitude must be between -180 and 180.",
    "number.max": "Longitude must be between -180 and 180.",
  }),
});

// Body for POST /locations/recent.
export const recentLocationSchema = Joi.object({
  zoneId: Joi.string().uuid().required().messages({
    "string.base": "Zone is not valid.",
    "string.empty": "Zone is required.",
    "string.guid": "Zone is not valid.",
    "any.required": "Zone is required.",
  }),
}).options({ abortEarly: false, stripUnknown: true });
