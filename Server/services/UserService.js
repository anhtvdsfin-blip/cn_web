import httpStatus from 'http-status';
import User from '../models/User.js';
import { geocodeLocation } from '../helper/geocodeLocation.js';
import { uploadProfilePhoto } from './photo.service.js';

const MIN_MATCH_AGE = 18;
const MAX_MATCH_AGE = 26;
const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 220;

const clampAgeRange = (value) => {
    if (!value || typeof value !== 'object') {
        return {
            min: MIN_MATCH_AGE,
            max: MAX_MATCH_AGE,
        };
    }

    let min = Number(value.min);
    let max = Number(value.max);

    if (!Number.isFinite(min)) {
        min = MIN_MATCH_AGE;
    }
    if (!Number.isFinite(max)) {
        max = MAX_MATCH_AGE;
    }

    min = Math.trunc(min);
    max = Math.trunc(max);

    if (min < MIN_MATCH_AGE) {
        min = MIN_MATCH_AGE;
    }
    if (min > MAX_MATCH_AGE - 1) {
        min = MAX_MATCH_AGE - 1;
    }

    if (max > MAX_MATCH_AGE) {
        max = MAX_MATCH_AGE;
    }
    if (max <= min) {
        max = Math.min(MAX_MATCH_AGE, min + 1);
    }

    return { min, max };
};

export const normalizeGender = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (['male', 'nam'].includes(normalized)) {
        return 'Male';
    }
    if (['female', 'nữ', 'nu'].includes(normalized)) {
        return 'Female';
    }
    if (['other', 'khác', 'khac'].includes(normalized)) {
        return 'Other';
    }

    return null;
};

const normalizeLookingFor = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (['male', 'nam'].includes(normalized)) {
        return 'Male';
    }
    if (['female', 'nữ', 'nu'].includes(normalized)) {
        return 'Female';
    }
    if (['all', 'tat ca', 'tất cả', 'all genders'].includes(normalized)) {
        return 'All';
    }

    return null;
};

const sanitizeImageValue = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    if (/^(https?:)?\/\//i.test(trimmed)) {
        return trimmed;
    }
    return '';
};

const deriveZodiacFromDate = (dateValue) => {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.valueOf())) {
        return '';
    }

    const month = dateValue.getUTCMonth() + 1;
    const day = dateValue.getUTCDate();

    const zodiacTable = [
        { name: 'Ma Kết', start: { month: 12, day: 22 }, end: { month: 1, day: 19 } },
        { name: 'Bảo Bình', start: { month: 1, day: 20 }, end: { month: 2, day: 18 } },
        { name: 'Song Ngư', start: { month: 2, day: 19 }, end: { month: 3, day: 20 } },
        { name: 'Bạch Dương', start: { month: 3, day: 21 }, end: { month: 4, day: 19 } },
        { name: 'Kim Ngưu', start: { month: 4, day: 20 }, end: { month: 5, day: 20 } },
        { name: 'Song Tử', start: { month: 5, day: 21 }, end: { month: 6, day: 20 } },
        { name: 'Cự Giải', start: { month: 6, day: 21 }, end: { month: 7, day: 22 } },
        { name: 'Sư Tử', start: { month: 7, day: 23 }, end: { month: 8, day: 22 } },
        { name: 'Xử Nữ', start: { month: 8, day: 23 }, end: { month: 9, day: 22 } },
        { name: 'Thiên Bình', start: { month: 9, day: 23 }, end: { month: 10, day: 22 } },
        { name: 'Bọ Cạp', start: { month: 10, day: 23 }, end: { month: 11, day: 21 } },
        { name: 'Nhân Mã', start: { month: 11, day: 22 }, end: { month: 12, day: 21 } },
    ];

    const matchesRange = (entry) => {
        const { start, end } = entry;
        if (start.month === end.month) {
            return month === start.month && day >= start.day && day <= end.day;
        }
        if (start.month < end.month) {
            return (
                (month === start.month && day >= start.day)
                || (month === end.month && day <= end.day)
                || (month > start.month && month < end.month)
            );
        }
        // Range wraps around the year (e.g., Capricorn)
        return (
            month > start.month
            || month < end.month
            || (month === start.month && day >= start.day)
            || (month === end.month && day <= end.day)
        );
    };

    const found = zodiacTable.find(matchesRange);
    return found ? found.name : '';
};

