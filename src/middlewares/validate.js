
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const fieldErrors = {};

    for (const detail of error.details) {
      const field = detail.path.join(".");

      if (!fieldErrors[field]) {
        fieldErrors[field] = detail.message;
      }
    }

    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Validation Error",
      fieldErrors,
    });
  }

  req.body = value;
  next();
};

export default validate;
