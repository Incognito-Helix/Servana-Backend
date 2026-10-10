const requireOwnership = (getOwnerId) => {
  return async (req, res, next) => {
    // The auth middleware should attach the authenticated user to req.user.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    try {
      // Retrieve the resource owner's ID using the supplied function.
      const ownerId = await getOwnerId(req);

      if (ownerId == null) {
        return res.status(404).json({
          success: false,
          message: "Resource not found.",
        });
      }

      // Compare IDs as strings to handle numeric and string IDs safely.
      if (String(ownerId) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource.",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default requireOwnership;
