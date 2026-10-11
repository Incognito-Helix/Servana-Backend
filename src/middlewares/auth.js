import jwt from "jsonwebtoken";
import { verifyToken } from "../services/token.service.js";

const unauthorized = (message, code = "UNAUTHORIZED") => {
  const error = new Error(message);
  error.status = 401;
  error.code = code;
  return error;
};

const auth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("Authentication required."));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(unauthorized("Session expired.", "TOKEN_EXPIRED"));
    }
    next(unauthorized("Invalid token."));
  }
};

export default auth;
