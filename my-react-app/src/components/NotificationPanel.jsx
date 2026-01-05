import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { SocketContext, UserContext } from '../contexts';
import axios from 'axios';

export default function NotificationPanel({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user } = useContext(UserContext) ?? {};
  const { notifications, setNotifications, unreadCount, setUnreadCount } = useContext(SocketContext) ?? {};
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;

  const handleMarkAsRead = async (notificationId) => {
    try {
      // Validate notificationId
      if (!notificationId) {
        console.warn('⚠️ No notification ID provided');
        return { success: false, error: 'No ID' };
      }

      // Some notifications are local-only (generated client-side) and use synthetic ids like 'm-<ts>'.
      // These are not stored in the server DB so avoid calling backend for them.
      if (typeof notificationId === 'string' && notificationId.startsWith('m-')) {
        setNotifications?.(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n));
        setUnreadCount?.(prev => Math.max(0, prev - 1));
        return { success: true, local: true };
      }

      // Validate MongoDB ObjectId format (24 hex characters)
      const objectIdRegex = /^[0-9a-fA-F]{24}$/;
      if (!objectIdRegex.test(notificationId.toString())) {
        console.warn('⚠️ Invalid notification ID format:', notificationId);
        // Mark as read locally anyway
        setNotifications?.(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n));
        setUnreadCount?.(prev => Math.max(0, prev - 1));
        return { success: true, local: true };
      }

      const res = await axios.post(`${API_URL}/api/notifications/${notificationId}/read`);
      if (res.data.success) {
        // Update local state
        setNotifications?.(prev =>
          prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
        );
        setUnreadCount?.(prev => Math.max(0, prev - 1));
      }
      return res.data;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      // Mark as read locally anyway to improve UX
      setNotifications?.(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n));
      setUnreadCount?.(prev => Math.max(0, prev - 1));
      return { success: false, error };
    }
  };

  const handleMarkAll = async () => {
    if (!notifications || notifications.length === 0) return;
    setLoading(true);
    try {
      const unread = (notifications || []).filter(n => !n.isRead);
      if (unread.length === 0) return;

      const serverUnread = unread.filter(n => !(typeof n._id === 'string' && n._id.startsWith('m-')));
      const localOnly = unread.filter(n => (typeof n._id === 'string' && n._id.startsWith('m-')));

      // Fire server requests in parallel for real notifications
      if (serverUnread.length > 0) {
        await Promise.allSettled(
          serverUnread.map(n => axios.post(`${API_URL}/api/notifications/${n._id}/read`).catch(e => e))
        );
      }

      // Mark local-only as read by updating state
      setNotifications?.((prev) => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount?.(0);
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }

    // If comment or reply notification, navigate to Community page
    if ((notification.type === 'comment' || notification.type === 'reply') && notification.postId) {
      onClose?.();
      const postId = notification.postId._id || notification.postId;
      navigate(`/community?postId=${postId}`);
      return;
    }

    // If match notification, navigate to conversation
    if (notification.type === 'match' && notification.matchId) {
      onClose?.();
      navigate(`/messenger?matchId=${notification.matchId._id || notification.matchId}`);
      return;
    }

    // If mutual BK crush notification, navigate to messenger
    if (notification.type === 'mutual_bk_crush' && notification.matchId) {
      onClose?.();
      navigate(`/messenger?matchId=${notification.matchId._id || notification.matchId}`);
      return;
    }

    // If message notification, navigate to the chat conversation
    if (notification.type === 'message') {
      const convId = notification.meta?.conversationId || notification.conversationId || notification.matchId;
      if (convId) {
        if (!notification.isRead) handleMarkAsRead(notification._id);
        onClose?.();
        navigate(`/messenger?matchId=${convId}`);
        return;
      }
    }

    // If library-related notification, navigate to library page and optionally to room
    if (notification.type && notification.type.startsWith('library')) {
      onClose?.();
      const roomId = notification.roomId?._id || notification.roomId;
      if (roomId) {
        navigate(`/library-invite?roomId=${roomId}`);
      } else {
        navigate('/library-invite');
      }
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Panel */}
      <div className="fixed right-4 top-16 z-50 w-96 max-w-[calc(100vw-32px)] bg-white rounded-lg shadow-lg border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="font-semibold text-slate-900">Thông báo</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full transition"
            aria-label="Đóng"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-500 text-sm">Không có thông báo</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map(notif => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 cursor-pointer transition ${
                    notif.type === 'mutual_bk_crush'
                      ? 'bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100'
                      : !notif.isRead
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Match Notification */}
                  {notif.type === 'match' && (
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-1">💖</span>
                      <div className="flex-1">
                        <p className="text-slate-900 font-medium">
                          {notif.content}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  )}

                  {/* Mutual BK Crush Notification */}
                  {notif.type === 'mutual_bk_crush' && (
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <span className="text-3xl mt-1 animate-pulse">💖</span>
                        <span className="absolute -top-1 -right-1 text-xl">✨</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-rose-600 font-bold text-sm">
                          🎉 Chúc mừng! Mutual Crush!
                        </p>
                        <p className="text-slate-900 font-medium mt-0.5">
                          {notif.content}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="h-2 w-2 rounded-full bg-rose-500 flex-shrink-0 mt-2 animate-pulse" />
                      )}
                    </div>
                  )}

                  {/* Other Notification Types */}
                  {notif.type !== 'match' && notif.type !== 'mutual_bk_crush' && (
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-1">📬</span>
                      <div className="flex-1">
                        <p className="text-slate-900 font-medium">
                          {notif.content}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications && notifications.length > 0 && (
          <div className="border-t border-slate-100 p-3 text-center">
            <button
              onClick={handleMarkAll}
              disabled={loading}
              className="text-sm text-teal-500 font-medium hover:text-teal-600 transition disabled:opacity-50"
            >
              {loading ? 'Đang đánh dấu...' : 'Xem tất cả'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Helper to format time
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return d.toLocaleDateString('vi-VN');
}
