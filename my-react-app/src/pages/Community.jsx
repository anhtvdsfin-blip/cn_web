import { useEffect, useMemo, useState, useContext } from 'react';
// ✅ IMPORT THÊM các icon liên quan đến ảnh
import { Heart, MessageCircle, Send, X, Trash2, MoreHorizontal, Image, XCircle } from 'lucide-react'; 
import { SocketContext } from '../contexts';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import InputModal from '../components/InputModal';

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
  const [blockedUsers, setBlockedUsers] = useState([]); 
  
  // ✅ THÊM STATE CHO ẢNH
  const [selectedImage, setSelectedImage] = useState(null); 
  const [previewImage, setPreviewImage] = useState(null); 

  // ✅ STATE CHO CONFIRM MODALS
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: 'default',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ✅ STATE CHO REPORT MODAL
  const [reportModal, setReportModal] = useState({
    isOpen: false,
    targetUser: null,
  });
  const [reportText, setReportText] = useState('');

  const openConfirmModal = ({ type = 'default', title, message, onConfirm }) => {
    setConfirmModal({ isOpen: true, type, title, message, onConfirm });
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // --- Image Handling ---
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Vui lòng chọn file ảnh.');
        return;
      }
      setSelectedImage(file);
      setPreviewImage(URL.createObjectURL(file));    }
  };  
  const removeImage = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage); 
    }
    setSelectedImage(null);
    setPreviewImage(null);
    const fileInput = document.getElementById('post-image-upload');
    if (fileInput) fileInput.value = null; 
  };


  // ==============================
  // FETCH FEED - giữ nguyên
  // ==============================
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        
        // ⚠️ TẠM THỜI COMMENT OUT - sẽ fix sau khi có đúng API endpoint
        /* (logic fetch blockedUsers) */
        
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
  // SOCKET REALTIME - giữ nguyên
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
      const currentUserId = userId?.toString();
      
      console.log('📥 Socket post:new received:', post._id, 'from:', post.userId?.name, 'author:', postAuthorId, 'currentUser:', currentUserId);
      
      // ⛔ IGNORE nếu post này là của CHÍNH MÌNH (đã optimistic update rồi)
      if (postAuthorId === currentUserId) {
        console.log('⏭️ Skipping own post from socket (already added via optimistic update)');
        return;
      }
      
      // Check nếu author bị chặn thì không thêm vào feed
      if (!blockedUsers.includes(postAuthorId)) {
        console.log('✅ Adding new post from:', post.userId?.name);
        setPosts(prev => {
          // Tránh duplicate nếu bài đăng này đã tồn tại
          if (prev.some(p => p._id === post._id)) {
            console.log('⏭️ Post already exists, skipping');
            return prev;
          }
          return [post, ...prev];
        });
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
  }, [userId, blockedUsers, socket, setNotifications, setUnreadCount]);
    
  // ==============================
  // BLOCK OR REPORT
  // ==============================
  const handleBlockOrReport = async (targetUser, type) => {
    if (actionLoading) return;
    
    // ✅ Lấy ID chính xác từ target user object
    const targetId = (targetUser?._id || targetUser?.id || targetUser)?.toString();
    const targetName = targetUser?.name || 'người dùng này';
    const currentUserId = (storedUser?.id || storedUser?._id)?.toString();

    if (!currentUserId) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    
// Xác nhận block - sử dụng ConfirmModal
    if (type === 'block') {
        setShowMenu({});
        openConfirmModal({
            type: 'danger',
            title: 'Chặn người dùng',
            message: `Bạn có chắc chắn muốn CHẶN ${targetName} không?\nBạn sẽ không thấy bài viết/bình luận của họ nữa.`,
            onConfirm: () => executeBlockOrReport(targetUser, 'block'),
        });
        return;
    }
    
    // Báo cáo - sử dụng InputModal
    if (type === 'report') {
        setShowMenu({});
        setReportText('');
        setReportModal({
            isOpen: true,
            targetUser: targetUser,
        });
        return;
    }
  };

  // ✅ FUNCTION THỰC HIỆN BLOCK/REPORT
  const executeBlockOrReport = async (targetUser, type, reason) => {
    const targetId = (targetUser?._id || targetUser?.id || targetUser)?.toString();
    const targetName = targetUser?.name || 'người dùng này';
    const currentUserId = (storedUser?.id || storedUser?._id)?.toString();

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
  // CREATE POST - ✅ SỬ DỤNG FormData và FIX REALTIME
  // ==============================
	const createPost = async () => {
		// ✅ Thêm kiểm tra ảnh vào điều kiện
		if (!content.trim() && !selectedImage) {
			toast.error('Vui lòng nhập nội dung hoặc chọn ảnh để đăng bài.');
			return;
		}

		// ensure we have a valid userId (try stored state or sessionStorage fallback)
		const sessionUser = (() => {
			try { return JSON.parse(sessionStorage.getItem('user') || '{}'); } catch { return {}; }
		})();
		const uid = (userId || sessionUser?.id || sessionUser?._id);
		if (!uid) {
			toast.error('Vui lòng đăng nhập để đăng bài.');
			return;
		}

		// ✅ SỬ DỤNG FormData để gửi file
		const formData = new FormData();
		formData.append('userId', uid);
		formData.append('content', content || '');
    
		if (selectedImage) {
			formData.append('image', selectedImage); // Tên trường phải là 'image' ở Backend
		}

		try {
			setSubmitting(true);
			console.debug('Creating post', { userId: uid, hasImage: !!selectedImage, contentLength: (content||'').length });
			const token = sessionStorage.getItem('accessToken');
			const res = await fetch(`${API_URL}/api/posts`, {
				method: 'POST',
				// Let browser set Content-Type for FormData; include Authorization if present
				headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
				body: formData,
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || errorData.message || 'Lỗi tạo bài viết');
			}

			// ✅ FIX REALTIME: Lấy bài đăng mới từ response
			const data = await res.json();
			const newPost = data.post; 
      
			console.log('📝 New post created:', newPost._id, 'createdAt:', newPost.createdAt);
      
			// ✅ FIX REALTIME: Cập nhật state posts ngay lập tức
			if (newPost) {
				setPosts(prev => {
					console.log('📊 Current posts count:', prev.length);
					console.log('📊 First post createdAt:', prev[0]?.createdAt);
					console.log('📊 New post createdAt:', newPost.createdAt);
					return [newPost, ...prev];
				});
			}

			setContent('');
			removeImage(); // ✅ Reset ảnh
			toast.success('Đăng bài thành công!');
		} catch (err) {
			console.error('Create post error:', err);
			toast.error(err.message || 'Lỗi tạo bài viết');
		} finally {
			setSubmitting(false);
		}
	};

  // ==============================
  // TOGGLE LIKE - giữ nguyên
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
  // FETCH COMMENTS - giữ nguyên
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
  // CREATE COMMENT - giữ nguyên
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
  // DELETE POST
  // ==============================
  const deletePost = (postId) => {
    openConfirmModal({
      type: 'danger',
      title: 'Xóa bài viết',
      message: 'Bạn chắc chắn muốn xóa bài viết này?',
      onConfirm: () => executeDeletePost(postId),
    });
  };

  const executeDeletePost = async (postId) => {
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
  // DELETE COMMENT
  // ==============================
  const deleteComment = (commentId, postId) => {
    openConfirmModal({
      type: 'danger',
      title: 'Xóa bình luận',
      message: 'Bạn có chắc chắn muốn xóa bình luận này?',
      onConfirm: () => executeDeleteComment(commentId, postId),
    });
  };

  const executeDeleteComment = async (commentId, postId) => {
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
		<div className="min-h-screen bg-gradient-to-br from-[#fff4f6] via-[#fff8fb] to-[#fffaf6]">
			{/* CONFIRM MODAL */}
			<ConfirmModal
				isOpen={confirmModal.isOpen}
				onClose={closeConfirmModal}
				onConfirm={confirmModal.onConfirm}
				title={confirmModal.title}
				message={confirmModal.message}
				type={confirmModal.type}
				confirmText="Xác nhận"
				cancelText="Hủy"
			/>

			{/* REPORT MODAL */}
			<InputModal
				isOpen={reportModal.isOpen}
				onClose={() => {
					setReportModal({ isOpen: false, targetUser: null });
					setReportText('');
				}}
				title={`Báo cáo ${reportModal.targetUser?.name || 'người dùng'}`}
				message="Vui lòng mô tả lý do bạn báo cáo người này."
				placeholder="Nội dung báo cáo (không bắt buộc)"
				confirmText="Gửi báo cáo"
				cancelText="Hủy"
				value={reportText}
				onChange={setReportText}
				onSubmit={(reason) => {
					executeBlockOrReport(reportModal.targetUser, 'report', reason);
					setReportModal({ isOpen: false, targetUser: null });
					setReportText('');
				}}
			/>

			<div className="mx-auto max-w-2xl px-4 pt-28 pb-16">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-rose-600">Community</h1>
        </div>

        {/* CREATE POST */}
				<div className="mb-8 rounded-3xl border border-rose-50 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
					<textarea
						value={content}
						onChange={e => setContent(e.target.value)}
						placeholder="Bạn đang nghĩ gì?"
						className="w-full resize-none rounded-2xl border border-rose-100 bg-white/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:italic placeholder:text-rose-200"
						rows={3}
					/>
          
          {/* ✅ HIỂN THỊ VÀ XÓA ẢNH PREVIEW */}
					{previewImage && (
						<div className="relative mt-4 rounded-xl border border-rose-100 overflow-hidden">
							<img 
								src={previewImage} 
								alt="Preview" 
								className="w-full object-contain max-h-72 bg-black/2" 
								style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
							/>
              <button 
                onClick={removeImage} 
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 transition hover:bg-black/70"
                title="Xóa ảnh"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          )}

		  <div className="mt-4 flex justify-between items-center">
            {/* ✅ NÚT CHỌN ẢNH (Dùng label cho input hidden) */}
						<label
							htmlFor="post-image-upload"
							className="flex items-center gap-2 rounded-full text-sm font-semibold text-[#F08A74] cursor-pointer px-3 py-1 hover:bg-rose-50 transition"
						>
							<Image className="h-4 w-4" />
							Thêm ảnh
						</label>
            <input
              id="post-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              disabled={submitting}
            />

						<button
							onClick={createPost}
							disabled={submitting || (!content.trim() && !selectedImage)}
							className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F7C6B7] to-rose-400 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:scale-105 disabled:opacity-60 transition-transform"
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
					<div className="space-y-8">
            {posts.map(post => {
              // ✅ Lấy ID người đăng bài một cách an toàn
              const postAuthorId = (post.userId?._id || post.userId?.id || post.userId)?.toString();
              const currentUserId = (userId)?.toString();
              const isOwnPost = postAuthorId === currentUserId;

              // ✅ LẤY URL ẢNH (kiểm tra cả object {url} và string URL)
              const postImageUrl = post.images && post.images.length > 0 
                ? post.images[0].url || post.images[0] 
                : null;
              
								return (
									<div
										key={post._id}
										className="rounded-3xl border border-rose-50 bg-white/80 p-6 shadow-xl"
									>
                  {/* POST HEADER */}
                  <div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											{post.userId?.avatar || post.userId?.photo ? (
												<img src={post.userId.avatar || post.userId.photo} alt={post.userId?.name} className="h-10 w-10 rounded-full object-cover border-2 border-rose-50" />
											) : (
												<div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-200 to-pink-200 flex items-center justify-center text-sm font-semibold text-rose-600">
													{post.userId?.name?.charAt(0) || '?'}
												</div>
											)}
											<div>
												<p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
													<span>{post.userId?.name || 'Ẩn danh'}</span>
													{(post.userId?.major || post.userId?.kclass) && (
														<span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">{post.userId?.major || post.userId?.kclass}</span>
													)}
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
                              className="w-full px-4 py-2 text-left text-sm  hover:bg-rose-50 disabled:opacity-60 transition"
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
					
                  {/* ✅ HIỂN THỊ ẢNH ĐÍNH KÈM */}
		  {postImageUrl && (
									<div className="mt-4">
										<img
											src={postImageUrl}
											alt="Bài đăng có ảnh"
											className="w-full rounded-xl object-contain max-h-96 block mx-auto"
											style={{ maxWidth: '100%' }}
										/>
									</div>
		  )}

									{/* INTERACTIONS */}
									<div className="mt-5 flex items-center gap-6 text-slate-600">
										<button
											onClick={() => toggleLike(post._id)}
											className={`flex items-center gap-2 transition ${post.isLiked ? 'text-rose-500' : 'hover:text-rose-500'}`}
										>
											<Heart className="h-5 w-5" />
											<span className={`text-sm ${post.isLiked ? 'text-rose-500' : ''}`}>{post.likeCount || 0}</span>
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
											className="rounded-lg border border-100 bg-rose-50 p-3"
										>
											<div className="flex items-start justify-between">
												<div className="flex items-start gap-3">
													<div className="flex-shrink-0">
														{(comment.userId?.avatar || comment.userId?.photo) ? (
															<img
																src={comment.userId?.avatar || comment.userId?.photo}
																alt={comment.userId?.name || 'Avatar'}
																className="h-8 w-8 rounded-full object-cover"
															/>
														) : (
															<div className="h-8 w-8 rounded-full bg-rose-200 flex items-center justify-center text-xs font-semibold text-rose-700">
																{((comment.userId?.name || 'Ẩn').split(' ').map(n => n[0]).join('').slice(0,2)).toUpperCase()}
															</div>
														)}
													</div>
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
