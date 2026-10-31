import express from "express";
import {
  listCategoriesController,
  listZonesController,
} from "../controllers/catalog.controller.js";

// Public lists, no login needed.
const router = express.Router();

router.get("/categories", listCategoriesController);
router.get("/zones", listZonesController);

export default router;
