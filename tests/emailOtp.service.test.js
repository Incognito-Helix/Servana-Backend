
import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import crypto from "node:crypto";

const mockUpdateMany = jest.fn();
const mockCreate = jest.fn();
const mockTransaction = jest.fn();
const mockEnqueueEmail = jest.fn();
const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: {
    $transaction: mockTransaction,
  },
}));

jest.unstable_mockModule("../src/services/email-queue.service.js", () => ({
  enqueueEmail: mockEnqueueEmail,
}));

const { issueEmailOtp } = await import(
  "../src/services/emailOtp.service.js"
);

describe("email OTP service", () => {
  const user = {
    id: "user-1",
    email: "user@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockCreate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        authToken: {
          updateMany: mockUpdateMany,
          create: mockCreate,
        },
      }),
    );
    mockEnqueueEmail.mockResolvedValue("job-1");
  });

  test("stores a hashed OTP and enqueues its email", async () => {
    await issueEmailOtp(user);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        type: "email_otp",
        usedAt: null,
      },
      data: {
        usedAt: expect.any(Date),
      },
    });

    const tokenData = mockCreate.mock.calls[0][0].data;

    expect(tokenData.userId).toBe(user.id);
    expect(tokenData.type).toBe("email_otp");
    expect(tokenData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenData.expiresAt).toBeInstanceOf(Date);
    expect(tokenData.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);
    expect(mockEnqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: "Verify your Servana email",
      }),
    );

    const emailMessage = mockEnqueueEmail.mock.calls[0][0];
    const otp = emailMessage.text.match(/\b\d{6}\b/)?.[0];

    expect(otp).toBeDefined();
    expect(
      crypto.createHash("sha256").update(otp).digest("hex"),
    ).toBe(tokenData.tokenHash);
  });

  test("does not interrupt OTP issuance when email enqueueing fails", async () => {
    mockEnqueueEmail.mockRejectedValue(
      new Error("Email queue unavailable"),
    );

    await expect(issueEmailOtp(user)).resolves.toBeUndefined();

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      "[email-queue] Failed to enqueue OTP email:",
      expect.any(Error),
    );
  });

  test("does not enqueue an email when the OTP database transaction fails", async () => {
    mockTransaction.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(issueEmailOtp(user)).rejects.toThrow(
      "Database unavailable",
    );

    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});
