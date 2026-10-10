import jwt from "jsonwebtoken";
import "dotenv/config";

const getSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET was not provided");

  return process.env.JWT_SECRET;
};

export const signToken = (user) => {
  jwt.sign({ userId: user.id, role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export const verifyToken = (token) => {
  jwt.verify(token, getSecret());
};
