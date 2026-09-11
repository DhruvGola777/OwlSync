import { getSystemHealth } from './health.service.js';

/**
 * Detailed Diagnostic Health Endpoint
 * GET /health and GET /api/health
 */
export const getHealthHandler = async (req, res) => {
  const health = await getSystemHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
};

/**
 * Lightweight Liveness Probe
 * GET /health/live
 */
export const getLivenessHandler = (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
};

/**
 * Readiness Probe
 * GET /health/ready
 */
export const getReadinessHandler = async (req, res) => {
  const health = await getSystemHealth();
  if (health.status === 'healthy') {
    res.status(200).json({
      status: 'ready',
      ready: true,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      ready: false,
      services: health.services,
      timestamp: new Date().toISOString()
    });
  }
};
