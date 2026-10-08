const errorHandler = (err, req, res, next) => {
    console.error(err);

    res.status(err.status || 500).json({
        success: false,
        code: err.code || "INTERNAL_SERVER_ERROR",
        message: err.message || "Internal Server Error",
        fieldErrors: err.fieldErrors || {},
    });
};

export default errorHandler;