import { SupabaseClient } from '@supabase/supabase-js';

export type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export class HistoryTrendService {
  private static getStartDate(period: TrendPeriod): Date {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    if (period === 'weekly') start.setUTCDate(start.getUTCDate() - 6);
    if (period === 'monthly') start.setUTCDate(start.getUTCDate() - 29);
    if (period === 'yearly') start.setUTCMonth(start.getUTCMonth() - 11, 1);

    return start;
  }

  private static getLabel(dateStr: string, period: TrendPeriod): string {
    const d = new Date(dateStr);
    if (period === 'daily') {
      return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
    }
    if (period === 'weekly') {
      return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    }
    if (period === 'monthly') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  }

  static async getTrends(supabase: SupabaseClient, userId: string, period: TrendPeriod) {
    const startDate = this.getStartDate(period);

    const { data, error } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const meals = data ?? [];
    const grouped = new Map<string, { cal: number; pro: number }>();

    let totalCal = 0;
    let totalPro = 0;

    for (const meal of meals) {
      const serving = Number(meal.serving) || 1;
      const cal = Number(meal.calories) * serving;
      const pro = Number(meal.protein) * serving;

      totalCal += cal;
      totalPro += pro;

      const label = this.getLabel(meal.created_at, period);
      const curr = grouped.get(label) ?? { cal: 0, pro: 0 };
      grouped.set(label, { cal: curr.cal + cal, pro: curr.pro + pro });
    }

    const round = (n: number) => Math.round(n * 10) / 10;

    const points = Array.from(grouped.entries()).map(([label, { cal, pro }]) => ({
      label,
      ratio: pro > 0 ? round(cal / pro) : 0.0,
    }));

    return {
      avg_ratio: totalPro > 0 ? round(totalCal / totalPro) : 0.0,
      logged_meals: meals.length,
      points,
      meals: meals.reverse(), // newest first for the list UI
    };
  }
}