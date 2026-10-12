const requireOwnership = (getOwnerId) => {
  return async (req, res, next) => {
    // The auth middleware attaches the authenticated user to req.user.
    if (!req.user) {
      const error = new Error("Authentication required.");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    try {
      // Retrieve the resource owner's ID using the supplied function.
      const ownerId = await getOwnerId(req);

      if (ownerId == null) {
        const error = new Error("Resource not found.");
        error.status = 404;
        error.code = "NOT_FOUND";
        return next(error);
      }

      // Compare IDs as strings to handle numeric and string IDs safely.
      if (String(ownerId) !== String(req.user.id)) {
        const error = new Error(
          "You do not have permission to access this resource.",
        );
        error.status = 403;
        error.code = "FORBIDDEN";
        return next(error);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export default requireOwnership;
