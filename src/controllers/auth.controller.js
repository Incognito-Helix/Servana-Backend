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

    // Validate required fields.
    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    if (acceptedTerms !== true) {
      return res.status(400).json({
        success: false,
        message: "You must accept the terms and conditions.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    // Only permit public customer or vendor registration.
    const selectedRole = role || "customer";

    if (!["customer", "vendor"].includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role.",
      });
    }

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
        role: selectedRole,
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
      message: "Account created successfully. Please verify your email.",
      data: { user },
    });
  } catch (error) {
    // Handle duplicate emails, including concurrent registration attempts.
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