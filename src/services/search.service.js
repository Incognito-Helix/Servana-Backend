
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

const EARTH_RADIUS_KM = 6371;
const DEFAULT_SEARCH_RADIUS_KM = 10;
const MAX_SEARCH_RADIUS_KM = 50;

export const MAX_SPONSORED_SEARCH_RESULTS = 3;
export const MAX_SPONSORED_POPULAR_RESULTS = 8;

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(lat2 - lat1);
  const longitudeDifference = toRadians(lon2 - lon1);

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
};

const findNearestActiveZone = async (latitude, longitude, radiusKm) => {
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    select: {
      id: true,
      centerLatitude: true,
      centerLongitude: true,
    },
  });

  let nearestZone = null;
  let nearestDistance = radiusKm;

  for (const zone of zones) {
    const distance = calculateDistanceKm(
      latitude,
      longitude,
      zone.centerLatitude,
      zone.centerLongitude,
    );

    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone;
    }
  }

  return nearestZone;
};

export const searchVendors = async ({
  latitude,
  longitude,
  categoryId,
  serviceId,
  radiusKm = DEFAULT_SEARCH_RADIUS_KM,
  page = 1,
  limit = 10,
}) => {
  const effectiveRadiusKm = Math.min(
    Math.max(Number(radiusKm) || DEFAULT_SEARCH_RADIUS_KM, 1),
    MAX_SEARCH_RADIUS_KM,
  );

  const skip = (page - 1) * limit;
  const now = new Date();

  const nearestZone = await findNearestActiveZone(
    latitude,
    longitude,
    effectiveRadiusKm,
  );

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

  // Boosts are category-specific. Without a selected category,
  // no vendor receives paid ranking priority.
  const boostCategoryFilter = categoryId
    ? Prisma.sql`AND b."categoryId" = ${categoryId}`
    : Prisma.sql`AND 1 = 0`;

  // Only boosts targeting the nearest eligible active zone can
  // receive priority in this search.
  const boostZoneFilter = nearestZone
    ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM boost_zones bz
          WHERE bz."boostId" = b.id
            AND bz."zoneId" = ${nearestZone.id}
        )
      `
    : Prisma.sql`AND 1 = 0`;

  const latitudeDelta = effectiveRadiusKm / 111.32;
  const longitudeDelta = Math.min(
    180,
    effectiveRadiusKm /
      (111.32 *
        Math.max(
          Math.abs(Math.cos((latitude * Math.PI) / 180)),
          0.000001,
        )),
  );

  const minLatitude = Math.max(-90, latitude - latitudeDelta);
  const maxLatitude = Math.min(90, latitude + latitudeDelta);
  const minLongitude = longitude - longitudeDelta;
  const maxLongitude = longitude + longitudeDelta;

  let longitudeFilter = Prisma.empty;

  if (longitudeDelta < 180) {
    if (minLongitude < -180) {
      longitudeFilter = Prisma.sql`
        AND (
          vp.longitude >= ${minLongitude + 360}
          OR vp.longitude <= ${maxLongitude}
        )
      `;
    } else if (maxLongitude > 180) {
      longitudeFilter = Prisma.sql`
        AND (
          vp.longitude >= ${minLongitude}
          OR vp.longitude <= ${maxLongitude - 360}
        )
      `;
    } else {
      longitudeFilter = Prisma.sql`
        AND vp.longitude BETWEEN ${minLongitude} AND ${maxLongitude}
      `;
    }
  }

  const resultRows = await prisma.$queryRaw(Prisma.sql`
    WITH candidates AS (
      SELECT
        vp.id,
        vp."worksRemotely",
        vp."avgRating",
        CASE
          WHEN vp.latitude IS NOT NULL
            AND vp.longitude IS NOT NULL THEN
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
          ELSE NULL
        END AS "distanceKm"
      FROM vendor_profiles vp
      WHERE vp.status = 'approved'
        AND (
          (
            vp.latitude IS NOT NULL
            AND vp.longitude IS NOT NULL
            AND vp.latitude BETWEEN ${minLatitude} AND ${maxLatitude}
            ${longitudeFilter}
          )
          OR vp."worksRemotely" = TRUE
        )
        ${optionalFilters}
    ),
    eligible AS (
      SELECT
        c.*,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM boosts b
            WHERE b."profileId" = c.id
              AND b.type = 'top_spot'
              AND b.status = 'active'
              AND b."startAt" <= ${now}
              AND b."endAt" >= ${now}
              ${boostCategoryFilter}
              ${boostZoneFilter}
          ) THEN 1
          WHEN EXISTS (
            SELECT 1
            FROM boosts b
            WHERE b."profileId" = c.id
              AND b.type = 'zone_boost'
              AND b.status = 'active'
              AND b."startAt" <= ${now}
              AND b."endAt" >= ${now}
              ${boostCategoryFilter}
              ${boostZoneFilter}
          ) THEN 2
          ELSE 3
        END AS "boostRankGroup"
      FROM candidates c
      WHERE (
        c."worksRemotely" = TRUE
        OR c."distanceKm" <= ${effectiveRadiusKm}
      )
    ),
    ranked AS (
      SELECT
        eligible.*,
        ROW_NUMBER() OVER (
          PARTITION BY "boostRankGroup"
          ORDER BY
            CASE WHEN "worksRemotely" THEN 1 ELSE 0 END ASC,
            CASE
              WHEN "worksRemotely" THEN NULL
              ELSE "distanceKm"
            END ASC NULLS LAST,
            "avgRating" DESC,
            id ASC
        ) AS "groupPosition"
      FROM eligible
    ),
    sponsored AS (
      SELECT
        id,
        "boostRankGroup"
      FROM ranked
      WHERE "boostRankGroup" IN (1, 2)
      ORDER BY
        "boostRankGroup" ASC,
        "groupPosition" ASC
      LIMIT ${MAX_SPONSORED_SEARCH_RESULTS}
    ),
    final_ranked AS (
      SELECT
        r.*,
        CASE
          WHEN s.id IS NOT NULL THEN r."boostRankGroup"
          ELSE 3
        END AS "rankGroup",
        (s.id IS NOT NULL) AS sponsored
      FROM ranked r
      LEFT JOIN sponsored s ON s.id = r.id
    )
    SELECT
      r.id,
      r."distanceKm",
      r."worksRemotely",
      r."avgRating",
      r."rankGroup",
      r.sponsored
    FROM final_ranked r
    ORDER BY
      r."rankGroup" ASC,
      CASE WHEN r."worksRemotely" THEN 1 ELSE 0 END ASC,
      CASE
        WHEN r."worksRemotely" THEN NULL
        ELSE r."distanceKm"
      END ASC NULLS LAST,
      r."avgRating" DESC,
      r.id ASC
    LIMIT ${limit}
    OFFSET ${skip}
  `);

  const countRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS total
    FROM vendor_profiles vp
    WHERE vp.status = 'approved'
      AND (
        (
          vp.latitude IS NOT NULL
          AND vp.longitude IS NOT NULL
          AND vp.latitude BETWEEN ${minLatitude} AND ${maxLatitude}
          ${longitudeFilter}
        )
        OR vp."worksRemotely" = TRUE
      )
      ${optionalFilters}
      AND (
        vp."worksRemotely" = TRUE
        OR (
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
          ))) <= ${effectiveRadiusKm}
        )
      )
  `);

  const total = countRows[0]?.total ?? 0;
  const ids = resultRows.map((row) => row.id);

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
                select: { id: true, name: true, slug: true },
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

  const vendors = resultRows.flatMap((row) => {
    const vendor = vendorsById.get(row.id);

    if (!vendor) return [];

    return [
      {
        ...vendor,
        distanceKm:
          row.distanceKm == null
            ? null
            : Number(Number(row.distanceKm).toFixed(2)),
        sponsored: Boolean(row.sponsored),
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
