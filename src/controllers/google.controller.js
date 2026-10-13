import prisma from "../config/prisma.js";
import { verifyGoogleToken } from "../services/google.service.js";
import { signToken } from "../services/token.service.js";

const sendError = (next, message, status, code, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return next(error);
};

const signedIn = (res, user, status = 200, message = "Login successful.") =>
  res.status(status).json({
    success: true,
    message,
    data: {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      token: signToken(user),
    },
  });

const suspended = (next) =>
  sendError(next, "This account has been suspended.", 403, "ACCOUNT_SUSPENDED");

const googleAuth = async (req, res, next) => {
  try {
    const { idToken, role, acceptedTerms } = req.body;
    const profile = await verifyGoogleToken(idToken);

    // 1. This Google account is already linked to a user.
    const linkedUser = await prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (linkedUser) {
      if (linkedUser.status === "suspended") return suspended(next);
      return signedIn(res, linkedUser);
    }

    // 2. An account with this email exists, so link it and sign in.
    const emailUser = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (emailUser) {
      if (emailUser.status === "suspended") return suspended(next);

      // The email already belongs to a different Google account.
      if (emailUser.googleId) {
        return sendError(
          next,
          "This email is linked to a different Google account.",
          409,
          "GOOGLE_ACCOUNT_MISMATCH",
        );
      }

      const data = { googleId: profile.googleId, emailVerified: true };

      // An unverified email could have been registered by someone else,
      // so drop its password when the accounts link.
      if (!emailUser.emailVerified) data.passwordHash = null;

      const updatedUser = await prisma.user.update({
        where: { id: emailUser.id },
        data,
      });

      return signedIn(res, updatedUser);
    }

    // 3. New user. Ask the frontend for a role first.
    if (!role) {
      return res.status(200).json({
        success: true,
        message: "Choose a role to finish creating your account.",
        data: {
          needsRole: true,
          profile: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
          },
        },
      });
    }

    if (acceptedTerms !== true) {
      return sendError(
        next,
        "You must accept the terms and conditions.",
        400,
        "VALIDATION_ERROR",
        { acceptedTerms: "You must accept the terms and conditions." },
      );
    }

    const newUser = await prisma.user.create({
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        googleId: profile.googleId,
        role,
        emailVerified: true,
        termsVersion: process.env.TERMS_VERSION || "V1",
        termsAcceptedAt: new Date(),
      },
    });

    return signedIn(res, newUser, 201, "Account created successfully.");
  } catch (error) {
    // Two requests created the same user at the same time.
    if (error.code === "P2002") {
      return sendError(
        next,
        "Account already exists. Please sign in again.",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    return next(error);
  }
};

export default googleAuth;
