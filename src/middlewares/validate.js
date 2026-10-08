const validate = (schema) => {
    return (req, res, next) => {
        const {error} = schema.validate(req.body, {
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

        next();
    };
};

export default validate;