import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  vendorProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  zone: {
    findFirst: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { createProfile, getOwnProfile, updateProfile, submitProfileForReview } =
  await import("../src/services/vendor.service.js");

describe("Vendor onboarding persistence", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("resumes onboarding using the saved profile and step", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      slug: "test-business",
      businessName: "Test Business",
      onboardingStep: 4,
      status: "draft",
      avgRating: 0,
      reviewCount: 0,
    });

    const profile = await getOwnProfile("user-1");

    expect(profile.onboardingStep).toBe(4);
    expect(profile.status).toBe("draft");
    expect(mockPrisma.vendorProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: { socialLinks: true },
    });
  });

  it("does not move the saved onboarding step backwards", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      slug: "test-business",
      businessName: "Test Business",
      onboardingStep: 4,
      status: "draft",
      avgRating: 0,
      reviewCount: 0,
    });

    mockPrisma.vendorProfile.update.mockImplementation(async ({ data }) => ({
      id: "profile-1",
      userId: "user-1",
      slug: "test-business",
      businessName: "Test Business",
      onboardingStep: data.onboardingStep,
      status: "draft",
      avgRating: 0,
      reviewCount: 0,
    }));

    const profile = await updateProfile("profile-1", {
      onboardingStep: 2,
    });

    expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onboardingStep: 4 }),
      }),
    );
    expect(profile.onboardingStep).toBe(4);
  });

  it("creates a vendor profile as a draft at the first step", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);
    mockPrisma.vendorProfile.create.mockImplementation(async ({ data }) => ({
      id: "profile-1",
      ...data,
      about: null,
      phone: null,
      whatsapp: null,
      state: null,
      city: null,
      zoneId: null,
      latitude: null,
      longitude: null,
      streetAddress: null,
      offersHomeService: false,
      serviceRadiusKm: null,
      worksRemotely: false,
      coverImageUrl: null,
      profileImageUrl: null,
      onboardingStep: data.onboardingStep ?? 1,
      status: "draft",
      rejectionReason: null,
      isVerified: false,
      avgRating: 0,
      reviewCount: 0,
      locationChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const profile = await createProfile("user-1", {
      businessName: "Test Business",
    });

    expect(profile.onboardingStep).toBe(1);
    expect(profile.status).toBe("draft");
    expect(mockPrisma.vendorProfile.create).toHaveBeenCalled();
  });
});

it("transitions a completed draft profile to pending review", async () => {
  mockPrisma.vendorProfile.findUnique.mockResolvedValue({
    id: "profile-1",
    userId: "user-1",
    onboardingStep: 6,
    status: "draft",
    rejectionReason: null,
    zoneId: "zone-1",
    latitude: 6.45,
    longitude: 3.4,
  });

  mockPrisma.vendorProfile.update.mockResolvedValue({
    id: "profile-1",
    userId: "user-1",
    slug: "test-business",
    businessName: "Test Business",
    onboardingStep: 6,
    status: "pending",
    rejectionReason: null,
    avgRating: 0,
    reviewCount: 0,
  });

  const profile = await submitProfileForReview("user-1");

  expect(profile.status).toBe("pending");
  expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith({
    where: { id: "profile-1" },
    data: {
      status: "pending",
      rejectionReason: null,
    },
    include: { socialLinks: true },
  });
});

it("does not submit a profile before step 6", async () => {
  mockPrisma.vendorProfile.update.mockClear();

  mockPrisma.vendorProfile.findUnique.mockResolvedValue({
    id: "profile-1",
    userId: "user-1",
    onboardingStep: 4,
    status: "draft",
  });

  await expect(submitProfileForReview("user-1")).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });

  expect(mockPrisma.vendorProfile.update).not.toHaveBeenCalled();
});

it("does not allow an approved profile to be resubmitted", async () => {
  mockPrisma.vendorProfile.update.mockClear();

  mockPrisma.vendorProfile.findUnique.mockResolvedValue({
    id: "profile-1",
    userId: "user-1",
    onboardingStep: 6,
    status: "approved",
  });

  await expect(submitProfileForReview("user-1")).rejects.toMatchObject({
    code: "INVALID_PROFILE_STATUS",
    status: 409,
  });

  expect(mockPrisma.vendorProfile.update).not.toHaveBeenCalled();
});
