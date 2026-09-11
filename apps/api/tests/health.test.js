import request from 'supertest';
import app from '../src/server.js';

describe('Health, Security & Monitoring Suite', () => {
  it('GET /health/live should return 200 and status alive', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'alive');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /metrics should return Prometheus plain-text exposition format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('owlsync_http_requests_total');
  });

  it('Responses should include Helmet HTTP security headers', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('GET /api-docs/ should serve Swagger UI documentation', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
