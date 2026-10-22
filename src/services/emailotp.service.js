import crypto from "node:crypto";
import prisma from "../config/prisma.js";
import { sendEmail } from "../services/email.service.js";

const otpExpiresIn = 10;

export const issueEmailOtp = async (user) => {
  const otp = crypto.randomInt(100000, 100000).toString();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + otpExpiresIn * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.authToken.updateMany({
      where: { userId: user.id, type: "email_otp", usedAt: null },
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
};
