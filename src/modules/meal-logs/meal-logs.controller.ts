
import express, { type Request, type Response, type NextFunction } from 'express';
import { MealLogService } from './meal-logs.service.js';
import { AppError } from '../../errors/app-error.js';


const mealLogService = new MealLogService();

export const getMealLogs = async (req: Request, res: Response, next: NextFunction) => {


    try {
        if (!req.supabase) throw new AppError(403, "Unauthorized");
        const data = await mealLogService.get(req.supabase);
        res.json(data);
    } catch (err) {
        next(err);
    }


};

// app.post("/meal-logs", supabaseAuthMiddleware, async (req: Request, res: Response) => {
export const saveMealLogs = async (req: Request, res: Response, next: NextFunction) => {

    interface RecipePayload {
        id: string;
        name: string;
        description: string;
        image: string | null;
        ingredients: string[];
        types: string[];
        serving: number;
        goal: string; // <--- Add goal here
        nutrition: {
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
        };

    }

    const recipes = req.body?.recipes as RecipePayload[];
    if (!Array.isArray(recipes) || recipes.length == 0) {
        res.status(400).json({ error: "Recipe list must be non empty" });
        return;
    }

    const rows = recipes.map((item) => ({
        user_id: req.user!.id,
        recipe_id: item.id,
        name: item.name,
        calories: item.nutrition.calories,
        protein: item.nutrition.protein,
        carbs: item.nutrition.carbs,
        fat: item.nutrition.fat,
        serving: item.serving,
        goal: item.goal,
    }));


    try {
        if (!req.supabase) throw new AppError(403, "Unauthorized");
        const data = await mealLogService.save(req.supabase, rows);
        res.json(data);
    } catch (error) {
        next(error);
    }

};


export const updateMealLogs = async (req: Request, res: Response, next: NextFunction) => {

    try {
        if (!req.supabase) throw new AppError(403, "Unauthorized");
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) throw new AppError(400, "Id missing");
        const data = await mealLogService.update(req.supabase, id, req.body);
        res.json(data);
    } catch (err) {
        next(err);
    }

}

export const deleteMealLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.supabase) throw new AppError(403, "Unauthorized");
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) throw new AppError(400, "Id missing");
        await mealLogService.delete(req.supabase, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}