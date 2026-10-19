import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockVerifyNinWithMock = jest.fn();

const mockPrisma = {
  vendorProfile: {
    findUnique: jest.fn(),
  },
  verification: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockTx = {
  verification: {
    create: jest.fn(),
  },
  vendorProfile: {
    update: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(
  "../src/services/verification/ninVerification.mock.js",
  () => ({
    verifyNinWithMock: mockVerifyNinWithMock,
  }),
);

const { verifyVendorNin } = await import("../src/services/vendor.service.js");

describe("Vendor NIN verification", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const nin = "12345678901";

  const setupTransaction = () => {
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
  };

  it("stores only the last four digits when verification passes", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-123",
    });

    mockVerifyNinWithMock.mockResolvedValue({
      status: "passed",
      failedReason: null,
    });

    mockTx.verification.create.mockImplementation(({ data }) => ({
      id: "verification-123",
      ...data,
      checkedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));

    mockTx.vendorProfile.update.mockResolvedValue({
      id: "profile-123",
      isVerified: true,
    });

    setupTransaction();

    const result = await verifyVendorNin("user-123", nin);

    expect(mockVerifyNinWithMock).toHaveBeenCalledWith(nin);

    expect(mockTx.verification.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-123",
        ninLast4: "8901",
        status: "passed",
        failedReason: null,
      },
      select: {
        id: true,
        ninLast4: true,
        status: true,
        failedReason: true,
        checkedAt: true,
      },
    });

    expect(result.ninLast4).toBe("8901");
    expect(JSON.stringify(result)).not.toContain(nin);

    expect(mockTx.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-123" },
      data: { isVerified: true },
    });
  });

  it("records failed verification and marks the vendor unverified", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-123",
    });

    mockVerifyNinWithMock.mockResolvedValue({
      status: "failed",
      failedReason: "Mock verification failed.",
    });

    mockTx.verification.create.mockResolvedValue({
      id: "verification-456",
      ninLast4: "0000",
      status: "failed",
      failedReason: "Mock verification failed.",
      checkedAt: new Date(),
    });

    mockTx.vendorProfile.update.mockResolvedValue({
      id: "profile-123",
      isVerified: false,
    });

    setupTransaction();

    const result = await verifyVendorNin("user-123", "12345670000");

    expect(result.status).toBe("failed");
    expect(result.ninLast4).toBe("0000");

    expect(mockTx.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-123" },
      data: { isVerified: false },
    });
  });

  it("rejects verification when the vendor profile does not exist", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);

    await expect(verifyVendorNin("missing-user", nin)).rejects.toMatchObject({
      status: 404,
      code: "PROFILE_NOT_FOUND",
    });

    expect(mockVerifyNinWithMock).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
