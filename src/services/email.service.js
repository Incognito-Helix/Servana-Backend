import "dotenv/config";

const RESEND_URL = "https://api.resend.com/emails";

const sendOnce = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    const error = new Error("Resend email configuration is missing.");
    error.retryable = false;
    throw error;
  }

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const error = new Error(`Resend responded with status ${response.status}.`);
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }

  return true;
};

export const sendEmail = async (message) => {
  if (process.env.EMAIL_MODE === "log") {
    if (process.env.NODE_ENV === "production") {
      const error = new Error(
        "EMAIL_MODE=log is not permitted in production.",
      );
      error.retryable = false;
      throw error;
    }

    console.log(
      `[email:log] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );

    return true;
  }
  return sendOnce(message);
};