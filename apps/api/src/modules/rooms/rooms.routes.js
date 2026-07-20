import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as roomController from './rooms.controller.js';

const router = Router();

// Apply auth middleware to all room routes
router.use(requireAuth);

router.post('/', roomController.createRoom);
router.get('/', roomController.getRooms);
router.get('/:id', roomController.getRoomById);
router.post('/join', roomController.joinRoom); // Using POST /api/rooms/join based on frontend api.js
router.post('/:id/join', roomController.joinRoom);
router.post('/:id/leave', roomController.leaveRoom);
router.delete('/:id/members/:userId', roomController.kickMember);
router.delete('/:id', roomController.deleteRoom);

export default router;
