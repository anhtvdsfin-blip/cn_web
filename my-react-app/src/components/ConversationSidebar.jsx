import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useMemo } from 'react';
import ConversationListComponent from './ConversationListComponent';
import { enhanceConversation, sortConversations } from '../utils/messageHelpers';

export default function ConversationSidebar({
  selectedConversationId,
  onSelectConversation,
  conversations,
  onConversationsUpdate,
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const API_URL = import.meta.env.VITE_API_URL;

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Use match endpoint to fetch matched users and map into conversation shape
      const res = await axios.get(`${API_URL}/api/match/matched-users/${user.id}`);
      if (res.data?.success) {
        const matches = res.data.matches || res.data.matchedUsers || [];
        const mapped = matches.map((m) => ({
          _id: String(m.matchId || m._id || m.id),
          matchId: m.matchId || m._id || m.id,
          conversationId: m.conversationId || null,
          partnerId: m.partner?._id || m.id || m._id,
          partnerName: m.partner?.name || m.name,
          partnerAvatar: m.partner?.avatar || m.avatar,
          lastMessage: m.lastMessage || null,
          unreadCount: m.unreadCount || 0,
        }));

        const sorted = sortConversations(mapped);
        onConversationsUpdate(sorted);
      }
    } catch (error) {
      console.error('Error fetching matches as conversations:', error);
    }
  }, [API_URL, user?.id, onConversationsUpdate]);

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
    }
  }, [fetchConversations, user?.id]);

  const filteredConversations = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      conversation.partnerName?.toLowerCase().includes(normalized)
    );
  }, [conversations, searchQuery]);

  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleCreateNew = useCallback(() => navigate('/feed'), [navigate]);

  return (
    <ConversationListComponent
      conversations={filteredConversations}
      selectedConversationId={selectedConversationId}
      onSelect={onSelectConversation}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onCreateNew={handleCreateNew}
    />
  );
}
