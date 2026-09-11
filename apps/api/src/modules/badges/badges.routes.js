import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as badgeController from './badges.controllers.js';

const router = Router();

router.use(requireAuth);

router.get('/', badgeController.getBadges);
router.get('/user/:username', badgeController.getUserBadges);

export default router;
