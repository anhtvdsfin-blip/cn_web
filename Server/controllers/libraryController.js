import LibraryRoom from '../models/LibraryRoom.js';
import User from '../models/User.js';

export const createRoom = async (req, res) => {
  try {
    const { name, subject, capacity, description, createdBy, startTime, endTime } = req.body;
    if (!name || !capacity) return res.status(400).json({ message: 'Tên phòng và số thành viên là bắt buộc.' });

    const roomData = {
      name: name.trim(),
      subject: subject?.trim(),
      description: description?.trim(),
      capacity: Number(capacity),
      occupants: [],
      createdBy: createdBy || undefined,
    };

    if (startTime) roomData.startTime = new Date(startTime);
    if (endTime) roomData.endTime = new Date(endTime);

    const room = new LibraryRoom(roomData);

    await room.save();
    res.status(201).json({ success: true, room });
  } catch (err) {
    console.error('❌ Failed to create room:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo phòng.' });
  }
};

export const listRooms = async (req, res) => {
  try {
    const rooms = await LibraryRoom.find()
      .populate('occupants', 'name')
      .populate('createdBy', 'name')
      .populate('invites.senderId', 'name')
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

    res.json({ success: true, room });
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
