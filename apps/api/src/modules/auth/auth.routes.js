import { Router } from 'express';
import validateRequest from '../../middlewares/validateRequest.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.js';
import {
  register,
  login,
  refreshSession,
  logout,
  verifyEmail,
  deleteAccount,
  getSessions,
  revokeDeviceSession,
  setupTwoFactor,
  verifyTwoFactor,
  loginTwoFactor,
  requestMagicLink,
  verifyMagicLink,
  requestPasswordReset,
  resetPassword,
  oauthRedirect,
  oauthCallback
} from './auth.controller.js';
import { 
  registerSchema, 
  loginSchema, 
  magicLinkRequestSchema, 
  passwordResetRequestSchema, 
  passwordResetSchema, 
  verifyTwoFactorSchema, 
  loginTwoFactorSchema 
} from '@owlsync/shared';

const router = Router();

// Standard Auth
router.post('/register', authRateLimiter, validateRequest(registerSchema), register);
router.post('/login', authRateLimiter, validateRequest(loginSchema), login);
router.post('/refresh', refreshSession);
router.post('/logout', logout);
router.get('/verify-email', verifyEmail);
router.delete('/account', requireAuth, deleteAccount);

// Sessions
router.get('/sessions', requireAuth, getSessions);
router.delete('/sessions/:id', requireAuth, revokeDeviceSession);

// 2FA
router.post('/2fa/setup', requireAuth, setupTwoFactor);
router.post('/2fa/verify', authRateLimiter, requireAuth, validateRequest(verifyTwoFactorSchema), verifyTwoFactor);
router.post('/2fa/login', authRateLimiter, validateRequest(loginTwoFactorSchema), loginTwoFactor);

// Magic Link
router.post('/magic-link/request', authRateLimiter, validateRequest(magicLinkRequestSchema), requestMagicLink);
router.get('/magic-link/verify', authRateLimiter, verifyMagicLink);

// Password Reset
router.post('/password-reset/request', authRateLimiter, validateRequest(passwordResetRequestSchema), requestPasswordReset);
router.post('/password-reset', authRateLimiter, validateRequest(passwordResetSchema), resetPassword);

// OAuth
router.get('/oauth/:provider', oauthRedirect);
router.get('/oauth/:provider/callback', oauthCallback);

export default router;
