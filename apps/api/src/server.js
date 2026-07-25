import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import roomRoutes from './modules/rooms/rooms.routes.js';
import friendsRoutes from './modules/friends/friends.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import AppError from './utils/AppError.js';
import { connectRabbitMQ, publishToQueue } from './config/rabbitmq.js';

const app = express();
const PORT = env.PORT;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for dev
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'owlsync-api' });
});

// Phase 2 RabbitMQ Test Route
app.get('/api/test-email', async (req, res) => {
  await publishToQueue('email_queue', {
    to: 'tester@owlsync.com',
    subject: 'Phase 2 Test Email',
    text: 'If you are reading this in the terminal, RabbitMQ is working!'
  });
  res.json({ message: 'Task queued! Check your terminal to see the worker pick it up.' });
});

// Handle unhandled routes (404)
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorHandler);

const startServer = async () => {
  await connectRabbitMQ();
  
  app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
  });
};

startServer();
