
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "../config/prisma.js";

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

/**
 * Verify Paystack's signature against the exact raw request body.
 */
export const verifyPaystackSignature = (
  rawBody,
  signature,
  secret = process.env.PAYSTACK_SECRET_KEY,
) => {
  if (!secret) {
    throw httpError(
      500,
      "PAYSTACK_SECRET_MISSING",
      "Paystack webhook secret is not configured.",
    );
  }

  if (
    !Buffer.isBuffer(rawBody) ||
    typeof signature !== "string" ||
    !/^[a-f\d]{128}$/i.test(signature)
  ) {
    return false;
  }

  const expected = createHmac("sha512", secret)
    .update(rawBody)
    .digest();

  const received = Buffer.from(signature, "hex");

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
};

/**
 * Handle a verified Paystack webhook event.
 */
export const processPaystackEvent = async (event) => {
  if (!event || typeof event.event !== "string") {
    throw httpError(400, "INVALID_WEBHOOK_EVENT", "Invalid webhook event.");
  }

  // Other Paystack event types are acknowledged but do not change records.
  if (event.event !== "charge.success") {
    return { received: true, processed: false, reason: "ignored_event" };
  }

  const data = event.data;

  if (
    !data ||
    typeof data.reference !== "string" ||
    !data.reference ||
    !Number.isSafeInteger(data.amount) ||
    data.amount < 0 ||
    typeof data.currency !== "string"  ||
    data.status !== "success"
  ) {
    throw httpError(
      400,
      "INVALID_PAYMENT_DATA",
      "The payment event contains invalid payment data.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { paystackReference: data.reference },
      include: {
        boost: {
          include: { zones: { select: { zoneId: true } } },
        },
      },
    });

    if (!payment) {
      throw httpError(
        404,
        "PAYMENT_NOT_FOUND",
        "No payment matches this Paystack reference.",
      );
    }

    // Never trust the amount or currency supplied by the webhook alone.
    if (
      data.amount !== payment.amountKobo ||
      data.currency !== payment.currency
    ) {
      throw httpError(
        400,
        "PAYMENT_MISMATCH",
        "The payment amount or currency does not match the expected payment.",
      );
    }

    // Repeated successful notifications must not activate the boost again.
    if (payment.status === "success") {
      return {
        received: true,
        processed: true,
        duplicate: true,
        paymentId: payment.id,
        boostId: payment.boostId,
      };
    }

    if (payment.status !== "pending") {
      throw httpError(
        409,
        "PAYMENT_NOT_PENDING",
        "This payment is not pending.",
      );
    }

    const boost = payment.boost;

    if (!boost || boost.status !== "pending") {
      throw httpError(
        409,
        "BOOST_NOT_PENDING",
        "The boost associated with this payment is not pending.",
      );
    }

    const now = new Date();
    const durationMs = boost.endAt.getTime() - boost.startAt.getTime();

    if (durationMs <= 0) {
      throw httpError(
        409,
        "INVALID_BOOST_DURATION",
        "The boost has an invalid duration.",
      );
    }

    const zoneIds = boost.zones.map((zone) => zone.zoneId);

    // Preserve sequential scheduling when this vendor has an active boost
    // in any of the same zones.
    const currentBoosts = await tx.boost.findMany({
      where: {
        id: { not: boost.id },
        profileId: boost.profileId,
        status: "active",
        endAt: { gt: now },
        zones: { some: { zoneId: { in: zoneIds } } },
      },
      select: { endAt: true },
    });

    const startAt = currentBoosts.reduce(
      (latest, item) => (item.endAt > latest ? item.endAt : latest),
      now,
    );

    const endAt = new Date(startAt.getTime() + durationMs);

    // Conditional updates protect against concurrent webhook deliveries.
    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, status: "pending" },
      data: { status: "success", paidAt: now },
    });

if (paymentUpdate.count !== 1) {
  // Another webhook may have completed this payment first.
  const latestPayment = await tx.payment.findUnique({
    where: { paystackReference: data.reference },
  });

  if (latestPayment?.status === "success") {
    return {
      received: true,
      processed: true,
      duplicate: true,
      paymentId: latestPayment.id,
      boostId: latestPayment.boostId,
    };
  }

  throw httpError(
    409,
    "PAYMENT_ALREADY_PROCESSED",
    "The payment status changed during processing.",
  );
}


    const boostUpdate = await tx.boost.updateMany({
      where: { id: boost.id, status: "pending" },
      data: { status: "active", startAt, endAt },
    });

    if (boostUpdate.count !== 1) {
      // Throwing rolls back the payment update as well.
      throw httpError(
        409,
        "BOOST_ALREADY_PROCESSED",
        "The boost status changed during payment processing.",
      );
    }

    return {
      received: true,
      processed: true,
      duplicate: false,
      paymentId: payment.id,
      boostId: boost.id,
    };
  });
};
