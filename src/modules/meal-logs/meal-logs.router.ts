import { Router } from "express";
import { supabaseAuthMiddleware } from "../../middleware/auth.middleware.js";
import { getMealLogs, saveMealLogs } from "./meal-logs.controller.js";

const router = Router();

router.use(supabaseAuthMiddleware);

router.get("/", getMealLogs);
router.post("/", saveMealLogs);

export default router;