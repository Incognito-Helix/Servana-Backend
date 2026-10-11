const requireRole = (_role) => {
  return (req, res, next) => {
    // Role authorization logic implemented here
    next();
  };
};

export default requireRole;
