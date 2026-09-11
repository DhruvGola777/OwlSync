import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as notificationController from './notifications.controllers.js';

const router = Router();

router.use(requireAuth);

router.get('/', notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
