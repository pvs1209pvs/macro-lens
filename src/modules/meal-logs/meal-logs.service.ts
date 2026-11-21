import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../errors/app-error.js";

export class MealLogService {

    async get(db: SupabaseClient) {
        const { data, error } = await db
            .from("meal_logs")
            .select("*")
            .order('created_at', { ascending: false });
        if (error) throw new AppError(500, error.message);
        return data;
    }

    async save(db: SupabaseClient, payload: any) {
        const { data, error } = await db.from("meal_logs").insert(payload).select().single();
        if (error) throw new AppError(500, error.message);
        return data;
    }

}