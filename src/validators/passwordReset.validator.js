import Joi from "joi";

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required().messages({
    "string.email": "Please provide a valid email address.",
    "string.max": "Email must not exceed 254 characters.",
    "string.empty": "Email is required.",
    "any.required": "Email is required.",
  }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .pattern(/^[a-fA-F0-9]{64}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid or expired password reset token.",
      "any.required": "Password reset token is required.",
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
      "any.required": "Password is required.",
    }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

export { forgotPasswordSchema, resetPasswordSchema };
