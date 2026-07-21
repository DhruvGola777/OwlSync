import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as roomController from './rooms.controller.js';

const router = Router();

// Apply auth middleware to all room routes
router.use(requireAuth);
// Room routes


/**
 * @route POST /api/rooms
 * @desc Create a new room
 * @access Private
 */
router.post('/', roomController.createRoom);
/**
 * @route GET /api/rooms
 * @desc Get all rooms
 * @access Private
 */
router.get('/', roomController.getRooms);
/**
 * @route GET /api/rooms/:id
 * @desc Get a room by ID
 * @access Private
 */
router.get('/:id', roomController.getRoomById);
/**
 * @route POST /api/rooms/join
 * @desc Join a room
 * @access Private
 */
router.post('/join', roomController.joinRoom); // Using POST /api/rooms/join based on frontend api.js
/**
 * @route POST /api/rooms/:id/join
 * @desc Join a specific room
 * @access Private
 */
router.post('/:id/join', roomController.joinRoom);
/**
 * @route POST /api/rooms/:id/leave
 * @desc Leave a room
 * @access Private
 */
router.post('/:id/leave', roomController.leaveRoom);
/**
 * @route DELETE /api/rooms/:id/members/:userId
 * @desc Kick a member from a room
 * @access Private
 */
router.delete('/:id/members/:userId', roomController.kickMember);
/**
 * @route DELETE /api/rooms/:id
 * @desc Delete a room
 * @access Private
 */
router.delete('/:id', roomController.deleteRoom);

export default router;
