import request from 'supertest';
import express from 'express';
import authRoutes from '../auth.routes.js';
import * as authService from '../auth.service.js';
import cookieParser from 'cookie-parser';

// Mock the auth service
jest.mock('../auth.service.js', () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  createSession: jest.fn(),
  userResponsePayload: jest.fn((user) => user),
  generateTwoFactorSecret: jest.fn(),
  updateUserTwoFactor: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// Global Error Handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ message: err.message });
});

describe('Auth API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      authService.findUserByEmail.mockResolvedValue(null);
      authService.createUser.mockResolvedValue({ id: '1', email: 'test@example.com' });
      authService.createSession.mockResolvedValue({
        accessToken: 'mock_access',
        refreshToken: 'mock_refresh',
        session: { id: 's1' },
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test' });

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toEqual('User created successfully');
    });

    it('should fail if user already exists', async () => {
      authService.findUserByEmail.mockResolvedValue({ id: '1', email: 'test@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual('User already exists');
    });
  });
});
