import React, { useEffect, useState, useContext } from 'react';
import { X, Plus, Info } from 'lucide-react';
import { UserContext } from '../contexts';
import Navbar from '../components/Navbar';

export default function LibraryInvite() {
  const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const [invites, setInvites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRoom, setModalRoom] = useState(null);
  const [modalEmail, setModalEmail] = useState('');
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
  const [createLoading, setCreateLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailRoom, setDetailRoom] = useState(null);

  const { user: ctxUser } = useContext(UserContext) || {};

  // Load rooms and invites; include `joined` flag for current user
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE || ''}/api/library/rooms`);
        if (res.ok) {
          const json = await res.json();
          const list = (json.rooms || []).map((r) => {
            const occupants = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
            const id = r._id || r.id || String(r._id || Date.now());
            const joined = ctxUser ? occupants.includes(String(ctxUser.id || ctxUser._id || ctxUser._id)) : false;
            const createdBy = r.createdBy ? (r.createdBy._id || r.createdBy).toString() : null;
            
            // Collect pending invites for current user as recipient
            const userInvites = (r.invites || [])
              .filter((inv) => inv.receiverId && String(inv.receiverId) === String(ctxUser?.id || ctxUser?._id))
              .filter((inv) => inv.status === 'pending')
              .map((inv) => ({ ...inv, roomId: id }));
            
            setInvites((prev) => [...prev, ...userInvites]);
            return { ...r, id, occupants, joined, createdBy, startTime: r.startTime, endTime: r.endTime };
          });
          setRooms(list);
        } else {
          setRooms([]);
        }
      } catch (err) {
        console.warn('Failed to fetch rooms:', err);
        setRooms([]);
      }
    })();
  }, [ctxUser]);

  async function joinRoom(roomId) {
    if (!ctxUser) return alert('Vui lòng đăng nhập để vào phòng.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || data?.error || 'Không thể vào phòng.';
        return alert(msg);
      }

      // server returns updated room; normalize and update state
      const r = data.room;
      const occupants = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
      const id = r._id || r.id || roomId;
      const joined = occupants.includes(String(ctxUser.id || ctxUser._id));
      const normalized = { ...r, id, occupants, joined };

      setRooms((prev) => prev.map((it) => (String(it.id) === String(id) ? normalized : it)));
    } catch (err) {
      console.error('Join room failed:', err);
      alert('Không thể vào phòng. Vui lòng thử lại.');
    }
  }

  async function deleteRoom(roomId) {
    if (!ctxUser) return alert('Vui lòng đăng nhập.');
    if (!confirm('Bạn có chắc muốn xóa phòng này?')) return;
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.message || 'Xóa phòng thất bại');
      // remove from list
      setRooms((prev) => prev.filter((r) => String(r.id) !== String(roomId)));
    } catch (err) {
      console.error('Delete room failed:', err);
      alert('Xóa phòng thất bại. Vui lòng thử lại.');
    }
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
        const res = await fetch(`${API_BASE || ''}/api/match/matched-users/${ctxUser.id || ctxUser._id}`);
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

  function openCreateModal() {
    setCreateName('');
    setCreateSubject('');
    setCreateCapacity(4);
    setCreateDescription('');
    setCreateStart('');
    setCreateEnd('');
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
  }

  function handleCreateRoom() {
    const name = createName.trim();
    const subject = createSubject.trim();
    const capacity = Number(createCapacity) || 0;
    if (!name) return alert('Vui lòng nhập tên phòng.');
    if (capacity <= 0) return alert('Số thành viên phải lớn hơn 0.');
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
        if (createStart) payload.startTime = createStart;
        if (createEnd) payload.endTime = createEnd;
        if (ctxUser && (ctxUser.id || ctxUser._id)) payload.createdBy = ctxUser.id || ctxUser._id;

        const res = await fetch(`${API_BASE || ''}/api/library/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            const occupants = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
            const id = r._id || r.id || String(r._id || Date.now());
            const joined = ctxUser ? occupants.includes(String(ctxUser.id || ctxUser._id || ctxUser._id)) : false;
            return { ...r, id, occupants, joined };
          });
          setRooms(list);
        }
      } catch (err) {
        console.error('Create room API failed:', err);
        alert('Tạo phòng thất bại. Vui lòng thử lại.');
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
    // require both start and end, and end > start
    if (!createStart || !createEnd) return false;
    const s = new Date(createStart);
    const e = new Date(createEnd);
    if (!(e > s)) return false;
    return true;
  })();

  function openDetail(room) {
    setDetailRoom(room);
  }

  function closeDetail() {
    setDetailRoom(null);
  }

  function closeInviteModal() {
    setModalOpen(false);
    setModalRoom(null);
    setSelectedUserId('');
    setMatchedUsers([]);
  }

  async function handleModalSend() {
    if (!selectedUserId) return alert('Vui lòng chọn một người để mời.');
    if (!modalRoom) return;

    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${modalRoom.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: ctxUser.id || ctxUser._id,
          receiverId: selectedUserId,
          note: `Mời tham gia phòng ${modalRoom.name}`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.message || 'Gửi lời mời thất bại.');

      // On success, close modal and refresh
      closeInviteModal();
      alert('Gửi lời mời thành công!');
    } catch (err) {
      console.error('Send invite failed:', err);
      alert('Gửi lời mời thất bại. Vui lòng thử lại.');
    }
  }

  async function acceptInvite(roomId, inviteId) {
    if (!ctxUser) return alert('Vui lòng đăng nhập.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}/invites/${inviteId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.message || 'Chấp nhận lời mời thất bại.');

      // On success, refresh rooms list to update occupants
      const listRes = await fetch(`${API_BASE || ''}/api/library/rooms`);
      if (listRes.ok) {
        const listJson = await listRes.json();
        const list = (listJson.rooms || []).map((r) => {
          const occupants = (r.occupants || []).map((o) => (o && (o._id || o.toString())) || String(o));
          const id = r._id || r.id || String(r._id || Date.now());
          const joined = ctxUser ? occupants.includes(String(ctxUser.id || ctxUser._id || ctxUser._id)) : false;
          const createdBy = r.createdBy ? (r.createdBy._id || r.createdBy).toString() : null;
          return { ...r, id, occupants, joined, createdBy, startTime: r.startTime, endTime: r.endTime };
        });
        setRooms(list);
      }

      // Remove the accepted invite from display
      setInvites((s) => s.filter((inv) => !(inv.roomId === roomId && inv._id === inviteId)));
    } catch (err) {
      console.error('Accept invite failed:', err);
      alert('Chấp nhận lời mời thất bại. Vui lòng thử lại.');
    }
  }

  async function rejectInvite(roomId, inviteId) {
    if (!ctxUser) return alert('Vui lòng đăng nhập.');
    try {
      const res = await fetch(`${API_BASE || ''}/api/library/rooms/${roomId}/invites/${inviteId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ctxUser.id || ctxUser._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.message || 'Từ chối lời mời thất bại.');

      // Remove the rejected invite from display
      setInvites((s) => s.filter((inv) => !(inv.roomId === roomId && inv._id === inviteId)));
    } catch (err) {
      console.error('Reject invite failed:', err);
      alert('Từ chối lời mời thất bại. Vui lòng thử lại.');
    }
  }

  const pending = invites.filter(i => i.status === 'pending' || i.status === 'Pending');

  return (
    <div className="min-h-screen bg-[#fff8fb]">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl px-4 py-16">

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-2xl border border-rose-50 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Phòng thư viện</h2>

            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm phòng, môn học..."
                  className="w-full max-w-md rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm"
                />
                <button onClick={() => setSearchQuery('')} className="text-sm text-slate-500">Xóa</button>
              </div>
              <div>
                <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">
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
                  <div key={room.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">{room.name}</div>
                        <div className="text-xs text-slate-500">{room.occupants.length}/{room.capacity}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{room.description}</div>
                      {room.startTime && (
                        <div className="mt-1 text-xs text-slate-500">Thời gian: {new Date(room.startTime).toLocaleString()}{room.endTime ? ` — ${new Date(room.endTime).toLocaleString()}` : ''}</div>
                      )}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div style={{ width: `${fillPct}%` }} className="h-2 bg-teal-400" />
                      </div>

                      <div className="mt-3">
                        <button onClick={() => openDetail(room)} className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium border border-slate-100 text-slate-700 hover:bg-slate-50">
                          <Info className="h-4 w-4" />
                          <span>Chi tiết</span>
                        </button>
                      </div>
                    </div>

                      <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => joinRoom(room.id)}
                        disabled={isFull || room.joined}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-transform duration-150 ${(isFull || room.joined) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-br from-teal-400 to-teal-500 text-white shadow-[0_10px_30px_-18px_rgba(56,189,248,0.35)] hover:scale-105'}`}
                      >
                        {isFull ? 'Đầy' : room.joined ? 'Đã vào' : 'Vào'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!room.joined) return alert('Bạn phải vào phòng trước mới có thể mời người khác.');
                            openInviteModal(room);
                          }}
                          disabled={isFull || !room.joined}
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${(isFull || !room.joined) ? 'text-slate-300 cursor-not-allowed' : 'border border-rose-100 text-rose-500 hover:bg-rose-50'}`}
                        >
                          Mời
                        </button>
                        {ctxUser && room.createdBy && String(room.createdBy) === String(ctxUser.id || ctxUser._id) && (
                          <button onClick={() => deleteRoom(room.id)} className="rounded-full px-3 py-1 text-sm font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50">Xóa</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">

            <div className="rounded-2xl border border-rose-50 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Lời mời tôi nhận được ({pending.length})</h3>
              {pending.length === 0 ? (
                <div className="text-sm text-slate-400">Không có lời mời nào đang chờ.</div>
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
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
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
                        <option key={user._id || user.id} value={user._id || user.id}>
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

                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Thời gian bắt đầu</span>
                  <input type="datetime-local" value={createStart} onChange={(e) => setCreateStart(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>

                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Thời gian kết thúc</span>
                  <input type="datetime-local" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>

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
                  {(!createStart || !createEnd) && <div>Vui lòng nhập cả thời gian bắt đầu và thời gian kết thúc.</div>}
                  {createStart && createEnd && new Date(createEnd) <= new Date(createStart) && <div>Thời gian kết thúc phải lớn hơn thời gian bắt đầu.</div>}
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
                  <div><strong>Thời gian:</strong> {new Date(detailRoom.startTime).toLocaleString()}{detailRoom.endTime ? ` — ${new Date(detailRoom.endTime).toLocaleString()}` : ''}</div>
                )}
                {detailRoom.subject && <div><strong>Môn học:</strong> {detailRoom.subject}</div>}
                <div><strong>Mô tả:</strong> {detailRoom.description || '—'}</div>
                <div><strong>Số lượng thành viên:</strong> {detailRoom.capacity}</div>
                <div><strong>Đang tham gia:</strong> {detailRoom.occupants.length}</div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={closeDetail} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
