import { memo, useCallback } from 'react';
import { Smile, Image as ImageIcon, Send } from 'lucide-react';

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
          placeholder="Nhập tin nhắn của bạn hoặc gửi Opening Move..."
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

export default MessageInput;
