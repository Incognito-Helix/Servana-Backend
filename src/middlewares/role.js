const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // The auth middleware should attach the authenticated user to req.user.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    next();
  };
};

export default requireRole;
