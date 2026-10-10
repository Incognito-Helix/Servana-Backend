
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const error = new Error("Invalid email or password.");
      error.status = 401;
      error.code = "INVALID_CREDENTIALS";
      return next(error);
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      const error = new Error("Invalid email or password.");
      error.status = 401;
      error.code = "INVALID_CREDENTIALS";
      return next(error);
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export default login;
