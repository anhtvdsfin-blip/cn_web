//chat.jsx
import { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SocketContext } from "../contexts";
import Navbar from '../components/Navbar';

const pastelGradient = 'bg-[#fff5f8]';


export default function RandomChat() {
  const { socket } = useContext(SocketContext);
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [isFinding, setIsFinding] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [compatibilityScore, setCompatibilityScore] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);

  
  // ✅ TIMER STATE
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 phút = 180 giây
  const [isExpired, setIsExpired] = useState(false);
  
  // ✅ LIKE STATE
  const [iLiked, setILiked] = useState(false);
  const [partnerLiked, setPartnerLiked] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  
  // ✅ MATCH DATA
  const [matchId, setMatchId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [tempChatId, setTempChatId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const conversationIdRef = useRef(null);
  
  const messagesEndRef = useRef(null);

  // ✅ LOAD USER từ sessionStorage
  useEffect(() => {
    const userDataString = sessionStorage.getItem("user");
    if (!userDataString) {
      toast.error("Vui lòng đăng nhập!");
      return;
    }
    
    const userData = JSON.parse(userDataString);
    
    if (!userData.id || !userData.gender || !userData.age) {
      toast.error("Vui lòng hoàn thiện thông tin cá nhân!");
      return;
    }
    
    setUser(userData);
    console.log("✅ User loaded:", userData);
  }, []);

  // ✅ SOCKET CONNECTION
const navigate = useNavigate();

  useEffect(() => {
  if (!socket) return;

  // ===== PARTNER FOUND =====
  socket.on("partner_found", (data) => {
    console.log("💞 Partner found:", data);
    console.log("🔍 Partner hobbies:", data.hobbies); // ✅ THÊM DÒNG NÀY
    console.log("🔍 Partner hobbies type:", typeof data.hobbies); // ✅ VÀ DÒNG NÀY
    console.log("🔍 Is array:", Array.isArray(data.hobbies)); 
    setPartner(data);
    setCompatibilityScore(data.compatibilityScore);
    setMatchId(data.matchId);
    setRoomId(data.roomId);
    setTempChatId(data.tempChatId);
    setTimeRemaining(data.timeLimit || 180);
    setIsFinding(false);
    setIsExpired(false);
    setILiked(false);
    setPartnerLiked(false);
    setIsMatched(false);
    setMessages([]);
  });

  // ===== TIMER UPDATE =====
  socket.on("timer_update", ({ remaining }) => {
    setTimeRemaining(remaining);
    if (remaining === 0) setIsExpired(true);
  });

  // ===== CHAT EXPIRED =====
  socket.on("chat_expired", ({ message }) => {
    setIsExpired(true);
    toast.error(message || "Thời gian chat đã hết! Hãy like để tiếp tục.");
  });

  // ===== RECEIVE TEMP MESSAGE =====
  socket.on("receive_temp_message", (data) => {
    console.log("📩 Received message:", data);
    setMessages(prev => [...prev, {
      from: "partner",
      text: data.message,
      time: new Date(data.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }]);
  });

  // ===== PARTNER LIKED YOU =====
  socket.on("partner_liked_you", () => {
    setPartnerLiked(true);
    console.log("💖 Partner liked you!");
  });

  // ===== MUTUAL MATCH =====
  socket.on("mutual_match", (payload) => {
    // Accept multiple possible payload shapes: { conversationId }, { matchId }, or { matchId: ... }
    const convId = payload?.conversationId || payload?.matchId || payload?.chatRoomId || payload?.conversation || payload?.id || null;
    const message = payload?.message || payload?.msg || payload?.text || '';
    console.log("🎉 Mutual match received; payload:", payload, "resolvedId:", convId);

    if (!convId) {
      console.error("❌ No conversationId/matchId in mutual_match event!", payload);
      // don't block; show a lightweight notification and return
      toast.error("❌ Lỗi: Không nhận được conversationId/matchId từ server. Hãy thử tải lại.");
      return;
    }

    setIsMatched(true);
    setConversationId(convId);
    setIsExpired(false);

    toast.success(message || "🎉 Cả hai đã thích nhau! Giờ bạn có thể chat vĩnh viễn!");

    // Navigate to messenger for this match
    console.log(`🚀 Navigating to /messenger/${convId}`);
    setTimeout(() => {
      navigate(`/messenger/${convId}`, { replace: true });
    }, 500);
  });

  // ===== NEW MESSAGE =====
  socket.on("new_message", ({ conversationId: convId, message }) => {
    // Sử dụng conversationId hiện tại để lọc message
    setMessages(prev => {
      if (convId === conversationIdRef.current) {
        return [...prev, {
          from: "partner",
          text: message.content,
          time: new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }];
      }
      return prev;
    });
  });

  // ===== PARTNER DISCONNECTED =====
  socket.on("partner_disconnected", () => {
    toast.error("Người kia đã rời khỏi cuộc trò chuyện!");
    resetChat();
  });


  return () => {
    console.log("🔌 Removing chat listeners");
    socket.off("partner_found");
    socket.off("timer_update");
    socket.off("chat_expired");
    socket.off("receive_temp_message");
    socket.off("partner_liked_you");
    socket.off("mutual_match");
    socket.off("new_message");
    socket.off("partner_disconnected");
  };

}, [socket, navigate]); // depend on socket so listeners attach after context socket is ready

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit("join_conversations", conversationId);
  }, [socket, conversationId]);


  // ✅ AUTO SCROLL messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== FIND PARTNER =====
  const handleFindPartner = () => {
    if (!socket || !user) {
      toast.error("Chưa kết nối socket hoặc thiếu thông tin user");
      return;
    }

    setIsFinding(true);
    
    const userData = {
      _id: user._id || user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      gender: user.gender,
      age: user.age,
      avatar: user.avatar || "",
      job: user.job || user.career || "Chưa cập nhật",
      hometown: user.hometown || user.location || "Chưa cập nhật",
      hobbies: Array.isArray(user.hobbies) ? user.hobbies : [],
      zodiac: user.zodiac || "Chưa rõ",
      lookingFor: user.lookingFor || "Tất cả"
    };

    console.log("🚀 Finding partner with data:", userData);
    console.log("🚀 user.hobbies:", user.hobbies);
    console.log("🚀 user.zodiac:", user.zodiac);
    console.log("🚀 user.lookingFor:", user.lookingFor);
    socket.emit("find_partner", userData);
  };

  // ===== SEND MESSAGE =====
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!socket || !partner || !input.trim()) return;
    
    // Kiểm tra nếu hết thời gian và chưa match
    if (isExpired && !isMatched) {
      toast.error("Thời gian chat đã hết! Hãy like để tiếp tục.");
      return;
    }

    // Nếu đã matched → gửi message vĩnh viễn
    if (isMatched && conversationId) {
      socket.emit("send_message", {
        conversationId,
        message: input
      });
    } else {
      // Gửi temp message (trong 3 phút)
      socket.emit("send_temp_message", {
        roomId,
        tempChatId,
        message: input
      });
    }

    // Thêm message vào UI ngay lập tức
    setMessages((prev) => [...prev, {
      from: "me",
      text: input,
      time: new Date().toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }]);
    
    setInput("");
  };

  // ===== LIKE PARTNER =====
  const handleLike = () => {
    if (!socket || !matchId || iLiked) return;

    console.log("💖 Sending like for match:", matchId);
    socket.emit("like_partner", { matchId });
    setILiked(true);
  };

  // ===== RESET CHAT =====
  const resetChat = () => {
    setPartner(null);
    setMessages([]);
    setCompatibilityScore(null);
    setTimeRemaining(180);
    setIsExpired(false);
    setILiked(false);
    setPartnerLiked(false);
    setIsMatched(false);
    setMatchId(null);
    setRoomId(null);
    setTempChatId(null);
    setConversationId(null);
  };

  // ===== END CHAT =====
  const handleEndChat = () => {
    setShowEndChatConfirm(true);
  };

  const handleConfirmEndChat = () => {
    setShowEndChatConfirm(false);
    if (socket) {
      socket.disconnect();
      setTimeout(() => {
        socket.connect();
      }, 100);
    }
    resetChat();
  };

  // ===== FORMAT TIME =====
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ===== TIMER COLOR =====
  const getTimerColor = () => {
    if (isMatched) return 'text-green-500';
    if (timeRemaining > 120) return 'text-green-500';
    if (timeRemaining > 60) return 'text-yellow-500';
    return 'text-red-500 animate-pulse';
  };

  return (
    <div className={`${pastelGradient} min-h-screen pb-24 pt-20`}>
      <Navbar />

      <div className="relative z-10 mx-auto max-w-6xl px-2 sm:px-4">
        <div className="grid gap-4 sm:gap-8 lg:grid-cols-[320px,1fr,320px]">
          {/* Left sidebar - Hidden on mobile */}
          <aside className="hidden lg:block space-y-6 rounded-[24px] border border-rose-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-rose-600">Tài khoản</div>
            {user ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-xl bg-rose-50 flex items-center justify-center text-3xl">{user.gender === 'Nam' ? '👨' : user.gender === 'Nữ' ? '👩' : '🧑'}</div>
                <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-500">{user.age} • {user.hometown || user.location}</div>
                <button onClick={() => navigate('/profile')} className="mt-3 rounded-full bg-rose-400 px-4 py-2 text-xs font-semibold text-white">Chỉnh sửa hồ sơ</button>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Không có thông tin người dùng</div>
            )}
          </aside>

          {/* Main chat column (existing header/find/chat UI preserved) */}
          <main className="w-full">
            <div className="text-center mb-6 sm:mb-12">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-rose-900">💬 Random Chat</h1>
              <p className="text-xs sm:text-sm text-rose-700/80">Trò chuyện 3 phút - Like để chat vĩnh viễn</p>
            </div>

            {/* original content (finding / chatting) */}
            {!partner ? (
              <div className="max-w-xl mx-auto">
                <div className="group relative">
                  <div className="relative bg-white p-6 rounded-2xl shadow-md">
                    {user && (
                      <div className="text-center mb-6">
                        <div className="w-28 h-28 rounded-xl bg-rose-50 mx-auto flex items-center justify-center text-5xl">{user.gender === 'Nam' ? '👨' : user.gender === 'Nữ' ? '👩' : '🧑'}</div>
                        <h2 className="text-xl font-bold mt-3">{user.name}</h2>
                        <p className="text-sm text-slate-500">{user.gender} • {user.age} tuổi</p>
                        {user.hometown && <p className="text-sm text-slate-400">📍 {user.hometown}</p>}
                      </div>
                    )}

                    <div className="p-4">
                      {!isFinding ? (
                        <div className="text-center space-y-4">
                          <div className="text-6xl">🔍</div>
                          <h3 className="text-lg font-semibold">Sẵn sàng gặp người mới?</h3>
                          <p className="text-sm text-slate-500">Hệ thống sẽ tìm người phù hợp nhất với bạn ✨</p>
                          <button
                            onClick={handleFindPartner}
                            disabled={!socket || !user}
                            className="mt-4 rounded-full bg-rose-400 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Bắt đầu tìm kiếm
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-6xl mb-3 animate-spin">🔍</div>
                          <h3 className="text-lg font-semibold">Đang tìm kiếm...</h3>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="relative bg-white rounded-2xl shadow-md overflow-hidden">
                  <div className="bg-rose-50 p-3 sm:p-4 border-b">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">{partner.gender === 'Nam' ? '👨' : partner.gender === 'Nữ' ? '👩' : '🧑'}</div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-800 truncate text-sm sm:text-base">{partner.name}</h3>
                          <p className="text-xs text-slate-500 truncate">{partner.gender} • {partner.age} tuổi{partner.hometown ? ` • ${partner.hometown}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {!isMatched && (
                          <button onClick={handleLike} disabled={iLiked} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-rose-500 text-white rounded-xl text-xs sm:text-sm whitespace-nowrap">{iLiked ? 'Đã like' : 'Like'}</button>
                        )}
                        <button onClick={handleEndChat} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-200 text-xs sm:text-sm rounded-xl whitespace-nowrap">Kết thúc</button>
                      </div>
                    </div>
                  </div>

                  <div className="h-[350px] sm:h-[420px] overflow-y-auto p-3 sm:p-6 bg-white">
                    {messages.length === 0 && (
                      <div className="text-center text-slate-500 mt-8 sm:mt-12">
                        <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">👋</div>
                        <h3 className="text-base sm:text-lg font-semibold">Bắt đầu cuộc trò chuyện!</h3>
                        <p className="text-xs sm:text-sm">Bạn có 3 phút để làm quen 💬</p>
                      </div>
                    )}

                    {messages.map((msg, index) => (
                      <div key={index} className={`mb-3 sm:mb-4 flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] sm:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl ${msg.from === 'me' ? 'bg-rose-400 text-white' : 'bg-slate-100 text-slate-800'}`}>
                          <p className="break-words text-sm sm:text-base">{msg.text}</p>
                          {msg.time && <p className="text-xs mt-1 text-slate-400">{msg.time}</p>}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-3 sm:p-4 border-t bg-white">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isExpired && !isMatched ? '⏰ Hết thời gian! Like để tiếp tục...' : 'Nhập tin nhắn...'}
                        disabled={isExpired && !isMatched}
                        className="flex-1 px-3 sm:px-4 py-2 border rounded-2xl text-sm sm:text-base"
                        onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                      />
                      <button onClick={handleSendMessage} disabled={!input.trim() || (isExpired && !isMatched)} className="px-3 sm:px-4 py-2 bg-rose-500 text-white rounded-2xl text-sm sm:text-base whitespace-nowrap">Gửi</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Right sidebar - Hidden on mobile */}
          <aside className="hidden lg:block space-y-6 rounded-[24px] border border-rose-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-rose-600">Thông tin cuộc trò chuyện</div>
            <div className="text-sm text-slate-600">
              <p><strong>Thời gian còn lại:</strong> <span className={getTimerColor()}>{isMatched ? '∞' : formatTime(timeRemaining)}</span></p>
              {compatibilityScore && <p><strong>Độ tương thích:</strong> {compatibilityScore}%</p>}
              <p className="mt-3 text-xs text-slate-400">Gợi ý: Like để kết nối dài hạn.</p>
            </div>
          </aside>

          {/* Mobile info panel - Show only when chatting */}
          {partner && (
            <div className="lg:hidden col-span-full">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-100">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-rose-600">Thời gian: </span>
                    <span className={getTimerColor()}>{isMatched ? '∞' : formatTime(timeRemaining)}</span>
                  </div>
                  {compatibilityScore && (
                    <div>
                      <span className="font-semibold text-rose-600">Độ tương thích: </span>
                      <span>{compatibilityScore}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== END CHAT CONFIRM MODAL ===== */}
      {showEndChatConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-rose-950/55 backdrop-blur-sm">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-rose-100 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Kết thúc cuộc trò chuyện?</h3>
            <p className="mt-2 text-sm text-slate-600">Bạn chắc chắn muốn rời khỏi cuộc trò chuyện này?</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowEndChatConfirm(false)}
                className="flex-1 rounded-full border border-rose-100 bg-white px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmEndChat}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
              >
                Kết thúc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CSS ANIMATIONS ===== */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        
        /* Custom scrollbar */
        .overflow-y-auto::-webkit-scrollbar {
          width: 8px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.5);
          border-radius: 10px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.7);
        }
      `}</style>
    </div>
  );
}