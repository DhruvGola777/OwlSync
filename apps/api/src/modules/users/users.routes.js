import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
  getMe,
  updateMe,
  getSessions,
  revokeDeviceSession,
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  deleteAccount
} from './users.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.delete('/me', deleteAccount);

router.get('/sessions', getSessions);
router.delete('/sessions/:id', revokeDeviceSession);

router.get('/2fa/setup', setupTwoFactor);
router.post('/2fa/verify', verifyTwoFactor);
router.delete('/2fa/disable', disableTwoFactor);

export default router;
