import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

// Confirmation Modal Component
function ConfirmModal({ isOpen, onClose, onConfirm, loading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div 
        className="relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <Heart className="h-8 w-8 text-rose-500" />
          </div>
        </div>

        <h3 className="mb-2 text-center text-xl font-bold text-slate-800">
          Hủy Crush Bí Mật?
        </h3>
        <p className="mb-6 text-center text-sm text-slate-600">
          Bạn có chắc chắn muốn hủy crush bí mật này không? Hành động này không thể hoàn tác.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-full border-2 border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:shadow-xl disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function YourCrush() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const user = (() => { try { return JSON.parse(sessionStorage.getItem('user')||'{}'); } catch { return {}; } })();
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!userId || !API_URL) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const headers = {};
        const token = sessionStorage.getItem('accessToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/api/v1/user/my-crush?userId=${userId}`, { headers, credentials: 'include' });
        if (!res.ok) {
          setMatch(null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.success && data.match) setMatch(data.match);
        else setMatch(null);
      } catch (err) {
        console.error('Failed to load crush:', err);
        setMatch(null);
      } finally { setLoading(false); }
    })();
  }, [userId]);

  const handleRemove = async () => {
    if (!match || !userId) return;
    setShowConfirmModal(false);
    setRemoving(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = sessionStorage.getItem('accessToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/v1/matches/${match._id}/remove-crush`, {
        method: 'POST', credentials: 'include', headers, body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setMatch(null);
      toast.success('Đã hủy crush bí mật');
    } catch (err) {
      console.error(err);
      toast.error('Hủy crush thất bại');
    } finally { setRemoving(false); }
  };

  const partner = (() => {
    if (!match) return null;
    const u1 = match.user1Id; const u2 = match.user2Id;
    const uid = String(userId);
    if (u1 && (String(u1._id||u1._id||u1) === uid)) return u2;
    return u1;
  })();

  return (
    <div className="min-h-screen bg-[#fff5f8] pt-24">
      <ConfirmModal 
        isOpen={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)} 
        onConfirm={handleRemove}
        loading={removing}
      />
      
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-rose-600 mb-6">Crush Bí Mật của bạn</h1>

        {loading ? (
          <div className="text-slate-500">Đang tải...</div>
        ) : match && partner ? (
          <div className="rounded-2xl border-2 border-rose-200 p-6 shadow-lg" style={{ boxShadow: '0 6px 30px rgba(249, 168, 184, 0.18)' }}>
            <div className="flex items-center gap-4">
              <img src={partner.avatar || '/placeholder-avatar.png'} alt={partner.name} className="h-24 w-24 rounded-xl object-cover border-4 border-rose-50" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-800">{partner.name}</h2>
                <p className="text-sm text-rose-400 mt-1">{partner.university || partner.school || 'HUST'}</p>
                <p className="text-sm text-slate-600 mt-2">{partner.bio || partner.hometown || ''}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => navigate('/messenger')} className="rounded-full px-4 py-2 text-sm border border-rose-100 hover:bg-rose-50">Tới Match List</button>
              <button 
                onClick={() => setShowConfirmModal(true)} 
                disabled={removing} 
                className="rounded-full bg-rose-500 px-4 py-2 text-sm text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removing ? 'Đang hủy...' : 'Hủy Crush Bí Mật'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center">
            <p className="text-slate-700 mb-4">Bạn chưa chọn crush bí mật nào.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => navigate('/messenger')} className="rounded-full bg-rose-500 px-4 py-2 text-sm text-white">Tới BK Crush / Match List</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
