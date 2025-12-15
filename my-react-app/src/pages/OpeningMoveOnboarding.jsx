import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export default function OpeningMoveOnboarding({ onComplete }) {
  const storedUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const userId = storedUser?.id || storedUser?._id;

  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchMoves = async () => {
      try {
        const headers = {};
        const token = sessionStorage.getItem('accessToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/api/opening-moves?active=1`, { credentials: 'include', headers });
        const payload = await res.json();
        if (!mounted) return;
        if (payload?.data) setMoves(payload.data);
      } catch (e) {
        console.error('Failed to load opening moves', e);
        toast.error('Không thể tải câu hỏi mở.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMoves();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async () => {
    if (!API_URL || !userId) {
      toast.error('Thiếu cấu hình hoặc chưa đăng nhập.');
      return;
    }
    setSaving(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = sessionStorage.getItem('accessToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/users/${userId}/opening-move`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify({ selectedOpeningMove: selected || null }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || 'Lỗi server');
      toast.success('Lưu lựa chọn thành công');
      if (typeof onComplete === 'function') onComplete(payload.user || null);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Không thể lưu lựa chọn');
    } finally {
      setSaving(false);
    }
  };

  const mapCategoryLabel = (cat) => {
    switch ((cat || '').toString()) {
      case 'HocThuat':
        return 'Học thuật';
      case 'SinhVien':
        return 'Sinh viên';
      case 'CoSoVatChat':
        return 'Cơ sở vật chất';
      case 'ThoiQuen':
        return 'Thói quen';
      default:
        return cat || '';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff5f8] p-6">
      <Toaster position="top-right" />
      <div className="max-w-xl w-full rounded-2xl bg-white/90 p-6 shadow-lg text-rose-600">
        <h1 className="text-2xl font-bold text-center">Chọn BK Opening Move!</h1>
        <p className="mt-3 text-center text-sm text-rose-400">Đây là câu hỏi đầu tiên bạn sẽ gửi cho Match. Đây là tùy chọn. Chọn một câu hỏi thú vị để bắt đầu cuộc trò chuyện đậm chất Bách khoa.</p>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Đang tải...</div>
          ) : (
            moves.map((m) => (
              <button
                key={m._id}
                onClick={() => setSelected(selected === m._id ? null : m._id)}
                className={`w-full text-left rounded-xl border p-4 transition ${selected === m._id ? 'border-rose-500 bg-rose-50' : 'border-rose-100 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-rose-600">{mapCategoryLabel(m.category)}</div>
                    <div className="mt-1 text-sm text-slate-700">{m.text}</div>
                  </div>
                  {selected === m._id && (
                    <div className="flex items-center text-rose-500">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-full bg-gradient-to-br from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] px-4 py-3 text-white font-semibold shadow-md hover:scale-[1.01] disabled:opacity-60"
          >
            Hoàn tất &amp; Bắt đầu Quẹt
          </button>
        </div>
      </div>
    </div>
  );
}
