import { memo, forwardRef } from 'react';
import { Heart } from 'lucide-react';
import MessageItem from './MessageItem';

const MessageListBase = ({ messages, isTyping, onScroll }, ref) => {
  const lastMessageIndex = messages.length - 1;

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_rgba(255,214,211,0.25)_58%,_transparent)] px-6 py-6"
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-rose-300">
          <Heart className="mb-4 h-12 w-12" />
          <p className="text-sm font-medium">Chưa có tin nhắn nào</p>
          <p className="mt-1 text-xs">Hãy gửi lời chào để mở đầu câu chuyện ✨</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => (
            <MessageItem key={message._id} message={message} isLastMessage={index === lastMessageIndex} />
          ))}
        </div>
      )}
      {isTyping && <p className="mt-4 text-[11px] text-rose-400">đang nhập...</p>}
    </div>
  );
};

const MessageList = memo(forwardRef(MessageListBase));

export default MessageList;
