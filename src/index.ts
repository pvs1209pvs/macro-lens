import axios from 'axios';
import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const app = express();

const PORT = process.env.PORT || 3000;

// if (process.env.FIXIE_URL) {
//   const proxyDispatcher = new ProxyAgent(process.env.FIXIE_URL.trim());
//   setGlobalDispatcher(proxyDispatcher);
// }

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
  httpAgent: fixieAgent,
  proxy:false
});

app.use(express.json());

app.get('/api', (_req: Request, res: Response<String>) => {
  res.json("Hello world");
});

const refreshFatSecretToken = async (req: Request, res: Response, next: NextFunction) => {

  if (fatSecretTokenCache && Date.now() < fatSecretTokenCache.expiresAt) {
    next();
  }

  const credentials = Buffer.from(
    `${clientID}:${clientSecret}`
  ).toString('base64');

  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OAuth failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  fatSecretTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  next();

}

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