export const buildUserResponse = (userDoc) => {
    if (!userDoc) {
        return null;
    }

    const plainUser = userDoc.toObject({ virtuals: true });
    const { password, __v, _id, location, hometown, gender, geoLocation, ...rest } = plainUser;
    const id = _id?.toString();
    const normalizedHometown = typeof hometown === 'string' && hometown.trim().length > 0
        ? hometown.trim()
        : (typeof location === 'string' && location.trim().length > 0 ? location.trim() : 'Not updated');
    const normalizedGeoLocation = geoLocation
        && typeof geoLocation === 'object'
        && Array.isArray(geoLocation.coordinates)
        && geoLocation.coordinates.length === 2
        ? {
            type: 'Point',
            coordinates: [
                Number(geoLocation.coordinates[0]) || 0,
                Number(geoLocation.coordinates[1]) || 0,
            ],
        }
        : undefined;
    const normalizedGender = normalizeGender(gender) || 'Other';
    const basePreferences = (rest.preferences && typeof rest.preferences === 'object')
        ? rest.preferences
        : {};
    const normalizedPreferences = {
        ...basePreferences,
        ageRange: clampAgeRange(basePreferences?.ageRange),
    };
    const normalizedHobbies = Array.isArray(rest.hobbies) ? rest.hobbies : [];
    const normalizedStudySubjects = Array.isArray(rest.studySubjects) ? rest.studySubjects : [];
    const sanitizedAvatar = sanitizeImageValue(plainUser.avatar);
    let normalizedPhotoGallery = Array.isArray(rest.photoGallery)
        ? rest.photoGallery
            .map((entry) => sanitizeImageValue(entry))
            .filter((entry) => entry && entry.length > 0)
        : [];
    if (normalizedPhotoGallery.length === 0 && sanitizedAvatar) {
        normalizedPhotoGallery = [sanitizedAvatar];
    }
    const avatarInitial = typeof plainUser.avatarInitial === 'string' && plainUser.avatarInitial.length > 0
        ? plainUser.avatarInitial
        : (typeof plainUser.name === 'string' && plainUser.name.trim().length > 0
            ? plainUser.name.trim().charAt(0).toUpperCase()
            : '');
    const normalizedHeight = (() => {
        const numeric = Number(plainUser.height);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        const truncated = Math.trunc(numeric);
        if (truncated < MIN_HEIGHT_CM || truncated > MAX_HEIGHT_CM) {
            return null;
        }
        return truncated;
    })();

    const normalizedZodiac = (() => {
        const raw = typeof rest.zodiac === 'string' ? rest.zodiac.trim() : '';
        if (raw && raw.toLowerCase() !== 'unknown') {
            return raw;
        }
        return deriveZodiacFromDate(userDoc.dob);
    })();

    return {
        ...rest,
        preferences: normalizedPreferences,
        hobbies: normalizedHobbies,
        studySubjects: normalizedStudySubjects,
        photoGallery: normalizedPhotoGallery,
        avatar: sanitizedAvatar,
        avatarFallback: avatarInitial,
        avatarInitial,
        height: normalizedHeight,
        _id: id,
        id,
        gender: normalizedGender,
        hometown: normalizedHometown,
        location: normalizedHometown,
        geoLocation: normalizedGeoLocation,
        zodiac: normalizedZodiac,
        isProfileComplete: typeof userDoc.isProfileComplete === 'function'
            ? userDoc.isProfileComplete()
            : rest.profileCompleted ?? false,
    };
};

const extractBufferFromDataUri = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const matches = trimmed.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        return null;
    }
    try {
        const buffer = Buffer.from(matches[2], 'base64');
        if (!buffer || buffer.length === 0) {
            return null;
        }
        const mimeType = matches[1];
        return { buffer, mimeType };
    } catch (parseError) {
        console.error('Không thể chuyển đổi Data URI sang buffer:', parseError);
        return null;
    }
};

const resolveImageValue = async (userId, value) => {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const parsed = extractBufferFromDataUri(trimmed);
    if (parsed) {
        const { buffer, mimeType } = parsed;
        return await uploadProfilePhoto(userId, buffer, mimeType || 'image/jpeg');
    }
    return sanitizeImageValue(trimmed);
};

export const getUserProfile = async (userId) => {
    if (!userId) {
        const error = new Error('Thiếu userId.');
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('Người dùng không tồn tại.');
        error.statusCode = httpStatus.NOT_FOUND;
        throw error;
    }

    return buildUserResponse(user);
};

