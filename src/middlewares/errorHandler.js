const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isParseError = err.type === "entity.parse.failed";

  // Parse errors echo the raw request body, so never log their message or stack.
  const logFields = {
    errType: err.type || err.name,
    code: err.code,
    status,
    errMessage: isParseError ? "invalid json body" : err.message,
    stack: isParseError ? undefined : err.stack,
  };

  if (req.log) {
    req.log.error(logFields, "request failed");
  } else {
    console.error("request failed", logFields);
  }

  if (isParseError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "request body is not a valid json",
        fieldErrors: {},
      },
    });
  }

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
