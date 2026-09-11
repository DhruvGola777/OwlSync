import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as searchController from './search.controllers.js';

const router = Router();

router.use(requireAuth);

router.get('/', searchController.globalSearch);

export default router;
