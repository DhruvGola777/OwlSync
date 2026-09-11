import client from 'prom-client';

// Initialize Prometheus Register
const register = new client.Registry();

// Add default recommended NodeJS runtime metrics (CPU, Memory, GC, Event Loop)
client.collectDefaultMetrics({
  register,
  prefix: 'owlsync_api_'
});

// Custom Metric 1: HTTP Total Requests Counter
export const httpRequestsTotal = new client.Counter({
  name: 'owlsync_http_requests_total',
  help: 'Total number of HTTP requests processed by OwlSync API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Custom Metric 2: HTTP Request Duration Histogram
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'owlsync_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// Custom Metric 3: AI Pair-Programmer Queries Counter
export const aiQueriesTotal = new client.Counter({
  name: 'owlsync_ai_queries_total',
  help: 'Total number of AI pair programming queries and agent sessions',
  labelNames: ['type'],
  registers: [register]
});

// Custom Metric 4: File Operations Counter
export const fileOperationsTotal = new client.Counter({
  name: 'owlsync_file_operations_total',
  help: 'Total file operations (create, update, delete, rename) in workspaces',
  labelNames: ['action'],
  registers: [register]
});

// Custom Metric 5: Session Recordings Counter
export const recordingsTotal = new client.Counter({
  name: 'owlsync_recordings_total',
  help: 'Total number of recorded coding sessions uploaded',
  registers: [register]
});

/**
 * Normalizes URL routes to prevent label cardinality explosion
 * E.g., /api/projects/b27f.../files -> /api/projects/:id/files
 */
function normalizePath(path) {
  if (!path) return 'unknown';
  return path
    .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:id')
    .replace(/\/[a-f0-9]{24}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .split('?')[0]; // Remove query strings
}

/**
 * Express Middleware to capture request duration and throughput
 */
export const metricsMiddleware = (req, res, next) => {
  // Skip metric endpoint itself to avoid recursion
  if (req.path === '/metrics') {
    return next();
  }

  const start = performance.now();

  res.on('finish', () => {
    const durationSeconds = (performance.now() - start) / 1000;
    const route = req.route ? req.baseUrl + req.route.path : normalizePath(req.originalUrl || req.url);
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString()
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
};

export { register };
