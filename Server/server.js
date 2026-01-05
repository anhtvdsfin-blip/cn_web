import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";  // NEW
import connectDB from "./config/db.js";
import matchingService from "./services/MatchingService.js";  // NEW
import crushRoutes from './routes/crushRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import libraryRoutes from './routes/libraryRoutes.js';
import { initChatSocket } from './socket/chatSocket.js';
import { initNotificationSocket } from './socket/notificationSocket.js';
import postRoutes from './routes/postRoutes.js';
import { notifRouter } from './routes/notificationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import findLoveRoutes from './routes/findLoveRoutes.js';
import openingMoveRoutes from './routes/openingMoveRoutes.js';

import { initPostSocket } from './socket/postSocket.js';

dotenv.config();

const app = express();

// Trust proxy - required when behind reverse proxy (Nginx, Cloudflare, Docker, etc.)
// This allows express-rate-limit to correctly identify users via X-Forwarded-For header
app.set('trust proxy', 1);

// Security: set various HTTP headers
app.use(helmet());

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 400, // limit each IP to 400 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general rate limiter to all requests
app.use(generalLimiter);

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
const httpServer = createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,  // lấy từ biến môi trường
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000"
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store io instance in app for controllers
app.set('io', io);


// Middleware
// ✅ Middleware CORS thông minh: cho phép localhost và devtunnels tự động
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép nếu không có origin (Postman, server nội bộ)
    if (!origin) return callback(null, true);

    // Cho phép localhost hoặc domain từ Azure DevTunnels
    if (origin.includes("localhost") || origin.includes("devtunnels.ms")) {
      return callback(null, true);
    }

    // Cho phép frontend chính thức (nếu có)
    if (origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    // Còn lại thì chặn
    console.warn("❌ CORS blocked request from:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Parse cookies
app.use(cookieParser());

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attach io to app for routes to access
app.use((req, res, next) => {
  req.io = io;
  // Add helper to emit notifications to specific user
  req.emitNotification = (recipientId, data) => {
    io.to(recipientId.toString()).emit('notification:new', data);
  };
  next();
});

// API Routes
// Apply strict rate limiter to auth routes
app.use("/api/auth", authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/match", matchRoutes);  // NEW
app.use('/api/findlove', findLoveRoutes);
// Crush API v1
app.use('/api/v1', crushRoutes);
app.use('/api', openingMoveRoutes);
app.use('/api', conversationRoutes);
app.use("/api", postRoutes);
app.use("/api", notifRouter);  
// Library routes
app.use('/api/library', libraryRoutes);

// Phục vụ tệp tĩnh từ dist
app.use(express.static(path.join(__dirname, "../my-react-app/dist")));  // đổi "client" thành thư mục front-end của bạn

// Bắt tất cả route không phải /api
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../my-react-app/dist", "index.html"));
});


// Kết nối MongoDB
connectDB();

// Initialize Matching Service
(async () => {
  try {
    await matchingService.initialize();
    console.log('✅ Matching Service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Matching Service:', error);
  }
})();


// Socket.IO logic
initChatSocket(io);
initPostSocket(io);
initNotificationSocket(io);



app.get("/api/health", (req, res) => {
  const stats = matchingService.getStats();
  res.json({
    status: "ok",
    matching: stats
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server đang chạy tại http://0.0.0.0:${PORT}`);
});
