import httpStatus from 'http-status';
import { getUserProfile, updateUserProfile } from '../services/UserService.js';
import User from '../models/User.js';
import Report from '../models/Report.js';

// POST /api/users/report/:targetId
export const reportUser = async (req, res) => {
    try {
        const reporterId = req.body.reporterId || req.user?.id;
        const targetId = req.params.targetId;
        const reason = req.body.reason || 'Không hợp lệ / vi phạm';

        if (!reporterId || !targetId) {
            return res.status(httpStatus.BAD_REQUEST).send({ success: false, message: 'Thiếu reporterId hoặc targetId.' });
        }

        const target = await User.findById(targetId);
        if (!target) {
            return res.status(httpStatus.NOT_FOUND).send({ success: false, message: 'Người dùng bị báo cáo không tồn tại.' });
        }

        await Report.create({
          reporterId,
          targetId,
          reason
        });

        return res.status(httpStatus.CREATED).send({ success: true, message: 'Báo cáo đã được ghi nhận.' });
    } catch (error) {
        console.error('reportUser error', error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ success: false, message: 'Không thể gửi báo cáo.' });
    }
};

// POST /api/users/block/:targetId
export const blockUser = async (req, res) => {
    try {
        const blockerId = req.body.blockerId || req.body.reporterId || req.user?.id;
        const targetId = req.params.targetId;

        if (!blockerId || !targetId) {
            return res.status(httpStatus.BAD_REQUEST).send({ success: false, message: 'Thiếu blockerId hoặc targetId.' });
        }

        const blocker = await User.findById(blockerId);
        if (!blocker) {
          return res.status(httpStatus.NOT_FOUND).send({ success: false, message: 'Người chặn không tồn tại.' });
        }

        const alreadyBlocked = (blocker.blockedUsers || []).some(id => id.toString() === targetId.toString());
        if (!alreadyBlocked) {
          blocker.blockedUsers = blocker.blockedUsers || [];
          blocker.blockedUsers.push(targetId);
          await blocker.save();
        }

        return res.status(httpStatus.OK).send({ success: true, message: 'Người dùng đã bị chặn.' });
    } catch (error) {
        console.error('blockUser error', error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ success: false, message: 'Không thể chặn người dùng.' });
    }
};

export const getProfile = async (req, res) => {
    try {
        const userId = req.params.userId || req.query.userId;
        if (!userId) {
            return res.status(httpStatus.BAD_REQUEST).send({ message: 'Thiếu userId.' });
        }

        const user = await getUserProfile(userId);
        res.send({ user });
    } catch (error) {
        const status = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
        const message = error.message || 'Không thể lấy thông tin hồ sơ.';
        res.status(status).send({ message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { userId: bodyUserId, ...profileData } = req.body || {};
        const targetUserId = req.params.userId || bodyUserId;
        if (!targetUserId) {
            return res.status(httpStatus.BAD_REQUEST).send({ message: 'Thiếu userId.' });
        }

        const user = await updateUserProfile(targetUserId, profileData);

        res.send({
            success: true,
            message: 'Cập nhật profile thành công.',
            user,
        });
    } catch (error) {
        const status = error.statusCode || httpStatus.BAD_REQUEST;
        const message = error.message || 'Cập nhật profile thất bại.';
        res.status(status).send({ message });
    }
};
