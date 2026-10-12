const errorHandler = (err, req, res, next) => {
  console.error(err);

  const status = err.status || err.statusCode || 500;

  const code =
    err.code ||
    (status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR");

  res.status(status).json({
    success: false,
    error: {
      code,
      message: status >= 500 ? "Internal Server Error" : err.message,
      fieldErrors: err.fieldErrors || {},
    },
  });
};

export default errorHandler;