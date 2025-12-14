import { memo, useCallback } from 'react';
import { HeartHandshake, MoreHorizontal } from 'lucide-react';

const ChatHeader = memo(function ChatHeader({ 
  conversation, 
  isTyping, 
  showMenu, 
  onToggleMenu, 
  onReport, 
  onBlock, 
  actionLoading 
}) {
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

export default ChatHeader;
