
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";

const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      acceptedTerms,
    } = req.body;

    const normalizedEmail = email;
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    // Check whether the email already exists.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Hash the password before saving it.
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        passwordHash,
        role,
        emailVerified: false,
        termsVersion: process.env.TERMS_VERSION || "1.0",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please verify your email.",
      data: { user },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return next(error);
  }
};

export default register;
