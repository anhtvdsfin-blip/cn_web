import express from 'express';
import { createRoom, listRooms, getRoom, createInviteForRoom, joinRoom, deleteRoom, acceptInvite, rejectInvite } from '../controllers/libraryController.js';

const router = express.Router();

// POST /api/library/rooms
router.post('/rooms', createRoom);

// GET /api/library/rooms
router.get('/rooms', listRooms);

// GET /api/library/rooms/:id
router.get('/rooms/:id', getRoom);

// POST /api/library/rooms/:id/invites  -> create invite stored inside room document
router.post('/rooms/:id/invites', createInviteForRoom);

// POST /api/library/rooms/:id/join -> join room (adds user to occupants)
router.post('/rooms/:id/join', joinRoom);

// DELETE /api/library/rooms/:id -> delete room (owner only)
router.delete('/rooms/:id', deleteRoom);

// POST /api/library/rooms/:id/invites/:inviteId/accept -> accept invite
router.post('/rooms/:id/invites/:inviteId/accept', acceptInvite);

// POST /api/library/rooms/:id/invites/:inviteId/reject -> reject invite
router.post('/rooms/:id/invites/:inviteId/reject', rejectInvite);

export default router;
