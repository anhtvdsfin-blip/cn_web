import httpStatus from 'http-status';
import { notificationService } from '../services/NotificationService.js';

export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.query;
    const { limit = 20, skip = 0 } = req.query;

    if (!userId) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Thiếu userId.'
      });
    }

    const options = {
      limit: Math.min(Number(limit) || 20, 50),
      skip: Math.max(Number(skip) || 0, 0)
    };

    const result = await notificationService.getUserNotifications(userId, options);

    return res.status(httpStatus.OK).json({
      success: true,
      data: result.notifications,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Không thể tải thông báo.'
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Thiếu userId.'
      });
    }

    const count = await notificationService.getUnreadCount(userId);

    return res.status(httpStatus.OK).json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Không thể lấy số thông báo chưa đọc.'
    });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Thiếu notification ID.'
      });
    }

    const notification = await notificationService.markAsRead(id);

    if (!notification) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Không tìm thấy thông báo.'
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Không thể cập nhật thông báo.'
    });
  }
};
