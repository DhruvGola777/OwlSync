import catchAsync from '../../utils/catchAsync.js';
import * as notificationService from './notifications.service.js';

export const getNotifications = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit, 10) || 20;

  const data = await notificationService.getUserNotifications(userId, limit);

  res.status(200).json({
    status: 'success',
    data
  });
});

export const markRead = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  await notificationService.markAsRead(id, userId);

  res.status(200).json({
    status: 'success',
    message: 'Notification marked as read'
  });
});

export const markAllRead = catchAsync(async (req, res) => {
  const userId = req.user.id;

  await notificationService.markAllAsRead(userId);

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read'
  });
});

export const deleteNotification = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  await notificationService.deleteNotification(id, userId);

  res.status(200).json({
    status: 'success',
    message: 'Notification deleted'
  });
});
