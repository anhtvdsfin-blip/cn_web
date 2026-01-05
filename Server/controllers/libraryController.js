import LibraryRoom from '../models/LibraryRoom.js';
import User from '../models/User.js';
import Match from '../models/Match.js';
import { notificationService } from '../services/NotificationService.js';
import { emitNotification } from '../socket/notificationSocket.js';
import { Notification } from '../models/Notification.js';

export const createRoom = async (req, res) => {
  try {
    const { name, subject, capacity, description, createdBy, startTime, endTime } = req.body;
    if (!name || !capacity) return res.status(400).json({ message: 'Tên phòng và số thành viên là bắt buộc.' });

    const roomData = {
      name: name.trim(),
      subject: subject?.trim(),
      description: description?.trim(),
      capacity: Number(capacity),
      // If the creator ID is provided, include them as the first occupant
      occupants: createdBy ? [createdBy] : [],
      createdBy: createdBy || undefined,
    };

    if (startTime) roomData.startTime = new Date(startTime);
    if (endTime) roomData.endTime = new Date(endTime);

    const room = new LibraryRoom(roomData);

    await room.save();
    
    // Gửi thông báo cho các user đã match với người tạo phòng (không gửi cho chính người tạo)
    try {
      if (createdBy) {
        const creator = await User.findById(createdBy).select('name');
        
        // Lấy danh sách các user đã match với người tạo phòng
        const matches = await Match.find({
          $or: [
            { user1Id: createdBy },
            { user2Id: createdBy }
          ],
          status: 'matched'
        }).lean();
        
        // Lấy danh sách ID các user đã match (trừ người tạo)
        const matchedUserIds = matches.map(m => {
          const u1 = m.user1Id?.toString();
          const u2 = m.user2Id?.toString();
          return u1 === createdBy.toString() ? u2 : u1;
        }).filter(Boolean);
        
        console.log(`📢 Sending room creation notification to ${matchedUserIds.length} matched users`);
        
        // Gửi thông báo cho từng user đã match
        for (const recipientId of matchedUserIds) {
          try {
            const notif = await notificationService.createNotification({
              recipientId: recipientId,
              senderId: createdBy,
              type: 'library_room_created',
              content: `${creator?.name || 'Ai đó'} đã tạo phòng học "${room.name}"`,
              isRead: false,
              roomId: room._id
            });

            const populatedNotif = await Notification.findById(notif._id)
              .populate('senderId', 'name avatar')
              .populate('roomId', 'name')
              .lean();

            if (req.io) {
              try { emitNotification(req.io, recipientId, populatedNotif); } catch (e) { console.warn('emitNotification failed', e); }
              try { req.emitNotification?.(recipientId, populatedNotif); } catch (e) { console.warn('req.emitNotification failed', e); }
            }
          } catch (notifErr) {
            console.warn(`Failed to send notification to ${recipientId}:`, notifErr.message);
          }
        }
      }
    } catch (err) {
      console.error('❌ Failed to create/emit notifications for room create:', err);
    }

    res.status(201).json({ success: true, room });
  } catch (err) {
    console.error('❌ Failed to create room:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo phòng.' });
  }
};

export const listRooms = async (req, res) => {
  try {
    const rooms = await LibraryRoom.find()
      .populate('occupants', 'name avatar')
      .populate('createdBy', 'name avatar')
      .populate('invites.senderId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, rooms });
  } catch (err) {
    console.error('❌ Failed to list rooms:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách phòng.' });
  }
};

export const getRoom = async (req, res) => {
  try {
    const room = await LibraryRoom.findById(req.params.id)
      .populate('occupants', 'name avatar')
      .populate('createdBy', 'name')
      .populate('invites.senderId', 'name');
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });
    res.json({ success: true, room });
  } catch (err) {
    console.error('❌ Failed to get room:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông tin phòng.' });
  }
};

