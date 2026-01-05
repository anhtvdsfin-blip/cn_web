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
  // Person with minAge: born from (today - minAge - 1 year + 1 day) to (today - minAge year)
  // Person with maxAge: born from (today - maxAge - 1 year + 1 day) to (today - maxAge year)
  const latestDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  const earliestDob = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate() + 1);

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

// 👍 Fetch users that current user has already LIKED (pending, not matched yet)
const fetchLikedUserIds = async (userId) => {
  const likes = await Swipe.find({
    swiperId: userId,
    actionType: 'like'
  }).distinct('swipedId');
  
  return likes.map((id) => id.toString());
};

// ⏰ Fetch users disliked in last 24 hours (will be available again after 24h)
const fetchRecentDislikesUserIds = async (userId) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const dislikes = await Swipe.find({
    swiperId: userId,
    actionType: 'dislike',
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
    return { matchId: existing._id, isNewMatch: false };
  }

  // Fetch users' selected opening moves (may be null)
  const [userA, userB] = await Promise.all([
    User.findById(userId).select('selectedOpeningMove').lean(),
    User.findById(targetId).select('selectedOpeningMove').lean(),
  ]);

  const openingMoveUser1 = userA ? (userA.selectedOpeningMove || null) : null;
  const openingMoveUser2 = userB ? (userB.selectedOpeningMove || null) : null;

  // Canonicalize user ordering and upsert atomically to avoid duplicate matches
  const [u1, u2] = String(userId) < String(targetId) ? [String(userId), String(targetId)] : [String(targetId), String(userId)];
  const created = await Match.findOneAndUpdate(
    { user1Id: u1, user2Id: u2 },
    { $setOnInsert: { user1Id: u1, user2Id: u2, openingMoveUser1, openingMoveUser2, ...matchUpdate } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return { matchId: created._id, isNewMatch: true };
};

export const findLoveService = {
  async getSwipeDeck(userId, options = {}) {
    const limit = Number(options.limit) && Number(options.limit) > 0 ? Math.min(Number(options.limit), 30) : DEFAULT_CARD_LIMIT;
    const filters = options.filters || {};
    const debug = Boolean(options.debug);

    const userDoc = await ensureUserExists(userId);
    await ensureMatchingReady();

    const normalizedCurrentUser = buildUserResponse(userDoc);
    
    // Exclude: matched users + liked users (pending) + recent dislikes (24h) + blocked users
    const matchedIds = await fetchMatchedUserIds(userId);
    const likedIds = await fetchLikedUserIds(userId);  // 👈 NEW: exclude already liked users
    const recentDislikeIds = await fetchRecentDislikesUserIds(userId);

    // Users this user has blocked (from their document)
    const blockedByUser = Array.isArray(userDoc.blockedUsers) ? userDoc.blockedUsers.map(String) : [];

    // Users who have blocked this user (they added current user to their blockedUsers)
    const blockedThisUser = await User.find({ blockedUsers: userId }).distinct('_id').lean().catch(() => []);
    const blockedThisUserIds = Array.isArray(blockedThisUser) ? blockedThisUser.map(String) : [];

    const excludeIds = [...new Set([
      ...matchedIds,
      ...likedIds,          // 👈 NEW: don't show users you already liked
      ...recentDislikeIds,
      ...blockedByUser,
      ...blockedThisUserIds,
    ])];

    let candidateQuery = buildCandidateQuery(userDoc, excludeIds, { strictProfile: true });

    // Apply external filters (overrides user preferences where applicable)
    // Age filter -> dob range
    if (filters.ageRange && (Number.isFinite(filters.ageRange.min) || Number.isFinite(filters.ageRange.max))) {
      const dobRange = computeDobRange(filters.ageRange);
      if (dobRange) {
        candidateQuery.dob = { $ne: null, $gte: dobRange.earliestDob, $lte: dobRange.latestDob };
      }
    }

    // Height filter
    if (filters.heightRange && (Number.isFinite(filters.heightRange.min) || Number.isFinite(filters.heightRange.max))) {
      const hMin = Number.isFinite(filters.heightRange.min) ? Number(filters.heightRange.min) : 0;
      const hMax = Number.isFinite(filters.heightRange.max) ? Number(filters.heightRange.max) : 999;
      candidateQuery.height = { $gte: hMin, $lte: hMax };
    }

    // Cohort filter -> classYear variants (e.g. K60, 60)
    if (filters.cohortRange && (Number.isFinite(filters.cohortRange.min) || Number.isFinite(filters.cohortRange.max))) {
      const cMin = Number.isFinite(filters.cohortRange.min) ? Number(filters.cohortRange.min) : null;
      const cMax = Number.isFinite(filters.cohortRange.max) ? Number(filters.cohortRange.max) : null;
      if (cMin !== null && cMax !== null && cMax >= cMin) {
        const values = [];
        for (let y = cMin; y <= cMax; y += 1) {
          values.push(`K${y}`);
          values.push(String(y));
        }
        candidateQuery.classYear = { $in: values };
      } else if (cMin !== null) {
        candidateQuery.classYear = { $in: [`K${cMin}`, String(cMin)] };
      }
    }
    // If distance filter is provided and we have a valid current user geoLocation, use $near
    let rawCandidates;
    const distanceKm = Number.isFinite(filters.distance) ? Number(filters.distance) : null;
    const hasValidCoords = userDoc.geoLocation && Array.isArray(userDoc.geoLocation.coordinates)
      && userDoc.geoLocation.coordinates.length === 2
      && userDoc.geoLocation.coordinates.some((c) => Number.isFinite(c) && c !== 0);

    if (distanceKm && hasValidCoords) {
      const maxMeters = Math.max(0, Math.floor(distanceKm * 1000));
      rawCandidates = await User.find({
        ...candidateQuery,
        geoLocation: {
          $near: {
            $geometry: userDoc.geoLocation,
            $maxDistance: maxMeters,
          },
        },
      })
        .limit(Math.max(limit * 3, MAX_CANDIDATE_POOL))
        .exec();
    } else {
      rawCandidates = await User.find(candidateQuery)
        .sort({ createdAt: -1, updatedAt: -1 })
        .limit(Math.max(limit * 3, MAX_CANDIDATE_POOL))
        .exec();
    }

    // Debug logging
    try {
      console.debug('[findLoveService] filters:', JSON.stringify(filters));
      console.debug('[findLoveService] candidateQuery keys:', Object.keys(candidateQuery));
      console.debug('[findLoveService] rawCandidates.length:', rawCandidates.length);
    } catch (e) {
      // ignore logging errors
    }

    // If no candidates found with strict filters, return empty deck
    // DO NOT fallback to ignore filters - user expects filtered results only
    if (!rawCandidates.length) {
      return { deck: [], total: 0 };
    }

    const normalizedCandidates = rawCandidates
      .map((doc) => buildUserResponse(doc))
      .filter(Boolean);

    if (debug) {
      const sampleAges = normalizedCandidates.map((c) => c.age).slice(0, 50);
      const dobFilter = candidateQuery.dob ? {
        $gte: candidateQuery.dob.$gte ? candidateQuery.dob.$gte.toISOString() : undefined,
        $lte: candidateQuery.dob.$lte ? candidateQuery.dob.$lte.toISOString() : undefined,
      } : null;
      const sampleDobs = rawCandidates.slice(0, 50).map((d) => d.dob ? new Date(d.dob).toISOString() : null);
      return {
        deck: [],
        total: normalizedCandidates.length,
        debug: {
          filters,
          rawCandidates: rawCandidates.length,
          normalizedCandidates: normalizedCandidates.length,
          sampleAges,
          sampleDobs,
          dobFilter,
        },
      };
    }

    // If raw option is set, return mapped candidate cards directly (skip matching/ranking)
    if (options.raw) {
      const mapped = normalizedCandidates.map((user) => mapCandidateToCard(user, null, normalizedCurrentUser));
      const deck = mapped.slice(0, limit);
      return { deck, total: deck.length };
    }

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
    const { matchId, isNewMatch } = await createOrUpdateMatch(userId, targetUserId, compatibility);

    // ============ CREATE MATCH NOTIFICATIONS ============
    // Only create notifications for NEW matches to avoid duplicates
    let notifications = null;
    if (isNewMatch) {
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
    } else {
      console.log(`ℹ️ Match ${matchId} already exists, skipping notification creation`);
    }

    return {
      match: true,
      matchId,
      compatibility,
      notifications
    };
  },
};
