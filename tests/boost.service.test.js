import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  vendorProfile: { findUnique: jest.fn() },
  category: { findUnique: jest.fn() },
  vendorCategory: { findFirst: jest.fn() },
  zone: { findMany: jest.fn() },
  boost: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { quoteBoost, createBoost, cancelBoost } =
  await import("../src/services/boost.service.js");

describe("Boost service", () => {
  const request = {
    profileId: "profile-1",
    categoryId: "category-1",
    type: "zone_boost",
    durationType: "daily",
    zoneIds: ["zone-1", "zone-2"],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      status: "approved",
    });

    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      isActive: true,
    });

    mockPrisma.vendorCategory.findFirst.mockResolvedValue({
      id: "vendor-category-1",
    });

    mockPrisma.zone.findMany.mockResolvedValue([
      { id: "zone-1", boostPriceMultiplier: 1 },
      { id: "zone-2", boostPriceMultiplier: 1.5 },
    ]);
  });

  test("calculates a quote using zone multipliers without creating a boost", async () => {
    const quote = await quoteBoost(request);

    expect(quote.currency).toBe("NGN");
    expect(quote.basePriceKobo).toBe(50_000);
    expect(quote.totalPriceKobo).toBe(125_000);
    expect(quote.totalPriceNaira).toBe(1_250);
    expect(quote.zones).toHaveLength(2);
    expect(mockPrisma.boost.create).not.toHaveBeenCalled();
  });

  test("rejects vendors whose profile is not approved", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      status: "pending",
    });

    await expect(quoteBoost(request)).rejects.toMatchObject({
      status: 409,
      code: "INVALID_PROFILE_STATUS",
    });

    expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
  });

  test("rejects missing categories", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    await expect(quoteBoost(request)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  test("rejects inactive categories", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      isActive: false,
    });

    await expect(quoteBoost(request)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  test("rejects categories the vendor is not listed in", async () => {
    mockPrisma.vendorCategory.findFirst.mockResolvedValue(null);

    await expect(quoteBoost(request)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  test("rejects missing or inactive zones", async () => {
    mockPrisma.zone.findMany.mockResolvedValue([
      { id: "zone-1", boostPriceMultiplier: 1 },
    ]);

    await expect(quoteBoost(request)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  test("rejects unsupported boost types in quotes", async () => {
    await expect(
      quoteBoost({ ...request, type: "invalid_type" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  test("rejects unsupported durations in quotes", async () => {
    await expect(
      quoteBoost({ ...request, durationType: "yearly" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  test("rejects unsupported boost types when creating a boost", async () => {
    await expect(
      createBoost({ ...request, type: "invalid_type" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });

    expect(mockPrisma.boost.create).not.toHaveBeenCalled();
  });

  test("rejects unsupported durations when creating a boost", async () => {
    await expect(
      createBoost({ ...request, durationType: "yearly" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });

    expect(mockPrisma.boost.create).not.toHaveBeenCalled();
  });

  test("creates a boost with the correct zone relation field", async () => {
    mockPrisma.boost.create.mockResolvedValue({
      id: "boost-1",
      profileId: "profile-1",
      categoryId: "category-1",
      type: "zone_boost",
      status: "active",
      startAt: new Date("2026-10-26T00:00:00Z"),
      endAt: new Date("2026-10-27T00:00:00Z"),
      zones: [{ zoneId: "zone-1" }, { zoneId: "zone-2" }],
    });

    const boost = await createBoost(request);

    expect(boost.zoneIds).toEqual(["zone-1", "zone-2"]);

    expect(mockPrisma.boost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zones: {
            create: [{ zoneId: "zone-1" }, { zoneId: "zone-2" }],
          },
        }),
        include: { zones: { select: { zoneId: true } } },
      }),
    );
  });

  test.each([
    ["daily", 1],
    ["weekly", 7],
    ["monthly", 30],
  ])("sets the correct expiry for a %s boost", async (durationType, days) => {
    mockPrisma.boost.create.mockImplementation(async ({ data }) => ({
      id: "boost-1",
      profileId: data.profileId,
      categoryId: data.categoryId,
      type: data.type,
      status: data.status,
      startAt: data.startAt,
      endAt: data.endAt,
      zones: data.zones.create,
    }));

    const boost = await createBoost({ ...request, durationType });

    expect(boost.endAt.getTime() - boost.startAt.getTime()).toBe(
      days * 24 * 60 * 60 * 1000,
    );
  });

  test("rejects cancellation when a boost does not exist", async () => {
    mockPrisma.boost.findUnique.mockResolvedValue(null);

    await expect(cancelBoost("missing-boost")).rejects.toMatchObject({
      status: 404,
      code: "BOOST_NOT_FOUND",
    });
  });
});
