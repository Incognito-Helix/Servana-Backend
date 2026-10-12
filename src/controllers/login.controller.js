import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import { signToken } from "../services/token.service.js";

const invalidCredentials = () => {
  const error = new Error("Invalid email or password.");
  error.status = 401;
  error.code = "INVALID_CREDENTIALS";
  return error;
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const passwordMatches = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      return next(invalidCredentials());
    }

    if (user.status === "suspended") {
      const error = new Error("This account has been suspended.");
      error.status = 403;
      error.code = "ACCOUNT_SUSPENDED";
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
