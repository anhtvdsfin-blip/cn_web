import express from 'express';
import { createRoom, listRooms, getRoom, createInviteForRoom, joinRoom, deleteRoom, acceptInvite, rejectInvite } from '../controllers/libraryController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/library/rooms
router.post('/rooms', requireAuth, createRoom);

// GET /api/library/rooms
router.get('/rooms', listRooms);

// GET /api/library/rooms/:id
router.get('/rooms/:id', getRoom);

// POST /api/library/rooms/:id/invites  -> create invite stored inside room document
router.post('/rooms/:id/invites', requireAuth, createInviteForRoom);

// POST /api/library/rooms/:id/join -> join room (adds user to occupants)
router.post('/rooms/:id/join', requireAuth, joinRoom);

// DELETE /api/library/rooms/:id -> delete room (owner only)
router.delete('/rooms/:id', requireAuth, deleteRoom);

// POST /api/library/rooms/:id/invites/:inviteId/accept -> accept invite
router.post('/rooms/:id/invites/:inviteId/accept', requireAuth, acceptInvite);

// POST /api/library/rooms/:id/invites/:inviteId/reject -> reject invite
router.post('/rooms/:id/invites/:inviteId/reject', requireAuth, rejectInvite);

export default router;
