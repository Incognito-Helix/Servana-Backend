import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";

const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    //Enforce normalization even if this controller is called without validation.
    const normalizedEmail = email.trim().toLowerCase();

    //Reject an email that already belongs to a user.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const error = new Error("Email is already registered.");
      error.status = 409;
      error.code = "EMAIL_ALREADY_EXISTS";
      return next(error);
    }

    //bcrypt only processes up to 72 bytes, so check the UTF-8 byte length.
    if (Buffer.byteLength(password, "utf8") > 72) {
      const error = new Error("Password must not exceed 72 bytes.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      error.fieldErrors = {
        password: "Password must not exceed 72 bytes.",
      };
      return next(error);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        termsVersion: "V1",
        termsAcceptedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        termsVersion: true,
        termsAcceptedAt: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      data: user,
    });
  } catch (error) {
    //Handle a concurrent registration that wins the unique email race.
    if (error.code === "P2002") {
      const conflictError = new Error("Email is already registered.");
      conflictError.status = 409;
      conflictError.code = "EMAIL_ALREADY_EXISTS";
      return next(conflictError);
    }
    return next(error);
  }
};

export default register;
