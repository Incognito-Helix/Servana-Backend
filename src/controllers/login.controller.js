import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import { signToken } from "../services/token.service.js";

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

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      const error = new Error("Invalid email or password.");
      error.status = 401;
      error.code = "INVALID_CREDENTIALS";
      return next(error);
    }

    const token = signToken(user);

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
