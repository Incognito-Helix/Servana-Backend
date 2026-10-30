import cron from "node-cron";
import prisma from "../config/prisma.js";
import { sendEmail } from "./email.service.js";
import { failAbandonedPayments } from "./payment.service.js";

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_WINDOW_HOURS = 24;
const CLAIM_LEASE_MINUTES = 10;
const DEFAULT_PENDING_TTL_HOURS = 48;

const getPendingTtlHours = () => {
  const value = Number(process.env.BOOST_PENDING_TTL_HOURS);

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_PENDING_TTL_HOURS;
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);

export const expireBoosts = async (now = new Date()) => {
  const result = await prisma.boost.updateMany({
    where: {
      status: "active",
      endAt: { lte: now },
    },
    data: { status: "expired" },
  });

  return result.count;
};

export const cancelStalePendingBoosts = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - getPendingTtlHours() * HOUR_MS);

  const result = await prisma.boost.updateMany({
    where: {
      status: "pending",
      createdAt: { lte: cutoff },
    },
    data: { status: "cancelled" },
  });

  return result.count;
};

export const sendBoostExpiryReminders = async (now = new Date()) => {
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * HOUR_MS);
  const claimCutoff = new Date(now.getTime() - CLAIM_LEASE_MINUTES * 60 * 1000);

  const candidates = await prisma.boost.findMany({
    where: {
      status: "active",
      endAt: { gt: now, lte: windowEnd },
      reminderSentAt: null,
      OR: [
        { reminderClaimedAt: null },
        { reminderClaimedAt: { lt: claimCutoff } },
      ],
    },
    include: {
      profile: {
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const boost of candidates) {
    //Automatically claim this reminder so concurrent runs do not send both.
    const claim = await prisma.boost.updateMany({
      where: {
        id: boost.id,
        status: "active",
        reminderSentAt: null,
        OR: [
          { reminderClaimedAt: null },
          { reminderClaimedAt: { lt: claimCutoff } },
        ],
      },
      data: { reminderClaimedAt: now },
    });

    if (claim.count !== 1) {
      skipped += 1;
      continue;
    }

    const email = boost.profile?.user?.email;

    if (!email) {
      await prisma.boost.updateMany({
        where: { id: boost.id, reminderSentAt: null },
        data: { reminderClaimedAt: null },
      });
      failed += 1;
      continue;
    }

    const name = boost.profile.user.firstName || "there";
    const subject = "Your Servana boost expires soon";
    const expiry = formatDate(boost.endAt);
    const text =
      `Hi ${name},\n\n` +
      `Your ${boost.type} boost is scheduled to expire on ${expiry} ` +
      `(West Africa Time).\n\n` +
      "You can visit Servana to review your boost options.\n\n" +
      "The Servana team";

    try {
      const delivered = await sendEmail({
        to: email,
        subject,
        text,
        html: `<p>Hi ${name},</p>
          <p>Your <strong>${boost.type}</strong> boost is scheduled to
          expire on ${expiry} (West Africa Time).</p>
          <p>You can visit Servana to review your boost options.</p>
          <p>The Servana team</p>`,
      });

      if (!delivered) {
        await prisma.boost.updateMany({
          where: {
            id: boost.id,
            reminderSentAt: null,
            reminderClaimedAt: now,
          },
          data: { reminderClaimedAt: null },
        });
        failed += 1;
        continue;
      }

      const marked = await prisma.boost.updateMany({
        where: {
          id: boost.id,
          status: "active",
          reminderSentAt: null,
          reminderClaimedAt: now,
        },
        data: {
          reminderSentAt: new Date(),
          reminderClaimedAt: null,
        },
      });

      if (marked.count === 1) {
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      await prisma.boost.updateMany({
        where: {
          id: boost.id,
          reminderSentAt: null,
          reminderClaimedAt: now,
        },
        data: { reminderClaimedAt: null },
      });

      failed += 1;
      console.error(
        `Failed to process expiry reminder for boost ${boost.id}:`,
        error.message,
      );
    }
  }

  return { candidates: candidates.length, sent, failed, skipped };
};

export const runBoostMaintenance = async (now = new Date()) => {
  const expired = await expireBoosts(now);
  const cancelled = await cancelStalePendingBoosts(now);
  const failedPayments = await failAbandonedPayments();
  const reminders = await sendBoostExpiryReminders(now);

  return { expired, cancelled, failedPayments, reminders };
};

export const startBoostScheduler = () => {
  const timezone = "Africa/Lagos";

  // Every five minutes: expiry, stale pending cleanup, and reminders.
  const task = cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        const result = await runBoostMaintenance();
        console.info("[boost-scheduler] Maintenance completed", result);
      } catch (error) {
        console.error("[boost-scheduler] Maintenance failed", error);
      }
    },
    { timezone, noOverlap: true },
  );

  console.info("[boost-scheduler] Started");
  return task;
};
