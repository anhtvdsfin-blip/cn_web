import express from 'express';
import { getProfile, updateProfile, reportUser, blockUser } from '../controllers/userController.js';

const router = express.Router();

router.get('/:userId/profile', getProfile);
router.put('/:userId/profile', updateProfile);

router.post('/report/:targetId', reportUser);
router.post('/block/:targetId', blockUser);

export default router;
