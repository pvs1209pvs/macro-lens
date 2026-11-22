import { Router } from 'express';
import { supabaseAuthMiddleware } from '../../middleware/auth.middleware.js';
import { HistoryTrendController } from './history-trend.controller.js';

const router = Router();

router.use(supabaseAuthMiddleware);

router.get('/', HistoryTrendController.getHistoryTrend);

export default router;