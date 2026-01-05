import Post from '../models/Post.js';
import User from '../models/User.js'; // ✅ THÊM IMPORT
import { Comment } from '../models/Comment.js';
import { createNotification } from '../models/Notification.js';
import { io } from '../server.js';

// ==========================================
// CREATE POST
// ==========================================
export const createPost = async (req, res) => {
  try {
    const { userId, content, images, privacy } = req.body;

    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const post = await Post.create({
      userId,
      content,
      images: images || [],
      privacy: privacy || 'public'
    });

    await post.populate('userId', 'name avatar');

    // 🔴 REALTIME: post mới
    io.emit('post:new', post);

    res.status(201).json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// GET FEED - ✅ FIXED WITH BLOCK FILTER
// ==========================================
export const getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId } = req.query;
    const skip = (page - 1) * limit;

    // ✅ LẤY DANH SÁCH NGƯỜI BỊ CHẶN
    let blockedUserIds = [];
    if (userId) {
      const currentUser = await User.findById(userId).select('blockedUsers').lean();
      blockedUserIds = currentUser?.blockedUsers || [];
      
      console.log(`📋 User ${userId} has blocked ${blockedUserIds.length} users:`, blockedUserIds);
    }

    // ✅ QUERY với filter người bị chặn
    const query = {
      isDeleted: false,
      ...(blockedUserIds.length > 0 && {
        userId: { $nin: blockedUserIds } // Loại bỏ posts của người bị chặn
      })
    };

    console.log('🔍 Query filter:', JSON.stringify(query));

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name avatar gender age hometown')
      .lean();

    console.log(`✅ Found ${posts.length} posts after blocking filter`);

    // ✅ Map kết quả với isLiked
    const result = posts.map(post => ({
      ...post,
      likeCount: post.likes?.length || 0,
      isLiked: userId
        ? post.likes?.some(like => like.userId.toString() === userId)
        : false
    }));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts: result,
      pagination: {
        page: +page,
        limit: +limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// TOGGLE LIKE POST
// ==========================================
export const toggleLikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const result = await post.toggleLike(userId);
    await post.save();

    // 🔔 Notification
    if (result.action === 'like' && post.userId.toString() !== userId) {
      await createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: 'like',
        postId: post._id,
        content: 'đã thích bài viết của bạn'
      });
    }

    // 🔴 REALTIME: update like cho TẤT CẢ client
    io.emit('post:like', {
      postId: post._id.toString(),
      likeCount: post.likes.length,
      userId,
      action: result.action
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// GET COMMENTS - ✅ ADDED WITH BLOCK FILTER
// ==========================================
export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.query; // Người đang xem

    // ✅ LẤY DANH SÁCH NGƯỜI BỊ CHẶN
    let blockedUserIds = [];
    if (userId) {
      const currentUser = await User.findById(userId).select('blockedUsers').lean();
      blockedUserIds = currentUser?.blockedUsers || [];
    }

    // ✅ QUERY với filter người bị chặn
    const query = {
      postId,
      ...(blockedUserIds.length > 0 && {
        userId: { $nin: blockedUserIds } // Loại comments của người bị chặn
      })
    };

    const comments = await Comment.find(query)
      .sort({ createdAt: 1 })
      .populate('userId', 'name avatar')
      .lean();

    console.log(`✅ Found ${comments.length} comments (filtered ${blockedUserIds.length} blocked users)`);

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// CREATE COMMENT
// ==========================================
export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, content, parentCommentId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const comment = await Comment.create({
      postId,
      userId,
      content,
      parentCommentId: parentCommentId || null
    });

    await comment.populate('userId', 'name avatar');

    // 🔢 Fix commentCount
    post.commentCount += 1;
    await post.save();

    // 🔔 Notification
    let notification = null;
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId);
      if (parent && parent.userId.toString() !== userId) {
        notification = await createNotification({
          recipientId: parent.userId,
          senderId: userId,
          type: 'reply',
          postId,
          commentId: comment._id,
          content: 'đã trả lời bình luận của bạn'
        });
      }
    } else if (post.userId.toString() !== userId) {
      notification = await createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: 'comment',
        postId,
        commentId: comment._id,
        content: 'đã bình luận bài viết của bạn'
      });
    }

    // 🔔 Emit notification qua socket
    if (notification) {
      // Populate notification để gửi đầy đủ thông tin
      await notification.populate('senderId', 'name avatar');
      await notification.populate('postId', 'content');
      
      const recipientId = notification.recipientId.toString();
      console.log(`📤 Emitting notification to notifications_${recipientId}`, notification);
      
      io.to(`notifications_${recipientId}`).emit('new_notification', notification);
    }

    // 🔴 REALTIME: comment mới
    io.emit('post:comment', {
      postId,
      comment,
      userId // ✅ Thêm userId để client có thể filter
    });

    res.status(201).json({
      success: true,
      comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// DELETE POST
// ==========================================
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    if (post.userId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    post.isDeleted = true;
    await post.save();

    // 🔴 REALTIME: remove post
    io.emit('post:delete', postId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// DELETE COMMENT
// ==========================================
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await Comment.findByIdAndDelete(commentId);

    // ✅ Giảm commentCount
    await Post.findByIdAndUpdate(comment.postId, {
      $inc: { commentCount: -1 }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};