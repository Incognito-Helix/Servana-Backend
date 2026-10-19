import { Router } from "express";
import { searchVendorsController } from "../controllers/search.controller.js";
import validateQuery from "../middlewares/validateQuery.js";
import searchQuerySchema from "../validators/search.validator";

const router = Router();

router.get("/", validateQuery(searchQuerySchema), searchVendorsController);

export default router;
