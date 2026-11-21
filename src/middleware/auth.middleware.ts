import { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config/env.js';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import type { CachedToken } from '../types/common.types.js';
import { fixieAgent } from '../clients/clients.js';

const getUserSupabaseClient = (authHeader?: string) => {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
};

export const supabaseAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Bearer token " });
    return;
  }

  const supabaseClient = getUserSupabaseClient(authHeader);
  const { data, error } = await supabaseClient.auth.getUser();
  const user = data.user;

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  req.supabase = supabaseClient;
  next();

}



export let fatSecretTokenCache: CachedToken | null = null;


export const refreshFatSecretToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (fatSecretTokenCache && Date.now() < fatSecretTokenCache.expiresAt) {
      next();
      return;
    }

    // const credentials = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
    const credentials = Buffer.from(`${config.fatsecret.clientId}:${config.fatsecret.clientSecret}`).toString('base64');

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