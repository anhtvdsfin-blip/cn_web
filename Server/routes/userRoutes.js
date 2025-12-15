import express from 'express';
import { getProfile, updateProfile, reportUser, blockUser, setSelectedOpeningMove } from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:userId/profile', getProfile);
router.put('/:userId/profile', requireAuth, updateProfile);
// Set or clear selected opening move for a user
router.put('/:userId/opening-move', requireAuth, setSelectedOpeningMove);
router.post('/report/:targetId', requireAuth, reportUser);
router.post('/block/:targetId', requireAuth, blockUser);

export default router;
