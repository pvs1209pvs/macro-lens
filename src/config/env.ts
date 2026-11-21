function getEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT?.trim()) || 3000,

  supabase: {
    url: getEnv('SUPABASE_URL'),
    anonKey: getEnv('SUPABASE_ANON_KEY'),
  },

  fatsecret: {
    clientId: getEnv('FATSECRET_CLIENT_ID'),
    clientSecret: getEnv('FATSECRET_CLIENT_SECRET'),
  },

  proxy: {
    fixieUrl: process.env.FIXIE_URL?.trim() || undefined,
  },
} as const;