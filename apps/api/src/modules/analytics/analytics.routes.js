import express from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { getUserAnalyticsHandler, getWorkspaceAnalyticsHandler } from './analytics.controllers.js';

const router = express.Router();

router.use(requireAuth);

router.get('/user/summary', getUserAnalyticsHandler);
router.get('/workspace/:workspaceId', getWorkspaceAnalyticsHandler);

export default router;
