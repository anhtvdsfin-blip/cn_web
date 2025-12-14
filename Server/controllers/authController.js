// controllers/authController.js
import httpStatus from 'http-status';
import catchAsync from '../ultis/CatchAsync.js';
import { registerUser, loginUser } from '../services/AuthService.js';



/**
 * @desc Xử lý logic Đăng ký người dùng
 * @route POST /v1/auth/register
 * @access Public
 */
export const register = async (req, res) => {
    try {
        const { user, tokens } = await registerUser(req.body);

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.status(httpStatus.CREATED).send({
            user,
            accessToken: tokens.accessToken,
            message: 'Đăng ký thành công!'
        });
    } catch (error) {
        const status = error.statusCode
            || (error.code === 11000 ? httpStatus.CONFLICT : httpStatus.BAD_REQUEST);
        const message = error.code === 11000
            ? 'Email đã được sử dụng.'
            : error.message || 'Đăng ký thất bại.';

        res.status(status).send({ message });
    }
};

/**
 * @desc Xử lý logic Đăng nhập người dùng
 * @route POST /v1/auth/login
 * @access Public
 */

export const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // 1. Gọi Service để thực hiện xác thực
    const { user, tokens } = await loginUser(email, password);

    // 2. Thiết lập Refresh Token vào Cookie
    res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 
    });

    // 3. Trả về Access Token và thông tin User
    res.send({ 
        user, 
        accessToken: tokens.accessToken 
    });
});

export const logout = catchAsync(async (req, res) => {
    // Xóa cookie refreshToken
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
    });

    res.send({ message: 'Đăng xuất thành công!' });
});

export const refreshToken = catchAsync(async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
        return res.status(httpStatus.UNAUTHORIZED).send({ message: 'Không tìm thấy Refresh Token.' });
    }

    // Xác thực và tạo token mới
    const tokens = await AuthService.refreshTokens(refreshToken);
    res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 
    });

    res.send({ accessToken: tokens.accessToken });
}
);