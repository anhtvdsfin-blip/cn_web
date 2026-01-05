import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Plus, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { UserContext } from '../contexts';

export default function LibraryInvite() {
  const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  // Helper: robustly extract avatar URL from occupant object
  const extractAvatar = (o) => {
    if (!o || typeof o === 'string') return null;
    const fields = ['avatar', 'photo', 'picture', 'profilePic', 'avatarUrl', 'avatar_url', 'image', 'imageUrl', 'url'];
    for (const f of fields) {
      const v = o[f];
      if (!v) continue;
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'object') {
        if (typeof v.url === 'string' && v.url.trim()) return v.url;
        if (typeof v.secure_url === 'string' && v.secure_url.trim()) return v.secure_url;
      }
    }
    // fallback: some APIs nest under 'avatar' object with different keys
    if (o.avatar && typeof o.avatar === 'object') {
      if (o.avatar.secure_url) return o.avatar.secure_url;
      if (o.avatar.url) return o.avatar.url;
    }
    if (o.photo && typeof o.photo === 'object') {
      if (o.photo.url) return o.photo.url;
    }
    return null;
  };
  const [invites, setInvites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRoom, setModalRoom] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createCapacity, setCreateCapacity] = useState(4);
  const [createDescription, setCreateDescription] = useState('');
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  // Preferred: combined Date objects for date+time picker
  const [createStartDT, setCreateStartDT] = useState(null);
  const [createEndDT, setCreateEndDT] = useState(null);
  // Fallback split date/time inputs (kept for compatibility)
  const [createStartDate, setCreateStartDate] = useState('');
  const [createStartTime, setCreateStartTime] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createEndTime, setCreateEndTime] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetRoom, setDeleteTargetRoom] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCreateError, setShowCreateError] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [detailRoom, setDetailRoom] = useState(null);

  const { user: ctxUser } = useContext(UserContext) || {};

  // Helper to build Authorization header and normalize token
  function getAuthHeaders() {
    const tokenRaw = sessionStorage.getItem('accessToken');
    if (!tokenRaw) return {};
    // strip accidental quotes
    let token = tokenRaw;
    if (typeof token === 'string') {
      token = token.trim();
      if ((token.startsWith("\"") && token.endsWith("\"")) || (token.startsWith("'") && token.endsWith("'"))) {
        token = token.slice(1, -1);
      }
    }
    // log for debugging (will show in browser console)
    try { console.debug('Using accessToken for API calls:', token.slice(0, 8) + '...'); } catch (e) {}
    return { Authorization: `Bearer ${token}` };
  }

  // Load rooms and invites; include `joined` flag for current user
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE || ''}/api/library/rooms`);
        if (res.ok) {
          const json = await res.json();
          const fetched = json.rooms || [];
          const invitesAcc = [];
          const list = fetched.map((r) => {
            const occupantIds = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
            const occupantNames = (r.occupants || []).map((o) => (o && o.name) || (typeof o === 'string' ? o : ''));
            const occupantAvatars = (r.occupants || []).map((o) => extractAvatar(o));
            const id = r._id || r.id || String(r._id || Date.now());
            const joined = ctxUser ? occupantIds.includes(String(ctxUser.id || ctxUser._id || ctxUser._id)) : false;
            const createdBy = r.createdBy ? (r.createdBy._id || r.createdBy).toString() : null;

            // Collect pending invites for current user as recipient (accumulate)
            const userInvites = (r.invites || [])
              .filter((inv) => inv.receiverId && String(inv.receiverId) === String(ctxUser?.id || ctxUser?._id))
              .filter((inv) => inv.status === 'pending')
              .map((inv) => ({ ...inv, roomId: id }));

            if (userInvites.length) invitesAcc.push(...userInvites);
            return { ...r, id, occupants: occupantIds, occupantNames, occupantAvatars, joined, createdBy, startTime: r.startTime, endTime: r.endTime };
          });

          // Update state once to avoid many re-renders
          setRooms(list);
          if (invitesAcc.length) setInvites(invitesAcc);
        } else {
          setRooms([]);
        }
      } catch (err) {
        console.warn('Failed to fetch rooms:', err);
        setRooms([]);
      }
    })();
  }, [ctxUser]);

  // Debounce search input to avoid frequent recomputations
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Memoize filtered rooms for smoother rendering
  const filteredRooms = useMemo(() => {
    const q = debouncedSearch || '';
    if (!q) return rooms;
    return rooms.filter((room) => {
      return (
        (room.name || '').toLowerCase().includes(q) ||
        ((room.description || '').toLowerCase().includes(q))
      );
    });
  }, [rooms, debouncedSearch]);

  const joinRoom = useCallback(async (roomId) => {
    if (!ctxUser) return toast.error('Vui lòng đăng nhập để vào phòng.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || data?.error || 'Không thể vào phòng.';
        return toast.error(msg);
      }

      // server returns updated room; normalize and update state
      const r = data.room;
      const occupantIds = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
      const occupantNames = (r.occupants || []).map((o) => (o && o.name) || (typeof o === 'string' ? o : ''));
      const occupantAvatars = (r.occupants || []).map((o) => extractAvatar(o));
      const id = r._id || r.id || roomId;
      const joined = occupantIds.includes(String(ctxUser.id || ctxUser._id));
      const normalized = { ...r, id, occupants: occupantIds, occupantNames, occupantAvatars, joined };

      setRooms((prev) => prev.map((it) => (String(it.id) === String(id) ? normalized : it)));
    } catch (err) {
      console.error('Join room failed:', err);
      toast.error('Không thể vào phòng. Vui lòng thử lại.');
    }
  }, [ctxUser, API_BASE]);

  const deleteRoom = useCallback(async (roomId) => {
    if (!ctxUser) return toast.error('Vui lòng đăng nhập.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ msg: data.message || 'Xóa phòng thất bại', type: 'error' });
        return false;
      }
      // remove from list
      setRooms((prev) => prev.filter((r) => String(r.id) !== String(roomId)));
      setToast({ msg: 'Xóa phòng thành công', type: 'success' });
      return true;
    } catch (err) {
      console.error('Delete room failed:', err);
      setToast({ msg: 'Xóa phòng thất bại. Vui lòng thử lại.', type: 'error' });
      return false;
    }
  }, [ctxUser, API_BASE]);

  function openDeleteConfirm(roomId) {
    setDeleteTargetRoom(roomId);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deleteTargetRoom) return;
    setDeleteLoading(true);
    const ok = await deleteRoom(deleteTargetRoom);
    setDeleteLoading(false);
    setShowDeleteConfirm(false);
    setDeleteTargetRoom(null);
    if (ok) closeDetail();
  }

  function openInviteModal(room) {
    setModalRoom(room);
    setSelectedUserId('');
    setModalOpen(true);
    
    // Fetch matched users
    if (!ctxUser) return;
    setLoadingMatches(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE || ''}/api/match/matched-users/${ctxUser.id || ctxUser._id}`, { headers: { ...getAuthHeaders() } });
        if (res.ok) {
          const data = await res.json();
          setMatchedUsers(data.matchedUsers || []);
        } else {
          setMatchedUsers([]);
        }
      } catch (err) {
        console.error('Failed to fetch matched users:', err);
        setMatchedUsers([]);
      } finally {
        setLoadingMatches(false);
      }
    })();
  }

  const openInviteModalCb = useCallback((room) => openInviteModal(room), [/* room passed in */]);

  function openCreateModal() {
    setCreateName('');
    setCreateSubject('');
    setCreateCapacity(4);
    setCreateDescription('');
    setCreateStart('');
    setCreateEnd('');
    setCreateStartDT(null);
    setCreateEndDT(null);
    setCreateStartDate('');
    setCreateStartTime('');
    setCreateEndDate('');
    setCreateEndTime('');
    setCreateModalOpen(true);
  }

  const openDetail = useCallback((room) => {
    setDetailRoom(room);
  }, []);

  function closeCreateModal() {
    setCreateModalOpen(false);
  }

  function handleCreateRoom() {
    const name = createName.trim();
    const subject = createSubject.trim();
    const capacity = Number(createCapacity) || 0;
    if (!name) return toast.error('Vui lòng nhập tên phòng.');
    if (capacity <= 0) return toast.error('Số thành viên phải lớn hơn 0.');
    const newRoom = {
      id: String(Date.now()),
      name,
      description: subject ? `${subject} — ${createDescription}`.trim() : createDescription,
      capacity,
      occupants: [],
    };
    // Persist to backend — require success to update UI
    setCreateLoading(true);
    (async () => {
      try {
        const payload = { name, subject, capacity, description: createDescription };
        // Build ISO timestamps — prefer DatePicker Date objects, fallback to split inputs
        if (createStartDT) {
          payload.startTime = createStartDT.toISOString();
        } else if (createStartDate && createStartTime) {
          const s = new Date(`${createStartDate}T${createStartTime}`);
          payload.startTime = s.toISOString();
        } else if (createStart) {
          payload.startTime = createStart;
        }

        if (createEndDT) {
          payload.endTime = createEndDT.toISOString();
        } else if (createEndDate && createEndTime) {
          const e = new Date(`${createEndDate}T${createEndTime}`);
          payload.endTime = e.toISOString();
        } else if (createEnd) {
          payload.endTime = createEnd;
        }
        if (ctxUser && (ctxUser.id || ctxUser._id)) payload.createdBy = ctxUser.id || ctxUser._id;

        // debug: log payload and token prefix
        try { console.debug('Creating room payload:', { ...payload, startTime: payload.startTime, endTime: payload.endTime }); } catch (e) {}

        const res = await fetch(`${API_BASE || ''}/api/library/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => null);
          throw new Error(text || 'Server returned an error');
        }
        // refresh full list from server to reflect DB state
        const listRes = await fetch(`${API_BASE || ''}/api/library/rooms`);
        if (listRes.ok) {
          const listJson = await listRes.json();
          const list = (listJson.rooms || []).map((r) => {
            const occupantIds = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
            const occupantNames = (r.occupants || []).map((o) => (o && o.name) || (typeof o === 'string' ? o : ''));
            const occupantAvatars = (r.occupants || []).map((o) => extractAvatar(o));
            const id = r._id || r.id || String(r._id || Date.now());
            const joined = ctxUser ? occupantIds.includes(String(ctxUser.id || ctxUser._id || ctxUser._id)) : false;
            return { ...r, id, occupants: occupantIds, occupantNames, occupantAvatars, joined };
          });
          setRooms(list);
        }
      } catch (err) {
          console.error('Create room API failed:', err);
          const msg = (err && err.message) || 'Tạo phòng thất bại. Vui lòng thử lại.';
          setCreateErrorMessage(msg);
          setShowCreateError(true);
      } finally {
        setCreateLoading(false);
        closeCreateModal();
      }
    })();
  }

  const isCreateValid = (() => {
    const name = createName.trim();
    const capacity = Number(createCapacity) || 0;
    if (!name) return false;
    if (!(capacity > 0)) return false;
    // require subject
    if (!createSubject.trim()) return false;
    // require start/end — prefer Date objects from picker, fallback to split inputs
    let s = null;
    let e = null;
    if (createStartDT && createEndDT) {
      s = createStartDT;
      e = createEndDT;
    } else {
      if (!createStartDate || !createStartTime || !createEndDate || !createEndTime) return false;
      s = new Date(`${createStartDate}T${createStartTime}`);
      e = new Date(`${createEndDate}T${createEndTime}`);
    }
    if (!(e > s)) return false;
    return true;
  })();

  

  function closeDetail() {
    setDetailRoom(null);
  }

  function closeInviteModal() {
    setModalOpen(false);
    setModalRoom(null);
    setSelectedUserId('');
    setMatchedUsers([]);
  }

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleModalSend() {
    if (!selectedUserId) return toast.error('Vui lòng chọn một người để mời.');
    if (!modalRoom) return;

    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${modalRoom.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          senderId: ctxUser.id || ctxUser._id,
          receiverId: selectedUserId,
          note: `Mời tham gia phòng ${modalRoom.name}`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.message || 'Gửi lời mời thất bại.');

      // On success, close modal and refresh
      closeInviteModal();
      setToast({ msg: 'Gửi lời mời thành công!', type: 'success' });
    } catch (err) {
      console.error('Send invite failed:', err);
      toast.error('Gửi lời mời thất bại. Vui lòng thử lại.');
    }
  }

  async function acceptInvite(roomId, inviteId) {
    if (!ctxUser) return toast.error('Vui lòng đăng nhập.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}/invites/${inviteId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.message || 'Chấp nhận lời mời thất bại.');

      // On success, refresh rooms list to update occupants
      const listRes = await fetch(`${API_BASE || ''}/api/library/rooms`);
        if (listRes.ok) {
          const listJson = await listRes.json();
          const list = (listJson.rooms || []).map((r) => {
            const occupantIds = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
            const occupantNames = (r.occupants || []).map((o) => (o && o.name) || (typeof o === 'string' ? o : ''));
            const occupantAvatars = (r.occupants || []).map((o) => (o && typeof o === 'object' ? (o.avatar || o.photo || null) : null));
            const id = r._id || r.id || String(r._id || Date.now());
            const joined = ctxUser ? occupantIds.includes(String(ctxUser.id || ctxUser._id || ctxUser._id)) : false;
            const createdBy = r.createdBy ? (r.createdBy._id || r.createdBy).toString() : null;
            return { ...r, id, occupants: occupantIds, occupantNames, occupantAvatars, joined, createdBy, startTime: r.startTime, endTime: r.endTime };
          });
          setRooms(list);
        }

      // Remove the accepted invite from display
      setInvites((s) => s.filter((inv) => !(inv.roomId === roomId && inv._id === inviteId)));
    } catch (err) {
      console.error('Accept invite failed:', err);
      toast.error('Chấp nhận lời mời thất bại. Vui lòng thử lại.');
    }
  }

  async function rejectInvite(roomId, inviteId) {
    if (!ctxUser) return toast.error('Vui lòng đăng nhập.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}/invites/${inviteId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.message || 'Từ chối lời mời thất bại.');

      // Remove the rejected invite from display
      setInvites((s) => s.filter((inv) => !(inv.roomId === roomId && inv._id === inviteId)));
    } catch (err) {
      console.error('Reject invite failed:', err);
      toast.error('Từ chối lời mời thất bại. Vui lòng thử lại.');
    }
  }

  const pending = invites.filter(i => i.status === 'pending' || i.status === 'Pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff4f6] via-[#fff8fb] to-[#fffaf6] pt-16">
      <div className="mx-auto w-full max-w-6xl px-4 py-16">

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-3xl border border-rose-50 bg-white/80 p-6 shadow-md backdrop-blur-sm">
            <h2 className="mb-4 text-2xl font-extrabold text-rose-600">Phòng thư viện</h2>

            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm phòng, môn học..."
                    className="w-full max-w-lg rounded-2xl border border-rose-100 bg-white/60 px-4 py-3 text-sm shadow-md placeholder:italic placeholder:text-rose-200"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-500">Xóa</button>
                  )}
                </div>
              </div>
              <div>
                <button onClick={openCreateModal} className="inline-flex items-center gap-3 rounded-full bg-gradient-to-br from-[#F7C6B7] to-rose-400 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:scale-105 transition-transform">
                  <Plus className="h-4 w-4" /> Tạo room mới
                </button>
              </div>
            </div>

            {/* Rooms list (vertical) */}
            <div className="flex flex-col gap-4">
              {rooms
                .filter((room) => {
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    room.name.toLowerCase().includes(q) ||
                    (room.description || '').toLowerCase().includes(q)
                  );
                })
                .map((room) => {
                const available = room.capacity - room.occupants.length;
                const isFull = available <= 0;
                const fillPct = Math.round((room.occupants.length / room.capacity) * 100);
                return (
                  <div key={room.id} className="flex items-center justify-between gap-4 rounded-2xl border border-rose-50 bg-white p-4 shadow-lg">
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-slate-800">{room.name}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{room.description}</div>
                      {room.occupantNames && room.occupantNames.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-slate-500 mb-2">Thành viên:</div>
                          <div className="flex items-center -space-x-2 pr-4">
                            {(room.occupantAvatars || room.occupantNames || []).slice(0, 6).map((a, idx) => {
                              const name = (room.occupantNames && room.occupantNames[idx]) || '';
                              if (a) {
                                return (
                                  <img
                                    key={idx}
                                    title={name}
                                    src={a}
                                    alt={name}
                                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                                  />
                                );
                              }
                              const initials = (name || '').split(' ').map(s => s[0]).slice(0,2).join('');
                              return (
                                <div key={idx} title={name} className="h-8 w-8 flex items-center justify-center rounded-full bg-rose-100 text-xs text-rose-700 ring-2 ring-white shadow-sm">{initials}</div>
                              );
                            })}
                            {(room.occupantNames || []).length > 6 && (
                              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600 ring-2 ring-white">+{(room.occupantNames || []).length - 6}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {room.startTime && (
                        <div className="mt-2 text-sm text-slate-500">Thời gian: <span className="text-teal-600 font-medium">{new Date(room.startTime).toLocaleString()}</span>{room.endTime ? ` — ${new Date(room.endTime).toLocaleString()}` : ''}</div>
                      )}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-teal-50">
                        <div style={{ width: `${fillPct}%` }} className="h-2 bg-teal-400 shadow-inner" />
                      </div>

                      <div className="mt-3">
                        <button onClick={() => openDetail(room)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium border border-rose-100 text-rose-600 hover:bg-rose-50">
                          <Info className="h-4 w-4" />
                          <span>Chi tiết</span>
                        </button>
                      </div>
                    </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-xs  font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-md">{room.occupants.length}/{room.capacity}</div>
                      <button
                        onClick={() => joinRoom(room.id)}
                        disabled={isFull || room.joined}
                        className={`rounded-full px-5 py-2 text-sm font-semibold transition-transform duration-150 ${(isFull || room.joined) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-br from-[#F7C6B7] to-rose-400 text-white shadow-[0_12px_30px_-18px_rgba(247,198,183,0.45)] hover:scale-105'}`}
                      >
                        {isFull ? 'Đầy' : room.joined ? 'Đã vào' : 'Vào'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!room.joined) return toast.error('Bạn phải vào phòng trước mới có thể mời người khác.');
                            openInviteModal(room);
                          }}
                          disabled={isFull || !room.joined}
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${(isFull || !room.joined) ? 'text-slate-300 cursor-not-allowed' : 'border border-rose-100 text-rose-600 hover:bg-rose-50'}`}
                        >
                          Mời
                        </button>
                        {ctxUser && room.createdBy && String(room.createdBy) === String(ctxUser.id || ctxUser._id) && (
                          <button onClick={() => openDeleteConfirm(room.id)} className="rounded-full px-3 py-1 text-sm font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50">Xóa</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">

            <div className="rounded-2xl border border-rose-50 bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-extrabold text-rose-600">Lời mời tôi nhận được <span className="text-sm font-medium text-slate-500">({pending.length})</span></h3>
              {pending.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
                    <path d="M3 7v10a2 2 0 0 0 2 2h14V5H5a2 2 0 0 0-2 2z" fill="#E9F8F8" />
                    <path d="M6 3v4" stroke="#7AD7D1" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M12 7v6" stroke="#F7C6B7" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M9 12h6" stroke="#F7C6B7" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <div className="font-medium">Không có lời mời nào đang chờ</div>
                  <div className="text-xs text-slate-400">Hãy tạo phòng hoặc mời bạn bè để khởi đầu một buổi học thật hiệu quả.</div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {pending.map((i) => (
                    <li key={i._id || i.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
                      <div>
                        <div className="font-medium text-slate-800">{rooms.find(r => r.id === i.roomId || r._id === i.roomId)?.name || 'Phòng'}</div>
                        <div className="mt-1 text-xs text-slate-500">Từ: {i.senderId?.name || 'Ai đó'}</div>
                        {i.expiresAt && (
                          <div className="mt-1 text-xs text-slate-400">Hết hạn: {new Date(i.expiresAt).toLocaleString()}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => acceptInvite(i.roomId || i.room_id, i._id || i.id)} className="text-xs text-teal-600 font-semibold">Chấp nhận</button>
                        <button onClick={() => rejectInvite(i.roomId || i.room_id, i._id || i.id)} className="text-xs text-rose-500 font-semibold">Từ chối</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeInviteModal} />
            <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Mời vào {modalRoom?.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{modalRoom?.description}</p>
                </div>
                <button onClick={closeInviteModal} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div className="mt-4">
                {loadingMatches ? (
                  <div className="text-sm text-slate-500">Đang tải danh sách người matching...</div>
                ) : matchedUsers.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Bạn chưa có người matching nào. Hãy dùng chức năng Match để tìm người.
                  </div>
                ) : (
                  <label className="block text-sm">
                    <span className="text-xs text-slate-500">Chọn người để mời</span>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">-- Chọn người --</option>
                      {matchedUsers.map(user => (
                        <option key={user.userId || user.id || user._id} value={user.userId || user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={closeInviteModal} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Hủy</button>
                <button onClick={handleModalSend} disabled={!selectedUserId || loadingMatches} className={`rounded-full px-4 py-2 text-sm text-white ${(!selectedUserId || loadingMatches) ? 'bg-slate-200 cursor-not-allowed' : 'bg-rose-500'}`}>Gửi</button>
              </div>
            </div>
          </div>
        )}

        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeCreateModal} />
            <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Tạo room mới</h3>
                  <p className="mt-1 text-sm text-slate-500">Tạo phòng học / thảo luận.</p>
                </div>
                <button onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Tên phòng</span>
                  <input value={createName} onChange={(e) => setCreateName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>

                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Môn học (tùy chọn)</span>
                  <input value={createSubject} onChange={(e) => setCreateSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>

                <div className="grid gap-3">
                  <label className="block text-sm">
                    <span className="text-xs text-slate-500">Chọn thời gian bắt đầu</span>
                    <div className="mt-2">
                      <DatePicker
                        selected={createStartDT}
                        onChange={(d) => setCreateStartDT(d)}
                        showTimeSelect
                        timeIntervals={15}
                        dateFormat="Pp"
                        placeholderText="Chọn ngày và giờ"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </label>

                  <label className="block text-sm">
                    <span className="text-xs text-slate-500">Chọn thời gian kết thúc</span>
                    <div className="mt-2">
                      <DatePicker
                        selected={createEndDT}
                        onChange={(d) => setCreateEndDT(d)}
                        showTimeSelect
                        timeIntervals={15}
                        dateFormat="Pp"
                        placeholderText="Chọn ngày và giờ"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </label>
                </div>

                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Số thành viên</span>
                  <input type="number" min={1} value={createCapacity} onChange={(e) => setCreateCapacity(e.target.value)} className="mt-2 w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>

                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Mô tả</span>
                  <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>

                {/* validation messages */}
                <div className="mt-2 text-xs text-rose-500">
                  {!createName.trim() && <div>Vui lòng nhập tên phòng.</div>}
                  {!createSubject.trim() && <div>Vui lòng nhập môn học.</div>}
                  {!(Number(createCapacity) > 0) && <div>Số thành viên phải là số lớn hơn 0.</div>}
                  {(!createStartDate || !createStartTime || !createEndDate || !createEndTime) && <div>Vui lòng nhập cả ngày và giờ bắt đầu, kết thúc.</div>}
                  {createStartDate && createStartTime && createEndDate && createEndTime && new Date(`${createEndDate}T${createEndTime}`) <= new Date(`${createStartDate}T${createStartTime}`) && <div>Thời gian kết thúc phải lớn hơn thời gian bắt đầu.</div>}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={closeCreateModal} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Hủy</button>
                <button onClick={handleCreateRoom} disabled={!isCreateValid || createLoading} className={`rounded-full px-4 py-2 text-sm text-white ${(!isCreateValid || createLoading) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-rose-500'}`}>
                  {createLoading ? 'Đang tạo...' : 'Tạo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {detailRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{detailRoom.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{detailRoom.description}</p>
                </div>
                <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {detailRoom.startTime && (
                  <div><strong className="text-slate-800">Thời gian:</strong> <span className="text-teal-600 font-medium">{new Date(detailRoom.startTime).toLocaleString()}{detailRoom.endTime ? ` — ${new Date(detailRoom.endTime).toLocaleString()}` : ''}</span></div>
                )}
                {detailRoom.subject && <div><strong className="text-slate-800">Môn học:</strong> <span className="text-teal-600 font-medium">{detailRoom.subject}</span></div>}
                <div><strong className="text-slate-800">Mô tả:</strong> <div className="mt-1 text-slate-600">{detailRoom.description || '—'}</div></div>
                <div><strong className="text-slate-800">Số lượng thành viên:</strong> <span className="ml-1 text-slate-700">{detailRoom.capacity}</span></div>
                <div>
                  <strong className="text-slate-800">Đang tham gia:</strong>
                  {detailRoom.occupantNames && detailRoom.occupantNames.length > 0 ? (
                    <div className="mt-3">
                      <div className="flex flex-row flex-wrap items-start gap-6">
                        {detailRoom.occupantNames.map((n, i) => {
                          const avatar = (detailRoom.occupantAvatars && detailRoom.occupantAvatars[i]) || (detailRoom.occupants && extractAvatar(detailRoom.occupants[i])) || null;
                          const initials = (n || '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
                          // determine occupant id to check creator
                          const occ = detailRoom.occupants && detailRoom.occupants[i];
                          const occId = occ && (occ._id || occ.id || occ.toString());
                          const creatorId = detailRoom.createdBy && (detailRoom.createdBy._id || detailRoom.createdBy.id || detailRoom.createdBy.toString());
                          const isCreator = creatorId && occId && String(creatorId) === String(occId);
                          return (
                            <div key={i} className="flex flex-col items-center w-28">
                              <div className="relative">
                                {avatar ? (
                                  <img src={avatar} alt={n} title={n} className={`h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-sm ${isCreator ? 'border-2 border-rose-300' : ''}`} />
                                ) : (
                                  <div title={n} className={`h-20 w-20 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-base font-semibold ${isCreator ? 'ring-2 ring-rose-200' : ''}`}>{initials}</div>
                                )}
                                {isCreator && (
                                  <span className="absolute -top-1 -right-1 bg-rose-50 text-rose-600 rounded-full p-1 text-xs" title="Người tạo">👑</span>
                                )}
                              </div>
                              <div className="mt-2 text-sm text-slate-700 text-center break-words w-full">{n}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="ml-2">{detailRoom.occupants ? detailRoom.occupants.length : 0}</span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                {detailRoom && ctxUser && String(detailRoom.createdBy) === String(ctxUser.id || ctxUser._id) && (
                  <button onClick={() => openDeleteConfirm(detailRoom.id)} className="rounded-full border border-rose-100 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50">Xóa</button>
                )}
                <button onClick={closeDetail} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Đóng</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => { if (!deleteLoading) { setShowDeleteConfirm(false); setDeleteTargetRoom(null); } }} />
            <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[20px] border border-rose-100 bg-white p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900">Bạn có chắc muốn xóa phòng này?</h3>
              <p className="mt-2 text-sm text-slate-600">Hành động này sẽ xóa phòng và lịch sử lời mời liên quan. Không thể hoàn tác.</p>
              <div className="mt-4 flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteTargetRoom(null); }} disabled={deleteLoading} className="flex-1 rounded-full border border-rose-100 bg-white px-4 py-2 text-sm text-rose-600">Hủy</button>
                <button onClick={confirmDelete} disabled={deleteLoading} className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white">{deleteLoading ? 'Đang xóa...' : 'Xóa và ẩn'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Create error modal */}
        {showCreateError && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateError(false)} />
            <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[20px] border border-rose-100 bg-white p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900">Tạo phòng thất bại</h3>
              <p className="mt-2 text-sm text-slate-600">{createErrorMessage || 'Không thể tạo phòng. Vui lòng thử lại.'}</p>
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setShowCreateError(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Đóng</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 z-50">
            <div className={`max-w-xs rounded-lg px-4 py-2 shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
