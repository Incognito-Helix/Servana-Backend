import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  vendorProfile: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  profileEvent: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  boost: {
    findFirst: jest.fn(),
  },
  contactReveal: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { revealContact, recordContactTap, DAILY_REVEAL_LIMIT } =
  await import("../src/services/contact.service.js");

const approvedProfile = {
  id: "profile-1",
  userId: "vendor-user-1",
  status: "approved",
  phone: "+2348012345678",
  whatsapp: "+2348012345678",
};

const setupApprovedProfile = () => {
  mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);
  mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true });
  mockPrisma.profileEvent.findMany.mockResolvedValue([]);
  mockPrisma.boost.findFirst.mockResolvedValue(null);
  mockPrisma.contactReveal.upsert.mockResolvedValue({ id: "reveal-1" });
  mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });
  mockPrisma.$transaction.mockResolvedValue([]);
};

describe("Contact reveal service", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns phone and WhatsApp for a verified user and approved vendor", async () => {
    setupApprovedProfile();

    const result = await revealContact("customer-1", "profile-1");

    expect(result).toEqual({
      phone: "+2348012345678",
      whatsapp: "+2348012345678",
    });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      select: { emailVerified: true },
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing vendor profile", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);

    await expect(
      revealContact("customer-1", "missing-profile"),
    ).rejects.toMatchObject({
      status: 404,
      code: "PROFILE_NOT_FOUND",
    });

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(["pending", "rejected", "suspended"])(
    "rejects a vendor whose status is %s",
    async (status) => {
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        ...approvedProfile,
        status,
      });

      await expect(
        revealContact("customer-1", "profile-1"),
      ).rejects.toMatchObject({
        status: 404,
        code: "PROFILE_NOT_FOUND",
      });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it("rejects contact reveal when the customer's email is unverified", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: false });

    await expect(
      revealContact("customer-1", "profile-1"),
    ).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a user trying to reveal their own vendor contact", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);

    await expect(
      revealContact("vendor-user-1", "profile-1"),
    ).rejects.toMatchObject({
      status: 403,
      code: "OWN_PROFILE",
    });

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns nullable phone and WhatsApp values without inventing contact details", async () => {
    setupApprovedProfile();

    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      ...approvedProfile,
      phone: null,
      whatsapp: null,
    });

    const result = await revealContact("customer-1", "profile-1");

    expect(result).toEqual({ phone: null, whatsapp: null });
  });

  it("enforces the daily limit for new vendor reveals", async () => {
    setupApprovedProfile();

    mockPrisma.profileEvent.findMany.mockResolvedValue(
      Array.from({ length: DAILY_REVEAL_LIMIT }, (_, index) => ({
        profileId: `profile-${index + 10}`,
      })),
    );

    await expect(
      revealContact("customer-1", "profile-1"),
    ).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMIT_EXCEEDED",
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows reopening a vendor already revealed today at the daily limit", async () => {
    setupApprovedProfile();

    mockPrisma.profileEvent.findMany.mockResolvedValue([
      { profileId: "profile-1" },
      ...Array.from({ length: DAILY_REVEAL_LIMIT - 1 }, (_, index) => ({
        profileId: `profile-${index + 10}`,
      })),
    ]);

    const result = await revealContact("customer-1", "profile-1");

    expect(result.phone).toBe("+2348012345678");
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("requires a previous contact reveal before recording a contact tap", async () => {
    setupApprovedProfile();
    mockPrisma.contactReveal.findUnique.mockResolvedValue(null);

    await expect(
      recordContactTap("customer-1", "profile-1"),
    ).rejects.toMatchObject({
      status: 403,
      code: "CONTACT_NOT_REVEALED",
    });

    expect(mockPrisma.profileEvent.create).not.toHaveBeenCalled();
  });

  it("records a contact tap after the contact was revealed", async () => {
    setupApprovedProfile();
    mockPrisma.contactReveal.findUnique.mockResolvedValue({ id: "reveal-1" });

    await expect(
      recordContactTap("customer-1", "profile-1"),
    ).resolves.toBeUndefined();

    expect(mockPrisma.profileEvent.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        type: "contact_tap",
        boostId: null,
        viewerId: "customer-1",
      },
    });
  });
});
