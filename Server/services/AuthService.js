import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import User from '../models/User.js';
import Token from '../models/token.js';
import { buildUserResponse, normalizeGender } from './UserService.js';

// HASH MẬT KHẨU
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};
// SO SÁNH MẬT KHẨU
const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};
// TẠO ACCESS TOKEN (Thời gian tồn tại ngắn)
const generateAccessToken = (userId) => {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { 
        expiresIn: process.env.JWT_ACCESS_EXPIRATION 
    });
};

// TẠO VÀ LƯU REFRESH TOKEN (Thời gian tồn tại dài)
const generateAndSaveRefreshToken = async (userId) => {
    const refreshToken = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRATION
    });

    const expiresAt = new Date(Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRATION_MS)); // Ví dụ: 30 ngày
    
    const hashedToken = await hashPassword(refreshToken);

    await Token.create({
        userId,
        token: hashedToken,
        expires: expiresAt,
    });

    return refreshToken;
};

// LOGIC ĐĂNG KÝ
export const registerUser = async (userData) => {
    const { name, email, password, gender, ...rest } = userData;

    if(!email.endsWith('@sis.hust.edu.vn')) {
        const error = new Error('Bạn phải đăng ký với email của HUST.');
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
    }

    if (await User.findOne({ email })) {
        const error = new Error('Email đã được sử dụng.');
        error.statusCode = httpStatus.CONFLICT;
        throw error;
    }

    const hashedPassword = await hashPassword(password);
    const normalizedGender = normalizeGender(gender) || 'Other';

    // 3. Tạo người dùng
    const newUser = await User.create({
        name,
        email,
        password: hashedPassword,
        gender: normalizedGender,
        ...rest  
    });

    const safeUser = buildUserResponse(newUser);
    const accessToken = generateAccessToken(newUser._id);
    const refreshToken = await generateAndSaveRefreshToken(newUser._id);

    return { user: safeUser, tokens: { accessToken, refreshToken } };
};

// LOGIC ĐĂNG NHẬP
export const loginUser = async (email, password) => {
    const user = await User.findOne({ email }).select('+password'); // Lấy cả password

    if (!user || !(await comparePassword(password, user.password))) {
        const error = new Error('Email hoặc mật khẩu không chính xác.');
        error.statusCode = httpStatus.UNAUTHORIZED;
        throw error;
    }

    const safeUser = buildUserResponse(user);
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateAndSaveRefreshToken(user._id);
    
    return { user: safeUser, tokens: { accessToken, refreshToken } };
};

// LOGIC LÀM MỚI TOKEN
export const logoutUser = async (userId) => {
    await Token.deleteMany({ userId });
}

// LOGIC LÀM MỚI TOKEN
export const refreshAccessToken = async (refreshToken) => {
    let payload;
    try {
        payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
        throw new Error('Refresh Token không hợp lệ.');
    }

    const user = await User.findById(payload.sub);

    if (!user) {
        throw new Error('Không tìm thấy người dùng.');
    }

    const accessToken = generateAccessToken(user._id);

    return accessToken;
};