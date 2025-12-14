import { memo } from 'react';

const MessageItem = memo(function MessageItem({ message, isLastMessage }) {
  const alignment = message.isSelf ? 'justify-end' : 'justify-start';
  const bubbleColor = message.isSelf
    ? 'bg-gradient-to-r from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] text-white'
    : 'bg-white/85 text-slate-700';
  const shouldAnimate = isLastMessage && message.shouldAnimate;

  return (
    <div className={`flex ${alignment} ${shouldAnimate ? 'animate-fadeIn' : ''}`}>
      <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm shadow ${bubbleColor}`}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`mt-2 text-[11px] font-medium ${message.isSelf ? 'text-white/70' : 'text-rose-300'}`}>
          {message.formattedTime}
        </p>
      </div>
    </div>
  );
});

export default MessageItem;
