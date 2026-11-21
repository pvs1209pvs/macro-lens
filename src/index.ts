import axios from 'axios';
import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createClient } from '@supabase/supabase-js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const app = express();

const PORT = process.env.PORT || 3000;

// if (process.env.FIXIE_URL) {
//   const proxyDispatcher = new ProxyAgent(process.env.FIXIE_URL.trim());
//   setGlobalDispatcher(proxyDispatcher);
// }

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const clientID = process.env.FATSECRET_CLIENT_ID?.trim()!;
const clientSecret = process.env.FATSECRET_CLIENT_SECRET?.trim()!;

const fixieAgent = process.env.FIXIE_URL
  ? new HttpsProxyAgent(process.env.FIXIE_URL.trim())
  : undefined;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let fatSecretTokenCache: CachedToken | null = null;


const fatSecretClient = axios.create({
  baseURL: "https://platform.fatsecret.com",
  timeout: 10000,
  httpsAgent: fixieAgent,
  proxy: false
});

const getUserSupabaseClient = (authHeader?: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
};

app.use(express.json());

app.get('/api', (_req: Request, res: Response<String>) => {
  res.json("Hello world");
});

const refreshFatSecretToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (fatSecretTokenCache && Date.now() < fatSecretTokenCache.expiresAt) {
      next();
      return;
    }

    const credentials = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    });

    const response = await axios.post(
      'https://oauth.fatsecret.com/connect/token',
      body.toString(),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        httpsAgent: fixieAgent,
        proxy: false,
        timeout: 10000,
      }
    );

    const data = response.data as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    fatSecretTokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    next();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const details = error.response?.data ?? error.message;
      res.status(status).json({
        error: 'FatSecret OAuth failed',
        details,
      });
      return;
    }

    next(error);
  }
};


interface RecipePayload {
  id: string;
  name: string;
  description: string;
  image: string | null;
  ingredients: string[];
  types: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

app.post("/recipe", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer")) {
    res.status(401).json({ error: "Missing Bearer token " });
    return;
  }
  const supabase = getUserSupabaseClient(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const recipes = req.body?.recipes as RecipePayload[];
  if (!Array.isArray(recipes) || recipes.length == 0) {
    res.status(400).json({ error: "Recipe list must be non empty" });
    return;
  }

  const rows = recipes.map((item) => ({
    user_id: user.id,
    recipe_id: item.id,
    name: item.name,
    calories: item.nutrition.calories,
    protein: item.nutrition.protein,
    carbs: item.nutrition.carbs,
    fat: item.nutrition.fat,
  }));

  const { data, error } = await supabase.from("meal_logs").insert(rows).select();

  if (error) {
    res.status(400).json({ error: error.message, code: error.code });
    return;
  }

  res.status(201).json({ saved: data });




});

// REST Endpoint Wrapper for Recipe Search v3
app.get('/api/recipes/search', refreshFatSecretToken, async (req: Request, res: Response) => {
  try {
    const {
      search_expression,
      recipe_types,
      recipe_types_matchall,
      must_have_images,
      page_number,
      max_results,
      sort_by
    } = req.query;

    if (!search_expression) {
      res.status(400).json({ error: 'Missing required query parameter ?search_expression=' });
      return;
    }

    const response = await fatSecretClient.get("/rest/recipes/search/v3", {
      headers: {
        Authorization: `Bearer ${fatSecretTokenCache?.accessToken}`,
      },
      params: {
        format: 'json',
        search_expression,
        recipe_types,
        recipe_types_matchall,
        must_have_images,
        page_number,
        max_results,
        sort_by,
      }
    });


    if (response.status != 200) {
      res.status(response.status).json({
        error: `FatSecret API error: ${response.status}`,
      });
      return;
    }


    const data = response.data;

    // Helper to normalize FatSecret's "object when 1 item, array when >1" quirk
    const toArray = <T>(value: T | T[] | undefined): T[] => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const rawRecipes = toArray(data?.recipes?.recipe);

    const recipes = rawRecipes.map((item) => ({
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

    res.json({
      page: Number(data?.recipes?.page_number ?? 0),
      maxResults: Number(data?.recipes?.max_results ?? 10),
      totalResults: Number(data?.recipes?.total_results ?? 0),
      recipes,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Recipe search error:', message);
    res.status(502).json({
      error: 'Proxy request failed',
      details: message,
    });
  }
});

app.get('/api/foods/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const page = (req.query.page as string) || '0';
  const maxResults = (req.query.limit as string) || '20';

  if (!query) {
    res.status(400).json({ error: 'Missing required query parameter ?q=' });
    return;
  }

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
          Authorization: `Bearer ${fatSecretTokenCache!.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.ok) {
      res.status(response.status).json({
        error: `FatSecret API error: ${response.status}`,
        details: await response.text(),
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({
      error: 'Proxy request failed',
      details: message,
    });
  }
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

