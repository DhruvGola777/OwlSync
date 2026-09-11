import request from 'supertest';
import app from '../src/server.js';

describe('Authentication API Suite', () => {
  const randomSuffix = Math.floor(Math.random() * 100000);
  const testUser = {
    name: 'CI Tester',
    username: `citester_${randomSuffix}`,
    email: `citester_${randomSuffix}@owlsync.com`,
    password: 'Password123!'
  };

  it('POST /api/auth/register should validate required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@test.com' });

    expect(res.status).toBe(400);
  });

  it('GET /api/users/me should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});
