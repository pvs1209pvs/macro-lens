import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../errors/app-error.js";

export class NutritionGoalService {

    async get(db: SupabaseClient) {
        const { data, error } = await db.from("nutrition_goals").select("*").single();
        if (error) throw new AppError(500, error.message);
        if (!data) throw new AppError(404, 'Nutrition goal not found');
        return data;

    }

    async upsert(db: SupabaseClient, payload: Record<string, unknown>) {
        const { data, error } = await db
            .from('nutrition_goals')
            .upsert(payload, { onConflict: 'user_id' })
            .select('*')
            .single();
        if (error) throw new AppError(500, error.message);
        return data;
    }

}