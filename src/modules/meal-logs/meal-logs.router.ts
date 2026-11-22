import { Router } from "express";
import { supabaseAuthMiddleware } from "../../middleware/auth.middleware.js";
import { deleteMealLogs, getMealLogs, saveMealLogs, updateMealLogs } from "./meal-logs.controller.js";

const router = Router();

router.use(supabaseAuthMiddleware);

router.get("/", getMealLogs);
router.post("/", saveMealLogs);
router.put("/:id", updateMealLogs);
router.delete("/:id", deleteMealLogs);

export default router;