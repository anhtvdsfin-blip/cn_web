// ============================================
// socket/chatSocket.js - Real-time Chat System
// ============================================

import matchingService from '../services/MatchingService.js';
import mongoose from 'mongoose';
import Match from '../models/Match.js';
import TemporaryChat from '../models/TemporaryChat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export const initChatSocket = (io) => {
  // Helper: canonicalize two user ids into a stable ordering to avoid duplicate match records
  function canonicalPair(a, b) {
    const s1 = String(a);
    const s2 = String(b);
    return s1 < s2 ? [s1, s2] : [s2, s1];
  }

  const waitingQueue = [];
  const activeChatRooms = new Map(); // socketId -> roomData
  const chatTimers = new Map(); // roomId -> timer

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.id}`);


// ==========================================
// AUTH USER (fix userId undefined)
// ==========================================
// socket auth: accept token or legacy userId
socket.on("auth_user", async ({ token, userId }) => {
  try {
    if (token) {
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        socket.emit('error', { message: 'Invalid auth token' });
        return;
      }
      const uid = payload.sub;
      socket.data.userId = uid.toString();
      socket.join(`user_${uid}`);
      console.log(`🔐 Authenticated user via token: ${socket.data.userId}`);
      return;
    }

    // fallback: legacy client sending userId directly (not recommended)
    if (userId) {
      socket.data.userId = userId.toString();
      socket.join(`user_${userId}`);
      console.log(`⚠️ Authenticated user via userId (legacy): ${socket.data.userId}`);
      return;
    }

    console.log("❌ auth_user received empty credentials");
  } catch (err) {
    console.error('auth_user handler error', err);
  }
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

        const currentUserId = userData._id || userData.id;

        for (let i = 0; i < waitingQueue.length; i++) {
          const candidate = waitingQueue[i];
          if (candidate.socketId === socket.id) continue;

          const candidateId = candidate._id || candidate.id;

          // ✅ KIỂM TRA XEM 2 NGƯỜI ĐÃ MATCH CHƯA
          const [u1, u2] = canonicalPair(currentUserId, candidateId);
          
          console.log(`🔍 Checking match between ${userData.name} (${currentUserId}) and ${candidate.name} (${candidateId})`);
          console.log(`🔍 Canonical pair: u1=${u1}, u2=${u2}`);
          
          const existingMatch = await Match.findOne({
            user1Id: u1,
            user2Id: u2,
            matchedAt: { $ne: null } // Chỉ check những match đã hoàn thành (cả 2 đã like)
          });

          if (existingMatch) {
            console.log(`⚠️ SKIP ${candidate.name} - Already matched with ${userData.name} at ${existingMatch.matchedAt}`);
            console.log(`   Match status: ${existingMatch.status}, conversationId: ${existingMatch.conversationId}`);
            continue; // Bỏ qua người này, tìm người khác
          } else {
            console.log(`✅ No existing match found - can pair ${userData.name} with ${candidate.name}`);
          }

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

          // ✅ TẠO MATCH RECORD (canonicalize pair + upsert to avoid duplicates)
          const [u1, u2] = canonicalPair(userData._id || userData.id, bestMatch._id || bestMatch.id);
          const matchPayload = {
            compatibilityScore: bestScore,
            compatibilityBreakdown: bestCompatibility.breakdown,
            status: 'active',
            expiresAt,
            tempChatId: tempChat._id
          };
          const match = await Match.findOneAndUpdate(
            { user1Id: u1, user2Id: u2 },
            {
              $setOnInsert: { user1Id: u1, user2Id: u2, ...matchPayload },
              $set: {
                user1Liked: false,
                user2Liked: false,
                user1LikedAt: null,
                user2LikedAt: null,
                matchedAt: null,
                updatedAt: new Date()
              }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          );

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
        // Try to load by provided matchId. If not found, attempt to resolve
        // the participating user ids from socket state / activeChatRooms / temp chat
        let match = null;
        if (matchId) match = await Match.findById(matchId);

        // resolve userId (liker) - declare once and initialize safely
        let userId = socket.data?.userId || null;
        if (!userId) {
          const roomInfo = activeChatRooms.get(socket.id);
          if (roomInfo && roomInfo.userId) {
            userId = roomInfo.userId;
            console.log(`ℹ️ Resolved userId from activeChatRooms: ${userId}`);
          }
        }

        // If match not found, try to derive partnerId and either reuse an existing
        // match between the two users or create a new one so likes can be applied.
        if (!match) {
          let partnerId = null;

          const roomInfo = activeChatRooms.get(socket.id);
          if (roomInfo && roomInfo.partnerId) partnerId = roomInfo.partnerId;

          if (!partnerId) {
            // try TemporaryChat fallback
            try {
              const temp = await TemporaryChat.findOne({ $or: [{ user1SocketId: socket.id }, { user2SocketId: socket.id }] });
              if (temp) {
                if (temp.user1SocketId === socket.id) partnerId = temp.user2Id?.toString();
                else if (temp.user2SocketId === socket.id) partnerId = temp.user1Id?.toString();
              }
            } catch (e) {
              console.warn('❌ Error resolving partnerId from TemporaryChat:', e?.message || e);
            }
          }

          if (userId && partnerId) {
            // look for existing match between these users
            const existing = await Match.findOne({
              $or: [
                { user1Id: userId, user2Id: partnerId },
                { user1Id: partnerId, user2Id: userId }
              ]
            });

            if (existing) {
              match = existing;
              console.log(`🔁 Reusing existing match ${existing._id} between ${userId} and ${partnerId}`);
            } else {
              // create a new match record and mark it active
              const payload = {
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              // canonicalize ordering to ensure uniqueness and atomically upsert
              const [u1, u2] = canonicalPair(userId, partnerId);
              match = await Match.findOneAndUpdate(
                { user1Id: u1, user2Id: u2 },
                {
                  $setOnInsert: { user1Id: u1, user2Id: u2, ...payload },
                  $set: {
                    user1Liked: false,
                    user2Liked: false,
                    user1LikedAt: null,
                    user2LikedAt: null,
                    matchedAt: null,
                    updatedAt: new Date()
                  }
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
              );
              console.log(`➕ Upserted match ${match._id} for users ${u1} & ${u2}`);
            }
          }

          if (!match) {
            socket.emit("error", { message: "Match not found and could not be created" });
            return;
          }
        }

        // Resolve userId: prefer attached socket data, then activeChatRooms, then TemporaryChat as fallback
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

        // Ensure we update the actual match document we resolved/created above
        const targetMatchId = matchId || (match && match._id);
        if (!targetMatchId) {
          console.error('❌ No match id available to update likes');
          socket.emit('error', { message: 'No match id to apply like' });
          return;
        }

        // Perform atomic update and get PREVIOUS document to check whether the other side had already liked
        const prevMatch = await Match.findByIdAndUpdate(targetMatchId, update, { new: false });
        console.log('💖 like_partner update', { targetMatchId, userId, isUser1, prevUser1Liked: !!prevMatch?.user1Liked, prevUser2Liked: !!prevMatch?.user2Liked });

        // ✅ Gửi tín hiệu cho partner biết rằng họ được like
        const chatRoom = activeChatRooms.get(socket.id);
        if (chatRoom) {
          io.to(chatRoom.partnerSocketId).emit("partner_liked_you");
        }

        // Determine if this like completed a mutual match (other side had already liked)
        const otherHadLiked = isUser1 ? !!prevMatch?.user2Liked : !!prevMatch?.user1Liked;
        if (otherHadLiked) {
          // fetch the updated document for further processing
          const updatedMatch = await Match.findById(targetMatchId);
          const matchIdForChat = updatedMatch._id;

          // Atomically update match status
          await Match.findByIdAndUpdate(updatedMatch._id, {
            $set: { status: 'matched', matchedAt: new Date() }
          });

          // Move temp messages (if any) into Message collection using chatRoomId = matchId
          let tempChat = null;
          console.log('➡️ Attempting temp message migration', { matchId: matchIdForChat, tempChatId: updatedMatch.tempChatId, roomInfo: chatRoom });
          if (updatedMatch.tempChatId) {
            try { tempChat = await TemporaryChat.findById(updatedMatch.tempChatId); } catch (e) { console.warn('❌ Error loading TemporaryChat by id:', e?.message || e); }
          }

          // Fallbacks: by user ids, by socket ids from activeChatRooms, or by roomId
          if (!tempChat) {
            try {
              tempChat = await TemporaryChat.findOne({
                $or: [
                  { user1Id: updatedMatch.user1Id, user2Id: updatedMatch.user2Id },
                  { user1Id: updatedMatch.user2Id, user2Id: updatedMatch.user1Id }
                ]
              });
              console.log('ℹ️ Fallback lookup by userIds', { found: !!tempChat, tempChatId: tempChat?._id });
            } catch (e) {
              console.warn('❌ Error finding fallback TemporaryChat by userIds:', e?.message || e);
            }
          }

          if (!tempChat && chatRoom) {
            try {
              tempChat = await TemporaryChat.findOne({
                $or: [
                  { user1SocketId: socket.id },
                  { user2SocketId: socket.id },
                  { user1SocketId: chatRoom.partnerSocketId },
                  { user2SocketId: chatRoom.partnerSocketId }
                ]
              });
              console.log('ℹ️ Fallback lookup by socketIds', { found: !!tempChat, tempChatId: tempChat?._id });
            } catch (e) {
              console.warn('❌ Error finding fallback TemporaryChat by socketIds:', e?.message || e);
            }
          }

          if (!tempChat) {
            console.log('⚠️ No TemporaryChat found to migrate for match', matchIdForChat);
          }

          if (tempChat && Array.isArray(tempChat.messages) && tempChat.messages.length > 0) {
            const tempMessages = tempChat.messages.map((msg) => ({
              chatRoomId: matchIdForChat,
              senderId: msg.senderId,
              content: msg.content || '',
              attachment: msg.attachment || null,
              icon: msg.icon || null,
              type: msg.attachment ? 'image' : (msg.icon ? 'emoji' : 'text'),
              status: 'sent',
              timestamp: msg.timestamp || msg.createdAt || new Date(),
              createdAt: msg.timestamp || msg.createdAt || new Date(),
              updatedAt: msg.timestamp || msg.createdAt || new Date()
            }));

            const inserted = await Message.insertMany(tempMessages, { ordered: true });

            // clear tempChatId on match if it was set
            try {
              if (updatedMatch.tempChatId) await Match.findByIdAndUpdate(matchIdForChat, { $unset: { tempChatId: "" } });
            } catch (e) {
              console.warn('Could not clear tempChatId on match', e?.message || e);
            }

            // delete temp chat after successful migration
            try {
              await TemporaryChat.findByIdAndDelete(tempChat._id);
            } catch (e) {
              console.warn('Could not delete TemporaryChat after migration', e?.message || e);
            }

            console.log(`💬 Moved ${inserted.length || tempMessages.length} temp messages → match ${matchIdForChat}`);
          }

          // Notify both users using match id as conversationId
          const roomId = chatRoom?.roomId;
          if (roomId) {
            io.to(roomId).emit("mutual_match", {
              conversationId: matchIdForChat,
              message: "🎉 Cả hai đã thích nhau! Giờ bạn có thể chat vĩnh viễn!",
            });
          }

          // Also notify users directly in their personal rooms so app-level sockets receive the event
          try {
            if (updatedMatch.user1Id) io.to(`user_${String(updatedMatch.user1Id)}`).emit('mutual_match', { matchId: matchIdForChat, message: '🎉 Cả hai đã thích nhau!' });
            if (updatedMatch.user2Id) io.to(`user_${String(updatedMatch.user2Id)}`).emit('mutual_match', { matchId: matchIdForChat, message: '🎉 Cả hai đã thích nhau!' });
          } catch (e) {
            console.warn('Could not emit mutual_match to personal rooms', e?.message || e);
          }

          // Cancel 3-minute timer (if any)
          if (roomId) clearChatTimer(roomId);

          console.log(`🎉 MUTUAL MATCH → Match ${matchIdForChat}`);
        }
      } catch (error) {
        console.error("❌ Error in like_partner:", error);
        socket.emit("error", { message: "Đã có lỗi khi xử lý like" });
      }
    });


    // ==========================================
    // 4. GỬI TIN NHẮN VĨNH VIỄN (SAU KHI MATCH)
    // ==========================================
    socket.on("send_message", async (payload) => {
      // payload may be { conversationId, message, tempId, senderId, attachment, icon }
      const { conversationId, tempId, senderId } = payload || {};
      let message = payload?.message;

      // If attachment/icon provided at top-level, and message is a string, normalize to object
      if ((payload?.attachment || payload?.icon) && (typeof message === 'string' || !message)) {
        message = {
          content: typeof message === 'string' ? message : (message?.content || ''),
          attachment: payload.attachment,
          icon: payload.icon
        };
      }
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

        // Accept optional attachment/icon from message object
        const { attachment, icon } = message || {};
        const content = typeof message === 'string' ? message : (message?.content || '');
        const savedMessage = await Message.create({
          chatRoomId: conversationId,
          senderId: userId,
          content: content || '',
          attachment: attachment || null,
          icon: icon || null,
          type: attachment ? 'image' : (icon ? 'emoji' : 'text'),
          status: 'sent',
          timestamp: new Date()
        });

        console.log(`✅ Message saved: ${savedMessage._id}`);

        // Update lastMessage in Match (store text preview)
        match.lastMessage = {
          text: attachment ? (content || '📷 Ảnh') : (icon ? `${icon} ${content || ''}` : content),
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

        // Try to fetch sender name to include in payload so clients can display sender
        let senderName = 'Ai đó';
        try {
          const senderUser = await User.findById(userId).select('name');
          if (senderUser && senderUser.name) senderName = senderUser.name;
        } catch (e) {
          console.warn('Could not fetch sender user for notif payload', e?.message || e);
        }

        const payload = {
          conversationId,
          message: {
            _id: savedMessage._id,
            senderId: savedMessage.senderId,
            senderName,
            content: savedMessage.content,
            attachment: savedMessage.attachment,
            icon: savedMessage.icon,
            type: savedMessage.type,
            timestamp: savedMessage.timestamp,
            tempId
          }
        };

        io.to(user1Room).emit('new_message', payload);
        io.to(user2Room).emit('new_message', payload);

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