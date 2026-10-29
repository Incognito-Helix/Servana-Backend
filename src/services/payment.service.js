import prisma from "../config/prisma.js";
import crypto from "crypto";
import { createBoost, quoteBoost } from "../services/boost.service.js";

const PAYSTACK_URL = "";

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const getApprovedVendor = async (userId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true, status: true, user: { select: { email: true } } },
  });

  if (!profile)
    throw httpError(404, "PROFILE_NOT_FOUND", "vendor profile was not found");

  if (profile.status !== "approved")
    throw httpError(
      403,
      "PROFILE_NOT_APPROVED",
      "only approved vendors can boost",
    );

  return profile;
};

export const initializePayment = async (
  userId,
  { categoryId, type, durationType, zoneIds },
) => {
  const secret = process.env.PAYSTACK_SECRET;

  if (!secret)
    throw httpError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "payments are temporarily unavailable",
    );

  const profile = await getApprovedVendor(userId);
  const request = {
    profileId: profile.id,
    categoryId,
    type,
    durationType,
    zoneIds,
  };

  const quote = await quoteBoost(request);
  const boost = await createBoost(request);
  const reference = crypto.randomUUID().replace(/-/g, "");
  const payment = await prisma.payment.create({
    data: {
      userId,
      boostId: boost.id,
      paystackReference: reference,
      amountKobo: quote.totalPriceKobo,
      currency: "NGN",
    },
  });

  let paystack;

  try {
    const response = await fetch(PAYSTACK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer: ${secret}`,
        "content-type": "application.json",
      },
      body: JSON.stringify({
        email: profile.user.email,
        amount: quote.totalPriceKobo,
        currency: "NGN",
        reference,
        metadata: { paymentId: payment.id, boostId: boost.id },
      }),
      signal: AbortSignal.timeout(15000),
    });

    paystack = await response.json();

    if (!response.ok || !paystack?.status)
      throw new Error(paystack?.message || "Paystack rejected the request.");
  } catch (error) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
      }),
      prisma.boost.update({
        where: { id: boost.id },
        data: { status: "cancelled" },
      }),
    ]);

    console.error("Paystack initialize failed:", error.message);

    throw httpError(
      502,
      "PAYMENT_INIT_FAILED",
      "We could not start the payment. Please try again.",
    );
  }

  return {
    reference,
    accessCode: paystack.data.access_code,
    authorizationUrl: paystack.data.authorization_url,
    amountKobo: quote.totalPriceKobo,
    amountNaira: quote.totalPriceNaira,
    boost,
  };
};

export const getPaymentStatus = async (userId, reference) => {
  const payment = await prisma.payment.findUnique({
    where: { paystackReference: reference },
    select: {
      userId: true,
      status: true,
      amountKobo: true,
      paidAt: true,
      boost: {
        select: { id: true, status: true, startAt: true, endAt: true },
      },
    },
  });

  // Someone else's payment looks the same as a missing one.
  if (!payment || payment.userId !== userId) {
    throw httpError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  }

  return {
    reference,
    status: payment.status,
    amountKobo: payment.amountKobo,
    paidAt: payment.paidAt,
    boost: payment.boost,
  };
};
