import Joi from "joi";

const csrfSchema = Joi.object({
  "x-csrf-token": Joi.string().trim().min(1).required(),
});

export default csrfSchema;
