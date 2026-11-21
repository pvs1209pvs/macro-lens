import { fatSecretClient } from '../../clients/clients.js';
import { AppError } from '../../errors/app-error.js';
import { fatSecretTokenCache } from '../../middleware/auth.middleware.js';

export interface SearchRecipesParams {
  search_expression: string;
  recipe_types?: string;
  recipe_types_matchall?: string;
  must_have_images?: string;
  page_number?: string;
  max_results?: string;
  sort_by?: string;
}

export interface SearchFoodsParams {
  query: string;
  page?: string;
  maxResults?: string;
}

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export class FatSecretService {
  
  async searchRecipes(params: SearchRecipesParams) {
    try {
      const response = await fatSecretClient.get('/rest/recipes/search/v3', {
        headers: {
          Authorization: `Bearer ${fatSecretTokenCache?.accessToken}`,
        },
        params: {
          format: 'json',
          ...params,
        },
      });

      if (response.status !== 200) {
        throw new AppError(response.status, `FatSecret API error: ${response.status}`);
      }

      const data = response.data;
      const rawRecipes = toArray(data?.recipes?.recipe);

      const recipes = rawRecipes.map((item: any) => ({
        id: item.recipe_id,
        name: item.recipe_name,
        description: item.recipe_description ?? '',
        image: item.recipe_image ?? null,
        ingredients: toArray(item.recipe_ingredients?.ingredient),
        types: toArray(item.recipe_types?.recipe_type),
        nutrition: {
          calories: Number(item.recipe_nutrition?.calories ?? 0),
          protein: Number(item.recipe_nutrition?.protein ?? 0),
          carbs: Number(item.recipe_nutrition?.carbohydrate ?? 0),
          fat: Number(item.recipe_nutrition?.fat ?? 0),
        },
      }));

      return {
        page: Number(data?.recipes?.page_number ?? 0),
        maxResults: Number(data?.recipes?.max_results ?? 10),
        totalResults: Number(data?.recipes?.total_results ?? 0),
        recipes,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new AppError(502, `Proxy request failed: ${message}`);
    }
  }

  async searchFoods({ query, page = '0', maxResults = '20' }: SearchFoodsParams) {
    try {
      const params = new URLSearchParams({
        search_expression: query,
        page_number: page,
        max_results: maxResults,
        format: 'json',
      });

      const response = await fetch(
        `https://platform.fatsecret.com/rest/foods/search/v1?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${fatSecretTokenCache?.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response.ok) {
        const details = await response.text();
        throw new AppError(
          response.status,
          `FatSecret API error: ${response.status}${details ? ` - ${details}` : ''}`
        );
      }

      return await response.json();
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new AppError(502, `Proxy request failed: ${message}`);
    }
  }
}