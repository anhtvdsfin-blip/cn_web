import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { SocketContext } from '../contexts';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Heart, Smile, Image as ImageIcon, Send, HeartHandshake,MoreHorizontal } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';


export default function Messenger() {
  const navigate = useNavigate();
  const location = useLocation();
  const targetConversationId = location.state?.conversationId;
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL;
  const socket = useContext(SocketContext);

  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
   if (!socket || !user) return;

    console.log("🔐 Emitting auth_user with:", user.id);
    socket.emit("auth_user", { userId: user.id });
    socket.emit("join_conversations", user.id);
  }, [socket, user]);

  // ✅ Load user
  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!userData.id) {
      navigate('/login');
      return;
    }
    setUser(userData);
  }, [navigate]);

  const selectedConversationRef = useRef(selectedConversation);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // ✅ Socket connection
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit("join_conversations", user.id);

    socket.on('new_message', ({ conversationId, message }) => {
      console.log('📩 New message received:', { conversationId, message });

      if (selectedConversationRef.current?._id === conversationId) {
        setMessages(prev => {
          const tempIndex = prev.findIndex(m => m._id === message.tempId);
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = {
              _id: message._id,
              senderId: message.senderId,
              content: message.content,
              timestamp: message.timestamp,
              createdAt: message.timestamp
            };
            return updated;
          }

          if (prev.some(m => m._id === message._id)) return prev;

          return [...prev, {
            _id: message._id,
            senderId: message.senderId,
            content: message.content,
            timestamp: message.timestamp,
            createdAt: message.timestamp
          }];
        });
      }

      setConversations(prev => prev.map(conv => {
        if (conv._id === conversationId) {
          return {
            ...conv,
            lastMessage: { text: message.content, timestamp: message.timestamp },
            unreadCount: conv._id === selectedConversationRef.current?._id
              ? conv.unreadCount
              : (conv.unreadCount || 0) + 1
          };
        }
        return conv;
      }).sort((a, b) => new Date(b.lastMessage?.timestamp) - new Date(a.lastMessage?.timestamp)));
    });

    socket.on('partner_typing', ({ conversationId, isTyping: typing }) => {
      if (selectedConversationRef.current?._id === conversationId) {
        setIsTyping(typing);
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('partner_typing');
    };
  }, [user, socket]); 

   // ✅ Select conversation
  const handleSelectConversation = useCallback(async (conv) => {
    console.log('📂 Selecting conversation:', conv._id);
    setSelectedConversation(conv);
    
    try {
      const res = await axios.get(`${API_URL}/api/messages/${conv._id}`);
      await new Promise(resolve => setTimeout(resolve, 300)); 
      
      if (res.data.success) {
        console.log('📬 Loaded messages:', res.data.messages.length);
        setMessages(res.data.messages);
      }

      if (socket) {
        socket.emit('mark_as_read', { conversationId: conv._id });
      }

      setConversations(prev => prev.map(c => 
        c._id === conv._id ? { ...c, unreadCount: 0 } : c
      ));

    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [API_URL, socket]);


  // ✅ Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const res = await axios.get(`${API_URL}/api/conversations?userId=${user.id}`);


      await new Promise(resolve => setTimeout(resolve, 300)); 
      



      if (res.data.success) {
        setConversations(res.data.conversations);
        console.log("Conversations:", res.data.conversations);


        if (targetConversationId && !selectedConversation) {
          const conv = res.data.conversations.find(c => c._id === targetConversationId);
          if (conv) {
            handleSelectConversation(conv);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [API_URL, handleSelectConversation, selectedConversation, targetConversationId, user]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [fetchConversations, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

 
  // ✅ Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!socket || !input.trim() || !selectedConversation) return;

    const tempId = Date.now().toString();

    const tempMessage = {
      _id: tempId,
      senderId: user.id,
      content: input,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      temp: true
    };
    
    setMessages(prev => [...prev, tempMessage]);

    socket.emit('send_message', {
      conversationId: selectedConversation._id,
      message: input,
      senderId: user.id,
      tempId
    });

    setInput('');
  };

  // ✅ Typing indicator
  const handleTyping = () => {
    if (socket && selectedConversation) {
      socket.emit('typing', {
        conversationId: selectedConversation._id,
        isTyping: true
      });

      setTimeout(() => {
        socket.emit('typing', {
          conversationId: selectedConversation._id,
          isTyping: false
        });
      }, 1000);
    }
  };

  const handleBlockOrReport = async (type) => {
    // Lấy ID của người đang xem (đối tác trò chuyện)
    const targetId = selectedConversation?.partnerId; 
    const blockerId = user?.id; // ID của người đang đăng nhập

    if (!targetId || !blockerId || actionLoading) {
        toast.error("Thiếu thông tin người dùng hoặc đang tải.");
        return;
    }
    
    // 1. Confirmation Modal cho hành động BLOCK
    if (type === 'block') {
        const confirmBlock = window.confirm(
            `Bạn có chắc chắn muốn CHẶN ${selectedConversation.partnerName} không? Cuộc trò chuyện này sẽ bị đóng.`
        );
        if (!confirmBlock) {
            setShowMenu(false);
            return;
        }
    }
    
    const endpointPath = type === 'block' ? `block/${targetId}` : `report/${targetId}`;
    const apiUrl = `${API_URL}/api/users/${endpointPath}`;
    
    const requestBody = {
        blockerId: blockerId,
        reporterId: blockerId,
        reason: type === 'report' ? prompt("Lý do báo cáo (Không bắt buộc):") : undefined,
    };

    setActionLoading(true);
    setShowMenu(false);

    try {
        const res = await axios.post(apiUrl, requestBody); // Sử dụng axios đã import
        
        // Back-end Controller trả về 200/201 (res.status === 200/201)

        const message = type === 'block' 
            ? `Đã chặn ${selectedConversation.partnerName}. Cuộc trò chuyện đã bị xóa.` 
            : `Đã gửi báo cáo về ${selectedConversation.partnerName}.`;
        
        toast.success(message); 
        
        // ✨ LOGIC SAU BLOCK/REPORT ✨
        if (type === 'block') {
            // Xóa cuộc trò chuyện khỏi danh sách và clear cửa sổ chat
            setConversations(prev => prev.filter(conv => conv._id !== selectedConversation._id));
            setSelectedConversation(null);
            setMessages([]);
        }
        
    } catch (error) {
        console.error("API Error:", error);
        const errorMessage = error.response?.data?.message || 'Lỗi kết nối Server.';
        toast.error(`Thao tác thất bại: ${errorMessage}`);
        
    } finally {
        setActionLoading(false);
    }
};

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ`;
    return date.toLocaleDateString('vi-VN');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.partnerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff1f5] via-[#fde5ef] to-[#ede9ff] pt-20">
      <div className="mx-auto flex h-[calc(100vh-5rem)] w-full max-w-6xl flex-col rounded-[40px] border border-white/50 bg-white/30 p-6 shadow-[0_50px_120px_-60px_rgba(233,114,181,0.55)] backdrop-blur-xl">
        <header className="flex items-center gap-3 rounded-[28px] border border-white/60 bg-white/50 px-6 py-4 text-sm font-semibold text-rose-500">
          <Heart className="h-5 w-5 text-rose-400" />
          <span>Kết nối đang chờ bạn • HUSTLove Messenger</span>
        </header>

        <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[0.32fr_0.68fr]">
          {/* Sidebar - Match list */}
          <aside className="flex h-full flex-col rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-[0_30px_90px_-70px_rgba(233,114,181,0.6)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-400">Match list</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">Danh sách các cặp đôi</h2>
              </div>
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên"
                className="w-full rounded-[20px] border border-white/50 bg-white/70 px-4 py-2 text-sm text-slate-700 placeholder-rose-300 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
              {conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-rose-200/70 bg-white/60 p-6 text-center text-rose-400">
                  <p className="text-sm">Chưa có cuộc trò chuyện nào</p>
                  <button
                    onClick={() => navigate('/chat')}
                    className="mt-4 rounded-full bg-gradient-to-r from-[#f7b0d2] to-[#fdd2b7] px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-200 transition hover:shadow-lg"
                  >
                    Tìm người mới
                  </button>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-rose-200/70 bg-white/60 p-6 text-center text-rose-400">
                  <p className="text-sm">Không tìm thấy kết quả phù hợp</p>
                  <p className="mt-1 text-xs">Hãy thử từ khóa khác nhé</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = selectedConversation?._id === conv._id;
                  return (
                    <button
                      type="button"
                      key={conv._id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`w-full rounded-[26px] border px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'border-rose-300 bg-gradient-to-r from-[#ffe4f1] to-[#fde7ef] shadow-[0_20px_40px_-30px_rgba(233,114,181,0.9)]'
                          : 'border-white/60 bg-white/60 hover:border-rose-200 hover:bg-white/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f9b9d0] to-[#c7b6ff] text-base font-semibold text-white shadow-sm ${isActive ? 'ring-2 ring-rose-300' : ''}`}>
                          {conv.partnerName?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{conv.partnerName}</p>
                          <p className="truncate text-xs text-rose-400/80">
                            {conv.lastMessage?.text || 'Bắt đầu trò chuyện...'}
                          </p>
                          <p className="text-[11px] text-rose-300">
                            {conv.lastMessage?.timestamp && formatTime(conv.lastMessage.timestamp)}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[28px] rounded-full bg-rose-400 px-2 py-1 text-center text-[11px] font-semibold text-white shadow-sm">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Chat window */}
          <section className="flex h-full flex-col rounded-[32px] border border-white/60 bg-white/75 shadow-[0_40px_120px_-70px_rgba(233,114,181,0.65)]">
            {selectedConversation ? (
              <>
                <header className="flex items-center justify-between rounded-t-[32px] border-b border-white/60 bg-white/70 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f7b0d2] to-[#fdd2b7] text-lg font-semibold text-white shadow-sm">
                      {selectedConversation.partnerName?.[0]?.toUpperCase()}
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-400 shadow">♥</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-800">{selectedConversation.partnerName}</p>
                      <p className="text-xs font-medium uppercase tracking-[0.28em] text-rose-300">
                        {selectedConversation.partnerClass || 'HUST K65'}
                      </p>
                      {isTyping && <p className="text-[11px] text-rose-400">đang nhập...</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
    {/* Icon Kết nối an toàn */}
    <div className="hidden items-center gap-2 text-xs font-semibold text-rose-400 sm:flex">
        <HeartHandshake className="h-4 w-4" />
        <span>Kết nối an toàn</span>
    </div>

    {/* Menu Tùy chọn (Report/Block) */}
    <div className="relative">
        <button
            onClick={() => setShowMenu((s) => !s)}
            aria-label="More options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm hover:scale-105"
        >
            <MoreHorizontal className="h-5 w-5" />
        </button>

        {showMenu && (
            <div className="absolute right-0 top-12 w-40 rounded-lg border border-rose-100 bg-white shadow-lg z-10">
                <button
                    onClick={() => handleBlockOrReport('report')}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 disabled:opacity-60"
                >
                    Báo cáo (Report)
                </button>
                <button
                    onClick={() => handleBlockOrReport('block')}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                    Chặn (Block)
                </button>
            </div>
        )}
    </div>
</div>
                </header>

                <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_rgba(255,214,211,0.25)_58%,_transparent)] px-6 py-6">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-rose-300">
                      <Heart className="mb-4 h-12 w-12" />
                      <p className="text-sm font-medium">Chưa có tin nhắn nào</p>
                      <p className="text-xs mt-1">Hãy gửi lời chào để mở đầu câu chuyện ✨</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, index) => {
                        const isSelf = msg.senderId === user.id;
                        return (
                          <div
                            key={msg._id || index}
                            className={`flex ${isSelf ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                          >
                            <div
                              className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm shadow ${
                                isSelf
                                  ? 'bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] text-white'
                                  : 'bg-white/85 text-slate-700'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              <p className={`mt-2 text-[11px] font-medium ${isSelf ? 'text-white/70' : 'text-rose-300'}`}>
                                {msg.timestamp && formatTime(msg.timestamp)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="rounded-b-[32px] border-t border-white/60 bg-white/80 px-5 py-4">
                  <div className="flex items-center gap-3 rounded-full border border-rose-200 bg-white/70 px-4 py-2 shadow-sm shadow-rose-100">
                    <button
                      type="button"
                      className="rounded-full p-2 text-rose-300 transition hover:bg-rose-50 hover:text-rose-400"
                      aria-label="Gửi reaction"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2 text-rose-300 transition hover:bg-rose-50 hover:text-rose-400"
                      aria-label="Gửi ảnh"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </button>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Gửi lời yêu thương..."
                      className="flex-1 bg-transparent text-sm text-slate-700 placeholder-rose-300 outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      Gửi
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-rose-300">
                <Heart className="mb-4 h-14 w-14" />
                <p className="text-base font-semibold">Chọn một cuộc trò chuyện để bắt đầu</p>
                <p className="text-xs mt-2">Những rung động mới đang đợi bạn ở ngay bên trái</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* CSS */}
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