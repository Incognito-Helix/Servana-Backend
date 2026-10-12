
import Joi from "joi";

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(1).required().messages({
    "string.empty": "First name is required.",
    "any.required": "First name is required.",
  }),

  lastName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Last name is required.",
    "any.required": "Last name is required.",
  }),

  email: Joi.string().trim().email().lowercase().required().messages({
    "string.email": "Please provide a valid email address.",
    "string.empty": "Email is required.",
    "any.required": "Email is required.",
  }),

  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),

  role: Joi.string()
    .valid("customer", "vendor")
    .default("customer"),

  acceptedTerms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the terms and conditions.",
    "any.required": "You must accept the terms and conditions.",
  }),
});

export default registerSchema;
