import express from "express";
import auth from "../middlewares/auth.js";
import requireRole from "../middlewares/role.js";
import validate from "../middlewares/validate.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createZoneSchema,
  updateZoneSchema,
  updateBoostPriceSchema,
} from "../validators/catalog.validator.js";
import {
  adminListCategoriesController,
  adminCreateCategoryController,
  adminUpdateCategoryController,
  adminListZonesController,
  adminCreateZoneController,
  adminUpdateZoneController,
  adminListBoostPricesController,
  adminUpdateBoostPriceController,
  adminResetLocationCooldownController,
} from "../controllers/catalog.controller.js";

// Mounted at /admin next to admin.routes.js. Kept in its own file so it does
// not clash with other work on the main admin routes.
const router = express.Router();

router.use(
  ["/categories", "/zones", "/boost-prices", "/vendors"],
  auth,
  requireRole("admin"),
);

router.get("/categories", adminListCategoriesController);
router.post(
  "/categories",
  validate(createCategorySchema),
  adminCreateCategoryController,
);
router.patch(
  "/categories/:categoryId",
  validate(updateCategorySchema),
  adminUpdateCategoryController,
);

router.get("/zones", adminListZonesController);
router.post("/zones", validate(createZoneSchema), adminCreateZoneController);
router.patch(
  "/zones/:zoneId",
  validate(updateZoneSchema),
  adminUpdateZoneController,
);

router.get("/boost-prices", adminListBoostPricesController);
router.put(
  "/boost-prices",
  validate(updateBoostPriceSchema),
  adminUpdateBoostPriceController,
);

router.patch(
  "/vendors/:profileId/location-cooldown/reset",
  adminResetLocationCooldownController,
);

export default router;
