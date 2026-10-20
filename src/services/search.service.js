import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

const EARTH_RADIUS_KM = 6371;
const SEARCH_RADIUS_KM = 50;

export const searchVendors = async ({
  latitude,
  longitude,
  categoryId,
  serviceId,
  page = 1,
  limit = 10,
}) => {
  const skip = (page - 1) * limit;

  // Bounding box: narrow the candidates before calculating distance.
  const latitudeDelta = SEARCH_RADIUS_KM / 111.32;
  const longitudeDelta = Math.min(
    180,
    SEARCH_RADIUS_KM /
      (111.32 *
        Math.max(Math.abs(Math.cos((latitude * Math.PI) / 180)), 0.000001)),
  );

  const minLatitude = Math.max(-90, latitude - latitudeDelta);
  const maxLatitude = Math.min(90, latitude + latitudeDelta);

  const minLongitude = longitude - longitudeDelta;
  const maxLongitude = longitude + longitudeDelta;

  let longitudeFilter = Prisma.empty;

  if (longitudeDelta < 180) {
    if (minLongitude < -180) {
      longitudeFilter = Prisma.sql`
        AND (vp.longitude >= ${minLongitude + 360}
          OR vp.longitude <= ${maxLongitude})
      `;
    } else if (maxLongitude > 180) {
      longitudeFilter = Prisma.sql`
        AND (vp.longitude >= ${minLongitude}
          OR vp.longitude <= ${maxLongitude - 360})
      `;
    } else {
      longitudeFilter = Prisma.sql`
        AND vp.longitude BETWEEN ${minLongitude} AND ${maxLongitude}
      `;
    }
  }

  const filters = [];

  if (categoryId) {
    filters.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM vendor_categories vc
        WHERE vc."profileId" = vp.id
          AND vc."categoryId" = ${categoryId}
      )
    `);
  }

  if (serviceId) {
    filters.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM services s
        WHERE s."profileId" = vp.id
          AND s.id = ${serviceId}
      )
    `);
  }

  const optionalFilters = filters.length
    ? Prisma.sql`AND ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;

  const candidatesCte = Prisma.sql`
    WITH candidates AS (
      SELECT
        vp.id,
        (
          ${EARTH_RADIUS_KM} * 2 * ASIN(SQRT(LEAST(1.0,
            POWER(
              SIN(RADIANS(vp.latitude - ${latitude}) / 2),
              2
            ) +
            COS(RADIANS(${latitude})) *
            COS(RADIANS(vp.latitude)) *
            POWER(
              SIN(
               RADIANS(
              MOD(vp.longitude - ${longitude} + 540, 360) - 180
             ) / 2
          ),
            2
          )
          )))
        ) AS "distanceKm"
      FROM vendor_profiles vp
      WHERE vp.status = 'approved'
        AND vp.latitude IS NOT NULL
        AND vp.longitude IS NOT NULL
        AND vp.latitude BETWEEN ${minLatitude} AND ${maxLatitude}
        ${longitudeFilter}
        ${optionalFilters}
    )
  `;

  const [distanceRows, countRows] = await prisma.$transaction([
    prisma.$queryRaw(Prisma.sql`
      ${candidatesCte}
      SELECT id, "distanceKm"
      FROM candidates
      WHERE "distanceKm" <= ${SEARCH_RADIUS_KM}
      ORDER BY "distanceKm" ASC, id ASC
      LIMIT ${limit}
      OFFSET ${skip}
    `),
    prisma.$queryRaw(Prisma.sql`
      ${candidatesCte}
      SELECT COUNT(*)::int AS total
      FROM candidates
      WHERE "distanceKm" <= ${SEARCH_RADIUS_KM}
    `),
  ]);

  const total = countRows[0]?.total ?? 0;
  const ids = distanceRows.map((row) => row.id);

  const vendorDetails = ids.length
    ? await prisma.vendorProfile.findMany({
        where: { id: { in: ids } },
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
      })
    : [];

  const vendorsById = new Map(
    vendorDetails.map((vendor) => [vendor.id, vendor]),
  );

  const vendors = distanceRows.flatMap((row) => {
    const vendor = vendorsById.get(row.id);

    if (!vendor) return [];

    return [
      {
        ...vendor,
        distanceKm: Number(Number(row.distanceKm).toFixed(2)),
      },
    ];
  });

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
