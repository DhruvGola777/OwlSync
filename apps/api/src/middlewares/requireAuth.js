import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import { findUserById } from '../modules/auth/auth.service.js';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      throw new AppError('You are not logged in. Please log in to get access.', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new AppError('Invalid token. Please log in again.', 401);
    }

    const currentUser = await findUserById(decoded.userId);

    if (!currentUser) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }

    // Attach user to request object
    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};
