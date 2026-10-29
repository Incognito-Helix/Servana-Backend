import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  vendorProfile: {
    findUnique: jest.fn(),
  },
  boost: {
    findFirst: jest.fn(),
  },
  profileEvent: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { getProfile } = await import("../src/services/vendor.service.js");

const approvedProfile = {
  id: "profile-1",
  userId: "vendor-user-1",
  status: "approved",
  businessName: "Test Vendor",
  socialLinks: [],
};

describe("Public vendor profile analytics", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("records a view when another user opens an approved profile", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });

    const result = await getProfile("profile-1", "viewer-1");

    expect(result).toBeDefined();
    expect(mockPrisma.profileEvent.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        type: "view",
        boostId: null,
        viewerId: "viewer-1",
      },
    });
  });

  it("does not record a view when the owner opens their own profile", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);

    await getProfile("profile-1", "vendor-user-1");

    expect(mockPrisma.profileEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.boost.findFirst).not.toHaveBeenCalled();
  });

  it("does not record a view for an unapproved profile", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      ...approvedProfile,
      status: "pending",
    });

    await expect(getProfile("profile-1", "viewer-1")).rejects.toMatchObject({
      status: 404,
      code: "PROFILE_NOT_FOUND",
    });

    expect(mockPrisma.profileEvent.create).not.toHaveBeenCalled();
  });

  it("does not record a view when no viewer is authenticated", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });

    await getProfile("profile-1");

    expect(mockPrisma.profileEvent.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        type: "view",
        boostId: null,
        viewerId: null,
      },
    });
  });

  it("still returns the profile when view analytics fails", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(approvedProfile);
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.create.mockRejectedValue(
      new Error("Analytics database error"),
    );

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const result = await getProfile("profile-1", "viewer-1");

      expect(result).toBeDefined();
      expect(result.id).toBe("profile-1");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to record profile view:",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
