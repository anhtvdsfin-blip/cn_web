import Match from '../models/Match.js';
import User from '../models/User.js';
import { notificationService } from '../services/NotificationService.js';
import { emitNotification } from '../socket/notificationSocket.js';

// Helper to resolve userId from request
function resolveUserId(req) {
  if (!req) return null;
  const bodyUser = req.body && (req.body.userId || req.body.userId === 0 ? req.body.userId : null);
  const queryUser = req.query && (req.query.userId || req.query.userId === 0 ? req.query.userId : null);
  const reqUser = req.user && (req.user.id || req.user.userId || req.user._id) ? (req.user.id || req.user.userId || req.user._id) : null;
  return bodyUser || queryUser || reqUser || null;
}

export const setCrush = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const user1 = match.user1Id?.toString();
    const user2 = match.user2Id?.toString();

    let updated = false;
    let becameMutual = false;

    if (user1 === String(userId)) {
      if (!match.isCrushStatusA) {
        match.isCrushStatusA = true;
        match.crushAtA = new Date();
        updated = true;
      }
    } else if (user2 === String(userId)) {
      if (!match.isCrushStatusB) {
        match.isCrushStatusB = true;
        match.crushAtB = new Date();
        updated = true;
      }
    } else {
      return res.status(403).json({ success: false, message: 'User is not part of this match' });
    }

    // Check mutual crush - track if it BECOMES mutual (was false, now true)
    const wasMutual = match.isMutualCrush;
    if (match.isCrushStatusA && match.isCrushStatusB) {
      match.isMutualCrush = true;
      // Only trigger notification if it JUST became mutual (wasn't mutual before)
      becameMutual = !wasMutual;
    } else {
      match.isMutualCrush = false;
    }

    if (updated || becameMutual) await match.save();

    // If mutual crush detected now, create notifications for both users
    if (becameMutual) {
      try {
        const [u1, u2] = await Promise.all([
          User.findById(match.user1Id).select('name'),
          User.findById(match.user2Id).select('name')
        ]);

        const notifFor1 = await notificationService.createNotification({
          recipientId: match.user1Id,
          senderId: match.user2Id,
          type: 'mutual_bk_crush',
          content: `Mutual BK Crush! Bạn và ${u2?.name || 'Ai đó'} đã crush nhau 💖`,
          isRead: false,
          matchId: match._id
        });

        const notifFor2 = await notificationService.createNotification({
          recipientId: match.user2Id,
          senderId: match.user1Id,
          type: 'mutual_bk_crush',
          content: `Mutual BK Crush! Bạn và ${u1?.name || 'Ai đó'} đã crush nhau 💖`,
          isRead: false,
          matchId: match._id
        });

        if (req.io) {
          try { emitNotification(req.io, match.user1Id, notifFor1); } catch (e) { console.warn('emitNotification u1 failed', e); }
          try { emitNotification(req.io, match.user2Id, notifFor2); } catch (e) { console.warn('emitNotification u2 failed', e); }
          // also notify legacy post socket room if present
          try { req.emitNotification?.(match.user1Id, notifFor1); } catch (e) { console.warn('req.emitNotification u1 failed', e); }
          try { req.emitNotification?.(match.user2Id, notifFor2); } catch (e) { console.warn('req.emitNotification u2 failed', e); }
        }
      } catch (err) {
        console.error('Failed to create/emit mutual crush notifications:', err);
      }
    }

    return res.json({ success: true, match });
  } catch (err) {
    console.error('setCrush error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const removeCrush = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const user1 = match.user1Id?.toString();
    const user2 = match.user2Id?.toString();

    let updated = false;

    if (user1 === String(userId)) {
      if (match.isCrushStatusA) {
        match.isCrushStatusA = false;
        match.crushAtA = null;
        updated = true;
      }
    } else if (user2 === String(userId)) {
      if (match.isCrushStatusB) {
        match.isCrushStatusB = false;
        match.crushAtB = null;
        updated = true;
      }
    } else {
      return res.status(403).json({ success: false, message: 'User is not part of this match' });
    }

    // If mutual flag was set, clearing one side should unset mutual
    if (match.isMutualCrush && (!match.isCrushStatusA || !match.isCrushStatusB)) {
      match.isMutualCrush = false;
    }

    if (updated) await match.save();

    return res.json({ success: true, match });
  } catch (err) {
    console.error('removeCrush error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMyCrush = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const match = await Match.findOne({
      $or: [
        { user1Id: userId, isCrushStatusA: true },
        { user2Id: userId, isCrushStatusB: true }
      ]
    }).populate('user1Id user2Id');

    if (!match) return res.status(404).json({ success: false, message: 'No active crush found' });

    return res.json({ success: true, match });
  } catch (err) {
    console.error('getMyCrush error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
