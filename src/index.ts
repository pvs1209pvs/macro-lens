import express, { type Request, type Response, type NextFunction } from 'express';

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api', (_req: Request, res: Response<String>) => {
    res.json("Hello world");
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});