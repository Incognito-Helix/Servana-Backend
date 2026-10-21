import Joi from "joi";

const searchQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    "number.base": "Latitude must be a number.",
    "number.min": "Latitude must be between -90 and 90.",
    "number.max": "Latitude must be between -90 and 90.",
    "any.required": "Latitude is required.",
  }),

  longitude: Joi.number().min(-180).max(180).required().messages({
    "number.base": "Longitude must be a number.",
    "number.min": "Longitude must be between -180 and 180.",
    "number.max": "Longitude must be between -180 and 180.",
    "any.required": "Longitude is required.",
  }),

  categoryId: Joi.string().trim().min(1).optional(),

  serviceId: Joi.string().trim().min(1).optional(),

  page: Joi.number().integer().min(1).default(1),

  radius: Joi.number().positive().max(50).default(10),
  limit: Joi.number().integer().min(1).max(50).default(20),
}).unknown(false);

export default searchQuerySchema;
