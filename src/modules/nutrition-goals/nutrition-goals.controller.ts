import { type Request, type Response, type NextFunction } from 'express';
import { NutritionGoalService } from './nutrition-goals.service.js';


const nutritionGoalService = new NutritionGoalService();

export const getNutritionGoal = async (req: Request, res: Response, next: NextFunction) => {

    try {
        if (!req.supabase) throw new Error("Not authed");
        const data = await nutritionGoalService.get(req.supabase!);
        res.json(data);
    }
    catch (err) {
        next(err);
    }

}

export const saveNutritionGoal = async (req: Request, res: Response, next: NextFunction) => {
    const { goal, daily_calorie_target, daily_protein_target } = req.body ?? {};

    if (!['cut', 'maintain', 'bulk'].includes(goal)) {
        res.status(400).json({ error: "Invalid goal. Must be cut, bulk or maintain" });
        return;
    }

    try {
        if (!req.supabase) throw new Error("Not authed");
        const data = await nutritionGoalService.upsert(req.supabase, {
            user_id: req.user!.id,
            goal,
            daily_calorie_target: Math.round(daily_calorie_target),
            daily_protein_target: Math.round(daily_protein_target),
            updated_at: new Date().toISOString(),
        });
        res.status(204).json(data);
    }
    catch (err) {
        next(err);
    }
}




