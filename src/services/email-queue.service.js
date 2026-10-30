import "dotenv/config";
import { PgBoss } from "pg-boss";
import { sendEmail } from "./email.service.js";

export const EMAIL_QUEUE = "servana-email";

const MAX_RETRIES = 2;

let boss;

export const startEmailQueue = async () => {
  if (boss) return boss;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to start the email queue.");
  }

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
  });

  boss.on("error", (error) => {
    console.error("[email-queue] pg-boss error:", error);
  });

  try {
    await boss.start();

    await boss.createQueue(EMAIL_QUEUE, {
      retryLimit: MAX_RETRIES,
      retryDelay: 1,
      retryBackoff: true,
      retryDelayMax: 60,
    });

    await boss.work(EMAIL_QUEUE, async ([job]) => {
      try {
        await sendEmail(job.data);
        console.log(`[email-queue] Email job ${job.id} completed.`);
      } catch (error) {
        console.error(
          `[email-queue] Email job ${job.id} failed:`,
          error.message,
        );

        throw error;
      }
    });

    console.log("[email-queue] Worker started.");

    return boss;
  } catch (error) {
    await boss.stop().catch(() => {});
    boss = undefined;
    throw error;
  }
};

export const enqueueEmail = async (message) => {
  if (!boss) {
    throw new Error("Email queue has not been started.");
  }

  return boss.send(EMAIL_QUEUE, message);
};

export const stopEmailQueue = async () => {
  if (!boss) return;

  const currentBoss = boss;
  boss = undefined;

  await currentBoss.stop();
  console.log("[email-queue] Worker stopped.");
};