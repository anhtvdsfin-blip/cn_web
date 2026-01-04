import ConversationService from '../services/ConversationService.js';
import User from '../models/User.js';

// ----------------------------
// GET LIST CONVERSATIONS
// ----------------------------
export const getConversations = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const result = await ConversationService.getConversations(userId);
    res.json(result);

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
    // support routes using either :conversationId or :matchId
    const conversationId = req.params.conversationId || req.params.matchId || null;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId (or matchId) is required' });
    }

    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = parseInt(req.query.skip, 10) || 0;

    const result = await ConversationService.getMessages(conversationId, limit, skip);
    res.json(result);

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
    const { senderId, content, attachment, icon } = req.body;

    if (!conversationId || !senderId || !content) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await ConversationService.sendMessage(conversationId, senderId, content, { attachment, icon });
    res.json(result);

  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ----------------------------
// MARK AS READ
// ----------------------------
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await ConversationService.markAsRead(conversationId, userId);
    res.json(result);

  } catch (err) {
    console.error("❌ Error marking as read:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Upload chat image (via multipart/form-data)
export const uploadChatImage = async (req, res) => {
  try {
    // accept either :matchId or legacy :conversationId in the route
    const matchId = req.params.matchId || req.params.conversationId || null;
    const { userId } = req.body || {};
    const file = req.file;

    // For uploading the file we only strictly need userId and file buffer.
    // matchId is optional here (used by client to continue workflow) so don't fail when absent.
    if (!userId || !file) {
      return res.status(400).json({ success: false, error: 'Missing required fields: userId and image file are required' });
    }

    // Use photo service to upload
    const { uploadChatImage } = await import('../services/photo.service.js');
    const url = await uploadChatImage(userId, file.buffer, file.mimetype);

    return res.status(200).json({ success: true, url, matchId });
  } catch (err) {
    console.error('❌ Error uploading chat image:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};