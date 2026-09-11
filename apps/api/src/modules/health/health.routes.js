import express from 'express';
import { 
  getHealthHandler, 
  getLivenessHandler, 
  getReadinessHandler 
} from './health.controllers.js';

const router = express.Router();

// Health, Liveness, and Readiness endpoints
router.get('/', getHealthHandler);
router.get('/live', getLivenessHandler);
router.get('/ready', getReadinessHandler);

export default router;
