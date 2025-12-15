//router


// routes/conversationRoutes.js
import express from 'express';
import multer from 'multer';
import{
  getConversations, getMessages, sendMessage, uploadChatImage
} from '../controllers/conversationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/conversations', requireAuth, getConversations);
router.get('/messages/:conversationId', requireAuth, getMessages);
router.post('/messages/:conversationId', requireAuth, sendMessage);
router.post('/messages/:conversationId/upload', requireAuth, upload.single('image'), uploadChatImage);
router.get('/conversations/:userId', requireAuth, getConversations);

export default router;
// // GET conversations của user
// router.get('/conversations', async (req, res) => {
//   try {
//     const { userId } = req.query;

//     const conversations = await Conversation.find({
//       participants: userId,
//       isActive: true
//     })
//     .sort({ updatedAt: -1 })
//     .populate('participants', 'name avatar');

//     // Format data
//     const formatted = await Promise.all(conversations.map(async conv => {
//       const partner = conv.participants.find(p => p._id.toString() !== userId);
//       const unreadCount = conv.unreadCount.get(userId) || 0;

//       return {
//         _id: conv._id,
//         partnerName: partner?.name,
//         partnerAvatar: partner?.avatar,
//         lastMessage: conv.lastMessage,
//         unreadCount,
//         updatedAt: conv.updatedAt
//       };
//     }));

//     res.json({ success: true, conversations: formatted });
//   } catch (error) {
//     console.error('Error fetching conversations:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// // GET messages của conversation
// router.get('/messages/:conversationId', async (req, res) => {
//   try {
//     const conversation = await Conversation.findById(req.params.conversationId);
//     if (!conversation) return res.status(404).json({ success: false, error: "Conversation not found" });

//     res.json({ success: true, messages: conversation.messages || [] });
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });


// export default router;