export const createInviteForRoom = async (req, res) => {
  try {
    const { id } = req.params; // room id
    const { senderId, receiverId, status, schedule, note, expiresAt } = req.body;

    if (!senderId || !receiverId) return res.status(400).json({ success: false, message: 'senderId và receiverId là bắt buộc.' });

    const room = await LibraryRoom.findById(id);
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });

    // Ensure sender is an occupant of the room
    const occupantsStr = (room.occupants || []).map((o) => o.toString());
    if (!occupantsStr.includes(String(senderId))) {
      return res.status(403).json({ success: false, message: 'Chỉ thành viên trong phòng mới được mời người khác.' });
    }

    // Set default expiration to 7 days if not provided
    const defaultExpiration = new Date();
    defaultExpiration.setDate(defaultExpiration.getDate() + 7);

    const invite = {
      senderId,
      receiverId,
      status: status || 'pending',
      schedule: schedule || undefined,
      note: note?.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiration,
    };

    room.invites.push(invite);
    await room.save();

    // return the last pushed invite (with _id)
    const savedInvite = room.invites[room.invites.length - 1];

    // Create a persistent notification for the receiver and emit it in real-time
    try {
      const sender = await User.findById(senderId).select('name');
      console.log(`📬 Creating library_invite notification: ${sender?.name} → User ${receiverId} for room ${room.name}`);
      
      const notif = await notificationService.createNotification({
        recipientId: receiverId,
        senderId,
        type: 'library_invite',
        content: `${sender?.name || 'Ai đó'} đã mời bạn vào phòng ${room.name}`,
        isRead: false,
        roomId: room._id
      });
      console.log(`✅ Notification created:`, notif._id);

      // populate notification before emitting so frontend has sender and room info
      const populatedNotif = await Notification.findById(notif._id)
        .populate('senderId', 'name avatar')
        .populate('roomId', 'name')
        .lean();
      console.log(`📤 Populated notification:`, populatedNotif);

      // emit via both notification socket namespace and legacy post socket room (if available)
      if (req.io) {
        console.log(`🔌 Emitting to receiverId: ${receiverId}`);
        try { 
          emitNotification(req.io, receiverId, populatedNotif);
          console.log(`✅ emitNotification called`);
        } catch (e) { console.warn('emitNotification failed', e); }
        try { 
          req.emitNotification?.(receiverId, populatedNotif);
          console.log(`✅ req.emitNotification called`);
        } catch (e) { console.warn('req.emitNotification failed', e); }
      } else {
        console.warn('⚠️ req.io is undefined, cannot emit notification');
      }
    } catch (err) {
      console.error('❌ Failed to create/emit notification for invite:', err);
    }

    res.status(201).json({ success: true, invite: savedInvite, roomId: room._id });
  } catch (err) {
    console.error('❌ Failed to create invite for room:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo lời mời.' });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { id } = req.params; // room id
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const room = await LibraryRoom.findById(id);
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });

    // normalize existing occupant ids to strings
    const occupantsStr = room.occupants.map((o) => o.toString());

    if (occupantsStr.includes(String(userId))) {
      return res.status(400).json({ success: false, message: 'User already joined this room.' });
    }

    if (room.occupants.length >= room.capacity) {
      return res.status(400).json({ success: false, message: 'Room is full.' });
    }

    room.occupants.push(userId);
    await room.save();

    // Re-fetch populated room so frontend receives occupant names (not just ObjectIds)
    let populatedRoom = await LibraryRoom.findById(id)
      .populate('occupants', 'name avatar')
      .populate('createdBy', 'name')
      .populate('invites.senderId', 'name');

    // Notify room creator that someone joined
    try {
      const creatorId = populatedRoom.createdBy ? populatedRoom.createdBy._id?.toString() || populatedRoom.createdBy.toString() : null;
      if (creatorId && String(creatorId) !== String(userId)) {
        const joiningUser = await User.findById(userId).select('name');
        const notif = await notificationService.createNotification({
          recipientId: creatorId,
          senderId: userId,
          type: 'library_user_joined',
          content: `${joiningUser?.name || 'Ai đó'} đã vào phòng ${populatedRoom.name}`,
          isRead: false,
          roomId: populatedRoom._id
        });

        const populatedNotifForCreator = await Notification.findById(notif._id)
          .populate('senderId', 'name avatar')
          .populate('roomId', 'name')
          .lean();

        if (req.io) {
          try { emitNotification(req.io, creatorId, populatedNotifForCreator); } catch (e) { console.warn('emitNotification failed', e); }
          try { req.emitNotification?.(creatorId, populatedNotifForCreator); } catch (e) { console.warn('req.emitNotification failed', e); }
        }
      }
    } catch (err) {
      console.error('❌ Failed to create/emit notification for join:', err);
    }

    // Also create a confirmation notification for the joining user listing other members
    try {
      const joiningUser = await User.findById(userId).select('name');
      const memberNames = (populatedRoom.occupants || [])
        .map((o) => (o && (o.name || (o._id || o.toString()))) )
        .filter(n => n && n !== joiningUser?.name);

      const contentForJoin = memberNames.length > 0
        ? `Bạn đã vào phòng ${populatedRoom.name} cùng với: ${memberNames.slice(0, 8).join(', ')}${memberNames.length > 8 ? `, +${memberNames.length - 8} khác` : ''}`
        : `Bạn đã vào phòng ${populatedRoom.name}`;

      // Use room creator as sender if available, otherwise use joiningUser as sender (createNotification will return null if sender==recipient)
      const senderForJoin = populatedRoom.createdBy ? (populatedRoom.createdBy._id || populatedRoom.createdBy) : null;

      if (String(senderForJoin) === String(userId)) {
        // pick a different sender if equal (e.g., system user) — fallback to creator or skip sender
      }

      const joinNotif = await notificationService.createNotification({
        recipientId: userId,
        senderId: senderForJoin || userId, // notificationService.createNotification prevents same-sender notifications
        type: 'library_user_joined',
        content: contentForJoin,
        isRead: false,
        roomId: populatedRoom._id
      });

      if (joinNotif && req.io) {
        try { emitNotification(req.io, userId, joinNotif); } catch (e) { console.warn('emitNotification failed for join user', e); }
        try { req.emitNotification?.(userId, joinNotif); } catch (e) { console.warn('req.emitNotification failed for join user', e); }
      }
    } catch (err) {
      console.error('❌ Failed to create/emit confirmation notification for joining user:', err);
    }

    res.json({ success: true, room: populatedRoom });
  } catch (err) {
    console.error('❌ Failed to join room:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tham gia phòng.' });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const room = await LibraryRoom.findById(id);
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });

    // only creator may delete
    const ownerId = room.createdBy ? room.createdBy.toString() : null;
    if (!ownerId || ownerId !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa phòng này.' });
    }

    await LibraryRoom.findByIdAndDelete(id);
    res.json({ success: true, message: 'Phòng đã được xóa.' });
  } catch (err) {
    console.error('❌ Failed to delete room:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa phòng.' });
  }
};

