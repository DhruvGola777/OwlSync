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
  deleteAccount,
  searchUsers
} from './users.controller.js';

import * as usersController from './users.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/me', getMe);
router.get('/search', usersController.searchUsers);
router.get('/profile/:username', usersController.getPublicProfile);
router.patch('/me', updateMe);
router.delete('/me', deleteAccount);

router.post('/:userId/block', usersController.blockUser);
router.delete('/:userId/block', usersController.unblockUser);

router.get('/sessions', getSessions);
router.delete('/sessions/:id', revokeDeviceSession);

router.get('/2fa/setup', setupTwoFactor);
router.post('/2fa/verify', verifyTwoFactor);
router.delete('/2fa/disable', disableTwoFactor);

export default router;
