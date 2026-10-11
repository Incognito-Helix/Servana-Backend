const errorHandler = (err, req, res, next) => {
  console.error(err);

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: status >= 500 ? "Internal Server Error" : err.message,
      fieldErrors: err.fieldErrors || {},
    },
  });
};

export default errorHandler;
