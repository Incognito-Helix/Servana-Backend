import prisma from "../config/prisma.js";

const httpError = (status, code, message, fieldErrors = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fieldErrors = fieldErrors;
  return error;
};

const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

const toZone = (zone) => ({
  id: zone.id,
  name: zone.name,
  slug: zone.slug,
  state: zone.state,
  city: zone.city,
  centerLatitude: zone.centerLatitude,
  centerLongitude: zone.centerLongitude,
  boostPriceMultiplier: Number(zone.boostPriceMultiplier),
  isActive: zone.isActive,
});

// Public list, for the boost zone picker and the location picker.
export const listActiveZones = async () => {
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return zones.map(toZone);
};

// Admin list, including deactivated zones.
export const listAllZones = async () => {
  const zones = await prisma.zone.findMany({ orderBy: { name: "asc" } });

  return zones.map(toZone);
};

export const createZone = async (input) => {
  const slug = input.slug || slugify(input.name);

  if (!slug) {
    throw httpError(400, "VALIDATION_ERROR", "Validation Error", {
      slug: "Could not build a slug from this name.",
    });
  }

  try {
    const zone = await prisma.zone.create({
      data: {
        name: input.name,
        slug,
        state: input.state,
        city: input.city,
        centerLatitude: input.centerLatitude,
        centerLongitude: input.centerLongitude,
        boostPriceMultiplier: input.boostPriceMultiplier,
      },
    });

    return toZone(zone);
  } catch (error) {
    if (error.code === "P2002") {
      throw httpError(409, "SLUG_TAKEN", "That slug is already used.", {
        slug: "That slug is already used.",
      });
    }
    throw error;
  }
};

// Soft deactivation: a switched off zone stops appearing in pickers, search
// stops treating it as the customer's zone, and new boosts cannot use it.
// Vendors already based there keep their location.
export const updateZone = async (zoneId, input) => {
  const existing = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { id: true },
  });

  if (!existing) {
    throw httpError(404, "ZONE_NOT_FOUND", "Zone not found.");
  }

  const fields = [
    "name",
    "state",
    "city",
    "centerLatitude",
    "centerLongitude",
    "boostPriceMultiplier",
    "isActive",
  ];

  const data = {};
  for (const field of fields) {
    if (input[field] !== undefined) data[field] = input[field];
  }

  const zone = await prisma.zone.update({ where: { id: zoneId }, data });

  return toZone(zone);
};
