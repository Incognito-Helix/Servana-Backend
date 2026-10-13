import { verifyToken } from "../services/token.service.js";

// For public routes that show more to a logged in user. A missing, invalid
// or expired token is treated as logged out instead of an error.
const optionalAuth = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme === "Bearer" && token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.userId, role: payload.role };
    } catch {
      // Carry on as an anonymous visitor.
    }
  }

  next();
};

export default optionalAuth;
