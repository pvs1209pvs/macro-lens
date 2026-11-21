import { Router } from 'express';
import { searchRecipes, searchFoods } from './fatsecret.controller.js';
import { refreshFatSecretToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(refreshFatSecretToken);

router.get('/recipes', searchRecipes);
router.get('/foods', searchFoods);

export default router;