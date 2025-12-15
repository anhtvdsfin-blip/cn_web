import { memo, useCallback, useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const ChatHeader = memo(function ChatHeader({ 
  conversation, 
  isTyping, 
  showMenu, 
  onToggleMenu, 
  onReport, 
  onBlock, 
  actionLoading 
}) {
  const [isCrush, setIsCrush] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Determine crush state for this conversation if matchId exists
    (async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        const userId = user?.id || user?._id;
        if (!userId || !conversation?.matchId) return;

        const res = await axios.get(`${API_URL}/api/v1/user/my-crush?userId=${userId}`);
        if (res.data?.success && res.data.match) {
          const m = res.data.match;
          const isMine = String(m._id) === String(conversation.matchId || conversation.matchId?._id);
          setIsCrush(isMine);
          setIsMutual(Boolean(m.isMutualCrush));
        } else {
          setIsCrush(false);
          setIsMutual(false);
        }
      } catch (err) {
        // ignore
      }
    })();
  }, [conversation?.matchId]);

  const handleSetCrush = async () => {
    console.debug('handleSetCrush clicked', { conversation });
    if (!conversation?.matchId) {
      console.warn('No matchId on conversation, cannot set crush', conversation);
      alert('Lỗi: cuộc trò chuyện này chưa có matchId.');
      return;
    }
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userId = user?.id || user?._id;
    if (!userId) return alert('Vui lòng đăng nhập');

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/v1/matches/${conversation.matchId}/set-crush`, { userId });
      if (res.data?.success) {
        setIsCrush(true);
        setIsMutual(Boolean(res.data.match?.isMutualCrush));
      }
    } catch (err) {
      console.error('Set crush failed', err);
    } finally { setLoading(false); }
  };

  const handleRemoveCrush = async () => {
    console.debug('handleRemoveCrush clicked', { conversation });
    if (!conversation?.matchId) {
      console.warn('No matchId on conversation, cannot remove crush', conversation);
      alert('Lỗi: cuộc trò chuyện này chưa có matchId.');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn hủy Crush bí mật này?')) return;
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userId = user?.id || user?._id;
    if (!userId) return alert('Vui lòng đăng nhập');

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/v1/matches/${conversation.matchId}/remove-crush`, { userId });
      if (res.data?.success) {
        setIsCrush(false);
        setIsMutual(Boolean(res.data.match?.isMutualCrush));
      }
    } catch (err) {
      console.error('Remove crush failed', err);
    } finally { setLoading(false); }
  };

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
        <div className="items-center gap-2 flex">
          <button
            type="button"
            onClick={() => { if (loading) return; if (isCrush) handleRemoveCrush(); else handleSetCrush(); }}
            aria-label="Crush"
            className={`inline-flex items-center justify-center px-3 py-2 rounded-full text-xs font-semibold transition ${isCrush ? 'bg-rose-500 text-white' : 'bg-white text-rose-500 border border-rose-100'} ${isMutual ? 'animate-pulse' : ''}`}
          >
            Crush
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

export default ChatHeader;
