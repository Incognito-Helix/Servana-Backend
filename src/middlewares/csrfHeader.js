import csrfSchema from "../validators/csrf.validator.js";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

const csrfHeader = (req, res, next) => {
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }
  const { error } = csrfSchema.validate(req.headers, {
    abortEarly: false,
  });

  if (error) {
    return res.status(403).json({
      success: false,
      error: {
        code: "CSRF_HEADER_MISSING",
        message: "Required CSRF header is missing or invalid.",
      },
    });
  }
  return next();
};

export default csrfHeader;
