import { Router } from 'express';
import { getSwipeDeck, submitSwipe } from '../controllers/findLoveController.js';

const router = Router();

router.get('/:userId/deck', getSwipeDeck);
router.post('/:userId/swipe', submitSwipe);

export default router;
