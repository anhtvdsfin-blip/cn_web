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

          // Lưu active chat (gồm cả userId để dễ tra cứu later)
          activeChatRooms.set(socket.id, {
            userId: userData._id || userData.id,
            roomId,
            partnerId: bestMatch._id || bestMatch.id,
            partnerSocketId: bestMatch.socketId,
            expiresAt
          });
          activeChatRooms.set(bestMatch.socketId, {
            userId: bestMatch._id || bestMatch.id,
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
            status: 'active',
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

        // Resolve userId: prefer attached socket data, then activeChatRooms, then TemporaryChat as fallback
        let userId = socket.data.userId;
        if (!userId) {
          const roomInfo = activeChatRooms.get(socket.id);
          if (roomInfo && roomInfo.userId) {
            userId = roomInfo.userId;
            console.log(`ℹ️ Resolved userId from activeChatRooms: ${userId}`);
          }
        }

        if (!userId && match.tempChatId) {
          try {
            const temp = await TemporaryChat.findById(match.tempChatId);
            if (temp) {
              if (temp.user1SocketId === socket.id) userId = temp.user1Id?.toString();
              else if (temp.user2SocketId === socket.id) userId = temp.user2Id?.toString();
              if (userId) console.log(`ℹ️ Resolved userId from TemporaryChat: ${userId}`);
            }
          } catch (e) {
            console.error('❌ Error resolving userId from temp chat:', e);
          }
        }

        const isUser1 = userId ? (match.user1Id.toString() === userId) : false;

        // ✅ Atomically update the like flag to avoid race conditions
        const update = isUser1
          ? { $set: { user1Liked: true, user1LikedAt: new Date() } }
          : { $set: { user2Liked: true, user2LikedAt: new Date() } };

        const updatedMatch = await Match.findByIdAndUpdate(matchId, update, { new: true });
        console.log(`💖 User ${userId || 'UNKNOWN'} liked ${isUser1 ? "user2" : "user1"}! Updated match: ${updatedMatch._id}`);

        // ✅ Gửi tín hiệu cho partner biết rằng họ được like
        const chatRoom = activeChatRooms.get(socket.id);
        if (chatRoom) {
          io.to(chatRoom.partnerSocketId).emit("partner_liked_you");
        }

        // ✅ Nếu cả hai cùng like → tạo hoặc dùng lại conversation
        if (updatedMatch.user1Liked && updatedMatch.user2Liked) {
          // mark matched and set matchedAt atomically later after conversation created

          // 🔍 Tìm xem đã có conversation giữa hai người chưa (dùng updatedMatch)
          let conversation = await Conversation.findOne({
            participants: { $all: [updatedMatch.user1Id, updatedMatch.user2Id], $size: 2 },
          });

          if (!conversation) {
            // 🆕 Chưa có → tạo mới
            conversation = await Conversation.create({
              participants: [updatedMatch.user1Id, updatedMatch.user2Id],
              matchId: updatedMatch._id,
              lastMessage: {
                text: "Hai bạn đã kết nối! 💕",
                timestamp: new Date(),
              },
            });
            console.log(`🆕 New conversation created: ${conversation._id}`);
          } else {
            console.log(`♻️ Existing conversation reused: ${conversation._id}`);
          }

          // Atomically update match with conversationId and status
          await Match.findByIdAndUpdate(updatedMatch._id, {
            $set: { conversationId: conversation._id, status: 'matched', matchedAt: new Date() }
          });

          // ✅ Chuyển tin nhắn tạm (3 phút) sang Conversation chính
          if (updatedMatch.tempChatId) {
            const tempChat = await TemporaryChat.findById(updatedMatch.tempChatId);
            if (tempChat && tempChat.messages.length > 0) {
              const tempMessages = tempChat.messages.map((msg) => ({
                senderId: msg.senderId,
                content: msg.content,
                timestamp: msg.timestamp,
              }));

              await Conversation.findByIdAndUpdate(conversation._id, {
                $push: { messages: { $each: tempMessages } },
              });

              await TemporaryChat.findByIdAndDelete(updatedMatch.tempChatId);
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
    socket.on("send_message", async ({ conversationId, message, tempId, senderId }) => {
      try {
        console.log(`📨 Received send_message: conversationId=${conversationId}, senderId=${senderId}, message=${message}`);

        // Use senderId from payload or socket data
        const userId = senderId || socket.data.userId;
        if (!userId) {
          console.error("❌ No userId found in socket.data or payload");
          socket.emit("error", { message: "Unauthorized - No user ID" });
          return;
        }

        // conversationId is actually matchId
        const match = await Match.findById(conversationId);
        if (!match) {
          console.error(`❌ Match not found: ${conversationId}`);
          socket.emit("error", { message: "Match not found" });
          return;
        }

        const isUser1 = match.user1Id.toString() === userId;
        const isUser2 = match.user2Id.toString() === userId;

        if (!isUser1 && !isUser2) {
          console.error(`❌ Unauthorized: userId=${userId}, user1Id=${match.user1Id}, user2Id=${match.user2Id}`);
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // Create new message in Message collection
        const newMessage = await Message.create({
          chatRoomId: conversationId,
          senderId: userId,
          content: message,
          type: 'text',
          status: 'sent',
          timestamp: new Date()
        });

        console.log(`✅ Message saved: ${newMessage._id}`);

        // Update lastMessage in Match
        match.lastMessage = {
          text: message,
          senderId: userId,
          timestamp: new Date()
        };
        match.updatedAt = new Date();

        // Update unread count for partner
        const partnerId = isUser1 ? match.user2Id.toString() : match.user1Id.toString();
        const currentUnread = match.unreadCount.get(partnerId) || 0;
        match.unreadCount.set(partnerId, currentUnread + 1);

        await match.save();

        // Emit message to both users
        const user1Room = `user_${match.user1Id}`;
        const user2Room = `user_${match.user2Id}`;

        io.to(user1Room).emit("new_message", {
          conversationId,
          message: {
            _id: newMessage._id,
            senderId: newMessage.senderId,
            content: newMessage.content,
            timestamp: newMessage.timestamp,
            tempId
          }
        });

        io.to(user2Room).emit("new_message", {
          conversationId,
          message: {
            _id: newMessage._id,
            senderId: newMessage.senderId,
            content: newMessage.content,
            timestamp: newMessage.timestamp,
            tempId
          }
        });

        console.log(`💬 Message emitted to both users in match ${conversationId}`);

      } catch (error) {
        console.error("❌ Error sending message:", error.message);
        socket.emit("error", { message: "Failed to send message: " + error.message });
      }
    });

    // ==========================================
    // 5. TYPING INDICATOR
    // ==========================================
    socket.on("typing", ({ conversationId, isTyping }) => {
      const userId = socket.data.userId;
      Match.findById(conversationId).then(match => {
        if (match) {
          const partnerId = match.user1Id.toString() === userId 
            ? match.user2Id.toString() 
            : match.user1Id.toString();

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
        const match = await Match.findById(conversationId);
        
        if (match) {
          match.unreadCount.set(userId.toString(), 0);
          await match.save();

          // Mark messages as read in Message collection
          await Message.updateMany(
            {
              chatRoomId: conversationId,
              senderId: { $ne: userId }
            },
            {
              $set: { isRead: true }
            }
          );
        }
      } catch (error) {
        console.error("❌ Error marking as read:", error);
      }
    });

    // ==========================================
    // 7. JOIN CONVERSATION ROOM (để nhận tin nhắn)
    // Accept both singular/plural event names from clients
    // ==========================================
    const joinHandler = async (userId) => {
      try {
        socket.data.userId = userId;
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined personal room (socket ${socket.id})`);
      } catch (err) {
        console.error('❌ Error in join handler:', err);
      }
    };

    socket.on("join_conversations", joinHandler);
    socket.on("join_conversation", joinHandler);

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