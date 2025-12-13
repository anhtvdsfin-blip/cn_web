// ============================================
// socket/chatSocket.js - Real-time Chat System
// ============================================

import matchingService from '../services/MatchingService.js';
import Match from '../models/Match.js';
import TemporaryChat from '../models/TemporaryChat.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export const initChatSocket = (io) => {
  const waitingQueue = [];
  const activeChatRooms = new Map(); // socketId -> roomData
  const chatTimers = new Map(); // roomId -> timer

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.id}`);


// ==========================================
// AUTH USER (fix userId undefined)
// ==========================================
socket.on("auth_user", ({ userId }) => {
  if (!userId) {
    console.log("❌ auth_user received empty userId");
    return;
  }

  socket.data.userId = userId.toString();
  socket.join(`user_${userId}`);
  console.log(`🔐 Authenticated user: ${socket.data.userId}`);
});

    // ==========================================
    // 1. TÌM PARTNER
    // ==========================================


    socket.on("find_partner", async (userData) => {
      try {
        console.log(`🔍 ${userData.name} đang tìm partner...`);

        if (waitingQueue.length === 0) {
          waitingQueue.push({ ...userData, socketId: socket.id });
          console.log("⏳ Added to queue");
          return;
        }

        // Tìm best match
        let bestMatch = null;
        let bestScore = 0;
        let bestIndex = -1;
        let bestCompatibility = null;

        for (let i = 0; i < waitingQueue.length; i++) {
          const candidate = waitingQueue[i];
          if (candidate.socketId === socket.id) continue;

          const compatibility = await matchingService.calculateCompatibility(
            {
              gender: userData.gender,
              age: userData.age,
              career: userData.job || "Chưa cập nhật",
              hobbies: userData.hobbies || [],
              location: userData.hometown || "Chưa cập nhật",
              zodiac: userData.zodiac || "Chưa rõ",
              lookingFor: userData.lookingFor || "Tất cả"
            },
            {
              gender: candidate.gender,
              age: candidate.age,
              career: candidate.job || "Chưa cập nhật",
              hobbies: candidate.hobbies || [],
              location: candidate.hometown || "Chưa cập nhật",
              zodiac: candidate.zodiac || "Chưa rõ",
              lookingFor: candidate.lookingFor || "Tất cả"
            }
          );

          if (compatibility.overallScore > bestScore) {
            bestScore = compatibility.overallScore;
            bestMatch = candidate;
            bestIndex = i;
            bestCompatibility = compatibility;
          }
        }

        if (bestMatch && bestScore >= 50) {
          waitingQueue.splice(bestIndex, 1);

          // ✅ TẠO ROOM và TIMER 3 PHÚT
          const roomId = `room_${socket.id}_${bestMatch.socketId}`;
          const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 phút

          // Join room
          socket.join(roomId);
          io.sockets.sockets.get(bestMatch.socketId)?.join(roomId);

          // Lưu active chat
          activeChatRooms.set(socket.id, {
            roomId,
            partnerId: bestMatch._id || bestMatch.id,
            partnerSocketId: bestMatch.socketId,
            expiresAt
          });
          activeChatRooms.set(bestMatch.socketId, {
            roomId,
            partnerId: userData._id || userData.id,
            partnerSocketId: socket.id,
            expiresAt
          });

          // ✅ TẠO TEMPORARY CHAT trong DB
          const tempChat = await TemporaryChat.create({
            user1Id: userData._id || userData.id,
            user2Id: bestMatch._id || bestMatch.id,
            user1SocketId: socket.id,
            user2SocketId: bestMatch.socketId,
            startedAt: new Date(),
            expiresAt,
            messages: []
          });

          // ✅ TẠO MATCH RECORD
          const match = await Match.create({
            user1Id: userData._id || userData.id,
            user2Id: bestMatch._id || bestMatch.id,
            compatibilityScore: bestScore,
            compatibilityBreakdown: bestCompatibility.breakdown,
            status: 'pending',
            expiresAt,
            tempChatId: tempChat._id  
          });

          // ✅ GỬI THÔNG TIN CHO CẢ 2
          const partnerData = {
            socketId: bestMatch.socketId,
            userId: bestMatch._id || bestMatch.id,
            name: bestMatch.name,
            gender: bestMatch.gender,
            age: bestMatch.age,
            avatar: bestMatch.avatar,
            job: bestMatch.job,
            hometown: bestMatch.hometown,
            hobbies: bestMatch.hobbies || [],           // ✅ THÊM
            zodiac: bestMatch.zodiac || "Chưa rõ",      // ✅ THÊM
            lookingFor: bestMatch.lookingFor || "Tất cả",
            compatibilityScore: bestScore,
            breakdown: bestCompatibility.breakdown,
            roomId,
            matchId: match._id,
            tempChatId: tempChat._id,
            timeLimit: 180 // 180 giây = 3 phút
          };

          socket.emit("partner_found", partnerData);

          io.to(bestMatch.socketId).emit("partner_found", {
            socketId: socket.id,
            userId: userData._id || userData.id,
            name: userData.name,
            gender: userData.gender,
            age: userData.age,
            avatar: userData.avatar,
            job: userData.job,
            hometown: userData.hometown,
            hobbies: userData.hobbies || [],             // ✅ THÊM
            zodiac: userData.zodiac || "Chưa rõ",        // ✅ THÊM
            lookingFor: userData.lookingFor || "Tất cả",
            compatibilityScore: bestScore,
            breakdown: bestCompatibility.breakdown,
            roomId,
            matchId: match._id,
            tempChatId: tempChat._id,
            timeLimit: 180
          });

          // ✅ BẮT ĐẦU TIMER 3 PHÚT
          startChatTimer(roomId, expiresAt, match._id, tempChat._id, io);

          console.log(`💕 Matched! Room: ${roomId}, Score: ${bestScore}%`);
        } else {
          waitingQueue.push({ ...userData, socketId: socket.id });
          console.log("⏳ No match, added to queue");
        }

      } catch (error) {
        console.error("❌ Error finding partner:", error);
        socket.emit("error", { message: "Lỗi khi tìm partner" });
      }
    });

    // ==========================================
    // 2. GỬI TIN NHẮN (3 PHÚT)
    // ==========================================
    socket.on("send_temp_message", async ({ roomId, tempChatId, message }) => {
      try {
        const chatRoom = activeChatRooms.get(socket.id);
        if (!chatRoom || chatRoom.roomId !== roomId) {
          socket.emit("error", { message: "Invalid room" });
          return;
        }

        // Kiểm tra hết hạn chưa
        if (new Date() > chatRoom.expiresAt) {
          socket.emit("chat_expired");
          return;
        }

        // Lưu message vào DB
        await TemporaryChat.findByIdAndUpdate(tempChatId, {
          $push: {
            messages: {
              senderId: socket.data.userId,
              content: message,
              timestamp: new Date()
            }
          }
        });

        // Emit cho partner
        socket.to(roomId).emit("receive_temp_message", {
          from: socket.id,
          message,
          timestamp: new Date().toISOString()
        });

        console.log(`💬 Message in ${roomId}: ${message.substring(0, 30)}...`);

      } catch (error) {
        console.error("❌ Error sending message:", error);
      }
    });

    // ==========================================
    // 3. LIKE PARTNER
    // ==========================================
    socket.on("like_partner", async ({ matchId }) => {
      try {
        const match = await Match.findById(matchId);
        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        const userId = socket.data.userId;
        const isUser1 = match.user1Id.toString() === userId;

        // ✅ Cập nhật trạng thái like
        if (isUser1) {
          match.user1Liked = true;
          match.user1LikedAt = new Date();
        } else {
          match.user2Liked = true;
          match.user2LikedAt = new Date();
        }

        await match.save();
        console.log(`💖 User ${userId} liked ${isUser1 ? "user2" : "user1"}!`);

        // ✅ Gửi tín hiệu cho partner biết rằng họ được like
        const chatRoom = activeChatRooms.get(socket.id);
        if (chatRoom) {
          io.to(chatRoom.partnerSocketId).emit("partner_liked_you");
        }

        // ✅ Nếu cả hai cùng like → tạo hoặc dùng lại conversation
        if (match.user1Liked && match.user2Liked) {
          match.status = "matched";
          match.matchedAt = new Date();

          // 🔍 Tìm xem đã có conversation giữa hai người chưa
          let conversation = await Conversation.findOne({
            participants: { $all: [match.user1Id, match.user2Id], $size: 2 },
          });

          if (!conversation) {
            // 🆕 Chưa có → tạo mới
            conversation = await Conversation.create({
              participants: [match.user1Id, match.user2Id],
              matchId: match._id,
              lastMessage: {
                text: "Hai bạn đã kết nối! 💕",
                timestamp: new Date(),
              },
            });
            console.log(`🆕 New conversation created: ${conversation._id}`);
          } else {
            console.log(`♻️ Existing conversation reused: ${conversation._id}`);
          }

          match.conversationId = conversation._id;
          await match.save();

          // ✅ Chuyển tin nhắn tạm (3 phút) sang Conversation chính
          if (match.tempChatId) {
            const tempChat = await TemporaryChat.findById(match.tempChatId);
            if (tempChat && tempChat.messages.length > 0) {
              const tempMessages = tempChat.messages.map((msg) => ({
                senderId: msg.senderId,
                content: msg.content,
                timestamp: msg.timestamp,
              }));

              await Conversation.findByIdAndUpdate(conversation._id, {
                $push: { messages: { $each: tempMessages } },
              });

              await TemporaryChat.findByIdAndDelete(match.tempChatId);
              console.log(`💬 Moved ${tempMessages.length} temp messages → ${conversation._id}`);
            }
          }

          // ✅ Gửi thông báo match thành công cho cả 2 người
          const roomId = chatRoom?.roomId;
          if (roomId) {
            io.to(roomId).emit("mutual_match", {
              conversationId: conversation._id,
              message: "🎉 Cả hai đã thích nhau! Giờ bạn có thể chat vĩnh viễn!",
            });
          }

          // ✅ Hủy đếm giờ 3 phút (nếu có)
          if (roomId) clearChatTimer(roomId);

          console.log(`🎉 MUTUAL MATCH → Conversation ${conversation._id}`);
        }
      } catch (error) {
        console.error("❌ Error in like_partner:", error);
        socket.emit("error", { message: "Đã có lỗi khi xử lý like" });
      }
    });


    // ==========================================
    // 4. GỬI TIN NHẮN VĨNH VIỄN (SAU KHI MATCH)
    // ==========================================
    socket.on("send_message", async ({ conversationId, message, tempId }) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        const userId = socket.data.userId;
        if (!conversation.participants.some(id => id.toString() === userId.toString())) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // Tạo object message mới
        const newMessage = {
          senderId: userId,
          content: message,
          timestamp: new Date(),
          isRead: false
        };

        // Thêm vào mảng messages
        conversation.messages.push(newMessage);

        // Update lastMessage
        conversation.lastMessage = {
          text: message,
          senderId: userId,
          timestamp: new Date()
        };
        conversation.updatedAt = new Date();
        await conversation.save();

        // // Update unread count cho partner
        // const partnerId = conversation.participants.find(p => p.toString() !== userId);
        // const currentUnread = conversation.unreadCount.get(partnerId.toString()) || 0;
        // conversation.unreadCount.set(partnerId.toString(), currentUnread + 1);

        // await conversation.save();
        // Update unread count cho partner
        const userIdStr = userId.toString();

        const participantIds = conversation.participants.map(p =>
          p.toString()
        );

        const partnerId = participantIds.find(id => id !== userIdStr);

        if (!partnerId) {
          console.error("❌ partnerId is undefined in send_message");
        } else {
          if (!conversation.unreadCount) {
            conversation.unreadCount = new Map();
          }

          const currentUnread = conversation.unreadCount.get(partnerId) || 0;
          conversation.unreadCount.set(partnerId, currentUnread + 1);
        }

        // Emit tin nhắn cho tất cả participants kèm tempId để client thay thế tin tạm
        conversation.participants.forEach(participantId => {
          io.to(`user_${participantId}`).emit("new_message", {
            conversationId,
            message: {
              ...newMessage,
              tempId // giữ tempId nếu muốn sync client
            }
          });
        });

        console.log(`💬 New message in conversation ${conversationId}`);

      } catch (error) {
        console.error("❌ Error sending message:", error);
      }
    });

    // ==========================================
    // 5. TYPING INDICATOR
    // ==========================================
    socket.on("typing", ({ conversationId, isTyping }) => {
      const userId = socket.data.userId;
      Conversation.findById(conversationId).then(conv => {
        if (conv) {
          const partnerId = conv.participants
          .map(p => p.toString())
          .find(id => id !== userId.toString());

          if (partnerId) {
            io.to(`user_${partnerId}`).emit("partner_typing", { conversationId, isTyping });
          }
        }
      });
    });

    // ==========================================
    // 6. MARK AS READ
    // ==========================================
    socket.on("mark_as_read", async ({ conversationId }) => {
      try {
        const userId = socket.data.userId;
        const conversation = await Conversation.findById(conversationId);
        
        if (conversation) {
          conversation.unreadCount.set(userId.toString(), 0);

          await conversation.save();

          // Mark messages as read
          await Message.updateMany(
            {
              conversationId,
              senderId: { $ne: userId },
              'readBy.userId': { $ne: userId }
            },
            {
              $push: {
                readBy: {
                  userId,
                  readAt: new Date()
                }
              }
            }
          );
        }
      } catch (error) {
        console.error("❌ Error marking as read:", error);
      }
    });

    // ==========================================
    // 7. JOIN CONVERSATION ROOM (để nhận tin nhắn)
    // ==========================================
    socket.on("join_conversations", async (userId) => {
      socket.data.userId = userId;
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined personal room`);
    });

    // ==========================================
    // 8. DISCONNECT (SỬA LẠI)
    // ==========================================
    socket.on("disconnect", async () => {
    console.log(`❌ User disconnected: ${socket.id}`);

    // Xóa khỏi hàng chờ
    const queueIndex = waitingQueue.findIndex(u => u.socketId === socket.id);
    if (queueIndex !== -1) {
        waitingQueue.splice(queueIndex, 1);
    }

    const chatRoom = activeChatRooms.get(socket.id);
    if (chatRoom) {
        try {
        // Kiểm tra xem match của phòng này đã mutual hay chưa
        const match = await Match.findOne({
            $or: [
            { user1Id: socket.data.userId, user2Id: chatRoom.partnerId },
            { user1Id: chatRoom.partnerId, user2Id: socket.data.userId }
            ]
        });

        // Nếu CHƯA mutual (status khác 'matched') thì mới báo rời phòng
        if (!match || match.status !== "matched") {
            io.to(chatRoom.partnerSocketId).emit("partner_disconnected");
        }

        // Xóa trạng thái phòng đang chat
        activeChatRooms.delete(socket.id);
        activeChatRooms.delete(chatRoom.partnerSocketId);
        clearChatTimer(chatRoom.roomId);

        console.log(`🧹 Room cleared: ${chatRoom.roomId}`);
        } catch (error) {
        console.error("❌ Error on disconnect:", error);
        }
    }
    });
    });
    


  // ==========================================
  // HELPER: START CHAT TIMER
  // ==========================================
  function startChatTimer(roomId, expiresAt, matchId, tempChatId, io) {
    const timeLeft = expiresAt.getTime() - Date.now();
    
    // Emit countdown mỗi giây
    const countdownInterval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      io.to(roomId).emit("timer_update", { remaining });
      
      if (remaining <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Timer hết hạn
    const expiryTimer = setTimeout(async () => {
      clearInterval(countdownInterval);
      
      // Update match status
      await Match.findByIdAndUpdate(matchId, {
        status: 'expired'
      });

      // Update temp chat
      await TemporaryChat.findByIdAndUpdate(tempChatId, {
        status: 'expired'
      });

      // Notify users
      io.to(roomId).emit("chat_expired", {
        message: "Thời gian chat đã hết! Hãy like nhau để tiếp tục trò chuyện."
      });

      console.log(`⏰ Chat expired: ${roomId}`);
      
      chatTimers.delete(roomId);
    }, timeLeft);

    chatTimers.set(roomId, { countdownInterval, expiryTimer });
  }

  // ==========================================
  // HELPER: CLEAR CHAT TIMER
  // ==========================================
  function clearChatTimer(roomId) {
    const timers = chatTimers.get(roomId);
    if (timers) {
      clearInterval(timers.countdownInterval);
      clearTimeout(timers.expiryTimer);
      chatTimers.delete(roomId);
      console.log(`⏰ Timer cleared: ${roomId}`);
    }
  }
};

export default initChatSocket;