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
