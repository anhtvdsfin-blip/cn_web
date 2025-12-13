import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

// ----------------------------
// GET LIST CONVERSATIONS
// ----------------------------
export const getConversations = async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await User.findById(userId).select("blockedUsers");

    console.log('🔍 Fetching conversations for userId:', userId);

    const conversations = await Conversation.find({
      participants: userId,
       participants: { $nin: user.blockedUsers },
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .populate('participants', 'name avatar');

    console.log('📬 Found conversations:', conversations.length);

    const formatted = conversations.map(conv => {
      console.log('Conv participants:', conv.participants);
      
      const partner = conv.participants.find(
        p => p._id.toString() !== userId
      );

      console.log('Partner found:', partner?.name || 'NONE');

      return {
        _id: conv._id,
        partnerName: partner?.name || 'Unknown User',
        partnerAvatar: partner?.avatar,
        partnerId: partner?._id, // ✅ Thêm partnerId cho block/report
        partnerClass: partner?.classYear, // ✅ Thêm classYear nếu có
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount.get(userId) || 0,
        updatedAt: conv.updatedAt
      };
    });

    res.json({ success: true, conversations: formatted });

  } catch (err) {
    console.error("❌ Error fetching conversations:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


// ----------------------------
// GET MESSAGES
// ----------------------------
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation)
      return res.status(404).json({ success: false, error: "Conversation not found" });

    return res.json({
      success: true,
      messages: conversation.messages || []
    });

  } catch (err) {
    console.error("❌ Error fetching messages:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


// ----------------------------
// SEND MESSAGE
// ----------------------------
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { senderId, content } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation)
      return res.status(404).json({ success: false, error: "Conversation not found" });

    conversation.messages.push({
      senderId,
      content,
      timestamp: new Date(),
      isRead: false
    });

    conversation.lastMessage = {
      text: content,
      senderId,
      timestamp: new Date()
    };

    conversation.participants.forEach(p => {
      if (p.toString() !== senderId) {
        const current = conversation.unreadCount.get(p.toString()) || 0;
        conversation.unreadCount.set(p.toString(), current + 1);
      }
    });

    await conversation.save();

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};