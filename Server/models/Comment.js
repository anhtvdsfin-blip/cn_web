import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Reply to another comment
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  
  // Likes on comment
  likes: [{
    userId: mongoose.Schema.Types.ObjectId,
    createdAt: Date
  }],
  
  // Status
  isDeleted: {
    type: Boolean,
    default: false
  },
  
}, {
  timestamps: true
});

// Indexes
commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });
commentSchema.index({ parentCommentId: 1 });

// Virtual: Like count
commentSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

export const Comment = mongoose.model('Comment', commentSchema);