import express from 'express';
import Post from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { createNotification } from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

// ==========================================
// CREATE POST
// ==========================================
router.post('/posts', async (req, res) => {
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

    if (req.io) {
      req.io.emit('post:new', post);
    }

    res.status(201).json({
      success: true,
      post
    });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// GET FEED - ✅ FIXED WITH BLOCK FILTER
// ==========================================
router.get('/posts', async (req, res) => {
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
        userId: { $nin: blockedUserIds }
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

    // Add isLiked flag for current user
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      likeCount: post.likes ? post.likes.length : 0,
      isLiked: userId ? post.likes?.some(like => like.userId.toString() === userId) : false
    }));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts: postsWithLikeStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// GET SINGLE POST
// ==========================================
router.get('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.query;

    const post = await Post.findById(postId)
      .populate('userId', 'name avatar gender age hometown')
      .lean();

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    post.likeCount = post.likes ? post.likes.length : 0;
    post.isLiked = userId ? post.likes?.some(like => like.userId.toString() === userId) : false;

    res.json({
      success: true,
      post
    });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// LIKE/UNLIKE POST
// ==========================================
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    const result = await post.toggleLike(userId);
    await post.save();

    if (req.io) {
      req.io.emit('post:like', {
        postId,
        userId,
        action: result.action,
        likeCount: result.likeCount
      });
    }

    if (result.action === 'like') {
      const user = await User.findById(userId);
      await createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: 'like',
        postId: post._id,
        content: 'đã thích bài viết của bạn'
      });

      if (req.emitNotification && post.userId.toString() !== userId) {
        req.emitNotification(post.userId.toString(), {
          type: 'like',
          recipientId: post.userId,
          senderId: userId,
          senderName: user?.name || 'Ai đó',
          postId,
          content: `đã thích bài viết của bạn`,
          timestamp: new Date()
        });
      }
    }

    res.json({
      success: true,
      action: result.action,
      likeCount: result.likeCount,
      isLiked: result.action === 'like'
    });

  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// DELETE POST - ✅ WITH REAL-TIME SOCKET
// ==========================================
router.delete('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    if (post.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    post.isDeleted = true;
    await post.save();

    // ✅ EMIT SOCKET EVENT để tất cả users thấy real-time
    if (req.io) {
      req.io.emit('post:delete', postId);
      console.log('🗑️ Socket emitted: post:delete', postId);
    }

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// GET COMMENTS - ✅ FIXED WITH BLOCK FILTER
// ==========================================
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20, userId } = req.query;
    const skip = (page - 1) * limit;

    // ✅ LẤY DANH SÁCH NGƯỜI BỊ CHẶN
    let blockedUserIds = [];
    if (userId) {
      const currentUser = await User.findById(userId).select('blockedUsers').lean();
      blockedUserIds = currentUser?.blockedUsers || [];
      
      console.log(`💬 User ${userId} has blocked ${blockedUserIds.length} users for comments`);
    }

    // ✅ QUERY với filter người bị chặn
    const commentQuery = {
      postId,
      isDeleted: false,
      parentCommentId: null,
      ...(blockedUserIds.length > 0 && {
        userId: { $nin: blockedUserIds }
      })
    };

    const comments = await Comment.find(commentQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name avatar')
      .lean();

    // Get replies for each comment (cũng filter blocked users)
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replyQuery = {
          parentCommentId: comment._id,
          isDeleted: false,
          ...(blockedUserIds.length > 0 && {
            userId: { $nin: blockedUserIds }
          })
        };

        const replies = await Comment.find(replyQuery)
          .sort({ createdAt: 1 })
          .populate('userId', 'name avatar')
          .lean();

        return {
          ...comment,
          likeCount: comment.likes ? comment.likes.length : 0,
          replies
        };
      })
    );

    console.log(`✅ Found ${commentsWithReplies.length} comments (filtered blocked users)`);

    res.json({
      success: true,
      comments: commentsWithReplies
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// CREATE COMMENT
// ==========================================
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, content, parentCommentId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    const comment = await Comment.create({
      postId,
      userId,
      content,
      parentCommentId: parentCommentId || null
    });

    await comment.populate('userId', 'name avatar');

    if (!parentCommentId) {
      post.commentCount += 1;
      await post.save();
    }

    if (req.io) {
      req.io.emit('post:comment', {
        postId,
        comment,
        userId,
        senderName: comment.userId?.name || 'Ai đó',
        postOwnerId: post.userId
      });
    }

    const user = await User.findById(userId);
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment) {
        await createNotification({
          recipientId: parentComment.userId,
          senderId: userId,
          type: 'reply',
          postId: post._id,
          commentId: comment._id,
          content: 'đã trả lời bình luận của bạn'
        });

        if (req.emitNotification && parentComment.userId.toString() !== userId) {
          req.emitNotification(parentComment.userId.toString(), {
            type: 'reply',
            recipientId: parentComment.userId,
            senderId: userId,
            senderName: user?.name || 'Ai đó',
            postId,
            content: `đã trả lời bình luận của bạn`,
            timestamp: new Date()
          });
        }
      }
    } else {
      await createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: 'comment',
        postId: post._id,
        commentId: comment._id,
        content: 'đã bình luận về bài viết của bạn'
      });

      if (req.emitNotification && post.userId.toString() !== userId) {
        req.emitNotification(post.userId.toString(), {
          type: 'comment',
          recipientId: post.userId,
          senderId: userId,
          senderName: user?.name || 'Ai đó',
          postId,
          content: `đã bình luận về bài viết của bạn`,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      comment
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// DELETE COMMENT
// ==========================================
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    if (comment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    comment.isDeleted = true;
    await comment.save();

    if (!comment.parentCommentId) {
      await Post.findByIdAndUpdate(comment.postId, {
        $inc: { commentCount: -1 }
      });
    }

    // ✅ EMIT SOCKET (QUAN TRỌNG)
    if (req.io) {
      req.io.emit('comment:delete', {
        commentId,
        postId: comment.postId,
        deletedBy: userId
      });

      console.log('🗑️ Socket emitted: comment:delete', {
        commentId,
        postId: comment.postId,
        deletedBy: userId
      });
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;