import crypto from "node:crypto";
import nodemailer from "nodemailer";
import prisma from "../config/prisma.js";

const OTP_EXPIRY_MINUTES = 10;

const sendEmailOtp = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Avoid revealing whether an email address has an account.
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If the account exists, a verification code will be sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(409).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !process.env.SMTP_FROM
    ) {
      throw new Error("Email service is not configured.");
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

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

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Verify your Servana email",
        text: `Your Servana verification code is ${otp}. It expires in 10 minutes.`,
        html: `<p>Your Servana verification code is:</p><h2>${otp}</h2><p>This code expires in 10 minutes. Do not share it with anyone.</p>`,
      });
    } catch (emailError) {
      // Invalidate the code if delivery fails.
      await prisma.authToken.updateMany({
        where: {
          userId: user.id,
          type: "email_otp",
          tokenHash: otpHash,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      throw emailError;
    }

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

    if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "A valid email and six-digit OTP are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
    }

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

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

export { sendEmailOtp, verifyEmail };