export const updateUserProfile = async (userId, payload) => {
    if (!userId) {
        const error = new Error('Thiếu userId.');
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('Người dùng không tồn tại.');
        error.statusCode = httpStatus.NOT_FOUND;
        throw error;
    }

    const {
        gender,
        dob,
        career,
        location,
        bio,
        hobbies,
        zodiac,
        preferences,
        classYear,
        studySubjects,
        academicHighlights,
        connectionGoal,
        photoGallery,
        avatar,
        height,
    } = payload;

    if (gender) {
        const normalizedGender = normalizeGender(gender);
        if (!normalizedGender) {
            const error = new Error('Giới tính không hợp lệ.');
            error.statusCode = httpStatus.BAD_REQUEST;
            throw error;
        }
        user.gender = normalizedGender;
    }

    if (dob) {
        const parsedDob = new Date(dob);
        if (Number.isNaN(parsedDob.getTime())) {
            const error = new Error('Ngày sinh không hợp lệ.');
            error.statusCode = httpStatus.BAD_REQUEST;
            throw error;
        }
        user.dob = parsedDob;
    }

    if (career !== undefined) {
        if (typeof career === 'string') {
            const trimmedCareer = career.trim();
            user.career = trimmedCareer.length > 0 ? trimmedCareer : 'Not updated';
        } else {
            user.career = 'Not updated';
        }
    }

    if (classYear !== undefined) {
        if (typeof classYear === 'string') {
            const trimmedClassYear = classYear.trim();
            user.classYear = trimmedClassYear.length > 0 ? trimmedClassYear : 'Not updated';
        } else {
            user.classYear = 'Not updated';
        }
    }

    let trimmedLocation;
    if (location !== undefined) {
        if (typeof location === 'string') {
            trimmedLocation = location.trim();
            if (trimmedLocation.length > 0) {
                user.hometown = trimmedLocation;
                user.location = trimmedLocation;
            } else {
                user.hometown = 'Not updated';
                user.location = 'Not updated';
            }
        } else {
            user.hometown = 'Not updated';
            user.location = 'Not updated';
        }
    }

    if (bio !== undefined) {
        const trimmedBio = typeof bio === 'string' ? bio.trim().slice(0, 500) : '';
        user.bio = trimmedBio;
    }

    if (Array.isArray(hobbies)) {
        const sanitizedHobbies = Array.from(
            new Set(
                hobbies
                    .map((item) => (typeof item === 'string' ? item.trim() : ''))
                    .filter((item) => item.length > 0)
            )
        ).slice(0, 20);
        user.hobbies = sanitizedHobbies;
    }

    if (zodiac) {
        user.zodiac = zodiac;
    }

    if (Array.isArray(studySubjects)) {
        const sanitizedSubjects = Array.from(
            new Set(
                studySubjects
                    .map((item) => (typeof item === 'string' ? item.trim() : ''))
                    .filter((item) => item.length > 0)
            )
        ).slice(0, 20);
        user.studySubjects = sanitizedSubjects;
    }

    if (typeof academicHighlights === 'string') {
        user.academicHighlights = academicHighlights.trim().slice(0, 400);
    }

    if (height !== undefined) {
        const numericHeight = Number(height);
        if (Number.isFinite(numericHeight)) {
            const truncated = Math.trunc(numericHeight);
            if (truncated >= MIN_HEIGHT_CM && truncated <= MAX_HEIGHT_CM) {
                user.height = truncated;
            } else {
                user.height = 0;
            }
        } else {
            user.height = 0;
        }
    }

    if (typeof connectionGoal === 'string') {
        const normalizedGoal = connectionGoal.trim();
        const allowedGoals = ['study', 'friendship', 'relationship'];
        user.connectionGoal = allowedGoals.includes(normalizedGoal) ? normalizedGoal : '';
    }

    let resolvedAvatarUrl = null;
    const rawAvatarValue = typeof avatar === 'string' ? avatar.trim() : null;

    if (rawAvatarValue !== null) {
        if (rawAvatarValue.length === 0) {
            user.avatar = '';
        } else {
            resolvedAvatarUrl = await resolveImageValue(userId, rawAvatarValue);
            if (resolvedAvatarUrl) {
                user.avatar = resolvedAvatarUrl;
            }
        }
    }

    if (Array.isArray(photoGallery)) {
        const uniqueItems = Array.from(
            new Set(
                photoGallery
                    .map((item) => (typeof item === 'string' ? item.trim() : ''))
                    .filter((item) => item.length > 0)
            )
        ).slice(0, 10);

        const resolvedUrls = [];
        for (const item of uniqueItems) {
            if (rawAvatarValue && item === rawAvatarValue && resolvedAvatarUrl) {
                if (!resolvedUrls.includes(resolvedAvatarUrl)) {
                    resolvedUrls.push(resolvedAvatarUrl);
                }
                continue;
            }

            const resolved = await resolveImageValue(userId, item);
            if (resolved && !resolvedUrls.includes(resolved)) {
                resolvedUrls.push(resolved);
            }
        }

        user.photoGallery = resolvedUrls;
    }

    if (resolvedAvatarUrl) {
        const gallery = Array.isArray(user.photoGallery) ? user.photoGallery : [];
        if (!gallery.includes(resolvedAvatarUrl)) {
            user.photoGallery = [resolvedAvatarUrl, ...gallery].slice(0, 10);
        } else {
            user.photoGallery = gallery;
        }
    }

    if (trimmedLocation && trimmedLocation.length > 0) {
        try {
            const geocodeResult = await geocodeLocation(trimmedLocation);
            if (geocodeResult?.coordinates) {
                user.geoLocation = {
                    type: 'Point',
                    coordinates: geocodeResult.coordinates,
                };
            }
        } catch (geocodeError) {
            console.error('⚠️  Không thể geocode địa điểm:', geocodeError);
        }
    } else if (location !== undefined) {
        user.geoLocation = {
            type: 'Point',
            coordinates: [0, 0],
        };
    }

    const currentPrefs = user.preferences || {};
    const incomingPrefs = preferences || {};

    const normalizedLookingFor = normalizeLookingFor(
        incomingPrefs.lookingFor ?? currentPrefs.lookingFor ?? 'All'
    ) || 'All';

    const allowedGoals = ['study', 'friendship', 'relationship'];
    const normalizedPrefGoal = typeof incomingPrefs.connectionGoal === 'string'
        ? incomingPrefs.connectionGoal.trim()
        : currentPrefs.connectionGoal;
    const finalPrefGoal = allowedGoals.includes(normalizedPrefGoal)
        ? normalizedPrefGoal
        : (allowedGoals.includes(user.connectionGoal) ? user.connectionGoal : '');

    let normalizedPrefSubjects = currentPrefs.studySubjects || [];
    if (Array.isArray(incomingPrefs.studySubjects)) {
        normalizedPrefSubjects = Array.from(
            new Set(
                incomingPrefs.studySubjects
                    .map((item) => (typeof item === 'string' ? item.trim() : ''))
                    .filter((item) => item.length > 0)
            )
        ).slice(0, 20);
    } else if (Array.isArray(user.studySubjects) && user.studySubjects.length > 0) {
        normalizedPrefSubjects = user.studySubjects;
    }

    let minAgeCandidate = Number(
        incomingPrefs.ageRange?.min ?? currentPrefs.ageRange?.min ?? MIN_MATCH_AGE
    );
    let maxAgeCandidate = Number(
        incomingPrefs.ageRange?.max ?? currentPrefs.ageRange?.max ?? MAX_MATCH_AGE
    );

    if (Number.isNaN(minAgeCandidate) || Number.isNaN(maxAgeCandidate)) {
        const error = new Error('Khoảng tuổi không hợp lệ.');
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
    }

    minAgeCandidate = Math.trunc(minAgeCandidate);
    maxAgeCandidate = Math.trunc(maxAgeCandidate);

    if (minAgeCandidate < MIN_MATCH_AGE) {
        minAgeCandidate = MIN_MATCH_AGE;
    }
    if (minAgeCandidate > MAX_MATCH_AGE - 1) {
        minAgeCandidate = MAX_MATCH_AGE - 1;
    }

    if (maxAgeCandidate > MAX_MATCH_AGE) {
        maxAgeCandidate = MAX_MATCH_AGE;
    }
    if (maxAgeCandidate <= minAgeCandidate) {
        maxAgeCandidate = Math.min(MAX_MATCH_AGE, minAgeCandidate + 1);
    }

    if (maxAgeCandidate <= minAgeCandidate) {
        const error = new Error('Khoảng tuổi không hợp lệ.');
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
    }

    const distanceCandidate = Number(
        incomingPrefs.distance ?? currentPrefs.distance ?? 50
    );

    if (Number.isNaN(distanceCandidate) || distanceCandidate <= 0) {
        const error = new Error('Khoảng cách không hợp lệ.');
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
    }

    user.preferences = {
        lookingFor: normalizedLookingFor,
        ageRange: {
            min: minAgeCandidate,
            max: maxAgeCandidate,
        },
        distance: distanceCandidate,
        connectionGoal: finalPrefGoal,
        studySubjects: normalizedPrefSubjects,
    };

    user.profileCompleted = true;
    user.lastActive = new Date();
    user.updatedAt = new Date();

    await user.save();

    return buildUserResponse(user);
};
