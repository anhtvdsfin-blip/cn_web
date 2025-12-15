import express from 'express';
import { setCrush, removeCrush, getMyCrush } from '../controllers/crushController.js';

const router = express.Router();

// POST /api/v1/matches/:matchId/set-crush
router.post('/matches/:matchId/set-crush', setCrush);

// POST /api/v1/matches/:matchId/remove-crush
router.post('/matches/:matchId/remove-crush', removeCrush);

// GET /api/v1/user/my-crush
router.get('/user/my-crush', getMyCrush);

export default router;
