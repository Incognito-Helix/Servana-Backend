const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // The auth middleware should attach the authenticated user to req.user.
    if (!req.user) {
      const error = new Error("Authentication required.");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error(
        "you do not have permission to access this resource",
      );
      error.status = 403;
      error.code = "FORBIDDEN";
      return next(error);
    }

    return next();
  };
};

export default requireRole;
