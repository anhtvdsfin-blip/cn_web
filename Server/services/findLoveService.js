import httpStatus from 'http-status';
import User from '../models/User.js';
import Swipe from '../models/Swipe.js';
import Match from '../models/Match.js';
import matchingService from './MatchingService.js';
import { buildUserResponse } from './UserService.js';
import { notificationService } from './NotificationService.js';

const MAX_CANDIDATE_POOL = 40;
const DEFAULT_CARD_LIMIT = 10;
const DEGREE_TO_RAD = Math.PI / 180;
const SUPPORTED_ACTIONS = new Map([
  ['like', 'like'],
  ['dislike', 'dislike'],
  ['nope', 'dislike'],
]);

const validationError = (message, status = httpStatus.BAD_REQUEST) => {
  const err = new Error(message);
  err.statusCode = status;
  return err;
};

const toRadians = (value) => value * DEGREE_TO_RAD;

const haversineDistanceKm = (coordA, coordB) => {
  if (!coordA || !coordB) return null;
  const [lngA, latA] = coordA.coordinates || [];
  const [lngB, latB] = coordB.coordinates || [];

  const hasValidCoords = [lngA, latA, lngB, latB].every((coord) => Number.isFinite(coord) && coord !== 0);
  if (!hasValidCoords) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round((earthRadiusKm * c) * 10) / 10;
};

const formatDistanceLabel = (distanceKm, fallbackKm) => {
  if (distanceKm === null) {
    if (Number.isFinite(fallbackKm) && fallbackKm > 0) {
      return `Trong ${fallbackKm} km`;
    }
    return 'Khoảng cách chưa xác định';
  }

  if (distanceKm < 1) {
    return '< 1 km';
  }

  return `${distanceKm.toFixed(1)} km`;
};

const summarizeBio = (bio) => {
  if (typeof bio !== 'string') {
    return '';
  }
  const trimmed = bio.trim();
  if (trimmed.length <= 160) {
    return trimmed;
  }
  return `${trimmed.slice(0, 157)}…`;
};

const computeDobRange = (ageRange) => {
  if (!ageRange || !Number.isFinite(ageRange.min) || !Number.isFinite(ageRange.max)) {
    return null;
  }

  const minAge = Math.max(18, Math.min(ageRange.min, ageRange.max));
  const maxAge = Math.max(minAge + 1, ageRange.max);

  const today = new Date();
  const latestDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate() + 1);
  const earliestDob = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate());

  return { earliestDob, latestDob };
};

const collectImages = (user) => {
  const gallery = Array.isArray(user.photoGallery) ? user.photoGallery.filter(Boolean) : [];
  if (user.avatar && !gallery.includes(user.avatar)) {
    gallery.unshift(user.avatar);
  }
  return gallery.slice(0, 6);
};

const ensureMatchingReady = async () => {
  try {
    await matchingService.initialize();
  } catch (error) {
    console.error('❌ Matching service unavailable:', error);
    throw validationError('Dịch vụ gợi ý đang bận. Vui lòng thử lại sau.', httpStatus.SERVICE_UNAVAILABLE);
  }
};

const mapCandidateToCard = (user, compatibility, currentUser) => {
  const distanceKm = haversineDistanceKm(currentUser.geoLocation, user.geoLocation);
  const fallbackDistance = Number(currentUser.preferences?.distance) || undefined;
  const heightValue = Number.isFinite(user.height) ? Number(user.height) : null;

  return {
    id: user.id,
    name: user.name,
    age: user.age,
    major: user.career || 'Sinh viên HUST',
    classYear: user.classYear || 'K?',
    location: user.location || 'Không rõ',
    distance: formatDistanceLabel(distanceKm, fallbackDistance),
    height: heightValue,
     gender: user.gender || null,
    zodiac: user.zodiac && user.zodiac !== 'Unknown' ? user.zodiac : '',
    summary: summarizeBio(user.bio),
    fullBio: user.bio || '',
    courses: Array.isArray(user.studySubjects) ? user.studySubjects : [],
    interests: Array.isArray(user.hobbies) ? user.hobbies : [],
    connectionGoal: user.connectionGoal
      || user.preferences?.connectionGoal
      || '',
    images: collectImages(user),
    compatibilityScore: compatibility?.overallScore ?? null,
    compatibilityBreakdown: compatibility?.breakdown || {},
    recommendation: compatibility?.recommendation || null,
  };
};

const fetchSwipedUserIds = async (userId) => {
  const swipes = await Swipe.find({ swiperId: userId }).distinct('swipedId');
  return swipes.map((id) => id.toString());
};

// 🔄 Fetch users that are matched with current user
const fetchMatchedUserIds = async (userId) => {
  const matches = await Match.find({
    $or: [
      { user1Id: userId },
      { user2Id: userId }
    ],
    status: 'active'
  }).select('user1Id user2Id');
  
  return matches.map(match => {
    const matchedId = String(match.user1Id) === String(userId) ? match.user2Id : match.user1Id;
    return matchedId.toString();
  });
};

// ⏰ Fetch users disliked in last 24 hours (will be available again after 24h)
const fetchRecentDislikesUserIds = async (userId) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const dislikes = await Swipe.find({
    swiperId: userId,
    action: 'dislike',
    createdAt: { $gte: oneDayAgo }
  }).distinct('swipedId');
  
  return dislikes.map((id) => id.toString());
};

