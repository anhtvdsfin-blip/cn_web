// ============================================
// MESSAGE & CONVERSATION HELPERS
// ============================================

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ`;
  return date.toLocaleDateString('vi-VN');
};

export const enhanceConversation = (conversation) => ({
  ...conversation,
  unreadCount: conversation.unreadCount || 0,
  lastMessage: conversation.lastMessage
    ? {
        ...conversation.lastMessage,
        formattedTime: conversation.lastMessage.timestamp
          ? formatTimestamp(conversation.lastMessage.timestamp)
          : '',
      }
    : null,
});

export const enhanceMessage = (message, userId, shouldAnimate = false) => {
  const timestamp = message.timestamp || message.createdAt;
  const senderId = message.senderId?._id || message.senderId; // Handle populated senderId
  return {
    ...message,
    timestamp,
    formattedTime: formatTimestamp(timestamp),
    isSelf: String(senderId) === String(userId),
    shouldAnimate,
  };
};

export const sortConversations = (list) => {
  return [...list].sort((a, b) => {
    const aTime = new Date(a.lastMessage?.timestamp || 0).getTime();
    const bTime = new Date(b.lastMessage?.timestamp || 0).getTime();
    return bTime - aTime;
  });
};

export const SCROLL_THRESHOLD = 120;
