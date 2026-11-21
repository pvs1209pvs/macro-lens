import 'dotenv/config'
import express, { type Request, type Response } from 'express';
import { SupabaseClient, type User } from '@supabase/supabase-js';
import nutritionGoalRouter from "../src/modules/nutrition-goals/nutrition-goals.router.js";
import mealLogRouter from "../src/modules/meal-logs/meal-logs.router.js";
import { globalErrorHandler } from './errors/app-error.js';
import fatSecretRouter from './modules/fatsecret/fatsecret.router.js';
import { config } from './config/env.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      supabase?: SupabaseClient;
    }
  }
}

const PORT = config.port || 3000;

const app = express();

app.use(express.json());
app.use("/nutrition-goal", nutritionGoalRouter);
app.use("/meal-log", mealLogRouter);
app.use('/api/fatsecret', fatSecretRouter);

app.get('/health', (_req: Request, res: Response<String>) => {
  res.json("Hello world");
});

app.get('/debug-ip', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');

    if (!response.ok) {
      res
        .status(response.status)
        .json({
          error: `Upstream error: ${response.status} ${response.statusText}`,
        });
      return;
    }

    const data = (await response.json()) as { ip: string };

    res.json({
      outboundIp: data.ip,
      proxyConfigured: Boolean(process.env.FIXIE_URL),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({
      error: 'Proxy request failed',
      details: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.use(globalErrorHandler);