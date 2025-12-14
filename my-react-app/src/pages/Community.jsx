import { useEffect, useMemo, useState, useContext } from 'react';
import { Heart, MessageCircle, Send, X, Trash2, MoreHorizontal } from 'lucide-react'; 
import { SocketContext } from '../contexts';
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
  const { socket, notifications, setNotifications, unreadCount, setUnreadCount } = useContext(SocketContext) ?? {};
  const [expandedComments, setExpandedComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [actionLoading, setActionLoading] = useState(false); 
  const [showMenu, setShowMenu] = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]); // ✅ THÊM STATE 

  // ==============================
  // FETCH FEED - ✅ Tạm thời tắt load blockedUsers
  // ==============================
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        
        // ⚠️ TẠM THỜI COMMENT OUT - sẽ fix sau khi có đúng API endpoint
        /*
        try {
          const userRes = await fetch(`${API_URL}/api/users/${userId}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            const blocked = userData.user?.blockedUsers || userData.blockedUsers || [];
            setBlockedUsers(blocked.map(id => id?.toString?.() || id));
            console.log('🚫 Blocked users loaded:', blocked.length, blocked);
          } else {
            setBlockedUsers([]);
          }
        } catch (userErr) {
          console.warn('⚠️ Error fetching blockedUsers:', userErr);
          setBlockedUsers([]);
        }
        */
        
        // Fetch posts
        const res = await fetch(`${API_URL}/api/posts?userId=${userId}`);
        const data = await res.json();
        
        console.log('📋 Posts loaded:', data.posts?.length || 0);
        if (data.posts?.[0]) {
          console.log('👤 Sample post userId structure:', data.posts[0].userId);
        }
        
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
  // SOCKET REALTIME - ✅ FIXED với Block Filter + Delete events
  // ==============================
  useEffect(() => {
    if (!socket) return;

    if (userId) {
      socket.emit('user:join', userId);
    }

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

socket.on('post:comment', ({ postId, comment, userId: commentUserId }) => {
  setPosts(prev =>
    prev.map(p => {
      if (p._id !== postId) return p;

      const existingComments = p.comments || [];
      // ✅ Tránh duplicate khi comment đã có (optimistic update)
      const isDuplicate = existingComments.some(c => c._id === comment._id);
      if (isDuplicate) return p;

      return {
        ...p,
        comments: [...existingComments, comment],
        commentCount: (p.commentCount || 0) + 1
      };
    })
  );
});



    socket.on('notification:new', (notification) => {
      const notificationRecipientId = notification.recipientId?.toString?.() || notification.recipientId;
      const currentUserId = userId?.toString?.() || userId;

      if (notificationRecipientId === currentUserId) {
        // push to global notifications stored in SocketContext so Navbar shows it
        setNotifications?.(prev => [{
          _id: notification._id || String(Date.now()),
          isRead: false,
          type: notification.type,
          content: notification.content,
          senderName: notification.senderName,
          createdAt: notification.createdAt || new Date().toISOString(),
          postId: notification.postId
        }, ...(prev || [])]);

        // increment unread count in global context
        setUnreadCount?.(c => (Number(c || 0) + 1));

        toast.success(notification.content);
      }
    });

    // ✅ FIXED: Filter post:new từ người bị chặn
    socket.on('post:new', (post) => {
      const postAuthorId = (post.userId?._id || post.userId?.id || post.userId)?.toString();
      
      // Check nếu author bị chặn thì không thêm vào feed
      if (!blockedUsers.includes(postAuthorId)) {
        console.log('✅ Adding new post from:', post.userId?.name);
        setPosts(prev => [post, ...prev]);
      } else {
        console.log('🚫 Blocked new post from:', post.userId?.name, postAuthorId);
      }
    });

    // ✅ NEW: Real-time delete post
    socket.on('post:delete', postId => {
      console.log('🗑️ Real-time: Post deleted:', postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
    });

    // ✅ NEW: Real-time delete comment
socket.on('comment:delete', ({ commentId, postId, deletedBy }) => {
  // ⛔ BỎ QUA nếu chính mình xóa (đã optimistic update rồi)
  if (deletedBy?.toString() === userId?.toString()) return;

  console.log('🗑️ Realtime comment delete from other user');

  setPosts(prev =>
    prev.map(p =>
      p._id === postId
        ? {
            ...p,
            commentCount: Math.max(0, (p.commentCount || 0) - 1),
            comments: p.comments?.filter(c => c._id !== commentId)
          }
        : p
    )
  );
});
    return () => {
      socket.off('post:like');
      socket.off('post:comment');
      socket.off('notification:new');
      socket.off('post:new');
      socket.off('post:delete');
      socket.off('comment:delete');
    };
  }, [userId, blockedUsers, socket, setNotifications, setUnreadCount]); // ✅ THÊM blockedUsers + socket into dependencies
    
  // ==============================
  // BLOCK OR REPORT - FIXED VERSION
  // ==============================
  const handleBlockOrReport = async (targetUser, type) => {
    if (actionLoading) return;
    
    // ✅ Lấy ID chính xác từ target user object
    const targetId = (targetUser?._id || targetUser?.id || targetUser)?.toString();
    const targetName = targetUser?.name || 'người dùng này';
    
    if (!targetId) {
        console.error('❌ Invalid targetId:', targetUser);
        toast.error("Không tìm thấy thông tin người dùng cần chặn.");
        return;
    }
    
    const currentUserId = (storedUser?.id || storedUser?._id)?.toString();

    if (!currentUserId) {
        toast.error("Vui lòng đăng nhập để thực hiện hành động này.");
        return;
    }
    
    // Không thể block/report chính mình
    if (currentUserId === targetId) {
        toast.error("Bạn không thể thực hiện hành động này với chính mình.");
        return;
    }
    
    // Xác nhận block
    if (type === 'block') {
        const confirmBlock = window.confirm(
            `Bạn có chắc chắn muốn CHẶN ${targetName} không?\nBạn sẽ không thấy bài viết/bình luận của họ nữa.`
        );
        if (!confirmBlock) {
            setShowMenu({});
            return;
        }
    }
    
    // Lấy lý do report
    let reason = undefined;
    if (type === 'report') {
        reason = prompt("Vui lòng cho biết lý do báo cáo (Không bắt buộc):");
        if (reason === null) { // User clicked Cancel
            setShowMenu({});
            return;
        }
    }
    
    const endpointPath = type === 'block' ? `block/${targetId}` : `report/${targetId}`;
    const apiUrl = `${API_URL}/api/users/${endpointPath}`;
    
    const requestBody = {
        blockerId: currentUserId,
        reporterId: currentUserId,
        reason: reason || undefined,
    };

    console.log('🎯 Block/Report request:', {
        type,
        apiUrl,
        targetId,
        targetName,
        blockerId: currentUserId,
        requestBody
    });

    setActionLoading(true);
    setShowMenu({});

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const responseData = await res.json();
        console.log('📥 Server response:', responseData);

        if (!res.ok) {
            throw new Error(responseData.message || 'Yêu cầu thất bại từ Server');
        }

        const message = type === 'block' 
            ? `Đã chặn ${targetName} thành công.` 
            : `Đã gửi báo cáo về ${targetName}.`;
        
        toast.success(message); 
        
        // ✅ Cập nhật blockedUsers state khi block thành công
        if (type === 'block') {
            setBlockedUsers(prev => [...prev, targetId]);
            
            // Lọc bài viết của người bị chặn ra khỏi feed
            setPosts(prevPosts => prevPosts.filter(p => {
                const postUserId = (p.userId?._id || p.userId?.id || p.userId)?.toString();
                const isBlocked = postUserId === targetId;
                
                if (isBlocked) {
                    console.log('🚫 Filtering out post from blocked user:', p._id);
                }
                
                return !isBlocked;
            }));
        }
    } catch (error) {
        console.error("❌ Block/Report error:", error);
        toast.error(`Thao tác thất bại: ${error.message || 'Lỗi kết nối Server.'}`);
    } finally {
        setActionLoading(false);
    }
  };
    
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
        console.log('✅ Like successful, waiting for socket update...');
      }
    } catch (err) {
      console.error('Toggle like error:', err);
      toast.error('Lỗi thích bài viết');
    }
  };

  // ==============================
  // FETCH COMMENTS - ✅ FIXED với userId
  // ==============================
  const fetchComments = async (postId) => {
    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }));
      
      // ✅ THÊM userId vào query để backend filter được
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments?userId=${userId}`);
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
    setCommentText(prev => ({ ...prev, [postId]: '' }));

    const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        content: text
      }),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Lỗi bình luận');
    }

    // ✅ Optimistic update: thêm comment vào ngay nếu chưa có trong state
    setPosts(prev =>
      prev.map(p => {
        if (p._id !== postId) return p;

        const existingComments = p.comments || [];
        const isDuplicate = existingComments.some(c => c._id === data.comment._id);

        if (isDuplicate) return p;

        return {
          ...p,
          comments: [...existingComments, data.comment],
          commentCount: (p.commentCount || 0) + 1
        };
      })
    );

    toast.success('Bình luận thành công!');
  } catch (err) {
    console.error('Create comment error:', err);
    toast.error(err.message || 'Lỗi bình luận');
  }
};



  // ==============================
  // DELETE POST - ✅ KHÔNG CẦN emit socket nữa (backend đã làm)
  // ==============================
  const deletePost = async (postId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa bài viết này?')) return;

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ Xóa ngay khỏi UI (optimistic update)
        setPosts(prev => prev.filter(p => p._id !== postId));
        
        // ❌ KHÔNG CẦN emit socket nữa - backend đã emit rồi
        // socket.emit('post:delete', postId);
        
        toast.success('Xóa bài viết thành công!');
      } else {
        throw new Error(data.error || 'Không thể xóa bài viết');
      }
    } catch (err) {
      console.error('Delete post error:', err);
      toast.error(err.message || 'Lỗi xóa bài viết');
    }
  };

  // ==============================
  // DELETE COMMENT - ✅ KHÔNG CẦN emit socket (backend đã làm)
  // ==============================
  const deleteComment = async (commentId, postId) => {
    if (!window.confirm('Xóa bình luận này?')) return;

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ Optimistic update: Xóa comment và giảm count ngay
        setPosts(prev =>
          prev.map(p =>
            p._id === postId
              ? { 
                  ...p, 
                  commentCount: Math.max(0, (p.commentCount || 0) - 1),
                  comments: p.comments?.filter(c => c._id !== commentId)
                }
              : p
          )
        );
        
        // ❌ KHÔNG CẦN emit socket nữa - backend đã emit rồi
        
        toast.success('Xóa bình luận thành công!');
      } else {
        throw new Error(data.error || 'Không thể xóa bình luận');
      }
    } catch (err) {
      console.error('Delete comment error:', err);
      toast.error(err.message || 'Lỗi xóa bình luận');
    }
  };

  return (
    <div className="min-h-screen bg-[#fff5f8]">
      <div className="mx-auto max-w-2xl px-4 pt-24 pb-16">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-rose-600">Community</h1>
        </div>

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
            {posts.map(post => {
              // ✅ Lấy ID người đăng bài một cách an toàn
              const postAuthorId = (post.userId?._id || post.userId?.id || post.userId)?.toString();
              const currentUserId = (userId)?.toString();
              const isOwnPost = postAuthorId === currentUserId;
              
              return (
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
                      
                    {/* BLOCK/REPORT MENU hoặc DELETE BUTTON */}
                    {!isOwnPost ? (
                      <div className="relative">
                        <button
                          onClick={() => setShowMenu(prev => ({ 
                            ...prev, 
                            [post._id]: !prev[post._id] 
                          }))}
                          disabled={actionLoading}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-50 transition"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        
                        {showMenu[post._id] && (
                          <div className="absolute right-0 top-6 z-10 w-44 rounded-lg border border-rose-100 bg-white shadow-lg">
                            <button
                              onClick={() => handleBlockOrReport(post.userId, 'report')}
                              disabled={actionLoading}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 disabled:opacity-60 transition"
                            >
                              Báo cáo người dùng
                            </button>
                            <button
                              onClick={() => handleBlockOrReport(post.userId, 'block')}
                              disabled={actionLoading}
                              className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60 transition"
                            >
                              Chặn người dùng
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => deletePost(post._id)}
                        className="text-slate-400 hover:text-red-500 transition"
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}