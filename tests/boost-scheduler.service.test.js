import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockUpdateMany = jest.fn();
const mockFindMany = jest.fn();
const mockSendEmail = jest.fn();

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: {
    boost: {
      updateMany: mockUpdateMany,
      findMany: mockFindMany,
    },
  },
}));

jest.unstable_mockModule("../src/services/email.service.js", () => ({
  sendEmail: mockSendEmail,
}));

const { expireBoosts, cancelStalePendingBoosts, sendBoostExpiryReminders } =
  await import("../src/services/boost-scheduler.service.js");

describe("boost scheduler service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BOOST_PENDING_TTL_HOURS;
  });

  test("expires active boosts whose end time has passed", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    const now = new Date("2026-10-26T12:00:00.000Z");
    const result = await expireBoosts(now);

    expect(result).toBe(2);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        status: "active",
        endAt: { lte: now },
      },
      data: { status: "expired" },
    });
  });

  test("cancels pending boosts older than the configured threshold", async () => {
    process.env.BOOST_PENDING_TTL_HOURS = "24";
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const now = new Date("2026-10-26T12:00:00.000Z");
    const result = await cancelStalePendingBoosts(now);

    expect(result).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        status: "pending",
        createdAt: {
          lte: new Date("2026-10-25T12:00:00.000Z"),
        },
      },
      data: { status: "cancelled" },
    });
  });

  test("does not send a reminder when no eligible boosts exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await sendBoostExpiryReminders(
      new Date("2026-10-26T12:00:00.000Z"),
    );

    expect(result).toEqual({
      candidates: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  test("claims an eligible boost, sends its reminder, and marks it sent", async () => {
    const now = new Date("2026-10-26T12:00:00.000Z");
    const boost = {
      id: "boost-1",
      type: "weekly",
      endAt: new Date("2026-10-27T08:00:00.000Z"),
      profile: {
        user: {
          email: "vendor@example.com",
          firstName: "Ada",
          lastName: "Okafor",
        },
      },
    };

    mockFindMany.mockResolvedValue([boost]);
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // Claim
      .mockResolvedValueOnce({ count: 1 }); // Mark sent
    mockSendEmail.mockResolvedValue(true);

    const result = await sendBoostExpiryReminders(now);

    expect(result).toEqual({
      candidates: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vendor@example.com",
        subject: "Your Servana boost expires soon",
      }),
    );
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany.mock.calls[1][0].data).toEqual({
      reminderSentAt: expect.any(Date),
      reminderClaimedAt: null,
    });
  });

  test("does not send when another run has already claimed the reminder", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "boost-2",
        type: "daily",
        endAt: new Date("2026-10-27T08:00:00.000Z"),
        profile: {
          user: {
            email: "vendor@example.com",
            firstName: "Ada",
            lastName: "Okafor",
          },
        },
      },
    ]);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await sendBoostExpiryReminders(
      new Date("2026-10-26T12:00:00.000Z"),
    );

    expect(result.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test("releases the claim when email delivery fails", async () => {
    const now = new Date("2026-10-26T12:00:00.000Z");
    mockFindMany.mockResolvedValue([
      {
        id: "boost-3",
        type: "daily",
        endAt: new Date("2026-10-27T08:00:00.000Z"),
        profile: {
          user: {
            email: "vendor@example.com",
            firstName: "Ada",
            lastName: "Okafor",
          },
        },
      },
    ]);
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // Claim
      .mockResolvedValueOnce({ count: 1 }); // Release claim
    mockSendEmail.mockResolvedValue(false);

    const result = await sendBoostExpiryReminders(now);

    expect(result.failed).toBe(1);
    expect(mockUpdateMany.mock.calls[1][0].data).toEqual({
      reminderClaimedAt: null,
    });
  });

  test("releases the claim when the vendor has no email address", async () => {
    const now = new Date("2026-10-26T12:00:00.000Z");

    mockFindMany.mockResolvedValue([
      {
        id: "boost-no-email",
        type: "daily",
        endAt: new Date("2026-10-27T08:00:00.000Z"),
        profile: {
          user: {
            email: null,
            firstName: "Ada",
            lastName: "Okafor",
          },
        },
      },
    ]);

    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // Claim
      .mockResolvedValueOnce({ count: 1 }); // Release claim

    const result = await sendBoostExpiryReminders(now);

    expect(result).toEqual({
      candidates: 1,
      sent: 0,
      failed: 1,
      skipped: 0,
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateMany.mock.calls[1][0].data).toEqual({
      reminderClaimedAt: null,
    });
  });

  test("releases the claim when email delivery throws", async () => {
    const now = new Date("2026-10-26T12:00:00.000Z");

    mockFindMany.mockResolvedValue([
      {
        id: "boost-email-error",
        type: "daily",
        endAt: new Date("2026-10-27T08:00:00.000Z"),
        profile: {
          user: {
            email: "vendor@example.com",
            firstName: "Ada",
            lastName: "Okafor",
          },
        },
      },
    ]);

    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // Claim
      .mockResolvedValueOnce({ count: 1 }); // Release claim

    mockSendEmail.mockRejectedValue(new Error("Email provider unavailable"));

    const result = await sendBoostExpiryReminders(now);

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany.mock.calls[1][0].data).toEqual({
      reminderClaimedAt: null,
    });
  });
});
