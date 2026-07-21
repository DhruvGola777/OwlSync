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

// Handle unhandled routes (404)
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
