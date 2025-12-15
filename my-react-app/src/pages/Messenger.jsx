import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  memo,
  forwardRef,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Heart, Smile, ImageIcon, Send, MoreHorizontal } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { SocketContext } from '../contexts';
import { enhanceMessage, sortConversations, SCROLL_THRESHOLD, formatTimestamp, enhanceConversation } from '../utils/messageHelpers';
import ConversationListComponent from '../components/ConversationListComponent';

// Vite environment variable for API base URL
const API_URL = import.meta.env.VITE_API_URL;

// use shared conversation list component from components/

// ============================================
// MESSAGE ITEM (Memoized)
// ============================================
const MessageItem = memo(function MessageItem({ message }) {
  const alignment = message.isSelf ? 'justify-end' : 'justify-start';
  const bubbleColor = message.isSelf
    ? 'bg-gradient-to-r from-[#f7b0d2] to-[#fdd2b7] text-white'
    : 'bg-white/85 text-slate-700';

  // Animation is applied only for the newest message. MessageList sets __isNewest on the message object.
  const shouldAnimate = !!message.__isNewest && !!message.shouldAnimate;

  return (
    <div className={`flex ${alignment} ${shouldAnimate ? 'animate-fadeIn' : ''} [writing-mode:horizontal-tb] [transform:none]`}>
      <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm shadow ${bubbleColor}`}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`mt-2 text-[11px] font-medium ${message.isSelf ? 'text-white/70' : 'text-rose-300'}`}>
          {message.formattedTime}
        </p>
      </div>
    </div>
  );
});

// ============================================
// MESSAGE LIST (Memoized with forwardRef)
// ============================================
const MessageListBase = ({ messages, isTyping, onScroll, conversation, onUseOpeningMove }, ref) => {
  const newestIndex = messages.length - 1;

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto bg-gradient-to-b from-white/50 to-white/30 px-6 py-6 [writing-mode:horizontal-tb] [transform:none]"
    >
      {messages.length === 0 ? (
        // If conversation has partnerOpeningMove, show it as the primary CTA.
        conversation?.partnerOpeningMove ? (
          <div className="px-6 py-4">
            <div className="max-w-full">
              <div className="rounded-2xl bg-teal-50 p-4 shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-teal-400 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 text-rose-300">
                      <path fill="currentColor" d="M12 21s-6.716-4.35-9.193-6.49C.923 11.987 3.06 7 6.5 7c1.925 0 3.02 1.06 3.5 2.02C10.48 8.06 11.575 7 13.5 7 16.94 7 19.077 11.987 21.193 14.51 18.716 16.65 12 21 12 21z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{conversation.partnerName} đã chọn câu hỏi mở đầu</p>
                    <div className="mt-2 max-w-[90%] overflow-hidden rounded-lg bg-teal-100/90 p-3 text-sm text-slate-800">
                      {conversation.partnerOpeningMove.text}
                    </div>
                    {/* <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onUseOpeningMove?.(conversation.partnerOpeningMove.text)}
                        className="inline-flex items-center gap-2 rounded-full bg-teal-200 px-3 py-1 text-xs font-semibold text-slate-800"
                      >
                        Bấm để gửi ngay câu hỏi này
                      </button>
                    </div> */}
                  </div>
                  <div className="ml-3 text-rose-300">♡</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-rose-300">
            <Heart className="mb-4 h-12 w-12" />
            <p className="text-sm font-medium">Chưa có tin nhắn nào</p>
            <p className="mt-1 text-xs">Hãy gửi lời chào để mở đầu câu chuyện ✨</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => {
            // create a lightweight per-render message object so MessageItem can know if it's newest
            const msgWithFlag = index === newestIndex ? { ...message, __isNewest: true } : message;
            return <MessageItem key={message._id} message={msgWithFlag} />;
          })}
        </div>
      )}
      {isTyping && <p className="mt-4 text-[11px] text-rose-400">đang nhập...</p>}
    </div>
  );
};

const MessageList = memo(forwardRef(MessageListBase));

// ============================================
// MESSAGE INPUT (Memoized)
// ============================================
const MessageInput = memo(function MessageInput({ value, onChange, onSend, onTyping }) {
  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      onSend(trimmed);
    },
    [onSend, value]
  );


import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { SocketContext } from '../contexts';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { Heart, Smile, Image as ImageIcon, Send, HeartHandshake,MoreHorizontal } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// ============================================
// CHAT HEADER (Memoized) - inline
// ============================================
const ChatHeader = memo(function ChatHeader({ conversation, isTyping, showMenu, onToggleMenu, onReport, onBlock, actionLoading, onCrushToggle, isCrush, isMutual, crushLoading }) {
  return (
    <header className="flex items-center justify-between rounded-t-[32px] border-b border-white/60 bg-white/70 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f7b0d2] to-[#fdd2b7] text-lg font-semibold text-white shadow-sm">
          {conversation.partnerName?.[0]?.toUpperCase()}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-400 shadow">♥</span>
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">{conversation.partnerName}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-rose-300">{conversation.partnerClass || 'HUST K65'}</p>
            {isMutual && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600">Be crush → Destiny!</span>}
          </div>
          {isTyping && <p className="text-[11px] text-rose-400">đang nhập...</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex">
          <button
            type="button"
            onClick={() => { if (crushLoading || !onCrushToggle) return; onCrushToggle(isCrush ? 'remove' : 'set'); }}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white ${isCrush ? 'bg-rose-500' : 'bg-gradient-to-br from-[#f7b0d2] to-[#fdd2b7]'} ${crushLoading ? 'opacity-70 cursor-wait' : 'hover:scale-105'}`}
          >
            {isCrush ? 'Crushed!!' : 'Crush'}
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label="More options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm hover:scale-105"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-12 z-10 w-40 rounded-lg border border-rose-100 bg-white shadow-lg">
              <button
                type="button"
                onClick={onReport}
                disabled={actionLoading}
                className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 disabled:opacity-60"
              >
                Báo cáo (Report)
              </button>
              <button
                type="button"
                onClick={onBlock}
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
  );
});

