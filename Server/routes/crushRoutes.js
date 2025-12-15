import express from 'express';
import { setCrush, removeCrush, getMyCrush } from '../controllers/crushController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/v1/matches/:matchId/set-crush
router.post('/matches/:matchId/set-crush', requireAuth, setCrush);

// POST /api/v1/matches/:matchId/remove-crush
router.post('/matches/:matchId/remove-crush', requireAuth, removeCrush);

// GET /api/v1/user/my-crush
router.get('/user/my-crush', requireAuth, getMyCrush);

export default router;
