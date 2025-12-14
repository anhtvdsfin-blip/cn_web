import express from 'express';
import { listOpeningMoves } from '../controllers/openingMoveController.js';

const router = express.Router();

// GET /api/opening-moves
router.get('/opening-moves', listOpeningMoves);

export default router;
