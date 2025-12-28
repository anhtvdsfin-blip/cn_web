import { memo, useCallback, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Smile, Image as ImageIcon, Send } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const MessageInput = memo(function MessageInput({ value, onChange, onSend, onTyping, conversationId }) {
  const fileRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const emojis = ['😊','😍','😂','😢','😮','🔥','🎉','💖','😉','🤗'];
  const handleEmojiSelect = useCallback((emoji) => {
    setPickerOpen(false);
    onSend({ text: '', icon: emoji });
  }, [onSend]);
  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file || !conversationId) return;

      const form = new FormData();
      const stored = sessionStorage.getItem('user');
      const userObj = stored ? JSON.parse(stored) : null;
      const userId = userObj?.id;
      form.append('image', file);
      if (userId) form.append('userId', userId);

      try {
        const res = await axios.post(`${API_URL}/api/match/${conversationId}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res.data?.url || res.data?.secure_url || null;
        if (url) {
          onSend({ text: '', attachment: url });
        } else {
          toast.error('Không thể tải ảnh lên, vui lòng thử lại.');
        }
      } catch (err) {
        console.error('Upload chat image failed', err);
        toast.error('Lỗi khi tải ảnh.');
      } finally {
        // reset input
        event.target.value = '';
      }
    },
    [conversationId, onSend]
  );
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full p-2 text-rose-300 transition hover:bg-rose-50 hover:text-rose-400"
            aria-label="Gửi reaction"
          >
            <Smile className="h-5 w-5" />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 bottom-full mb-2 z-50 w-40 rounded-lg bg-white p-2 shadow-md">
              <div className="grid grid-cols-5 gap-2">
                {emojis.map((e) => (
                  <button key={e} type="button" onClick={() => handleEmojiSelect(e)} className="rounded p-1 text-lg hover:bg-rose-50">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
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
