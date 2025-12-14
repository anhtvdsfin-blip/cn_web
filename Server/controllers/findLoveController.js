import httpStatus from 'http-status';
import { findLoveService } from '../services/findLoveService.js';
import { emitMatchNotifications } from '../socket/notificationSocket.js';

export const getSwipeDeck = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      limit,
      distance,
      ageMin,
      ageMax,
      heightMin,
      heightMax,
      cohortMin,
      cohortMax,
    } = req.query;

    const filters = {};
    if (distance !== undefined) filters.distance = Number(distance);
    if (ageMin !== undefined || ageMax !== undefined) filters.ageRange = {
      min: ageMin !== undefined ? Number(ageMin) : undefined,
      max: ageMax !== undefined ? Number(ageMax) : undefined,
    };
    if (heightMin !== undefined || heightMax !== undefined) filters.heightRange = {
      min: heightMin !== undefined ? Number(heightMin) : undefined,
      max: heightMax !== undefined ? Number(heightMax) : undefined,
    };
    if (cohortMin !== undefined || cohortMax !== undefined) filters.cohortRange = {
      min: cohortMin !== undefined ? Number(cohortMin) : undefined,
      max: cohortMax !== undefined ? Number(cohortMax) : undefined,
    };

    const debug = req.query.debug === '1' || req.query.debug === 'true';
    const raw = req.query.raw === '1' || req.query.raw === 'true';
    const result = await findLoveService.getSwipeDeck(userId, { limit, filters, debug, raw });

    const body = {
      success: true,
      data: result.deck,
      total: result.total,
    };
    if (result.debug) body.debug = result.debug;
    return res.status(httpStatus.OK).json(body);
  } catch (error) {
    const status = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Không thể tải danh sách hồ sơ.';
    return res.status(status).json({ success: false, message });
  }
};

export const submitSwipe = async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetId, action } = req.body || {};

    if (!targetId) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Thiếu targetId.',
      });
    }

    // Get io instance from req
    const io = req.app.get('io');

    const result = await findLoveService.registerSwipe(userId, targetId, action);

    // Emit notifications if match was created
    if (result.match && result.notifications) {
      emitMatchNotifications(io, userId, targetId, result.notifications);
    }

    // no automatic opening-move message emission (UI shows opening move banner instead)

    return res.status(httpStatus.OK).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Không thể lưu hành động swiping.';
    return res.status(status).json({ success: false, message });
  }
};

