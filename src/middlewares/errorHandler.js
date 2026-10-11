
const errorHandler = (err, req, res, next) => {
  console.error(err);

  const status = err.status || 500;

  const code =
    err.code ||
    (status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR");

  res.status(status).json({
    success: false,
    code,
    message: err.message || "Internal server error",
    fieldErrors: err.fieldErrors || {},
  });
};

export default errorHandler;

