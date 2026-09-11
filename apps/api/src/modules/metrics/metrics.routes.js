import express from 'express';
import { register } from './metrics.service.js';

const router = express.Router();

/**
 * Expose Prometheus metrics endpoint
 * GET /metrics
 */
router.get('/', async (req, res, next) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    next(error);
  }
});

export default router;