const buildCandidateQuery = (user, excludeIds, options = {}) => {
  const query = {
    _id: { $ne: user._id, $nin: excludeIds },
  };

  if (options.strictProfile !== false) {
    query.profileCompleted = true;
  }

  const lookingFor = user.preferences?.lookingFor;
  if (lookingFor && lookingFor !== 'All') {
    query.gender = lookingFor;
  }

  const ageRange = user.preferences?.ageRange;
  const dobRange = computeDobRange(ageRange);
  if (dobRange) {
    query.dob = { $ne: null, $gte: dobRange.earliestDob, $lte: dobRange.latestDob };
  } else {
    query.dob = { $ne: null };
  }

  return query;
};

const ensureUserExists = async (userId) => {
  if (!userId) {
    throw validationError('Thiếu userId.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw validationError('Người dùng không tồn tại.', httpStatus.NOT_FOUND);
  }

  return user;
};

const buildMatchPayload = async (userA, userB) => {
  try {
    const compatibility = await matchingService.calculateCompatibility(userA, userB);
    return compatibility;
  } catch (error) {
    console.error('Không thể tính điểm tương thích:', error);
    return null;
  }
};

const createOrUpdateMatch = async (userId, targetId, compatibility) => {
  const now = new Date();
  const matchUpdate = {
    status: 'active',
    matchedAt: now,
    expiresAt: new Date(now.getTime() + 3 * 60 * 1000),
  };

  if (compatibility) {
    matchUpdate.compatibilityScore = compatibility.overallScore;
    matchUpdate.compatibilityBreakdown = compatibility.breakdown;
  }

  const existing = await Match.findOne({
    $or: [
      { user1Id: userId, user2Id: targetId },
      { user1Id: targetId, user2Id: userId },
    ],
  });

  if (existing) {
    await Match.updateOne({ _id: existing._id }, { $set: matchUpdate });
    return existing._id;
  }

  const created = await Match.create({
    user1Id: userId,
    user2Id: targetId,
    ...matchUpdate,
  });

  return created._id;
};

export const findLoveService = {
  async getSwipeDeck(userId, options = {}) {
    const limit = Number(options.limit) && Number(options.limit) > 0 ? Math.min(Number(options.limit), 30) : DEFAULT_CARD_LIMIT;

    const userDoc = await ensureUserExists(userId);
    await ensureMatchingReady();

    const normalizedCurrentUser = buildUserResponse(userDoc);
    
    // Exclude: matched users + recent left swipes (24h)
    const matchedIds = await fetchMatchedUserIds(userId);
    const recentDislikeIds = await fetchRecentDislikesUserIds(userId);
    const excludeIds = [...new Set([...matchedIds, ...recentDislikeIds])];

    let candidateQuery = buildCandidateQuery(userDoc, excludeIds, { strictProfile: true });
    let rawCandidates = await User.find(candidateQuery)
      .sort({ updatedAt: -1 })
      .limit(Math.max(limit * 3, MAX_CANDIDATE_POOL))
      .exec();

    if (!rawCandidates.length) {
      candidateQuery = buildCandidateQuery(userDoc, excludeIds, { strictProfile: false });
      rawCandidates = await User.find(candidateQuery)
        .sort({ updatedAt: -1 })
        .limit(Math.max(limit * 2, MAX_CANDIDATE_POOL))
        .exec();
    }

    if (!rawCandidates.length) {
      return { deck: [], total: 0 };
    }

    const normalizedCandidates = rawCandidates
      .map((doc) => buildUserResponse(doc))
      .filter(Boolean);

    if (normalizedCandidates.length === 0) {
      return { deck: [], total: 0 };
    }

    const bestMatches = await matchingService.findMatches(
      normalizedCurrentUser,
      normalizedCandidates,
      limit
    );

    const deck = bestMatches.map(({ user, compatibility }) =>
      mapCandidateToCard(user, compatibility, normalizedCurrentUser));

    return {
      deck,
      total: deck.length,
    };
  },

  async registerSwipe(userId, targetUserId, rawAction) {
    const action = SUPPORTED_ACTIONS.get(String(rawAction || '').toLowerCase());
    if (!action) {
      throw validationError('Hành động không hợp lệ.');
    }

    if (String(userId) === String(targetUserId)) {
      throw validationError('Không thể swipe chính mình.');
    }

    const [swiperDoc, targetDoc] = await Promise.all([
      ensureUserExists(userId),
      ensureUserExists(targetUserId),
    ]);

    const swipeRecord = await Swipe.findOneAndUpdate(
      { swiperId: userId, swipedId: targetUserId },
      { actionType: action, isMatch: false },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (action !== 'like') {
      return { match: false, swipe: swipeRecord.toObject() };
    }

    const reciprocal = await Swipe.findOne({
      swiperId: targetUserId,
      swipedId: userId,
      actionType: 'like',
    });

    if (!reciprocal) {
      return { match: false, swipe: swipeRecord.toObject() };
    }

    await Promise.all([
      Swipe.updateOne({ _id: swipeRecord._id }, { $set: { isMatch: true } }),
      Swipe.updateOne({ _id: reciprocal._id }, { $set: { isMatch: true } }),
    ]);

    await ensureMatchingReady();

    const [normalizedSwiper, normalizedTarget] = [
      buildUserResponse(swiperDoc),
      buildUserResponse(targetDoc),
    ];

    const compatibility = await buildMatchPayload(normalizedSwiper, normalizedTarget);
    const matchId = await createOrUpdateMatch(userId, targetUserId, compatibility);

    // ============ CREATE MATCH NOTIFICATIONS ============
    let notifications = null;
    try {
      notifications = await notificationService.createMatchNotifications(
        userId,
        targetUserId,
        matchId
      );
      console.log(`✅ Match notifications created for match: ${matchId}`);
    } catch (error) {
      console.error('❌ Error creating match notifications:', error);
      // Don't throw - notifications are secondary feature
    }

    return {
      match: true,
      matchId,
      compatibility,
      notifications
    };
  },
};
