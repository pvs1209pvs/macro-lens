import { Router } from "express";
import { supabaseAuthMiddleware } from "../../middleware/auth.middleware.js";
import { getNutritionGoal, saveNutritionGoal } from "./nutrition-goals.controller.js";

const router = Router();

router.use(supabaseAuthMiddleware);

router.get("/", getNutritionGoal);
router.post("/", saveNutritionGoal);

export default router;
