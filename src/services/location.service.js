import prisma from "../config/prisma.js";

const MAX_SUGGESTIONS = 8;
const MAX_RECENT = 3;
// Same as the largest search radius. Farther than this is not "near" anything.
const NEAREST_MAX_KM = 50;
const EARTH_RADIUS_KM = 6371;

const validationError = (fieldErrors) => {
  const error = new Error("Validation Error");
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.fieldErrors = fieldErrors;
  return error;
};

// What the frontend gets to see about a zone.
const zoneFields = {
  id: true,
  name: true,
  city: true,
  state: true,
  slug: true,
  centerLatitude: true,
  centerLongitude: true,
};

// Haversine: straight line distance in km between two points on the earth.
const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceKm = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

export const suggestLocations = async ({ q, latitude, longitude }, userId) => {
  // Latitude and longitude only make sense together.
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw validationError({
      latitude: "Send latitude and longitude together.",
    });
  }

  const result = { suggestions: [], nearest: null, recent: [] };

  if (q) {
    result.suggestions = await prisma.zone.findMany({
      where: {
        isActive: true,
        name: { contains: q, mode: "insensitive" },
      },
      select: zoneFields,
      orderBy: { name: "asc" },
      take: MAX_SUGGESTIONS,
    });
  }

  if (latitude !== undefined) {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      select: { zoneFields },
    });

    let closest = null;

    for (const zone of zones) {
      const km = distanceKm(
        latitude,
        longitude,
        zone.centerLatitude,
        zone.centerLongitude,
      );

      if (closest === null || km < closest.km) {
        closest = { zone, km };
      }
    }

    if (closest !== null && closest.km <= NEAREST_MAX_KM) {
      result.nearest = {
        id: closest.zone.id,
        name: closest.zone.name,
        city: closest.zone.city,
        state: closest.zone.state,
        slug: closest.zone.slug,
        centerLatitude: closest.zone.centerLatitude,
        centerLongitude: closest.zone.centerLongitude,
        distanceKm: Math.round(closest.km * 10) / 10,
      };
    }
  }

  if (userId) {
    const rows = await prisma.userRecentLocation.findMany({
      where: { userId, zone: { isActive: true } },
      orderBy: { usedAt: "desc" },
      take: MAX_RECENT,
      select: { zone: { select: zoneFields } },
    });

    result.recent = rows.map((row) => row.zone);
  }

  return result;
};

export const saveRecentLocation = async (userId, zoneId) => {
  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, isActive: true },
    select: zoneFields,
  });

  if (!zone) {
    throw validationError({ zoneId: "Zone not found." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.userRecentLocation.upsert({
      where: { userId_zoneId: { userId, zoneId } },
      update: { usedAt: new Date() },
      create: { userId, zoneId },
    });

    const extra = await tx.userRecentLocation.findMany({
      where: { userId },
      orderBy: { usedAt: "desc" },
      skip: MAX_RECENT,
      select: { id: true },
    });

    if (extra.length > 0) {
      await tx.userRecentLocation.deleteMany({
        where: { id: { in: extra.map((row) => row.id) } },
      });
    }
  });

  return zone;
};
