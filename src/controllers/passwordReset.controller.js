import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { sendEmail } from "../services/email.service.js";
import prisma from "../config/prisma.js";

const RESET_TOKEN_EXPIRY_MINUTES = 10;

const genericResponse = {
  success: true,
  message:
    "If an account exists for that email, password reset instructions will be sent.",
};

const sendMessage = (status, code, message, fieldErrors) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return res.status(200).json(genericResponse);
    }

    if (!process.env.FRONTEND_URL) {
      throw new Error("FRONTEND_URL is not configured");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    );

    await prisma.$transaction(async (tx) => {
      await tx.authToken.updateMany({
        where: { userId: user.id, type: "password_reset", usedAt: null },
        data: { usedAt: now },
      });

      await tx.authToken.create({
        data: { userId: user.id, type: "password_reset", tokenHash, expiresAt },
      });
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    sendEmail({
      to: user.email,
      subject: "Reset your Servana password",
      text: `Use this link to reset your Servana password: ${resetLink}\n\nThis link expires in 10 minutes. If you did not request a reset, you can ignore this email.`,
      html: `
    <p>We received a request to reset your Servana password.</p>
    <p><a href="${resetLink}">Reset your password</a></p>
    <p>This link expires in 10 minutes. If you did not request a reset, you can ignore this email.</p>
  `,
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Match the byte limit enforced by bcrypt.
    if (Buffer.byteLength(password, "utf8") > 72) {
      return next(
        sendMessage(
          400,
          "VALIDATION_ERROR",
          "Password must not exceed 72 bytes.",
          {
            password: "Password must not exceed 72 bytes.",
          },
        ),
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        const resetRecord = await tx.authToken.findFirst({
          where: {
            type: "password_reset",
            tokenHash,
            usedAt: null,
            expiresAt: { gt: now },
          },
        });

        if (!resetRecord) {
          return false;
        }

        const consumed = await tx.authToken.updateMany({
          where: {
            id: resetRecord.id,
            type: "password_reset",
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });

        if (consumed.count !== 1) {
          return false;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await tx.user.update({
          where: { id: resetRecord.userId },
          data: { passwordHash },
        });

        // Invalidate any other outstanding reset tokens for this user.
        await tx.authToken.updateMany({
          where: {
            userId: resetRecord.userId,
            type: "password_reset",
            usedAt: null,
          },
          data: { usedAt: now },
        });

        return true;
      },
      {
        maxwait: 10000,
        timeout: 20000,
      },
    );

    if (!result) {
      return next(
        sendMessage(
          400,
          "INVALID_RESET_TOKEN",
          "Invalid or expired password reset token.",
        ),
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
};

export { forgotPassword, resetPassword };
