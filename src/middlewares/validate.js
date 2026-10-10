const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const fieldErrors = {};

      error.details.forEach((detail) => {
        const field = detail.path.join(".");
        fieldErrors[field] = detail.message;
      });

      const validationError = new Error("Validation Error");
      validationError.status = 400;
      validationError.code = "VALIDATION_ERROR";
      validationError.fieldErrors = fieldErrors;

      return next(validationError);
    }

    // Replace the request body with Joi's validated and cleaned values.
    req.body = value;

    next();
  };
};

export default validate;
