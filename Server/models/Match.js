import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  tempChatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TemporaryChat'
  },

  chatRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom'
  },

  // Last message (preview only)
  lastMessage: {
    text: String,
    senderId: mongoose.Schema.Types.ObjectId,
    timestamp: Date
  },

  // Unread count per user
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },

  // Typing indicator
  typing: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'matched', 'expired', 'closed'],
    default: 'active'
  },
  
  // Likes during temp chat
  user1Liked: {
    type: Boolean,
    default: false
  },
  user1LikedAt: Date,
  user2Liked: {
    type: Boolean,
    default: false
  },
  user2LikedAt: Date,

  // Linked conversation after matching
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  
  // Compatibility score
  compatibilityScore: Number,
  compatibilityBreakdown: Object,
  // Selected opening moves at time of match (optional)
  openingMoveUser1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OpeningMove',
    default: null,
  },
  openingMoveUser2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OpeningMove',
    default: null,
  },
    
  // Metadata
  matchedAt: Date, // Khi cả 2 like
  expiresAt: Date, // Hết hạn sau 3 phút
  // Crush (BK Crush) statuses
  isCrushStatusA: {
    type: Boolean,
    default: false
  },
  isCrushStatusB: {
    type: Boolean,
    default: false
  },
  crushAtA: Date,
  crushAtB: Date,
  isMutualCrush: {
    type: Boolean,
    default: false
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index để query nhanh
matchSchema.index({ user1Id: 1, user2Id: 1 });
matchSchema.index({ status: 1, expiresAt: 1 });
matchSchema.index({ user1Id: 1,user2Id: 1 }, { unique: true });

// Method: Check if matched
matchSchema.methods.isMatched = function() {
  return this.user1Liked && this.user2Liked;
};

// Method: Check if expired
matchSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

export default mongoose.model('Match', matchSchema);
