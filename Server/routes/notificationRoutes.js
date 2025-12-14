import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead
} from '../controllers/notificationController.js';

const notifRouter = express.Router();

// GET notifications for a user (query: userId) - sorted by createdAt DESC
notifRouter.get('/notifications', getNotifications);

// GET unread count for a user
notifRouter.get('/notifications/unread-count', getUnreadCount);

// POST mark notification as read
notifRouter.post('/notifications/:id/read', markAsRead);

export { notifRouter };