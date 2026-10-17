import "dotenv/config";
const RESEND_URL = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendOnce = async ({ to, subject, html, text }) => {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-type": "application/json",
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
    const error = new Error(`Resend responded ${response.status}`);
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }
};

export const sendEmail = async (message) => {
  if (process.env.EMAIL_MODE === "log") {
    if (process.env.NODE_ENV === "production") {
      console.error("email_mode = log isnt adviced during production");
    } else {
      console.log(
        `[email:log] to=${message.to} subject="${message.subject}"\n${message.text}`,
      );
      return true;
    }
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.error("resend key is missing");
    return false;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await sendOnce(message);
      return true;
    } catch (error) {
      console.error(
        `Email attempt ${attempt} of ${MAX_ATTEMPTS} failed: ${error.message}`,
      );
      if (error.retryable === false) return false;
      if (attempt < MAX_ATTEMPTS) await wait(attempt * 1000);
    }
  }
  return false;
};
