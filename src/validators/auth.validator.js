import Joi from "joi";

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),

  lastName: Joi.string().trim().min(2).max(50).required(),

  email: Joi.string().trim().lowercase().email().max(254).required(),

  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain an uppercase letter, a lowercase letter, a number, and a special character.",
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password must not exceed 72 characters.",
    }),
  role: Joi.string().valid("customer", "vendor").required(),

  acceptedTerms: Joi.boolean().valid(true).required(),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

export default registerSchema;
