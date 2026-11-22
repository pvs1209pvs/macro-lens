import { type Request, type Response } from 'express';
import { HistoryTrendService, type TrendPeriod } from './history-trend.service.js';

const VALID_PERIODS: TrendPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

export class HistoryTrendController {
  static async getHistoryTrend(req: Request, res: Response) {
    try {
      const period = (req.query.period as TrendPeriod) || 'daily';

      if (!VALID_PERIODS.includes(period)) {
        return res.status(400).json({ error: 'Invalid period' });
      }

      const data = await HistoryTrendService.getTrends(req.supabase!, req.user!.id, period);
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}