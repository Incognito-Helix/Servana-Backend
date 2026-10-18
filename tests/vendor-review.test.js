import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  vendorProfile: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { getPendingVendorReviews, approveVendorProfile, rejectVendorProfile } =
  await import("../src/services/vendor.service.js");

describe("Vendor review queue", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns only pending vendor profiles in oldest-update order", async () => {
    const pendingProfiles = [
      {
        id: "profile-1",
        businessName: "Test Business",
        status: "pending",
        user: {
          id: "user-1",
          firstName: "Test",
          lastName: "Vendor",
          email: "vendor@example.com",
        },
        categories: [],
        socialLinks: [],
        services: [],
        portfolioImages: [],
        workingHours: [],
        verifications: [],
      },
    ];

    mockPrisma.vendorProfile.findMany.mockResolvedValue(pendingProfiles);

    const result = await getPendingVendorReviews();

    expect(result).toEqual(pendingProfiles);
    expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "pending" },
        orderBy: { updatedAt: "asc" },
      }),
    );
  });
});

describe("Vendor profile approval and rejection", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("approves a pending vendor profile", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      status: "pending",
    });

    mockPrisma.vendorProfile.update.mockResolvedValue({
      id: "profile-1",
      slug: "test-business",
      businessName: "Test Business",
      status: "approved",
      rejectionReason: null,
      socialLinks: [],
      avgRating: 0,
      reviewCount: 0,
    });

    const result = await approveVendorProfile("profile-1");

    expect(result.status).toBe("approved");
    expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: {
        status: "approved",
        rejectionReason: null,
      },
      include: { socialLinks: true },
    });
  });

  it("rejects a pending profile and saves the reason", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      status: "pending",
    });

    mockPrisma.vendorProfile.update.mockResolvedValue({
      id: "profile-1",
      slug: "test-business",
      businessName: "Test Business",
      status: "rejected",
      rejectionReason: "Please provide more business details.",
      socialLinks: [],
      avgRating: 0,
      reviewCount: 0,
    });

    const result = await rejectVendorProfile(
      "profile-1",
      "  Please provide more business details.  ",
    );

    expect(result.status).toBe("rejected");
    expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: {
        status: "rejected",
        rejectionReason: "Please provide more business details.",
      },
      include: { socialLinks: true },
    });
  });

  it("does not approve a profile that is not pending", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      status: "approved",
    });

    await expect(approveVendorProfile("profile-1")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_PROFILE_STATUS",
    });

    expect(mockPrisma.vendorProfile.update).not.toHaveBeenCalled();
  });

  it("rejects an empty rejection reason", async () => {
    await expect(rejectVendorProfile("profile-1", "   ")).rejects.toMatchObject(
      {
        status: 400,
        code: "VALIDATION_ERROR",
      },
    );

    expect(mockPrisma.vendorProfile.update).not.toHaveBeenCalled();
  });

  it("returns not found when approving a missing profile", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);

    await expect(approveVendorProfile("missing-profile")).rejects.toMatchObject(
      {
        status: 404,
        code: "PROFILE_NOT_FOUND",
      },
    );

    expect(mockPrisma.vendorProfile.update).not.toHaveBeenCalled();
  });
});
