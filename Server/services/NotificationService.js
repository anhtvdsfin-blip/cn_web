import { Notification } from '../models/Notification.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const notificationService = {
  /**
   * Create a single notification
   */
  async createNotification(data) {
    try {
      const notification = new Notification(data);
      await notification.save();
      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  },

  /**
   * Create match notifications for both users
   * Called when two users match each other
   */
  async createMatchNotifications(user1Id, user2Id, matchId) {
    try {
      // Fetch both users to get their names
      const [user1, user2] = await Promise.all([
        User.findById(user1Id),
        User.findById(user2Id)
      ]);

      if (!user1 || !user2) {
        throw new Error('Một hoặc cả hai người dùng không tồn tại');
      }

      // Create notifications for both users
      const notifications = await Promise.all([
        this.createNotification({
          recipientId: user1Id,
          senderId: user2Id,
          type: 'match',
          matchId: matchId,
          content: `Bạn và ${user2.name} đã match nhau 💖`,
          isRead: false
        }),
        this.createNotification({
          recipientId: user2Id,
          senderId: user1Id,
          type: 'match',
          matchId: matchId,
          content: `Bạn và ${user1.name} đã match nhau 💖`,
          isRead: false
        })
      ]);

      return notifications;
    } catch (error) {
      console.error('❌ Error creating match notifications:', error);
      throw error;
    }
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, isRead = null } = options;

      const query = { recipientId: userId };
      if (isRead !== null) {
        query.isRead = isRead;
      }

      const notifications = await Notification.find(query)
        .populate('senderId', 'name avatar')
        .populate('roomId', 'name')
        .populate({
          path: 'matchId',
          select: 'user1Id user2Id openingMoveUser1 openingMoveUser2',
          populate: [
            { path: 'openingMoveUser1', model: 'OpeningMove', select: 'text category' },
            { path: 'openingMoveUser2', model: 'OpeningMove', select: 'text category' },
          ]
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .exec();

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        total,
        hasMore: skip + limit < total
      };
    } catch (error) {
      console.error('❌ Error fetching user notifications:', error);
      throw error;
    }
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      let notification = null;

      // If the id looks like a valid ObjectId, use it directly
      if (mongoose.Types.ObjectId.isValid(notificationId)) {
        notification = await Notification.findByIdAndUpdate(
          notificationId,
          { isRead: true, readAt: new Date() },
          { new: true }
        );
        return notification;
      }

      // If it's a numeric timestamp (ms since epoch), try matching createdAt
      const maybeTs = Number(notificationId);
      if (!Number.isNaN(maybeTs)) {
        const createdAtDate = new Date(maybeTs);
        notification = await Notification.findOneAndUpdate(
          { createdAt: createdAtDate },
          { isRead: true, readAt: new Date() },
          { new: true }
        );
        return notification;
      }

      // Fallback: try to find by _id as string (non-standard) or return null
      notification = await Notification.findOneAndUpdate(
        { _id: notificationId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );
      return notification;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipientId: userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      return result;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId) {
    try {
      await Notification.findByIdAndDelete(notificationId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  },

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipientId: userId,
        isRead: false
      });
      return count;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      throw error;
    }
  }
};
