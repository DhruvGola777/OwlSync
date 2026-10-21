import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import roomRoutes from './modules/rooms/rooms.routes.js';
import friendsRoutes from './modules/friends/friends.routes.js';
import projectsRoutes from './modules/projects/projects.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import recordingsRoutes from './modules/recordings/recordings.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import downloadRoutes from './modules/downloads/downloads.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import teamsRoutes from './modules/teams/teams.routes.js';
import badgesRoutes from './modules/badges/badges.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import metricsRoutes from './modules/metrics/metrics.routes.js';
import { metricsMiddleware } from './modules/metrics/metrics.service.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import AppError from './utils/AppError.js';
import { connectRabbitMQ, publishToQueue } from './config/rabbitmq.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { initSocketServer } from '../../socket/src/server.js';

process.env.OWLSYNC_EMBEDDED_SOCKET = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = env.PORT;

// Security & Base Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: true, // Allow all origins for dev
  credentials: true
}));
app.use(metricsMiddleware);
app.use(express.json());
app.use(cookieParser());

// Serve static storage directories
app.use('/uploads/recordings', express.static(path.resolve(__dirname, '../storage/recordings')));
app.use('/uploads/thumbnails', express.static(path.resolve(__dirname, '../storage/thumbnails')));
app.use('/uploads/exports', express.static(path.resolve(__dirname, '../storage/exports')));

// Interactive Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'OwlSync API Interactive Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true
  }
}));
app.get('/docs', (req, res) => res.redirect('/api-docs'));

// Root endpoint for health check & service verification
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '🚀 OwlSync API is running smoothly',
    version: '1.0.0',
    documentation: '/docs',
    health: '/health',
  });
});

// Health & Metrics Endpoints
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/metrics', metricsRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/downloads', downloadRoutes);

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

export const startServer = async () => {
  await connectRabbitMQ();
  try {
    await initSocketServer(httpServer);
    console.log('🔌 Socket.IO successfully attached to HTTP server');
  } catch (socketErr) {
    console.error('⚠️ Could not initialize Socket.IO on API server:', socketErr.message);
  }

  return httpServer.listen(PORT, () => {
    console.log(`🚀 OwlSync API & Realtime Socket Server running on http://localhost:${PORT}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

