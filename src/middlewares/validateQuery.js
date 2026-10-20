const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    convert: true,
    stripUnknown: false,
  });

  if (error) {
    const fieldErrors = {};

    for (const detail of error.details) {
      const field = detail.path.join(".");

      if (!fieldErrors[field]) {
        fieldErrors[field] = detail.message;
      }
    }
    const validationError = new Error("Validation Error");
    validationError.status = 400;
    validationError.code = "VALIDATION_ERROR";
    validationError.fieldErrors = fieldErrors;

    return next(validationError);
  }

  req.validatedQuery = value;
  return next();
};

export default validateQuery;
