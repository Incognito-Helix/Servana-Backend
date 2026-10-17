import crypto from "node:crypto";
import { sendEmail } from "../services/email.service.js";
import prisma from "../config/prisma.js";

const OTP_EXPIRY_MINUTES = 10;

const sendMessage = (status, code, message, fieldErrors) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const sendEmailOtp = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email)
      return next(sendMessage(400, "VALIDATION_ERROR", "Email is required."));

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If the account exists, a verification code will be sent.",
      });
    }

    if (user.emailVerified)
      return next(
        sendMessage(
          409,
          "EMAIL_ALREADY_VERIFIED",
          "Email is already verified.",
        ),
      );

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Invalidate previous unused email OTPs for this user.
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          type: "email_otp",
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      await tx.authToken.create({
        data: {
          userId: user.id,
          type: "email_otp",
          tokenHash: otpHash,
          expiresAt,
        },
      });
    });

    sendEmail({
      to: user.email,
      subject: "Verify your Servana email",
      text: `Your Servana verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your Servana verification code is:</p><h2>${otp}</h2><p>This code expires in 10 minutes. Do not share it with anyone.</p>`,
    });

    return res.status(200).json({
      success: true,
      message: "If the account exists, a verification code will be sent.",
    });
  } catch (error) {
    return next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp;

    if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp))
      return next(
        sendMessage(
          400,
          "VALIDATION_ERROR",
          "A valid email and six-digit OTP are required.",
        ),
      );

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user)
      return next(
        sendMessage(
          400,
          "INVALID_OTP",
          "Invalid or expired verification code.",
        ),
      );

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified.",
      });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const token = await tx.authToken.findFirst({
        where: {
          userId: user.id,
          type: "email_otp",
          tokenHash: otpHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!token) return false;

      const consumed = await tx.authToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) return false;

      await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });

      return true;
    });

    if (!result)
      return next(
        sendMessage(
          400,
          "INVALID_OTP",
          "Invalid or expired verification code.",
        ),
      );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

export { sendEmailOtp, verifyEmail };