export const acceptInvite = async (req, res) => {
  try {
    const { id, inviteId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const room = await LibraryRoom.findById(id);
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });

    // find the invite
    const inviteIndex = (room.invites || []).findIndex((inv) => inv._id.toString() === inviteId);
    if (inviteIndex < 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời.' });

    const invite = room.invites[inviteIndex];

    // ensure user is the recipient
    if (invite.receiverId.toString() !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không thể chấp nhận lời mời này.' });
    }

    // check if invite is expired
    if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ success: false, message: 'Lời mời đã hết hạn.' });
    }

    // check if user already in occupants
    const occupantsStr = (room.occupants || []).map((o) => o.toString());
    if (occupantsStr.includes(String(userId))) {
      return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của phòng này.' });
    }

    // check if room is full
    if (room.occupants.length >= room.capacity) {
      return res.status(400).json({ success: false, message: 'Phòng đã đầy, không thể tham gia.' });
    }

    // accept: add user to occupants and update invite status
    room.occupants.push(userId);
    room.invites[inviteIndex].status = 'accepted';
    await room.save();

    // Notify the original sender that their invite was accepted
    try {
      const senderIdFromInvite = invite.senderId;
      const receiverUser = await User.findById(userId).select('name');
      const notif = await notificationService.createNotification({
        recipientId: senderIdFromInvite,
        senderId: userId,
        type: 'library_invite_accepted',
        content: `${receiverUser?.name || 'Ai đó'} đã chấp nhận lời mời vào phòng ${room.name}`,
        isRead: false,
        roomId: room._id
      });

      const populatedNotifForSender = await Notification.findById(notif._id)
        .populate('senderId', 'name avatar')
        .populate('roomId', 'name')
        .lean();

      if (req.io) {
        try { emitNotification(req.io, senderIdFromInvite, populatedNotifForSender); } catch (e) { console.warn('emitNotification failed', e); }
        try { req.emitNotification?.(senderIdFromInvite, populatedNotifForSender); } catch (e) { console.warn('req.emitNotification failed', e); }
      }
    } catch (err) {
      console.error('❌ Failed to create/emit notification for accept:', err);
    }

    res.json({ success: true, room });
  } catch (err) {
    console.error('❌ Failed to accept invite:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi chấp nhận lời mời.' });
  }
};

export const rejectInvite = async (req, res) => {
  try {
    const { id, inviteId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const room = await LibraryRoom.findById(id);
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });

    // find the invite
    const inviteIndex = (room.invites || []).findIndex((inv) => inv._id.toString() === inviteId);
    if (inviteIndex < 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời.' });

    const invite = room.invites[inviteIndex];

    // ensure user is the recipient
    if (invite.receiverId.toString() !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không thể từ chối lời mời này.' });
    }

    // update invite status
    room.invites[inviteIndex].status = 'declined';
    await room.save();

    res.json({ success: true, room });
  } catch (err) {
    console.error('❌ Failed to reject invite:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi từ chối lời mời.' });
  }
};
