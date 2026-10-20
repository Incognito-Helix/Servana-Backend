import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  vendorProfile: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { searchVendors } = await import("../src/services/search.service.js");

describe("Vendor search service", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns vendors with default pagination", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], [{ total: 0 }]]);

    const result = await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      vendors: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it("includes the category filter in the database query", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], [{ total: 0 }]]);

    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      categoryId: "category-1",
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain("vendor_categories");
    expect(query.values).toContain("category-1");
  });

  it("includes the service filter in the database query", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], [{ total: 0 }]]);

    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      serviceId: "service-1",
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain("services");
    expect(query.values).toContain("service-1");
  });

  it("applies pagination and calculates total pages", async () => {
    mockPrisma.$transaction.mockResolvedValue([
      [{ id: "vendor-1", distanceKm: 12.34 }],
      [{ total: 23 }],
    ]);

    mockPrisma.vendorProfile.findMany.mockResolvedValue([
      {
        id: "vendor-1",
        businessName: "Test Vendor",
        categories: [],
        services: [],
      },
    ]);

    const result = await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      page: 2,
      limit: 10,
    });

    const distanceQuery = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(distanceQuery.sql).toContain("LIMIT");
    expect(distanceQuery.sql).toContain("OFFSET");
    expect(distanceQuery.values).toContain(10);

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 23,
      totalPages: 3,
    });

    expect(result.vendors[0].distanceKm).toBe(12.34);
  });

  it("combines category and service filters", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], [{ total: 0 }]]);

    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      categoryId: "category-1",
      serviceId: "service-1",
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain("vendor_categories");
    expect(query.sql).toContain("services");
    expect(query.values).toContain("category-1");
    expect(query.values).toContain("service-1");
  });
});
