import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  vendorProfile: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  review: {
    create: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const { createReview, listReviews } =
  await import("../src/services/review.service.js");

describe("Review service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.vendorProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      status: "approved",
      userId: "vendor-1",
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      role: "customer",
      status: "active",
    });

    mockPrisma.$transaction.mockImplementation(async (operation) => {
      if (typeof operation === "function") {
        return operation({
          review: {
            create: mockPrisma.review.create,
            aggregate: mockPrisma.review.aggregate,
          },
          vendorProfile: {
            update: mockPrisma.vendorProfile.update,
          },
        });
      }

      return Promise.all(operation);
    });
  });

  test("creates a review and updates the vendor's rating totals", async () => {
    const createdReview = {
      id: "review-1",
      profileId: "profile-1",
      customerId: "customer-1",
      rating: 5,
      comment: "Excellent service",
    };

    mockPrisma.review.create.mockResolvedValue(createdReview);
    mockPrisma.review.aggregate.mockResolvedValue({
      _avg: { rating: 5 },
      _count: { _all: 1 },
    });
    mockPrisma.vendorProfile.update.mockResolvedValue({});

    const result = await createReview("customer-1", "profile-1", {
      rating: 5,
      comment: "Excellent service",
    });

    expect(result).toEqual(createdReview);
    expect(mockPrisma.review.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        customerId: "customer-1",
        rating: 5,
        comment: "Excellent service",
      },
    });
    expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { avgRating: 5, reviewCount: 1 },
    });
  });

  test("rejects reviews for missing or unapproved vendor profiles", async () => {
    mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);

    await expect(
      createReview("customer-1", "missing-profile", { rating: 4 }),
    ).rejects.toMatchObject({
      status: 404,
      code: "PROFILE_NOT_FOUND",
    });

    expect(mockPrisma.review.create).not.toHaveBeenCalled();
  });

  test("prevents vendors from reviewing their own profiles", async () => {
    await expect(
      createReview("vendor-1", "profile-1", { rating: 5 }),
    ).rejects.toMatchObject({
      status: 403,
      code: "OWN_PROFILE",
    });
  });

  test("rejects duplicate reviews", async () => {
    mockPrisma.review.create.mockRejectedValue({ code: "P2002" });

    await expect(
      createReview("customer-1", "profile-1", { rating: 4 }),
    ).rejects.toMatchObject({
      status: 409,
      code: "REVIEW_ALREADY_EXISTS",
    });
  });

  test("lists reviews using pagination, sorting, and rating filters", async () => {
    mockPrisma.vendorProfile.findFirst.mockResolvedValue({
      id: "profile-1",
    });

    const reviews = [{ id: "review-1", rating: 5 }];

    mockPrisma.review.findMany.mockResolvedValue(reviews);
    mockPrisma.review.count.mockResolvedValue(1);

    const result = await listReviews("profile-1", {
      page: 2,
      limit: 5,
      sort: "highest_rating",
      rating: 5,
    });

    expect(result).toEqual({
      reviews,
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    });

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          profileId: "profile-1",
          rating: 5,
          moderationStatus: "visible",
        },
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        skip: 5,
        take: 5,
      }),
    );
  });
});
