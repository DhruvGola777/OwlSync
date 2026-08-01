import express from 'express';
import { getActivities, createActivity } from './activities.controllers.js';
import { requireAuth } from '../../middlewares/requireAuth.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', getActivities);
router.post('/', createActivity);

export default router;
