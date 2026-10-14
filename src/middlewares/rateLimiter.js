import rateLimit from "express-rate-limit";

const createAuthLimiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
      },
    },
  });

export const loginLimiter = createAuthLimiter(
  5,
  "Too many login attempts. Please try again in 15 minutes.",
);

export const sendOtpLimiter = createAuthLimiter(
  3,
  "Too many OTP requests. Please try again in 15 minutes.",
);

export const verifyOtpLimiter = createAuthLimiter(
  5,
  "Too many OTP verification attempts. Please try again in 15 minutes.",
);

export const forgotPasswordLimiter = createAuthLimiter(
  3,
  "Too many password reset requests. Please try again in 15 minutes.",
);

export const resetPasswordLimiter = createAuthLimiter(
  5,
  "Too many password reset attempts. Please try again in 15 minutes.",
);
