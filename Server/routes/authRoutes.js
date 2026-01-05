import express from 'express';
import { register, login, logout, refreshToken } from '../controllers/authController.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Validation error handler
const handleValidationErrors = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ success: false, errors: errors.array() });
	}
	next();
};

router.post(
	'/register',
	[
		body('name').isString().trim().isLength({ min: 2 }).withMessage('Name is required'),
		body('email').isEmail().withMessage('Valid email is required'),
		body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
	],
	handleValidationErrors,
	register
);

router.post(
	'/login',
	[
		body('email').isEmail().withMessage('Valid email is required'),
		body('password').isLength({ min: 1 }).withMessage('Password is required')
	],
	handleValidationErrors,
	login
);

router.post('/logout', logout);
router.post('/refresh', refreshToken);

export default router;