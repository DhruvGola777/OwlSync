import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as friendsController from './friends.controller.js';

const router = Router();

// Apply auth middleware to all friends routes
router.use(requireAuth);

router.post('/request', friendsController.sendFriendRequest);
router.post('/:id/accept', friendsController.acceptRequest);
router.post('/:id/decline', friendsController.declineRequest);
router.get('/', friendsController.getFriends);
router.get('/requests', friendsController.getPendingRequests);

export default router;
