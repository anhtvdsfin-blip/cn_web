import { memo, useCallback } from 'react';

const ConversationItem = memo(function ConversationItem({ conversation, isActive, onSelect }) {
  const handleClick = useCallback(() => onSelect(conversation.matchId || conversation._id), [conversation.matchId, conversation._id, onSelect]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full rounded-[26px] border px-4 py-3 text-left transition-all ${
        isActive
          ? 'border-rose-300 bg-gradient-to-r from-[#ffe4f1] to-[#fde7ef] shadow-[0_20px_40px_-30px_rgba(233,114,181,0.9)]'
          : 'border-white/60 bg-white/60 hover:border-rose-200 hover:bg-white/80'
      }`}
    >
      <div className="flex items-center gap-3">
        {conversation.partnerAvatar ? (
          <img
            src={conversation.partnerAvatar}
            alt={conversation.partnerName}
            className={`h-12 w-12 rounded-full object-cover shadow-sm ${
              isActive ? 'ring-2 ring-rose-300' : ''
            }`}
          />
        ) : (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f9b9d0] to-[#c7b6ff] text-base font-semibold text-white shadow-sm ${
              isActive ? 'ring-2 ring-rose-300' : ''
            }`}
          >
            {conversation.partnerName?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{conversation.partnerName}</p>
          <p className="truncate text-xs text-rose-400/80">
            {conversation.lastMessage?.text || 'Bắt đầu trò chuyện...'}
          </p>
          <p className="text-[11px] text-rose-300">{conversation.lastMessage?.formattedTime}</p>
        </div>
        {conversation.unreadCount > 0 && (
          <span className="min-w-[28px] rounded-full bg-rose-400 px-2 py-1 text-center text-[11px] font-semibold text-white shadow-sm">
            {conversation.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
});

export default ConversationItem;
