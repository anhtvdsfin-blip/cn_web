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
import { Heart, Smile, ImageIcon, Send, HeartHandshake, MoreHorizontal } from 'lucide-react';
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
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onUseOpeningMove?.(conversation.partnerOpeningMove.text)}
                        className="inline-flex items-center gap-2 rounded-full bg-teal-200 px-3 py-1 text-xs font-semibold text-slate-800"
                      >
                        Bấm để gửi ngay câu hỏi này
                      </button>
                    </div>
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

  const handleChange = useCallback(
    (event) => {
      onChange(event.target.value);
      onTyping();
    },
    [onChange, onTyping]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSend(trimmed);
      }
    },
    [onSend, value]
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-b-[32px] border-t border-white/60 bg-white/80 px-5 py-4">
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
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Gửi lời yêu thương..."
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder-rose-300 outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          Gửi
        </button>
      </div>
    </form>
  );
});

// ============================================
// CHAT HEADER (Memoized)
// ============================================
const ChatHeader = memo(function ChatHeader({ conversation, isTyping, showMenu, onToggleMenu, onReport, onBlock, actionLoading }) {
  return (
    <header className="flex items-center justify-between rounded-t-[32px] border-b border-white/60 bg-white/70 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f7b0d2] to-[#fdd2b7] text-lg font-semibold text-white shadow-sm">
          {conversation.partnerName?.[0]?.toUpperCase()}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-400 shadow">♥</span>
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">{conversation.partnerName}</p>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-rose-300">
            {conversation.partnerClass || 'HUST K65'}
          </p>
          {isTyping && <p className="text-[11px] text-rose-400">đang nhập...</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 text-xs font-semibold text-rose-400 sm:flex">
          <HeartHandshake className="h-4 w-4" />
          <span>Kết nối an toàn</span>
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

function ChatPanel({ API_URL, socket, user, selectedConversation, selectedConversationId, setConversations }) {
  const messagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageMetaRef = useRef({ id: null, fromSelf: false });
  const PAGE_SIZE = 10;
  const oldestMessageTimestampRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!socket || !user?.id) return;
    socket.emit('auth_user', { userId: user.id });
    socket.emit('join_conversations', user.id);
  }, [socket, user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleNewMessage = ({ conversationId, message }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === conversationId);
        if (idx === -1) return prev;

        const conv = prev[idx];
        const isActive = selectedConversationId === conversationId;

        const updatedConv = {
          ...conv,
          lastMessage: {
            text: message.content,
            timestamp: message.timestamp,
            formattedTime: formatTimestamp(message.timestamp),
          },
          // do not increment unread for active conversation
          unreadCount: isActive ? conv.unreadCount : (conv.unreadCount || 0) + 1,
        };

        if (isActive) {
          // keep the original order for active conversation; update in place
          const next = [...prev];
          next[idx] = updatedConv;
          return next;
        }

        // for inactive conversations, move to front and increment unread
        return [updatedConv, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });

      if (selectedConversationId !== conversationId) return;

      setMessages((prev) => {
        const formatted = enhanceMessage(message, user.id, true);
        lastMessageMetaRef.current = { id: formatted._id, fromSelf: formatted.isSelf };

        const tempIndex = prev.findIndex((item) => item._id === message.tempId);
        if (tempIndex !== -1) {
          const next = [...prev];
          next[tempIndex] = { ...formatted, shouldAnimate: false };
          return next;
        }

        if (prev.some((item) => item._id === formatted._id)) return prev;
        return [...prev, formatted];
      });
    };

    const handlePartnerTyping = ({ conversationId, isTyping: typing }) => {
      if (selectedConversationId === conversationId) setIsTyping(typing);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('partner_typing', handlePartnerTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('partner_typing', handlePartnerTyping);
    };
  }, [socket, user?.id, selectedConversationId, setConversations]);

  const displayedMessages = useMemo(() => {
    const MAX_RENDER = 200;
    if (!messages || messages.length <= MAX_RENDER) return messages;
    return messages.slice(messages.length - MAX_RENDER);
  }, [messages]);

  const selectedConversationRef = useRef(selectedConversationId);
  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
    setShowMenu(false);
  }, [selectedConversationId]);

  // fetch messages when conversation changes
  useEffect(() => {
    const conversationId = selectedConversationId;
    if (!conversationId || !API_URL || !user?.id) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setMessages([]);
        shouldAutoScrollRef.current = true;
        const res = await axios.get(`${API_URL}/api/messages/${conversationId}?limit=${PAGE_SIZE}`);
        if (cancelled) return;
        if (res.data?.success) {
          let mapped = (res.data.messages || []).map((m) => enhanceMessage(m, user.id, false));
          // ensure chronological order oldest->newest
          mapped.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          setMessages(mapped);
          oldestMessageTimestampRef.current = mapped[0]?.timestamp ?? null;
          hasMoreRef.current = (mapped.length === PAGE_SIZE);
          lastMessageMetaRef.current = { id: null, fromSelf: false };
        }
        if (socket) socket.emit('mark_as_read', { conversationId });
      } catch (err) {
        console.error('Error loading messages for conversation:', err);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, API_URL, user?.id, socket]);

  const loadOlderMessages = useCallback(async () => {
    const conversationId = selectedConversationId;
    if (!conversationId || !API_URL || !user?.id) return;
    if (loadingMoreRef.current || !hasMoreRef.current) return;

    const container = messagesRef.current;
    loadingMoreRef.current = true;
    try {
      const before = oldestMessageTimestampRef.current;
      const res = await axios.get(
        `${API_URL}/api/messages/${conversationId}?limit=${PAGE_SIZE}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      );
      if (res.data?.success) {
        let fetched = (res.data.messages || []).map((m) => enhanceMessage(m, user.id, false));
        // ensure chronological order oldest->newest
        fetched.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        if (fetched.length > 0) {
          const prevScrollHeight = container ? container.scrollHeight : 0;
          setMessages((prev) => {
            const next = [...fetched, ...prev];
            return next;
          });

          // after DOM updates, restore scroll position so user stays at same message
          requestAnimationFrame(() => {
            if (!container) return;
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          });

          oldestMessageTimestampRef.current = fetched[0]?.timestamp ?? oldestMessageTimestampRef.current;
          hasMoreRef.current = fetched.length === PAGE_SIZE;
        } else {
          hasMoreRef.current = false;
        }
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

    const { id, fromSelf } = lastMessageMetaRef.current;
    const shouldUseSmooth = msgsLen < 5;

    // avoid multiple reads of scrollHeight per render
    const bottom = container.scrollHeight;

    if (id === null) {
      if (shouldUseSmooth) requestAnimationFrame(() => (container.scrollTop = bottom));
      else container.scrollTop = bottom;
      shouldAutoScrollRef.current = true;
      return;
    }

    if (fromSelf || shouldAutoScrollRef.current) requestAnimationFrame(() => (container.scrollTop = bottom));

    lastMessageMetaRef.current = { id: null, fromSelf: false };
    // dependencies: only react to changes in the refs' current values
  }, [messages.length, /* trigger on message count changes */ shouldAutoScrollRef.current]);

  

  const handleSendMessage = useCallback(
    (text) => {
      if (!socket || !selectedConversation || !user?.id) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const now = new Date().toISOString();
      const tempId = `temp-${Date.now()}`;

      const tempMessage = enhanceMessage({ _id: tempId, senderId: user.id, content: trimmed, timestamp: now, createdAt: now }, user.id, true);

      lastMessageMetaRef.current = { id: tempMessage._id, fromSelf: true };
      setMessages((prev) => [...prev, tempMessage]);

      socket.emit('send_message', { conversationId: selectedConversation._id, message: trimmed, senderId: user.id, tempId });

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation._id === selectedConversation._id
              ? { ...conversation, lastMessage: { text: trimmed, timestamp: now, formattedTime: tempMessage.formattedTime } }
              : conversation
          )
        )
      );
    },
    [socket, selectedConversation, user?.id, setConversations]
  );

  const handleTyping = useCallback(() => {
    if (!socket || !selectedConversation) return;
    socket.emit('typing', { conversationId: selectedConversation._id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit('typing', { conversationId: selectedConversation._id, isTyping: false }), 800);
  }, [socket, selectedConversation]);

  const handleToggleMenu = useCallback(() => {
    if (!selectedConversation) return;
    setShowMenu((prev) => !prev);
  }, [selectedConversation]);

  const handleReport = useCallback(async () => {
    if (!selectedConversation || actionLoading || !API_URL || !user?.id) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/conversations/${selectedConversation._id}/report`, { reporterId: user.id });
      toast.success('Đã báo cáo');
    } catch (err) {
      console.error('Report failed', err);
      toast.error('Báo cáo thất bại');
    } finally {
      setActionLoading(false);
    }
  }, [API_URL, actionLoading, selectedConversation, user?.id]);

  const handleBlock = useCallback(async () => {
    if (!selectedConversation || actionLoading || !API_URL || !user?.id) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/conversations/${selectedConversation._id}/block`, { userId: user.id });
      toast.success('Đã chặn');
      setConversations((prev) => prev.filter((c) => c._id !== selectedConversation._id));
    } catch (err) {
      console.error('Block failed', err);
      toast.error('Chặn thất bại');
    } finally {
      setActionLoading(false);
    }
  }, [API_URL, actionLoading, selectedConversation, user?.id, setConversations]);

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

function MessengerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useContext(SocketContext) ?? {};
  const API_URL = import.meta.env.VITE_API_URL;

  // ========== MAIN PAGE STATE ==========
  const [user, setUser] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const targetHandledRef = useRef(false);

  // ========== AUTH CHECK ==========
  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!userData.id) {
      navigate('/login');
      return;
    }
    setUser(userData);
  }, [navigate]);

  // ========== FETCH CONVERSATIONS ==========
  useEffect(() => {
    if (!user?.id || !API_URL) return;

    const fetchConversations = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/conversations?userId=${user.id}`);
        if (res.data.success) {
          const mapped = res.data.conversations.map(enhanceConversation);
          const sorted = sortConversations(mapped);
          setConversations(sorted);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();
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
  }, [conversations, location.state?.conversationId]);

  // ========== MATCH ID HANDLER (from notification click) ==========
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const matchId = searchParams.get('matchId');
    if (!matchId || targetHandledRef.current) return;

    const targetConversation = conversations.find((conversation) => conversation.matchId && conversation.matchId.toString() === matchId);

    if (targetConversation) {
      targetHandledRef.current = true;
      setSelectedConversationId(targetConversation._id);
    }
  }, [conversations, location.search]);

  // simplified selection handler (only sets id) - stable reference
  const handleSelectConversation = useCallback((conversationId) => {
    if (!conversationId) return;
    setSelectedConversationId((prev) => {
      if (prev === conversationId) return prev;
      targetHandledRef.current = false;
      return conversationId;
    });
  }, []);

  // stable create-new handler
  const handleCreateNew = useCallback(() => navigate('/feed'), [navigate]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) => conversation.partnerName?.toLowerCase().includes(normalized));
  }, [conversations, searchQuery]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff1f5] via-[#fde5ef] to-[#ede9ff] px-4 pt-28 pb-24">
      <Toaster position="top-right" toastOptions={{ duration: 2400 }} />
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-6xl flex-col rounded-[40px] border border-white/50 bg-white/35 p-6 shadow-lg backdrop-blur-xl md:p-8">
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
              <ChatPanel API_URL={API_URL} socket={socket} user={user} selectedConversation={selectedConversation} selectedConversationId={selectedConversationId} setConversations={setConversations} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default memo(MessengerPage);
