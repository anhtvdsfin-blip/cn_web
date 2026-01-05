// ============================================
// socket/notificationSocket.js
// Real-time Notification System
// ============================================

import { notificationService } from '../services/NotificationService.js';

export const initNotificationSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Notification socket connected: ${socket.id}`);

    // ==========================================
    // Auth User for Notifications
    // ==========================================
    socket.on('auth_notification', ({ userId }) => {
      console.log(`📥 Received auth_notification event from socket ${socket.id} with userId:`, userId);
      if (!userId) {
        console.log('❌ auth_notification received empty userId');
        return;
      }

      socket.data.userId = userId.toString();
      socket.join(`notifications_${userId}`);
      console.log(`🔔 User ${userId} joined notification room notifications_${userId}`);
      console.log(`📊 Socket ${socket.id} is now in rooms:`, Array.from(socket.rooms));
    });

    // ==========================================
    // Get Unread Count
    // ==========================================
    socket.on('get_unread_count', async ({ userId }, callback) => {
      try {
        const count = await notificationService.getUnreadCount(userId);
        callback({ success: true, count });
      } catch (error) {
        console.error('❌ Error getting unread count:', error);
        callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // Mark Notification as Read
    // ==========================================
    socket.on('mark_notification_read', async ({ notificationId }, callback) => {
      try {
        const notification = await notificationService.markAsRead(notificationId);
        callback({ success: true, notification });
      } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // Mark All as Read
    // ==========================================
    socket.on('mark_all_notifications_read', async ({ userId }, callback) => {
      try {
        const result = await notificationService.markAllAsRead(userId);
        callback({ success: true, result });
      } catch (error) {
        console.error('❌ Error marking all as read:', error);
        callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // Disconnect
    // ==========================================
    socket.on('disconnect', () => {
      console.log(`👋 Notification socket disconnected: ${socket.id}`);
    });
  });
};

/**
 * Emit a new notification to the recipient
 * @param {Object} io - Socket.io instance
 * @param {string} userId - Recipient user ID
 * @param {Object} notification - Notification object
 */
export const emitNotification = (io, userId, notification) => {
  try {
    io.to(`notifications_${userId}`).emit('new_notification', {
      notification
    });
    console.log(`📢 Notification sent to user ${userId}`);
  } catch (error) {
    console.error('❌ Error emitting notification:', error);
  }
};

/**
 * Emit notifications for both users in a match
 * @param {Object} io - Socket.io instance
 * @param {string} user1Id - First user ID
 * @param {string} user2Id - Second user ID
 * @param {Array} notifications - Array of notifications
 */
export const emitMatchNotifications = (io, user1Id, user2Id, notifications) => {
  try {
    if (Array.isArray(notifications) && notifications.length === 2) {
      // Emit to user 1
      emitNotification(io, user1Id, notifications[0]);
      // Emit to user 2
      emitNotification(io, user2Id, notifications[1]);
    }
  } catch (error) {
    console.error('❌ Error emitting match notifications:', error);
  }
};
