import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  $transaction: jest.fn(),
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
    mockPrisma.$transaction.mockResolvedValue([[], 0]);

    const result = await searchVendors({
      categoryId: undefined,
      serviceId: undefined,
    });

    expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
        where: expect.objectContaining({
          status: "approved",
          latitude: { not: null },
          longitude: { not: null },
        }),
      }),
    );

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

  it("filters vendors by category", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0]);

    await searchVendors({
      categoryId: "category-1",
    });

    expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categories: {
            some: { categoryId: "category-1" },
          },
        }),
      }),
    );
  });

  it("filters vendors by service", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0]);

    await searchVendors({
      serviceId: "service-1",
    });

    expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          services: {
            some: { id: "service-1" },
          },
        }),
      }),
    );
  });

  it("applies pagination and calculates total pages", async () => {
    mockPrisma.$transaction.mockResolvedValue([[{ id: "vendor-1" }], 23]);

    const result = await searchVendors({
      page: 2,
      limit: 10,
    });

    expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 23,
      totalPages: 3,
    });
  });

  it("combines category and service filters", async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0]);

    await searchVendors({
      categoryId: "category-1",
      serviceId: "service-1",
    });

    expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categories: {
            some: { categoryId: "category-1" },
          },
          services: {
            some: { id: "service-1" },
          },
        }),
      }),
    );
  });
});