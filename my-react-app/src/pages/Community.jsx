import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Send, X, Trash2 } from 'lucide-react';
import socket from "../socket/postSocket.js";
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

export default function Community() {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userId = storedUser?.id || storedUser?._id;
  const userName = storedUser?.name || 'Ẩn danh';

  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [loadingComments, setLoadingComments] = useState({});

  // ==============================
  // FETCH FEED
  // ==============================
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/posts?userId=${userId}`);
        const data = await res.json();
        setPosts(data.posts || []);
      } catch (err) {
        console.error('Fetch feed error:', err);
        toast.error('Lỗi tải feed');
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchPosts();
  }, [userId]);

  // ==============================
  // SOCKET REALTIME
  // ==============================
  useEffect(() => {
    // Join user room for targeted notifications
    if (userId) {
      socket.emit('user:join', userId);
    }

    // Like realtime
    socket.on('post:like', data => {
      setPosts(prev =>
        prev.map(p =>
          p._id === data.postId
            ? {
                ...p,
                likeCount: data.likeCount,
                isLiked: data.userId === userId ? data.action === 'like' : p.isLiked,
              }
            : p
        )
      );
    });

    // Comment realtime
    socket.on('post:comment', ({ postId, comment, userId: commentUserId }) => {
      setPosts(prev =>
        prev.map(p =>
          p._id === postId
            ? { ...p, commentCount: (p.commentCount || 0) + 1 }
            : p
        )
      );

    //   // Show notification if it's not my comment
    //   if (commentUserId !== userId) {
    //     setNotifications(prev => [{
    //       id: Date.now(),
    //       type: 'comment',
    //       message: `${comment.userId?.name || 'Ai đó'} đã bình luận về bài viết của bạn`,
    //       postId
    //     }, ...prev]);
    //   }
    });

    // New notification
    socket.on('notification:new', (notification) => {
      // Ensure both are strings for comparison
      const notificationRecipientId = notification.recipientId?.toString?.() || notification.recipientId;
      const currentUserId = userId?.toString?.() || userId;
      
      if (notificationRecipientId === currentUserId) {
        setNotifications(prev => [{
          id: Date.now(),
          type: notification.type,
          message: `${notification.senderName} ${notification.content}`,
          postId: notification.postId
        }, ...prev]);
        toast.success(notification.content);
      }
    });

    // New post realtime
    socket.on('post:new', post => {
      setPosts(prev => [post, ...prev]);
    });

    // Delete post
    socket.on('post:delete', postId => {
      setPosts(prev => prev.filter(p => p._id !== postId));
    });

    return () => {
      socket.off('post:like');
      socket.off('post:comment');
      socket.off('notification:new');
      socket.off('post:new');
      socket.off('post:delete');
      socket.off('notification:new');
    };
  }, [userId]);

  // ==============================
  // CREATE POST
  // ==============================
  const createPost = async () => {
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content }),
      });

      if (!res.ok) throw new Error('Lỗi tạo bài viết');

      setContent('');
      toast.success('Đăng bài thành công!');
      // Socket sẽ cập nhật feed
    } catch (err) {
      console.error('Create post error:', err);
      toast.error('Lỗi tạo bài viết');
    } finally {
      setSubmitting(false);
    }
  };

  // ==============================
  // TOGGLE LIKE
  // ==============================
  const toggleLike = async postId => {
    try {
      console.log('👉 Clicking like for post:', postId);
      const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      console.log('✅ Like response:', data);

      if (data.success) {
        // Server will emit socket event, no need to emit from client
        console.log('✅ Like successful, waiting for socket update...');
      }
    } catch (err) {
      console.error('Toggle like error:', err);
      toast.error('Lỗi thích bài viết');
    }
  };

  // ==============================
  // FETCH COMMENTS
  // ==============================
  const fetchComments = async (postId) => {
    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }));
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
      const data = await res.json();

      setPosts(prev =>
        prev.map(p =>
          p._id === postId ? { ...p, comments: data.comments || [] } : p
        )
      );
    } catch (err) {
      console.error('Fetch comments error:', err);
      toast.error('Lỗi tải bình luận');
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  // ==============================
  // CREATE COMMENT
  // ==============================
  const createComment = async (postId) => {
    const text = commentText[postId];
    if (!text || !text.trim()) {
      toast.error('Vui lòng nhập bình luận');
      return;
    }

    try {
      console.log('👉 Creating comment for post:', postId);
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          content: text
        }),
      });

      const data = await res.json();
      console.log('✅ Comment response:', data);

      if (data.success) {
        setCommentText(prev => ({ ...prev, [postId]: '' }));
        
        // Server will emit socket event, no need to emit from client
        console.log('✅ Comment created, waiting for socket update...');

        // Refresh comments
        await fetchComments(postId);
        toast.success('Bình luận thành công!');
      }
    } catch (err) {
      console.error('Create comment error:', err);
      toast.error('Lỗi bình luận');
    }
  };

  // ==============================
  // DELETE POST
  // ==============================
  const deletePost = async (postId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa bài viết này?')) return;

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        socket.emit('post:delete', postId);
        toast.success('Xóa bài viết thành công!');
      }
    } catch (err) {
      console.error('Delete post error:', err);
      toast.error('Lỗi xóa bài viết');
    }
  };

  // ==============================
  // DELETE COMMENT
  // ==============================
  const deleteComment = async (commentId, postId) => {
    if (!window.confirm('Xóa bình luận này?')) return;

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        await fetchComments(postId);
        toast.success('Xóa bình luận thành công!');
      }
    } catch (err) {
      console.error('Delete comment error:', err);
      toast.error('Lỗi xóa bình luận');
    }
  };

  return (
    <div className="min-h-screen bg-[#fff5f8]">
      <div className="mx-auto max-w-2xl px-4 pt-24 pb-16">
        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-rose-600">Community</h1>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200"
          >
            <MessageCircle className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {Math.min(notifications.length, 9)}
              </span>
            )}
          </button>
        </div>

        {/* NOTIFICATIONS PANEL */}
        {showNotifications && (
          <div className="mb-6 rounded-[28px] border border-rose-100 bg-white/90 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Thông báo</h2>
              <button
                onClick={() => setNotifications([])}
                className="text-xs text-rose-500 hover:text-rose-600"
              >
                Xóa tất cả
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="text-center text-sm text-rose-400">Không có thông báo nào</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-slate-700"
                  >
                    <span>{notif.message}</span>
                    <button
                      onClick={() =>
                        setNotifications(prev => prev.filter(n => n.id !== notif.id))
                      }
                      className="text-rose-400 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CREATE POST */}
        <div className="mb-8 rounded-[28px] border border-rose-100 bg-white/90 p-6 shadow">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Bạn đang nghĩ gì?"
            className="w-full resize-none rounded-xl border border-rose-100 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            rows={3}
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={createPost}
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Đăng bài
            </button>
          </div>
        </div>

        {/* FEED */}
        {loading ? (
          <p className="text-center text-rose-400">Đang tải feed...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-rose-400">Chưa có bài viết nào</p>
        ) : (
          <div className="space-y-6">
            {posts.map(post => (
              <div
                key={post._id}
                className="rounded-[28px] border border-rose-100 bg-white/90 p-6 shadow"
              >
                {/* POST HEADER */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-200 to-pink-200 flex items-center justify-center text-sm font-semibold text-rose-600">
                      {post.userId?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {post.userId?.name || 'Ẩn danh'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(post.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  {post.userId?._id === userId && (
                    <button
                      onClick={() => deletePost(post._id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* POST CONTENT */}
                <p className="mt-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* INTERACTIONS */}
                <div className="mt-5 flex items-center gap-6 text-rose-400">
                  <button
                    onClick={() => toggleLike(post._id)}
                    className="flex items-center gap-2 hover:text-rose-500 transition"
                  >
                    <Heart
                      className={`h-5 w-5 transition ${
                        post.isLiked
                          ? 'fill-rose-500 text-rose-500'
                          : ''
                      }`}
                    />
                    <span className="text-sm">{post.likeCount || 0}</span>
                  </button>

                  <button
                    onClick={() => {
                      const newExpanded = !expandedComments[post._id];
                      setExpandedComments(prev => ({
                        ...prev,
                        [post._id]: newExpanded
                      }));
                      if (newExpanded && !post.comments) {
                        fetchComments(post._id);
                      }
                    }}
                    className="flex items-center gap-2 hover:text-rose-500 transition"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm">{post.commentCount || 0}</span>
                  </button>
                </div>

                {/* COMMENTS SECTION */}
                {expandedComments[post._id] && (
                  <div className="mt-6 border-t border-rose-100 pt-4">
                    {/* COMMENT INPUT */}
                    <div className="mb-4 flex gap-3">
                      <input
                        type="text"
                        value={commentText[post._id] || ''}
                        onChange={e =>
                          setCommentText(prev => ({
                            ...prev,
                            [post._id]: e.target.value
                          }))
                        }
                        onKeyPress={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            createComment(post._id);
                          }
                        }}
                        placeholder="Viết bình luận..."
                        className="flex-1 rounded-full border border-rose-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                      <button
                        onClick={() => createComment(post._id)}
                        className="flex items-center justify-center rounded-full bg-rose-500 p-2 text-white hover:bg-rose-600"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>

                    {/* COMMENTS LIST */}
                    <div className="space-y-3">
                      {loadingComments[post._id] ? (
                        <p className="text-center text-xs text-rose-400">Đang tải bình luận...</p>
                      ) : post.comments && post.comments.length > 0 ? (
                        post.comments.map(comment => (
                          <div
                            key={comment._id}
                            className="rounded-lg border border-rose-100 bg-rose-50 p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-xs font-semibold text-slate-800">
                                  {comment.userId?.name || 'Ẩn danh'}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                                  {comment.content}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {new Date(comment.createdAt).toLocaleString('vi-VN')}
                                </p>
                              </div>
                              {comment.userId?._id === userId && (
                                <button
                                  onClick={() => deleteComment(comment._id, post._id)}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-xs text-rose-400">Chưa có bình luận nào</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
