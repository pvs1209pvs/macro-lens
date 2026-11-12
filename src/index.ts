import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express';
import { ProxyAgent } from 'undici';

const app = express();

const PORT = process.env.PORT || 3000;

const proxyDispatcher = process.env.FIXIE_URL
    ? new ProxyAgent(process.env.FIXIE_URL)
    : undefined;

const clientID = process.env.FATSECRET_CLIENT_ID!;
const clientSecret = process.env.FATSECRET_CLIENT_SECRET!;

app.use(express.json());

app.get('/api', (_req: Request, res: Response<String>) => {
    res.json("Hello world");
});

app.get('/token', async (_req: Request, res: Response) => {
    try {
        const credentials = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
        const response = await fetch('https://oauth.fatsecret.com/connect/token?format=json', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                scope: 'basic',
            }),
            // @ts-expect-error Node's native fetch accepts undici's dispatcher at runtime
            dispatcher: proxyDispatcher,

        });

        if (!response.ok) {
            throw new Error(`OAuth failed (${response.status}): ${await response.text()}`);
        }

        const body = (await response.json()) as {
            access_token: string;
            expires_in: number;
            token_type: string;
        };
        res.json(body);
    } catch (error: unknown) {
        res.status(502).json({
            error: 'Failed to fetch access token',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.get('/debug-ip', async (_req: Request, res: Response) => {
    try {
        const response = await fetch('https://api.ipify.org?format=json', {
            // @ts-expect-error Node's native fetch accepts undici's dispatcher at runtime
            dispatcher: proxyDispatcher,
        });

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
            proxyConfigured: Boolean(proxyDispatcher),
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