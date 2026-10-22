
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const mockPrisma = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  zone: {
    findMany: jest.fn(),
  },
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
  beforeEach(() => {
    mockPrisma.zone.findMany.mockResolvedValue([]);
    mockPrisma.vendorProfile.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns vendors with default pagination and a 10 km radius", async () => {
    const result = await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.values).toContain(10);

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

  it("uses a custom search radius", async () => {
    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      radiusKm: 25,
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.values).toContain(25);
  });

  it("caps the search radius at 50 km", async () => {
    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      radiusKm: 75,
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.values).toContain(50);
    expect(query.values).not.toContain(75);
  });

  it("includes the category filter in the database query", async () => {
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
    mockPrisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "vendor-1",
          distanceKm: 12.34,
          sponsored: false,
        },
      ])
      .mockResolvedValueOnce([{ total: 23 }]);

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

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain("LIMIT");
    expect(query.sql).toContain("OFFSET");
    expect(query.values).toContain(10);

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 23,
      totalPages: 3,
    });

    expect(result.vendors[0].distanceKm).toBe(12.34);
    expect(result.vendors[0].sponsored).toBe(false);
  });

  it("combines category and service filters", async () => {
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

  it("orders Top Spot, Zone Boost, and organic results in rank groups", async () => {
    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      categoryId: "category-1",
    });


    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain('"rankGroup"');
    expect(query.sql).toContain("'top_spot'");
    expect(query.sql).toContain("'zone_boost'");
    expect(query.sql).toContain('"avgRating"');
    expect(query.sql).toContain("ORDER BY");
  });


  it("enforces a maximum of three sponsored search results", async () => {
    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
      categoryId: "category-1",
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    // Boost eligibility is separate from final ranking.
    expect(query.sql).toContain('"boostRankGroup"');
    expect(query.sql).toContain("final_ranked");

    // Sponsored vendors are capped before pagination.
    expect(query.sql).toContain("LIMIT");
    expect(query.values).toContain(3);

    // Vendors outside the sponsored selection fall back to organic rank.
    expect(query.sql).toContain('ELSE 3');
    expect(query.sql).toContain("(s.id IS NOT NULL) AS sponsored");
  });


  it("ranks local vendors before remote vendors and uses ratings for remote ordering", async () => {
    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain('"worksRemotely"');
    expect(query.sql).toContain('"avgRating"');
    expect(query.sql).toContain("NULLS LAST");
    expect(query.sql).toContain('WHEN r."worksRemotely" THEN NULL');
    expect(query.sql).toContain('ELSE r."distanceKm"');
  });

  it("does not allow category-specific boosts without a selected category", async () => {
    await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
    });

    const query = mockPrisma.$queryRaw.mock.calls[0][0];

    expect(query.sql).toContain("AND 1 = 0");
  });

  it("returns remote vendors without coordinates with a null distance", async () => {
    mockPrisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "remote-1",
          distanceKm: null,
          sponsored: false,
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    mockPrisma.vendorProfile.findMany.mockResolvedValue([
      {
        id: "remote-1",
        businessName: "Remote Vendor",
        worksRemotely: true,
        avgRating: "4.50",
        categories: [],
        services: [],
      },
    ]);

    const result = await searchVendors({
      latitude: 6.5244,
      longitude: 3.3792,
    });

    expect(result.vendors).toHaveLength(1);
    expect(result.vendors[0].businessName).toBe("Remote Vendor");
    expect(result.vendors[0].distanceKm).toBeNull();
    expect(result.vendors[0].sponsored).toBe(false);
  });
});
