import Joi from "joi";

const googleSchema = Joi.object({
  idToken: Joi.string().trim().required().messages({
    "string.empty": "Google token is required.",
    "any.required": "Google token is required.",
  }),

  role: Joi.string().valid("customer", "vendor").messages({
    "any.only": "Role must be customer or vendor.",
  }),

  acceptedTerms: Joi.boolean().valid(true).messages({
    "any.only": "You must accept the terms and conditions.",
  }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

export default googleSchema;
