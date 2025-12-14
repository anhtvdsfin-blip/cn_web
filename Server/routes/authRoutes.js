import express from 'express';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// router.post('/logout', logout); // Sẽ thêm sau
// router.post('/refresh-token', refreshTokens); // Sẽ thêm sau

export default router;