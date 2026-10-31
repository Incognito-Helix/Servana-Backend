import {
  listActiveCategories,
  listAllCategories,
  createCategory,
  updateCategory,
  setVendorCategories,
} from "../services/category.service.js";
import {
  listActiveZones,
  listAllZones,
  createZone,
  updateZone,
} from "../services/zone.service.js";
import {
  listBoostPrices,
  updateBoostPrice,
} from "../services/boost-price.service.js";
import { resetLocationCooldown } from "../services/vendor.service.js";

// Small helper so every handler has the same shape and error path.
const handle = (status, run) => async (req, res, next) => {
  try {
    const data = await run(req);
    return res.status(status).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Public
export const listCategoriesController = handle(200, async () => ({
  categories: await listActiveCategories(),
}));

export const listZonesController = handle(200, async () => ({
  zones: await listActiveZones(),
}));

// Vendor
export const setVendorCategoriesController = handle(200, (req) =>
  setVendorCategories(req.params.id, req.body),
);

// Admin
export const adminListCategoriesController = handle(200, async () => ({
  categories: await listAllCategories(),
}));

export const adminCreateCategoryController = handle(201, async (req) => ({
  category: await createCategory(req.body),
}));

export const adminUpdateCategoryController = handle(200, async (req) => ({
  category: await updateCategory(req.params.categoryId, req.body),
}));

export const adminListZonesController = handle(200, async () => ({
  zones: await listAllZones(),
}));

export const adminCreateZoneController = handle(201, async (req) => ({
  zone: await createZone(req.body),
}));

export const adminUpdateZoneController = handle(200, async (req) => ({
  zone: await updateZone(req.params.zoneId, req.body),
}));

export const adminListBoostPricesController = handle(200, async () => ({
  prices: await listBoostPrices(),
}));

export const adminUpdateBoostPriceController = handle(200, async (req) => ({
  price: await updateBoostPrice(req.body),
}));

export const adminResetLocationCooldownController = handle(
  200,
  async (req) => ({
    profile: await resetLocationCooldown(req.params.profileId),
  }),
);