function ChatPanel({ API_URL, socket, user, selectedConversation, selectedConversationId, setConversations, myCrushMatch, myCrushIsMutual, setMyCrushMatch, setMyCrushIsMutual }) {
  const messagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageMetaRef = useRef({ id: null, fromSelf: false });
  const PAGE_SIZE = 10;
  const oldestMessageTimestampRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

export default function Messenger() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  // Support conversation id coming from either location.state or URL param
  const targetConversationId = location.state?.conversationId || params.id;
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL;
  const { socket } = useContext(SocketContext);

  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCrush, setIsCrush] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [crushLoading, setCrushLoading] = useState(false);



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

    socket.emit("join_conversation", user.id);

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
      
      if (res.data.success) {
        console.log('📬 Loaded messages:', res.data.messages.length);
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [selectedConversationId, API_URL, user?.id]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  // load crush status for selected conversation's match
  useEffect(() => {
    const matchIdRaw = selectedConversation?.matchId ?? selectedConversation?._id;
    const matchId = matchIdRaw ? (typeof matchIdRaw === 'string' ? matchIdRaw : (matchIdRaw._id || matchIdRaw.toString())) : null;

    // Prefer top-level fetched `myCrushMatch` when available so the indicator survives a full reload
    if (myCrushMatch) {
      const myMatchId = String(myCrushMatch._id || myCrushMatch);
      const mine = myMatchId === String(matchId);
      setIsCrush(mine);
      setIsMutual(mine ? !!myCrushIsMutual : false);
      return;
    }

    let cancelled = false;
    if (!matchId || !user?.id) {
      setIsCrush(false);
      setIsMutual(false);
      return;
    }

    const base = API_URL ? API_URL : '';
    const loadCrushState = async () => {
      try {
        const res = await axios.get(`${base}/api/v1/user/my-crush?userId=${user.id}`);
        if (cancelled) return;
        if (res.data?.success && res.data.match) {
          const myMatch = res.data.match;
          const mine = String(myMatch._id) === String(matchId);
          setIsCrush(mine);
          setIsMutual(mine ? !!myMatch.isMutualCrush : false);
        } else {
          setIsCrush(false);
          setIsMutual(false);
        }
      } catch (err) {
        console.warn('Could not load crush state for matchId', matchId, err?.response?.data || err?.message || err);
        setIsCrush(false);
        setIsMutual(false);
      }
    };

    loadCrushState();

    return () => {
      cancelled = true;
    };
  }, [selectedConversation, API_URL, user?.id, myCrushMatch, myCrushIsMutual]);

  const handleCrushToggle = useCallback(async (action) => {
    const matchIdRaw = selectedConversation?.matchId ?? selectedConversation?._id;
    const matchId = matchIdRaw ? (typeof matchIdRaw === 'string' ? matchIdRaw : (matchIdRaw._id || matchIdRaw.toString())) : null;
    if (!matchId || !user?.id) {
      console.warn('Crush toggle attempted but no matchId or user:', { matchId: matchIdRaw, user });
      toast.error('Không tìm thấy thông tin crush.');
      return;
    }
    // Enforce single-crush client-side: if user already has a different active crush, block
    if (action === 'set' && myCrushMatch && String(myCrushMatch._id) !== String(matchId)) {
      toast.error('Bạn chỉ được chọn 1 Crush. Hãy bỏ crush hiện tại trước khi crush người khác.');
      return;
    }
    setCrushLoading(true);
    try {
      const base = API_URL ? API_URL : '';
      if (action === 'set') {
        const res = await axios.post(`${base}/api/v1/matches/${matchId}/set-crush`, { userId: user.id });
        if (res.data?.success) {
          setIsCrush(true);
          // server returns updated match in res.data.match
          const mutual = !!res.data.match?.isMutualCrush || !!res.data.isMutual || !!res.data.match?.isMutual;
          setIsMutual(mutual);
          // sync top-level stored crush so it persists across reloads
          if (typeof setMyCrushMatch === 'function') setMyCrushMatch(res.data.match || { _id: matchId });
          if (typeof setMyCrushIsMutual === 'function') setMyCrushIsMutual(mutual);
          toast.success('Đã crush');
        } else {
          toast.error(res.data?.message || 'Thao tác thất bại');
        }
      } else {
        const res = await axios.post(`${base}/api/v1/matches/${matchId}/remove-crush`, { userId: user.id });
        if (res.data?.success) {
          setIsCrush(false);
          setIsMutual(false);
          // if we removed our active crush, clear top-level record
          if (myCrushMatch && String(myCrushMatch._id) === String(matchId)) {
            if (typeof setMyCrushMatch === 'function') setMyCrushMatch(null);
            if (typeof setMyCrushIsMutual === 'function') setMyCrushIsMutual(false);
          }
          toast.success('Đã bỏ crush');
        } else {
          toast.error(res.data?.message || 'Thao tác thất bại');
        }
      }
    } catch (err) {
      console.error('Crush action failed', err);
      toast.error('Lỗi kết nối');
    } finally {
      setCrushLoading(false);
    }
  }, [selectedConversation, API_URL, user?.id, myCrushMatch, setMyCrushMatch, setMyCrushIsMutual]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= SCROLL_THRESHOLD;
    shouldAutoScrollRef.current = isNearBottom;
    // load older messages when scrolled to top
    if (container.scrollTop <= 120 && hasMoreRef.current && !loadingMoreRef.current) {
      // call loadOlderMessages if available
      if (typeof loadOlderMessages === 'function') loadOlderMessages();
    }
  }, [/* keep stable but rely on runtime lookup for loadOlderMessages */]);

  useLayoutEffect(() => {
    const container = messagesRef.current;
    const msgsLen = messages.length;
    if (!container || msgsLen === 0) {
      if (container && msgsLen === 0) container.scrollTop = 0;
      lastMessageMetaRef.current = { id: null, fromSelf: false };
      return;
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
    // Navigate to conversation route so URL reflects selected conversation
    try {
      navigate(`/messenger/${conv._id}`, { state: { conversationId: conv._id } });
    } catch (e) {
      console.error('❌ Navigation error:', e);
    }
  }, [API_URL, socket, navigate]);

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

  return (
    <>
      {selectedConversation ? (
        <>
          <ChatHeader
            conversation={selectedConversation}
            isTyping={isTyping}
            showMenu={showMenu}
            onToggleMenu={handleToggleMenu}
            onReport={handleReport}
            onBlock={handleBlock}
            actionLoading={actionLoading}
            onCrushToggle={handleCrushToggle}
            isCrush={isCrush}
            isMutual={isMutual}
            crushLoading={crushLoading}
          />
          <MessageList ref={messagesRef} messages={displayedMessages} isTyping={isTyping} onScroll={handleMessagesScroll} conversation={selectedConversation} onUseOpeningMove={(text) => { setInputValue(text || ''); }} />
          <MessageInput
            value={inputValue}
            onChange={setInputValue}
            onSend={(text) => {
              handleSendMessage(text);
              setInputValue('');
            }}
            onTyping={handleTyping}
          />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-rose-300">
          <Heart className="mb-4 h-14 w-14" />
          <p className="text-base font-semibold">Chọn một cuộc trò chuyện để bắt đầu</p>
          <p className="mt-2 text-xs">Những rung động mới đang đợi bạn ở ngay bên trái</p>
        </div>
      )}
    </>
  );
}

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

  // ========== MAIN PAGE STATE ==========
  const [user, setUser] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [myCrushMatch, setMyCrushMatch] = useState(null);
  const [myCrushIsMutual, setMyCrushIsMutual] = useState(false);

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

  // ========== FETCH CURRENT USER CRUSH (persist indicator across reloads) ==========
  useEffect(() => {
    if (!user?.id || !API_URL) {
      setMyCrushMatch(null);
      setMyCrushIsMutual(false);
      return;
    }
    let cancelled = false;
    const fetchMyCrush = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/v1/user/my-crush?userId=${user.id}`);
        if (cancelled) return;
        if (res.data?.success && res.data.match) {
          setMyCrushMatch(res.data.match);
          setMyCrushIsMutual(!!res.data.match.isMutualCrush);
        } else {
          setMyCrushMatch(null);
          setMyCrushIsMutual(false);
        }
      } catch (err) {
        console.warn('Could not fetch my crush on load', err?.response?.data || err?.message || err);
        setMyCrushMatch(null);
        setMyCrushIsMutual(false);
      }
    };
    fetchMyCrush();
    return () => { cancelled = true; };
  }, [user?.id, API_URL]);

  // ========== TARGET CONVERSATION (from location.state) ==========
  useEffect(() => {
    const targetConversationId = location.state?.conversationId;
    if (!targetConversationId || targetHandledRef.current) return;
    const targetConversation = conversations.find((conversation) => conversation._id === targetConversationId);
    if (targetConversation) {
      targetHandledRef.current = true;
      setSelectedConversationId(targetConversation._id);
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

        

        <div className="mt-6 grid flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[0.32fr_0.68fr]">
          {/* ========== LEFT SIDEBAR: CONVERSATIONS ========== */}
          <ConversationListComponent
            conversations={filteredConversations}
            selectedConversationId={selectedConversationId}
            onSelect={handleSelectConversation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCreateNew={handleCreateNew}
          />

          {/* ========== RIGHT PANEL: CHAT (ChatPanel owns messages) ========== */}
          <section className="flex h-full min-h-0 max-h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/75 shadow-lg">
            <div className="flex flex-1 flex-col overflow-hidden" >
              <ChatPanel
                API_URL={API_URL}
                socket={socket}
                user={user}
                selectedConversation={selectedConversation}
                selectedConversationId={selectedConversationId}
                setConversations={setConversations}
                myCrushMatch={myCrushMatch}
                myCrushIsMutual={myCrushIsMutual}
                setMyCrushMatch={setMyCrushMatch}
                setMyCrushIsMutual={setMyCrushIsMutual}
              />
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