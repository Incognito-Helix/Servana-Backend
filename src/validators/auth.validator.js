import Joi from "joi";

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 2 characters long.",
    "string.max": "First name must not exceed 50 characters.",
    "any.required": "First name is required.",
  }),

  lastName: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Last name is required.",
    "string.min": "Last name must be at least 2 characters long.",
    "string.max": "Last name must not exceed 50 characters.",
    "any.required": "Last name is required.",
  }),

  email: Joi.string().trim().lowercase().email().max(254).required().messages({
    "string.email": "Please provide a valid email address.",
    "string.max": "Email must not exceed 254 characters.",
    "string.empty": "Email is required.",
    "any.required": "Email is required.",
  }),

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
      "any.required": "Password is required.",
    }),

  role: Joi.string().valid("customer", "vendor").default("customer"),

  acceptedTerms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the terms and conditions.",
    "any.required": "You must accept the terms and conditions.",
  }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

export default registerSchema;
