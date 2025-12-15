import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Type: like, comment, reply, match, message, etc.
  type: {
    type: String,
    enum: [
      'like',           // Like bài viết
      'comment',        // Comment bài viết
      'reply',          // Reply comment
      'match',          // Match thành công
      'like_comment',   // Like comment
      'mention',        // Tag trong bài viết/comment
      'follow',         // Follow user
      'message',        // Tin nhắn mới
      // Library-related notifications
      'library_room_created',
      'library_invite',
      'library_invite_accepted',
      'library_user_joined'
    ],
    required: true
  },
  
  // Reference
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },

  // Library room reference for library-related notifications
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LibraryRoom'
  },
  
  // Match ID reference
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  
  // Content preview
  content: String,
  
  // Read status
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: Date,
  
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ senderId: 1 });
notificationSchema.index({ createdAt: -1 });

// TTL Index - Tự động xóa thông báo sau 30 ngày
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Notification = mongoose.model('Notification', notificationSchema);


export const createNotification = async (data) => {
  if (data.recipientId.toString() === data.senderId.toString()) {
    return null;
  }
  try {
    const notification = new Notification(data);
    await notification.save();
    return notification;
  } catch (err) {
    console.error('Lỗi khi tạo notification:', err);
    throw err;
  }
};
