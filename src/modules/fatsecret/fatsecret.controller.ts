import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/app-error.js';
import { FatSecretService } from './fatsecret.service.js';

const fatSecretService = new FatSecretService();

export const searchRecipes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchExpression = req.query.search_expression as string | undefined;
    if (!searchExpression) {
      throw new AppError(400, 'Missing required query parameter ?search_expression=');
    }

    const result = await fatSecretService.searchRecipes({
      search_expression: searchExpression,
      recipe_types: req.query.recipe_types as string | undefined,
      recipe_types_matchall: req.query.recipe_types_matchall as string | undefined,
      must_have_images: req.query.must_have_images as string | undefined,
      page_number: req.query.page_number as string | undefined,
      max_results: req.query.max_results as string | undefined,
      sort_by: req.query.sort_by as string | undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const searchFoods = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string | undefined;
    if (!query) {
      throw new AppError(400, 'Missing required query parameter ?q=');
    }

    const result = await fatSecretService.searchFoods({
      query,
      page: (req.query.page as string) || '0',
      maxResults: (req.query.limit as string) || '20',
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};