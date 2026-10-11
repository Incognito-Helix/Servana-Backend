import jwt from "jsonwebtoken";
import { verifyToken } from "../services/token.service.js";

const unauthorized = (message, code = "UNAUTHORIZED") => {
  const error = new Error(message);
  error.status = 401;
  error.code = code;
  return error;
};

const auth = (req, res, next) => {
  //Authentication will be implemented here
  next();
};

export default auth;
