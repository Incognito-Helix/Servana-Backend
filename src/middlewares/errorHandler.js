const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "request body is not a valid json",
        fieldErrors: {},
      },
    });
  }

  const status = err.status || err.statusCode || 500;

  const code =
    err.code || (status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR");

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
