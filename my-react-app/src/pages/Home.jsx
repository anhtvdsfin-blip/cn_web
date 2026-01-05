import toast, { Toaster } from 'react-hot-toast';
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Heart,
  MapPin,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  X as XIcon,
  SlidersHorizontal,
} from 'lucide-react';
import OtherProfileCard from '../components/OtherProfileCard';
import ConfirmModal from '../components/ConfirmModal';
import InputModal from '../components/InputModal';

const API_URL = import.meta.env.VITE_API_URL;

export default function Home() {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch (error) {
      console.error('Cannot parse user from session storage', error);
      return {};
    }
  }, []);

  const navigate = useNavigate();

  const userId = storedUser?.id || storedUser?._id;
  const [matchQueue, setMatchQueue] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [history, setHistory] = useState([]);
  // const [matchQueue] = useState(SAMPLE_PROFILES);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isLoadingDeck, setIsLoadingDeck] = useState(Boolean(API_URL && userId));
  const [deckError, setDeckError] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  // Filters state for Search Metrics panel
  const [filters, setFilters] = useState({
    distance: 3,
    ageMin: 18,
    ageMax: 25,
    heightMin: 150,
    heightMax: 175,
    cohortMin: 60,
    cohortMax: 69,
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [pendingActionType, setPendingActionType] = useState(null);

  const activeProfile = matchQueue[activeIndex];
  const deferredProfile = useDeferredValue(activeProfile);
  const displayProfile = deferredProfile || activeProfile;
  const photos = useMemo(() => {
    if (!displayProfile) return [];
    const imageList = Array.isArray(displayProfile.images) ? displayProfile.images : [];
    if (imageList.length > 0) {
      return imageList.slice(0, 6);
    }
    if (typeof displayProfile.avatar === 'string' && displayProfile.avatar.trim().length > 0) {
      return [displayProfile.avatar];
    }
    return [];
  }, [displayProfile]);

  const finderDistance = storedUser?.preferences?.distance || storedUser?.preferredDistance || 'Trong 3km';
  const finderAgeRange = useMemo(() => {
    const preferred = storedUser?.preferredAgeRange;
    const agePreference = storedUser?.preferences?.ageRange;
    if (preferred) return preferred;
    if (agePreference && (Number.isFinite(agePreference.min) || Number.isFinite(agePreference.max))) {
      const min = Number.isFinite(agePreference.min) ? agePreference.min : '?';
      const max = Number.isFinite(agePreference.max) ? agePreference.max : '?';
      return `${min} - ${max} tuổi`;
    }
    return '20 - 25 tuổi';
  }, [storedUser?.preferredAgeRange, storedUser?.preferences?.ageRange]);

  useEffect(() => {
    if (!API_URL || !userId) {
      return;
    }

    const controller = new AbortController();
    let abortControllerRef = controller;

    const fetchDeck = async () => {
      setIsLoadingDeck(true);
      setDeckError('');
      setActionError('');

      try {
        // build url with applied filters
        const params = new URLSearchParams();
        if (appliedFilters.distance != null) params.append('distance', appliedFilters.distance);
        if (appliedFilters.ageRange) {
          if (appliedFilters.ageRange.min != null) params.append('ageMin', appliedFilters.ageRange.min);
          if (appliedFilters.ageRange.max != null) params.append('ageMax', appliedFilters.ageRange.max);
        }
        if (appliedFilters.heightRange) {
          if (appliedFilters.heightRange.min != null) params.append('heightMin', appliedFilters.heightRange.min);
          if (appliedFilters.heightRange.max != null) params.append('heightMax', appliedFilters.heightRange.max);
        }
        if (appliedFilters.cohortRange) {
          if (appliedFilters.cohortRange.min != null) params.append('cohortMin', appliedFilters.cohortRange.min);
          if (appliedFilters.cohortRange.max != null) params.append('cohortMax', appliedFilters.cohortRange.max);
        }
        const url = `${API_URL}/api/findlove/${userId}/deck${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          signal: abortControllerRef.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = payload?.message || 'Không thể tải dữ liệu tìm kiếm.';
          throw new Error(message);
        }

        const payload = await response.json();
        const deck = Array.isArray(payload?.data) ? payload.data : [];

        setMatchQueue(deck);
        setActiveIndex(0);
        setHistory([]);
      } catch (error) {
        if (abortControllerRef.signal.aborted) return;
        console.error('Fetch swipe deck failed:', error);
        setDeckError(error.message || 'Không thể tải dữ liệu tìm kiếm.');
      } finally {
        if (!abortControllerRef.signal.aborted) {
          setIsLoadingDeck(false);
        }
      }
    };

    fetchDeck();

    // Expose fetchDeck to window for manual refresh
    window.__refreshDeck = fetchDeck;

    return () => {
      controller.abort();
      delete window.__refreshDeck;
    };
  }, [API_URL, userId, appliedFilters]);

  // Function to manually refresh deck
  const refreshDeck = () => {
    if (window.__refreshDeck) {
      window.__refreshDeck();
    }
  };

  useEffect(() => {
    setPhotoIndex(0);
    setShowMenu(false);
  }, [activeIndex]);

  useEffect(() => {
    if (API_URL) {
      return;
    }
    setDeckError('Thiếu cấu hình API. Vui lòng kiểm tra VITE_API_URL.');
    setIsLoadingDeck(false);
  }, [API_URL]);

  useEffect(() => {
    if (!API_URL || userId) {
      return;
    }
    setDeckError('Không tìm thấy thông tin người dùng. Hãy đăng nhập lại để tiếp tục.');
    setIsLoadingDeck(false);
  }, [API_URL, userId]);

  const submitSwipe = async (targetId, action) => {
    if (!API_URL || !userId) return;

    const response = await fetch(`${API_URL}/api/findlove/${userId}/swipe`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetId, action }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload?.message || 'Không thể lưu hành động swiping.';
      throw new Error(message);
    }
  };

  const handleNext = async (action) => {
    if (!activeProfile || isProcessingAction) return;

    setActionError('');

    try {
      setIsProcessingAction(true);
      await submitSwipe(activeProfile.id, action);
      startTransition(() => {
        setHistory((prev) => [{ profile: activeProfile, action }, ...prev.slice(0, 4)]);

        if (activeIndex + 1 >= matchQueue.length) {
          setActiveIndex(matchQueue.length);
        } else {
          setActiveIndex((prev) => prev + 1);
        }
      });
    } catch (error) {
      console.error('Submit swipe failed:', error);
      setActionError(error.message || 'Không thể lưu hành động swiping.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRewind = () => {
    if (history.length === 0) return;
    const [last, ...rest] = history;
    const previousIndex = matchQueue.findIndex((profile) => profile.id === last.profile.id);
    if (previousIndex >= 0) {
      startTransition(() => {
        setActiveIndex(previousIndex);
        setHistory(rest);
      });
      setActionError('');
    }
  };

  const handleNextPhoto = () => {
    const photos = activeProfile?.photos || [];
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = () => {
    const photos = activeProfile?.photos || [];
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const loadNextProfile = () => {
    if (activeIndex + 1 >= matchQueue.length) {
      startTransition(() => {
        setActiveIndex(matchQueue.length);
      });
    } else {
      startTransition(() => {
        setActiveIndex((prev) => prev + 1);
      });
    }
  };

  const handleBlockOrReport = async (type) => {
    if (!activeProfile || actionLoading) return;
    
    if (type === 'block') {
      setPendingActionType('block');
      setShowBlockConfirm(true);
    } else if (type === 'report') {
      setPendingActionType('report');
      setShowReportModal(true);
      setReportReason('');
    }
  };

  const executeBlockOrReport = async (type, reason = null) => {
    if (!activeProfile || actionLoading) return;
    const targetId = activeProfile.id;
    const blockerId = storedUser?.id;

    if (!blockerId) {
        toast.error("Vui lòng đăng nhập để thực hiện hành động này.");
        return;
    }
    
    const endpointPath = type === 'block' ? `block/${targetId}` : `report/${targetId}`;
    const apiUrl = `${API_URL}/api/users/${endpointPath}`;
    
    const requestBody = {
        blockerId: blockerId,
        reporterId: blockerId,
        reason: reason || undefined,
    };

    setActionLoading(true);
    setShowMenu(false);

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Yêu cầu thất bại từ Server');
        }

        const message = type === 'block' ? `Đã chặn ${activeProfile.name} thành công.` : `Đã gửi báo cáo về ${activeProfile.name}.`;
        
        toast.success(message); 
        
        setHistory((prev) => [{ profile: activeProfile, action: type }, ...prev.slice(0, 4)]);
        loadNextProfile();

    } catch (error) {
        console.error("API Error:", error);
        toast.error(`Thao tác thất bại: ${error.message || 'Lỗi kết nối Server.'}`);
    } finally {
        setActionLoading(false);
    }
  };
  const statusMessage = useMemo(() => {
    if (isPending) {
      return 'Đang chuyển hồ sơ mới...';
    }
    if (!API_URL) {
      return 'Thiếu cấu hình API. Vui lòng kiểm tra VITE_API_URL.';
    }
    if (!userId) {
      return 'Không tìm thấy thông tin người dùng. Hãy đăng nhập lại để tiếp tục.';
    }
    if (isLoadingDeck) {
      return 'Đang tải danh sách tương hợp cho bạn...';
    }
    if (deckError) {
      return deckError;
    }
    if (actionError) {
      return actionError;
    }
    if (!displayProfile) {
      return '🎉 Hết profile rồi! Quay lại sau để gặp thêm người mới nhé ~';
    }
    switch (history[0]?.action) {
      case 'like':
        return 'Bạn đã gửi một trái tim. Hãy xem điều kỳ diệu có xảy ra không nhé!';
      case 'nope':
        return 'Không sao cả, người dành cho bạn đang ở rất gần thôi.';
      default:
        return `${Math.max(0, matchQueue.length - activeIndex - 1)} profile đang đợi bạn khám phá.`;
    }
  }, [API_URL, actionError, activeIndex, deckError, displayProfile, history, isLoadingDeck, isPending, matchQueue.length, userId]);

  const showProfileDetails = photoIndex === 0;

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-[#fff5f8]">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center px-4 pt-24 pb-16">
          <div className="flex w-full max-w-md flex-col items-center text-center text-sm text-rose-500/80">
            <span className="font-medium uppercase tracking-[0.35em]">find love</span>
            <p className="mt-2 text-[15px] text-rose-600/90">
              Chào bạn, những nhịp tim mới đang chờ bạn ngay hôm nay 💕
            </p>
          </div>

          <div className="mt-12 flex w-full flex-1">
            {/* Mobile floating buttons */}
            <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-3 lg:hidden">
              <button
                onClick={() => setShowMobileFilters(true)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-600"
                aria-label="Bộ lọc"
              >
                <SlidersHorizontal className="h-6 w-6" />
              </button>
              <button
                onClick={() => setShowMobileNotifications(true)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-rose-500 shadow-lg hover:bg-rose-50 border border-rose-100"
                aria-label="Sự kiện"
              >
                <Sparkles className="h-6 w-6" />
              </button>
            </div>

            {/* Mobile Filters Modal */}
            {showMobileFilters && (
              <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setShowMobileFilters(false)}>
                <div 
                  className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-white p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-rose-500">Bộ lọc tìm kiếm</h3>
                    <button onClick={() => setShowMobileFilters(false)} className="text-rose-400 hover:text-rose-600">
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Distance */}
                    <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-500/90">Khoảng cách</span>
                        <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">Trong {filters.distance}km</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={filters.distance}
                        onChange={(e) => setFilters(prev => ({ ...prev, distance: Number(e.target.value) }))}
                        className="mt-3 w-full accent-rose-500"
                      />
                    </div>

                    {/* Age */}
                    <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-500/90">Độ tuổi</span>
                        <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">{filters.ageMin} - {filters.ageMax >= 30 ? '30+' : filters.ageMax} tuổi</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="range"
                          min="18"
                          max="60"
                          value={filters.ageMin}
                          onChange={(e) => setFilters(prev => ({ ...prev, ageMin: Math.min(Number(e.target.value), prev.ageMax - 1) }))}
                          className="w-full accent-rose-500"
                        />
                        <input
                          type="range"
                          min="18"
                          max="60"
                          value={filters.ageMax}
                          onChange={(e) => setFilters(prev => ({ ...prev, ageMax: Math.max(Number(e.target.value), prev.ageMin + 1) }))}
                          className="w-full accent-rose-500"
                        />
                      </div>
                    </div>

                    {/* Height */}
                    <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-500/90">Chiều cao</span>
                        <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">{filters.heightMin}cm - {filters.heightMax >= 190 ? '190+' : filters.heightMax}cm</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="range"
                          min="140"
                          max="210"
                          value={filters.heightMin}
                          onChange={(e) => setFilters(prev => ({ ...prev, heightMin: Math.min(Number(e.target.value), prev.heightMax - 1) }))}
                          className="w-full accent-rose-500"
                        />
                        <input
                          type="range"
                          min="140"
                          max="210"
                          value={filters.heightMax}
                          onChange={(e) => setFilters(prev => ({ ...prev, heightMax: Math.max(Number(e.target.value), prev.heightMin + 1) }))}
                          className="w-full accent-rose-500"
                        />
                      </div>
                    </div>

                    {/* Cohort */}
                    <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-500/90">Khóa</span>
                        <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">K{filters.cohortMin} - K{filters.cohortMax}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="range"
                          min="60"
                          max="69"
                          value={filters.cohortMin}
                          onChange={(e) => setFilters(prev => ({ ...prev, cohortMin: Math.min(Number(e.target.value), prev.cohortMax) }))}
                          className="w-full accent-rose-500"
                        />
                        <input
                          type="range"
                          min="60"
                          max="69"
                          value={filters.cohortMax}
                          onChange={(e) => setFilters(prev => ({ ...prev, cohortMax: Math.max(Number(e.target.value), prev.cohortMin) }))}
                          className="w-full accent-rose-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          const payload = {
                            distance: filters.distance,
                            ageRange: { min: filters.ageMin, max: filters.ageMax },
                            heightRange: { min: filters.heightMin, max: filters.heightMax },
                            cohortRange: { min: filters.cohortMin, max: filters.cohortMax }
                          };
                          setAppliedFilters(payload);
                          setShowMobileFilters(false);
                        }}
                        className="flex-1 rounded-full bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600"
                      >
                        Áp dụng
                      </button>
                      <button
                        onClick={() => setShowMobileFilters(false)}
                        className="flex-1 rounded-full border border-rose-100 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Notifications Modal */}
            {showMobileNotifications && (
              <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setShowMobileNotifications(false)}>
                <div 
                  className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-[28px] bg-white p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-rose-500">HUST Community</h3>
                    <button onClick={() => setShowMobileNotifications(false)} className="text-rose-400 hover:text-rose-600">
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-rose-100 bg-white p-4">
                      <span className="text-[11px] uppercase tracking-[0.3em] text-rose-300">Upcoming events</span>
                      <p className="mt-2 text-sm font-semibold text-slate-800">Robotics Workshop</p>
                      <p className="text-xs text-slate-500">TQB Library · 08/12 · 18:00</p>
                      <button className="mt-4 w-full rounded-full bg-rose-500/90 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-200 transition hover:bg-rose-500">
                        Thêm vào lịch
                      </button>
                    </div>

                    <div className="rounded-[24px] border border-rose-100 bg-white p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">BK Crush</h4>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">
                        Khám phá ai đang bí mật crush bạn và gửi lời nhắn dễ thương chỉ trong 1 chạm.
                      </p>
                      <button
                        onClick={() => {
                          setShowMobileNotifications(false);
                          navigate('/your-crush');
                        }}
                        className="mt-4 w-full rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-100"
                      >
                        Mở BK Crush
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid w-full flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)_280px] lg:gap-10">
              <aside className="hidden w-full max-w-[280px] flex-col gap-6 rounded-[28px] border border-rose-100/70 bg-white/80 p-6 text-sm text-rose-500 shadow-[0_18px_40px_-30px_rgba(188,144,255,0.6)] lg:flex">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-400/80">Search metrics</h3>
                  <div className="mt-5">
                    {!showFilters ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-[20px] border border-rose-100 bg-white px-4 py-3 text-xs text-slate-600">
                          <span className="font-semibold text-rose-500/90">Khoảng cách</span>
                          <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">Trong {filters.distance}km</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[20px] border border-rose-100 bg-white px-4 py-3 text-xs text-slate-600">
                          <span className="font-semibold text-rose-500/90">Độ tuổi</span>
                          <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">{filters.ageMin} - {filters.ageMax >= 30 ? '30+' : filters.ageMax} tuổi</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[20px] border border-rose-100 bg-white px-4 py-3 text-xs text-slate-600">
                          <span className="font-semibold text-rose-500/90">Chiều cao</span>
                          <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">{filters.heightMin}cm - {filters.heightMax >= 190 ? '190+' : filters.heightMax}cm</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[20px] border border-rose-100 bg-white px-4 py-3 text-xs text-slate-600">
                          <span className="font-semibold text-rose-500/90">Khóa</span>
                          <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">K{filters.cohortMin} - K{filters.cohortMax}</span>
                        </div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => setShowFilters(true)}
                            className="mt-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                          >
                            Sửa bộ lọc
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Distance */}
                        <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-rose-500/90">Khoảng cách</span>
                            <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">Trong {filters.distance}km</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={filters.distance}
                            onChange={(e) => setFilters(prev => ({ ...prev, distance: Number(e.target.value) }))}
                            className="mt-3 w-full accent-rose-500"
                          />
                        </div>

                        {/* Age */}
                        <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-rose-500/90">Độ tuổi</span>
                            <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">{filters.ageMin} - {filters.ageMax >= 30 ? '30+' : filters.ageMax} tuổi</span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="range"
                              min="18"
                              max="60"
                              value={filters.ageMin}
                              onChange={(e) => setFilters(prev => ({ ...prev, ageMin: Math.min(Number(e.target.value), prev.ageMax - 1) }))}
                              className="w-full accent-rose-500"
                            />
                            <input
                              type="range"
                              min="18"
                              max="60"
                              value={filters.ageMax}
                              onChange={(e) => setFilters(prev => ({ ...prev, ageMax: Math.max(Number(e.target.value), prev.ageMin + 1) }))}
                              className="w-full accent-rose-500"
                            />
                          </div>
                        </div>

                        {/* Height */}
                        <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-rose-500/90">Chiều cao</span>
                            <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">{filters.heightMin}cm - {filters.heightMax >= 190 ? '190+' : filters.heightMax}cm</span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="range"
                              min="140"
                              max="210"
                              value={filters.heightMin}
                              onChange={(e) => setFilters(prev => ({ ...prev, heightMin: Math.min(Number(e.target.value), prev.heightMax - 1) }))}
                              className="w-full accent-rose-500"
                            />
                            <input
                              type="range"
                              min="140"
                              max="210"
                              value={filters.heightMax}
                              onChange={(e) => setFilters(prev => ({ ...prev, heightMax: Math.max(Number(e.target.value), prev.heightMin + 1) }))}
                              className="w-full accent-rose-500"
                            />
                          </div>
                        </div>

                        {/* Cohort (Khóa) */}
                        <div className="rounded-[20px] border border-rose-100 bg-white px-4 py-4 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-rose-500/90">Khóa</span>
                            <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-500">K{filters.cohortMin} - K{filters.cohortMax}</span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="range"
                              min="60"
                              max="69"
                              value={filters.cohortMin}
                              onChange={(e) => setFilters(prev => ({ ...prev, cohortMin: Math.min(Number(e.target.value), prev.cohortMax) }))}
                              className="w-full accent-rose-500"
                            />
                            <input
                              type="range"
                              min="60"
                              max="69"
                              value={filters.cohortMax}
                              onChange={(e) => setFilters(prev => ({ ...prev, cohortMax: Math.max(Number(e.target.value), prev.cohortMin) }))}
                              className="w-full accent-rose-500"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const payload = {
                                distance: filters.distance,
                                ageRange: { min: filters.ageMin, max: filters.ageMax },
                                heightRange: { min: filters.heightMin, max: filters.heightMax },
                                cohortRange: { min: filters.cohortMin, max: filters.cohortMax }
                              };
                              setAppliedFilters(payload);
                              setShowFilters(false);
                            }}
                            className="mt-2 flex-1 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600"
                          >
                            Áp dụng
                          </button>
                          <button
                            onClick={() => setShowFilters(false)}
                            className="mt-2 flex-1 rounded-full bg-white border border-rose-100 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              <div className="flex w-full justify-center">
                <div className="flex w-full max-w-md flex-col items-center gap-10">
                  <div className="relative w-full">
                    <div className="relative mx-auto overflow-hidden rounded-[36px] border border-rose-100 bg-white/90 shadow-[0_30px_80px_-60px_rgba(233,114,181,0.65)]">
                      {displayProfile ? (
                        <OtherProfileCard profile={displayProfile} onBlocked={() => loadNextProfile()} />
                      ) : (
                        <>
                          <div className="flex h-[82vh] flex-col items-center justify-center gap-5 text-center">
                            <div className="rounded-full bg-white/60 p-6 text-rose-400 shadow-inner">
                              <Heart className="h-12 w-12" />
                            </div>
                            <div className="max-w-md text-rose-500">
                              <h3 className="text-2xl font-semibold">Bạn đã khám phá tất cả hôm nay rồi ✨</h3>
                              <p className="mt-3 text-sm leading-relaxed text-rose-400">
                                Hãy quay lại vào lúc khác để gặp thêm những tâm hồn đẹp nhé!
                              </p>
                              <button
                                onClick={refreshDeck}
                                disabled={isLoadingDeck}
                                className="mt-6 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {isLoadingDeck ? 'Đang tải...' : '🔄 Tải lại danh sách'}
                              </button>
                            </div>
                          </div>
                          {deckError && (
                            <div className="max-w-md text-rose-500">
                              <h3 className="text-2xl font-semibold">Không thể tải profile ✨</h3>
                              <p className="mt-3 text-sm leading-relaxed text-rose-400">{deckError}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center justify-center gap-8">
                      <button
                        onClick={() => handleNext('nope')}
                        disabled={!activeProfile || isProcessingAction || isLoadingDeck}
                        className="group flex h-16 w-16 items-center justify-center rounded-full bg-white text-rose-300 shadow-[0_12px_30px_-18px_rgba(244,114,182,0.6)] transition hover:scale-105 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Không phải gu của bạn"
                      >
                        <XIcon className="h-8 w-8 transition group-hover:scale-110" />
                      </button>
                      <button
                        onClick={handleRewind}
                        disabled={history.length === 0}
                        className="group flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-amber-400 shadow-[0_10px_30px_-18px_rgba(251,191,36,0.5)] transition hover:scale-105 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Quay lại profile trước"
                      >
                        <RotateCcw className="h-6 w-6 transition group-hover:rotate-[-12deg]" />
                      </button>
                      <button
                        onClick={() => handleNext('like')}
                        disabled={!activeProfile || isProcessingAction || isLoadingDeck}
                        className="group flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#f7b0d2] via-[#f59fb6] to-[#fdd2b7] text-white shadow-[0_25px_65px_-30px_rgba(244,114,182,0.75)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
                        aria-label="Gửi trái tim"
                      >
                        <Heart className="h-9 w-9 fill-current transition group-hover:scale-110" />
                      </button>
                    </div>

                    <p className="text-center text-sm font-medium text-rose-500/90">{statusMessage}</p>

                    {history.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold text-rose-400/90">
                        {history.map(({ profile, action }) => (
                          <span
                            key={`${profile.id}-${action}`}
                            className="rounded-full bg-white/60 px-3 py-1 backdrop-blur-sm"
                          >
                            {profile.name} · {action === 'like' ? 'đã nhận trái tim' : action === 'block' ? 'đã bị chặn' : action === 'report' ? 'đã bị báo cáo' : 'đã lướt qua'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside className="hidden w-full max-w-[280px] flex-col gap-6 rounded-[28px] border border-rose-100/70 bg-white/80 p-6 text-sm text-rose-500 shadow-[0_18px_40px_-30px_rgba(188,144,255,0.6)] lg:flex">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-400/80">HUST community</h3>
                  <div className="mt-4 rounded-[24px] border border-rose-100 bg-white p-4">
                    <span className="text-[11px] uppercase tracking-[0.3em] text-rose-300">Upcoming events</span>
                    <p className="mt-2 text-sm font-semibold text-slate-800">Robotics Workshop</p>
                    <p className="text-xs text-slate-500">TQB Library · 08/12 · 18:00</p>
                    <button className="mt-4 w-full rounded-full bg-rose-500/90 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-200 transition hover:bg-rose-500">
                      Thêm vào lịch
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-rose-100 bg-white p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">BK Crush</h4>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    Khám phá ai đang bí mật crush bạn và gửi lời nhắn dễ thương chỉ trong 1 chạm.
                  </p>
                  <button
                    onClick={() => navigate('/your-crush')}
                    className="mt-4 w-full rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-100"
                  >
                    Mở BK Crush
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <ConfirmModal
          title={`Chặn ${activeProfile?.name}?`}
          message="Bạn sẽ không bao giờ thấy hồ sơ này nữa. Hành động này không thể hoàn tác."
          type="danger"
          onConfirm={() => {
            setShowBlockConfirm(false);
            executeBlockOrReport('block');
          }}
          onCancel={() => {
            setShowBlockConfirm(false);
            setPendingActionType(null);
          }}
        />
      )}

      {/* Report Modal - Input reason */}
      {showReportModal && (
        <InputModal
          title={`Báo cáo ${activeProfile?.name}`}
          message="Vui lòng cho biết lý do báo cáo (không bắt buộc)"
          placeholder="Nhập lý do..."
          value={reportReason}
          onChange={(value) => setReportReason(value)}
          onSubmit={() => {
            setShowReportModal(false);
            executeBlockOrReport('report', reportReason);
          }}
          onCancel={() => {
            setShowReportModal(false);
            setPendingActionType(null);
            setReportReason('');
          }}
        />
      )}
    </>
  );
}
