import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { createHmac } from "node:crypto";

const TEST_SECRET = "test-paystack-secret";

const mockTx = {
  payment: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  boost: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockPrisma = {
  $transaction: jest.fn(),
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { verifyPaystackSignature, processPaystackEvent } =
  await import("../src/services/paystack-webhook.service.js");

const rawBody = Buffer.from(
  JSON.stringify({
    event: "charge.success",
    data: {
      reference: "servana_test_reference",
      amount: 125000,
      currency: "NGN",
    },
  }),
);

const signPayload = (body, secret = TEST_SECRET) =>
  createHmac("sha512", secret).update(body).digest("hex");

const makePayment = (overrides = {}) => ({
  id: "payment-1",
  userId: "user-1",
  boostId: "boost-1",
  paystackReference: "servana_test_reference",
  amountKobo: 125000,
  currency: "NGN",
  status: "pending",
  boost: {
    id: "boost-1",
    profileId: "profile-1",
    status: "pending",
    startAt: new Date("2026-10-28T00:00:00.000Z"),
    endAt: new Date("2026-10-29T00:00:00.000Z"),
    zones: [{ zoneId: "zone-1" }],
  },
  ...overrides,
});

const successEvent = (overrides = {}) => ({
  event: "charge.success",
  data: {
    reference: "servana_test_reference",
    amount: 125000,
    currency: "NGN",
    status: "success",
    ...overrides,
  },
});

describe("Paystack webhook service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;

    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockTx),
    );

    mockTx.payment.findUnique.mockResolvedValue(makePayment());

    mockTx.boost.findMany.mockResolvedValue([]);

    mockTx.payment.updateMany.mockResolvedValue({ count: 1 });

    mockTx.boost.updateMany.mockResolvedValue({ count: 1 });
  });

  describe("verifyPaystackSignature", () => {
    test("accepts a valid Paystack signature", () => {
      const signature = signPayload(rawBody);

      expect(verifyPaystackSignature(rawBody, signature)).toBe(true);
    });

    test("rejects an invalid signature", () => {
      expect(verifyPaystackSignature(rawBody, "a".repeat(128))).toBe(false);
    });

    test("rejects a missing signature", () => {
      expect(verifyPaystackSignature(rawBody, undefined)).toBe(false);
    });

    test("rejects a signature calculated from a different secret", () => {
      const signature = signPayload(rawBody, "wrong-secret");

      expect(verifyPaystackSignature(rawBody, signature)).toBe(false);
    });

    test("rejects a non-Buffer request body", () => {
      expect(
        verifyPaystackSignature(rawBody.toString(), signPayload(rawBody)),
      ).toBe(false);
    });
  });

  describe("processPaystackEvent", () => {
    test("ignores event types other than charge.success", async () => {
      const result = await processPaystackEvent({
        event: "transfer.success",
        data: {},
      });

      expect(result).toMatchObject({
        received: true,
        processed: false,
        reason: "ignored_event",
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test("activates the boost and marks the payment successful", async () => {
      const result = await processPaystackEvent(successEvent());

      expect(result).toMatchObject({
        received: true,
        processed: true,
        duplicate: false,
        paymentId: "payment-1",
        boostId: "boost-1",
      });

      expect(mockTx.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "payment-1", status: "pending" },
          data: expect.objectContaining({
            status: "success",
            paidAt: expect.any(Date),
          }),
        }),
      );

      expect(mockTx.boost.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "boost-1", status: "pending" },
          data: expect.objectContaining({
            status: "active",
            startAt: expect.any(Date),
            endAt: expect.any(Date),
          }),
        }),
      );
    });

    test("rejects a payment with an incorrect amount", async () => {
      await expect(
        processPaystackEvent(successEvent({ amount: 125001 })),
      ).rejects.toMatchObject({
        status: 400,
        code: "PAYMENT_MISMATCH",
      });

      expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
      expect(mockTx.boost.updateMany).not.toHaveBeenCalled();
    });

    test("rejects a payment with an incorrect currency", async () => {
      await expect(
        processPaystackEvent(successEvent({ currency: "USD" })),
      ).rejects.toMatchObject({
        status: 400,
        code: "PAYMENT_MISMATCH",
      });

      expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
      expect(mockTx.boost.updateMany).not.toHaveBeenCalled();
    });

    test("does not activate a boost again for a duplicate successful payment", async () => {
      mockTx.payment.findUnique.mockResolvedValue(
        makePayment({ status: "success" }),
      );

      const result = await processPaystackEvent(successEvent());

      expect(result).toMatchObject({
        received: true,
        processed: true,
        duplicate: true,
        paymentId: "payment-1",
        boostId: "boost-1",
      });

      expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
      expect(mockTx.boost.updateMany).not.toHaveBeenCalled();
    });
    test("acknowledges a concurrent duplicate when another request processes the payment first", async () => {
      mockTx.payment.findUnique
        .mockResolvedValueOnce(makePayment())
        .mockResolvedValueOnce(makePayment({ status: "success" }));

      mockTx.payment.updateMany.mockResolvedValue({ count: 0 });

      const result = await processPaystackEvent(successEvent());

      expect(result).toMatchObject({
        received: true,
        processed: true,
        duplicate: true,
        paymentId: "payment-1",
        boostId: "boost-1",
      });

      expect(mockTx.boost.updateMany).not.toHaveBeenCalled();
    });

    test("rejects a reference that has no matching payment", async () => {
      mockTx.payment.findUnique.mockResolvedValue(null);

      await expect(processPaystackEvent(successEvent())).rejects.toMatchObject({
        status: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
    });

    test("rolls back the payment update if boost activation fails", async () => {
      mockTx.boost.updateMany.mockResolvedValue({ count: 0 });

      await expect(processPaystackEvent(successEvent())).rejects.toMatchObject({
        status: 409,
        code: "BOOST_ALREADY_PROCESSED",
      });

      expect(mockTx.payment.updateMany).toHaveBeenCalled();
      expect(mockTx.boost.updateMany).toHaveBeenCalled();
    });
  });
});
