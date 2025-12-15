import { memo, useState } from 'react';

const MessageItem = memo(function MessageItem({ message, isLastMessage }) {
  const alignment = message.isSelf ? 'justify-end' : 'justify-start';
  const bubbleColor = message.isSelf
    ? 'bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] text-white'
    : 'bg-white/85 text-slate-700';
  const shouldAnimate = isLastMessage && message.shouldAnimate;
  const [expanded, setExpanded] = useState(false);
  const isLong = typeof message.content === 'string' && message.content.length > 240;
  const preview = !expanded && isLong ? `${message.content.slice(0, 240)}…` : message.content;

  return (
    <div className={`flex ${alignment} ${shouldAnimate ? 'animate-fadeIn' : ''}`}>
      <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm shadow ${bubbleColor} break-words`} style={{ wordBreak: 'break-word' }}>
        {/* Attachment (image) */}
        {message.attachment ? (
          <div className="mb-2">
            <a href={message.attachment} target="_blank" rel="noreferrer">
              <img src={message.attachment} alt="sent" className="max-h-[40vh] w-auto rounded-lg object-contain" />
            </a>
          </div>
        ) : null}

        {/* Emoji-only message */}
        {(!message.content || message.content === '') && message.icon ? (
          <div className="text-3xl">{message.icon}</div>
        ) : (
          <div className="max-h-[30vh] overflow-auto">
            <p className="whitespace-pre-wrap break-words">{preview}</p>
          </div>
        )}

        {isLong && !expanded && (
          <button type="button" onClick={() => setExpanded(true)} className="mt-2 text-xs font-medium text-rose-400 underline">
            Xem thêm
          </button>
        )}
        {isLong && expanded && (
          <button type="button" onClick={() => setExpanded(false)} className="mt-2 text-xs font-medium text-rose-400 underline">
            Ẩn bớt
          </button>
        )}

        <p className={`mt-2 text-[11px] font-medium ${message.isSelf ? 'text-white/70' : 'text-rose-300'}`}>
          {message.formattedTime}
        </p>
      </div>
    </div>
  );
});

export default MessageItem;
