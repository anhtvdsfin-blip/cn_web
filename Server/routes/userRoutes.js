import express from 'express';
import { getProfile, updateProfile, reportUser, blockUser, setSelectedOpeningMove } from '../controllers/userController.js';

const router = express.Router();

router.get('/:userId/profile', getProfile);
router.put('/:userId/profile', updateProfile);
// Set or clear selected opening move for a user
router.put('/:userId/opening-move', setSelectedOpeningMove);
router.post('/report/:targetId', reportUser);
router.post('/block/:targetId', blockUser);

export default router;
