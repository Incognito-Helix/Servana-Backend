import jwt from "jsonwebtoken";
import { verifyToken } from "../services/token.service.js";

const unauthorized = (message, code = "UNAUTHORIZED") => {
  const error = new Error(message);
  error.status = 401;
  error.code = code;
  return error;
};

const auth = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(unauthorized("aunthentication required"));
  }

  const token = authorization.split(" ")[1];
  if (!token) return next(unauthorized("authentication token is requried"));

  try {
    const decoded = verifyToken(token);

    if (!decoded.userId || !decoded.role)
      return next(unauthorized("invalid token"));

    req.user = { id: decoded.userId, role: decoded.role };
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(
        unauthorized("Authentication token has expired.", "TOKEN_EXPIRED"),
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(
        unauthorized("Invalid authentication token.", "INVALID_TOKEN"),
      );
    }
  }
};


export default auth;