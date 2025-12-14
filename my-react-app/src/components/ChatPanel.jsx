import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { SocketContext } from '../contexts';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { enhanceMessage, sortConversations, SCROLL_THRESHOLD } from '../utils/messageHelpers';

export default function ChatPanel({ selectedConversationId, conversations, onConversationsUpdate }) {
  const location = useLocation();
  const targetConversationId = location.state?.conversationId;
  const socket = useContext(SocketContext);
  const API_URL = import.meta.env.VITE_API_URL;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const messagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageMetaRef = useRef({ id: null, fromSelf: false });
  const targetHandledRef = useRef(false);

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    setShowMenu(false);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    socket.emit('auth_user', { userId: user.id });
    socket.emit('join_conversations', user.id);
  }, [socket, user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleNewMessage = ({ conversationId, message }) => {
      onConversationsUpdate?.((prev) => {
        let found = false;
        const updated = prev.map((conversation) => {
          if (conversation._id !== conversationId) return conversation;
          found = true;
          const isActive = selectedConversationRef.current === conversationId;
          return {
            ...conversation,
            lastMessage: {
              text: message.content,
              timestamp: message.timestamp,
              formattedTime: new Intl.DateTimeFormat('vi-VN').format(new Date(message.timestamp)),
            },
            unreadCount: isActive ? conversation.unreadCount : (conversation.unreadCount || 0) + 1,
          };
        });
        return found ? sortConversations(updated) : prev;
      });

      if (selectedConversationRef.current !== conversationId) {
        return;
      }

      setMessages((prev) => {
        const formatted = enhanceMessage(message, user.id, true);
        lastMessageMetaRef.current = { id: formatted._id, fromSelf: formatted.isSelf };

        const tempIndex = prev.findIndex((item) => item._id === message.tempId);
        if (tempIndex !== -1) {
          const next = [...prev];
          next[tempIndex] = { ...formatted, shouldAnimate: false };
          return next;
        }

        if (prev.some((item) => item._id === formatted._id)) {
          return prev;
        }

        return [...prev, formatted];
      });
    };

    const handlePartnerTyping = ({ conversationId, isTyping: typing }) => {
      if (selectedConversationRef.current === conversationId) {
        setIsTyping(typing);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('partner_typing', handlePartnerTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('partner_typing', handlePartnerTyping);
    };
  }, [socket, user?.id, onConversationsUpdate]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <= SCROLL_THRESHOLD;
    shouldAutoScrollRef.current = isNearBottom;
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || messages.length === 0) {
      if (container && messages.length === 0) {
        container.scrollTop = 0;
      }
      lastMessageMetaRef.current = { id: null, fromSelf: false };
      return;
    }

    const { id, fromSelf } = lastMessageMetaRef.current;
    const shouldUseSmooth = messages.length < 5;

    if (id === null) {
      if (shouldUseSmooth) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      shouldAutoScrollRef.current = true;
      return;
    }

    if (fromSelf || shouldAutoScrollRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }

    lastMessageMetaRef.current = { id: null, fromSelf: false };
  }, [messages]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const handleSelectConversation = useCallback(
    async (conversationId) => {
      if (!conversationId || !API_URL || !user?.id) return;
      if (selectedConversationRef.current === conversationId) return;

      selectedConversationRef.current = conversationId;
      setShowMenu(false);
      setMessages([]);
      shouldAutoScrollRef.current = true;

      try {
        const res = await axios.get(`${API_URL}/api/messages/${conversationId}`);
        if (res.data.success) {
          const mapped = (res.data.messages || []).map((message) => enhanceMessage(message, user.id, false));
          setMessages(mapped);
          lastMessageMetaRef.current = { id: null, fromSelf: false };
        }

        if (socket) {
          socket.emit('mark_as_read', { conversationId });
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    },
    [API_URL, socket, user?.id]
  );

  useEffect(() => {
    if (!targetConversationId || targetHandledRef.current) return;
    const targetConversation = conversations.find((conversation) => conversation._id === targetConversationId);
    if (targetConversation) {
      targetHandledRef.current = true;
      handleSelectConversation(targetConversation._id);
    }
  }, [conversations, handleSelectConversation, targetConversationId]);

  const handleSendMessage = useCallback(
    (text) => {
      if (!socket || !selectedConversation || !user?.id) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const now = new Date().toISOString();
      const tempId = `temp-${Date.now()}`;

      const tempMessage = enhanceMessage(
        {
          _id: tempId,
          senderId: user.id,
          content: trimmed,
          timestamp: now,
          createdAt: now,
        },
        user.id,
        true
      );

      lastMessageMetaRef.current = { id: tempMessage._id, fromSelf: true };
      setMessages((prev) => [...prev, tempMessage]);

      socket.emit('send_message', {
        conversationId: selectedConversation._id,
        message: trimmed,
        senderId: user.id,
        tempId,
      });

      onConversationsUpdate?.((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation._id === selectedConversation._id
              ? {
                  ...conversation,
                  lastMessage: {
                    text: trimmed,
                    timestamp: now,
                    formattedTime: tempMessage.formattedTime,
                  },
                }
              : conversation
          )
        )
      );
    },
    [socket, selectedConversation, user?.id, onConversationsUpdate]
  );

  const handleTyping = useCallback(() => {
    if (!socket || !selectedConversation) return;

    socket.emit('typing', {
      conversationId: selectedConversation._id,
      isTyping: true,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', {
        conversationId: selectedConversation._id,
        isTyping: false,
      });
    }, 800);
  }, [socket, selectedConversation]);

  const handleToggleMenu = useCallback(() => {
    if (!selectedConversation) return;
    setShowMenu((prev) => !prev);
  }, [selectedConversation]);

  const handleReport = useCallback(async () => {
    if (!selectedConversation || !user?.id || actionLoading) return;

    const targetId = selectedConversation.partnerId;
    if (!targetId) {
      toast.error('Thiếu thông tin người dùng hoặc đang tải.');
      return;
    }

    const reason = window.prompt('Lý do báo cáo (Không bắt buộc):') ?? undefined;

    try {
      setActionLoading(true);
      setShowMenu(false);
      const apiUrl = `${API_URL}/api/users/report/${targetId}`;
      await axios.post(apiUrl, { reporterId: user.id, reason });
      toast.success(`Đã gửi báo cáo về ${selectedConversation.partnerName}.`);
    } catch (error) {
      const message = error.response?.data?.message || 'Lỗi kết nối Server.';
      toast.error(`Thao tác thất bại: ${message}`);
    } finally {
      setActionLoading(false);
    }
  }, [API_URL, actionLoading, selectedConversation, user?.id]);

  const handleBlock = useCallback(async () => {
    if (!selectedConversation || !user?.id || actionLoading) return;

    const targetId = selectedConversation.partnerId;
    if (!targetId) {
      toast.error('Thiếu thông tin người dùng hoặc đang tải.');
      return;
    }

    const confirmBlock = window.confirm(
      `Bạn có chắc chắn muốn CHẶN ${selectedConversation.partnerName} không? Cuộc trò chuyện này sẽ bị đóng.`
    );
    if (!confirmBlock) {
      setShowMenu(false);
      return;
    }

    try {
      setActionLoading(true);
      setShowMenu(false);
      const apiUrl = `${API_URL}/api/users/block/${targetId}`;
      await axios.post(apiUrl, { blockerId: user.id });
      toast.success(`Đã chặn ${selectedConversation.partnerName}. Cuộc trò chuyện đã bị xóa.`);

      onConversationsUpdate?.((prev) => prev.filter((conversation) => conversation._id !== selectedConversation._id));
      setMessages([]);
    } catch (error) {
      const message = error.response?.data?.message || 'Lỗi kết nối Server.';
      toast.error(`Thao tác thất bại: ${message}`);
    } finally {
      setActionLoading(false);
    }
  }, [API_URL, actionLoading, selectedConversation, user?.id, onConversationsUpdate]);

  const handleInputChange = useCallback((value) => setInputValue(value), []);
  const handleSendFromInput = useCallback(
    (text) => {
      handleSendMessage(text);
      setInputValue('');
    },
    [handleSendMessage]
  );

  return (
    <section className="flex h-full flex-col rounded-[32px] border border-white/60 bg-white/75 shadow-[0_40px_120px_-70px_rgba(233,114,181,0.65)]">
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
          <MessageList ref={messagesRef} messages={messages} isTyping={isTyping} onScroll={handleMessagesScroll} />
          <MessageInput value={inputValue} onChange={handleInputChange} onSend={handleSendFromInput} onTyping={handleTyping} />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-rose-300">
          <Heart className="mb-4 h-14 w-14" />
          <p className="text-base font-semibold">Chọn một cuộc trò chuyện để bắt đầu</p>
          <p className="mt-2 text-xs">Những rung động mới đang đợi bạn ở ngay bên trái</p>
        </div>
      )}
    </section>
  );
}
