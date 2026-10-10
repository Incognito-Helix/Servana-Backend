import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication required.");
    error.status = 401;
    error.code = "UNAUTHORIZED";
    return next(error);
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    const error = new Error("Authentication token is required.");
    error.status = 401;
    error.code = "UNAUTHORIZED";
    return next(error);
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is not configured."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (typeof decoded === "string" || !decoded.userId || !decoded.role) {
      const error = new Error("Invalid authentication token.");
      error.status = 401;
      error.code = "INVALID_TOKEN";
      return next(error);
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    return next();
  } catch {
    const error = new Error("Invalid or expired authentication token.");
    error.status = 401;
    error.code = "INVALID_TOKEN";
    return next(error);
  }
};

export default auth;
