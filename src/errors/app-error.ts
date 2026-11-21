import { type Request, type Response, type NextFunction } from 'express';

export class AppError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export const globalErrorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal server error' });
};