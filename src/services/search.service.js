import prisma from "../config/prisma.js";

export const searchVendors = async ({
  categoryId,
  serviceId,
  page = 1,
  limit = 10,
}) => {
  const where = {
    status: "approved",
    latitude: { not: null },
    longitude: { not: null },
  };
  if (categoryId) {
    where.categories = {
      some: { categoryId },
    };
  }

  if (serviceId) {
    where.services = {
      some: { id: serviceId },
    };
  }
  const skip = (page - 1) * limit;

  const [vendors, total] = await prisma.$transaction([
    prisma.vendorProfile.findMany({
      where,
      select: {
        id: true,
        slug: true,
        businessName: true,
        about: true,
        state: true,
        city: true,
        offersHomeService: true,
        serviceRadiusKm: true,
        worksRemotely: true,
        coverImageUrl: true,
        profileImageUrl: true,
        isVerified: true,
        reviewCount: true,
        avgRating: true,

        categories: {
          select: {
            isPrimary: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            priceMin: true,
            priceMax: true,
          },
        },
      },
      orderBy: [
        { avgRating: "desc" },
        { reviewCount: "desc" },
        { businessName: "asc" },
      ],
      skip,
      take: limit,
    }),
    prisma.vendorProfile.count({ where }),
  ]);
  return {
    vendors,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
