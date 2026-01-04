import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers && typeof req.headers.authorization === 'string'
      ? req.headers.authorization
      : (req.query?.token || req.body?.token || null);
    let token = null;
    if (authHeader && typeof authHeader === 'string') {
      if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
      else token = authHeader;
    }

    if (!token) {
      console.warn('requireAuth: missing token. authHeader=', authHeader ? (String(authHeader).slice(0,80)) : authHeader);
      return res.status(401).json({ success: false, message: 'Unauthorized: missing token' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      try {
        console.warn('requireAuth: token verification failed. tokenPreview=', (token || '').slice(0, 12), 'error=', err.message);
      } catch (e) {}
      return res.status(401).json({ success: false, message: 'Unauthorized: invalid token' });
    }

    const user = await User.findById(payload.sub).select('-password').lean();
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized: user not found' });

    req.user = { id: user._id, name: user.name, avatar: user.avatar };
    next();
  } catch (err) {
    console.error('requireAuth error', err);
    return res.status(500).json({ success: false, message: 'Server error in auth' });
  }
}

export default requireAuth;
