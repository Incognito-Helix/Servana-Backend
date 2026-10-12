import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";

const sendError = (next, message, statusCode, code, fieldErrors = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return next(error);
};

const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, acceptedTerms } =
      req.body;

    // Normalize registration data.
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    // Confirm that the user accepted the terms.
    if (acceptedTerms !== true) {
      return sendError(
        next,
        "You must accept the terms and conditions.",
        400,
        "VALIDATION_ERROR",
        { acceptedTerms: "You must accept the terms and conditions." },
      );
    }

    // Check whether the email already exists.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return sendError(
        next,
        "Email is already registered.",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    // bcrypt only processes up to 72 bytes.
    if (Buffer.byteLength(password, "utf8") > 72) {
      return sendError(
        next,
        "Password must not exceed 72 bytes.",
        400,
        "VALIDATION_ERROR",
        { password: "Password must not exceed 72 bytes." },
      );
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
        termsVersion: process.env.TERMS_VERSION || "V1",
        termsAcceptedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        emailVerified: true,
        termsVersion: true,
        termsAcceptedAt: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please verify your email.",
      data: user,
    });
  } catch (error) {
    // Handle a concurrent registration with the same email.
    if (error.code === "P2002") {
      return sendError(
        next,
        "Email is already registered.",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    return next(error);
  }
};

export default register;
