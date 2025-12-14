import { memo, useCallback } from 'react';
import { Heart } from 'lucide-react';
import ConversationItem from './ConversationItem';

const ConversationListComponent = memo(function ConversationListComponent({
  conversations,
  selectedConversationId,
  onSelect,
  searchQuery,
  onSearchChange,
  onCreateNew,
}) {
  const handleSearchChange = useCallback((event) => onSearchChange(event.target.value), [onSearchChange]);
  const handleCreateNew = useCallback(() => onCreateNew(), [onCreateNew]);

  return (
    <aside className="flex h-full flex-col rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-[0_30px_90px_-70px_rgba(233,114,181,0.6)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-400">Match list</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">Danh sách các cặp đôi</h2>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Tìm kiếm theo tên"
          className="w-full rounded-[20px] border border-white/50 bg-white/70 px-4 py-2 text-sm text-slate-700 placeholder-rose-300 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
        />
      </div>

      <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
        {conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-rose-200/70 bg-white/60 p-6 text-center text-rose-400">
            <p className="text-sm">Chưa có cuộc trò chuyện nào</p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-4 rounded-full bg-gradient-to-r from-[#f7b0d2] to-[#fdd2b7] px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-200 transition hover:shadow-lg"
            >
              Tìm người mới
            </button>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation._id}
              conversation={conversation}
              isActive={selectedConversationId === conversation._id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
});

export default ConversationListComponent;
