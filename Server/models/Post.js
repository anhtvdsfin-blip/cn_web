import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Content
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  // Images (có thể đăng nhiều ảnh)
  images: [{
    url: String,
    publicId: String // Cloudinary ID để xóa sau này
  }],
  
  // Likes
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Số lượng comment (để query nhanh)
  commentCount: {
    type: Number,
    default: 0
  },
  
  // Privacy
  privacy: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  
  // Status
  isDeleted: {
    type: Boolean,
    default: false
  },
  

}, {
  timestamps: true
});

// Indexes
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ 'likes.userId': 1 });

// Virtual: Like count
postSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Method: Check if user liked
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.userId.toString() === userId.toString());
};

// Method: Toggle like
postSchema.methods.toggleLike = async function(userId) {
  const likeIndex = this.likes.findIndex(
    like => like.userId.toString() === userId.toString()
  );
  
  if (likeIndex > -1) {
    // Unlike
    this.likes.splice(likeIndex, 1);
    return { action: 'unlike', likeCount: this.likes.length };
  } else {
    // Like
    this.likes.push({ userId, createdAt: new Date() });
    return { action: 'like', likeCount: this.likes.length };
  }
};

export default mongoose.model('Post', postSchema);