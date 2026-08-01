import express from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as whiteboardController from './whiteboard.controllers.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', whiteboardController.getWhiteboard);
router.put('/', whiteboardController.updateWhiteboard);

export default router;
