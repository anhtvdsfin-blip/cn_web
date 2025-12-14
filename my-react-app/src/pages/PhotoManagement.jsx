import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GripVertical, Plus, X } from 'lucide-react';
import Navbar from '../components/Navbar';

const MAX_PHOTOS = 6;
const MIN_REQUIRED = 1;

const pastelBackground = 'bg-[#fff5f8]';

const buildInitialSlots = () => Array.from({ length: MAX_PHOTOS }, () => null);

function revokePreviewUrl(item) {
  if (item?.preview && item.preview.startsWith('blob:')) {
    URL.revokeObjectURL(item.preview);
  }
}

export default function PhotoManagement() {
  const [slots, setSlots] = useState(buildInitialSlots);
  const [pendingSlot, setPendingSlot] = useState(-1);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL;
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch (error) {
      console.error('Cannot parse user from session storage', error);
      return {};
    }
  }, []);
  const userId = storedUser?.id || storedUser?._id;

  const isEditMode = useMemo(
    () => location.pathname.includes('/profile'),
    [location.pathname],
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState('neutral');

  useEffect(() => () => {
    slots.forEach(revokePreviewUrl);
  }, [slots]);

  const populateSlots = useCallback((photos) => {
    setSlots(() => {
      const next = buildInitialSlots();
      photos.slice(0, MAX_PHOTOS).forEach((photo, index) => {
        if (!photo) return;
        next[index] = {
          name: `Ảnh ${index + 1}`,
          size: 0,
          preview: photo,
          data: photo,
          isRemote: true,
        };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const preloadedPhotos = Array.isArray(storedUser?.photoGallery) ? storedUser.photoGallery : [];
    if (preloadedPhotos.length) {
      populateSlots(preloadedPhotos);
    }

    if (!userId || !API_URL) {
      setIsLoading(false);
      if (!userId) {
        setStatusMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
        setStatusTone('error');
      }
      return;
    }

    const fetchUserPhotos = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users/${userId}/profile`, {
          withCredentials: true,
        });
        const user = response.data?.user;
        const gallery = Array.isArray(user?.photoGallery) ? user.photoGallery : [];
        if (gallery.length) {
          populateSlots(gallery);
        }
      } catch (error) {
        console.error('Không thể tải album ảnh', error);
        setStatusMessage('Không thể tải album ảnh.');
        setStatusTone('error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPhotos();
  }, [API_URL, populateSlots, storedUser?.photoGallery, userId]);

  const uploadedCount = useMemo(
    () => slots.filter(Boolean).length,
    [slots]
  );

  const handleOpenPicker = useCallback((index) => {
    setPendingSlot(index);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || pendingSlot < 0) {
      setPendingSlot(-1);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setPendingSlot(-1);
        return;
      }
      setSlots((prev) => {
        const next = [...prev];
        const previous = next[pendingSlot];
        revokePreviewUrl(previous);
        next[pendingSlot] = {
          name: file.name,
          size: file.size,
          preview: result,
          data: result,
          isRemote: false,
        };
        return next;
      });
      setPendingSlot(-1);
    };
    reader.onerror = () => {
      setPendingSlot(-1);
      setStatusMessage('Không thể đọc file ảnh. Vui lòng thử lại.');
      setStatusTone('error');
    };
    reader.readAsDataURL(file);
  }, [pendingSlot]);

  const handleRemove = useCallback((index) => {
    setSlots((prev) => {
      const next = [...prev];
      revokePreviewUrl(next[index]);
      next[index] = null;
      return next;
    });
  }, []);

  const isContinueDisabled = uploadedCount < MIN_REQUIRED;

  const handleContinue = useCallback(async () => {
    if (isContinueDisabled || !userId || !API_URL || isSaving) {
      if (!userId) {
        setStatusMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
        setStatusTone('error');
      }
      return;
    }

    const payloadPhotos = slots.filter(Boolean).map((item) => item?.data).filter(Boolean);
    if (payloadPhotos.length < MIN_REQUIRED) {
      setStatusMessage('Bạn cần ít nhất 1 ảnh để tiếp tục.');
      setStatusTone('error');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      const response = await axios.put(
        `${API_URL}/api/users/${userId}/profile`,
        {
          photoGallery: payloadPhotos,
          avatar: payloadPhotos[0] || '',
        },
        { withCredentials: true },
      );

      const updatedUser = response.data?.user;
      if (updatedUser) {
        const nextSessionUser = {
          ...storedUser,
          ...updatedUser,
          photoGallery: payloadPhotos,
          avatar: payloadPhotos[0] || updatedUser.avatar || '',
        };
        sessionStorage.setItem('user', JSON.stringify(nextSessionUser));
        window.dispatchEvent(new Event('userChanged'));
      }

      setStatusTone('success');
      setStatusMessage(isEditMode ? 'Album ảnh đã được cập nhật.' : 'Album ảnh đã lưu, chuẩn bị khám phá nhé!');
      navigate(isEditMode ? '/profile' : '/feed', { replace: true });
    } catch (error) {
      console.error('Không thể lưu album ảnh', error);
      setStatusTone('error');
      setStatusMessage(error.response?.data?.message || 'Không thể lưu album ảnh.');
    } finally {
      setIsSaving(false);
    }
  }, [API_URL, isContinueDisabled, isEditMode, isSaving, navigate, slots, storedUser, userId]);

  const headerMeta = useMemo(
    () => ({
      stepLabel: isEditMode ? null : 'Bước 2/3',
      title: isEditMode ? 'Quản Lý Album Ảnh Hồ Sơ' : 'Tạo Album Ảnh Ấn Tượng',
      subtitle: 'Ảnh sẽ được cắt theo tỉ lệ 3:4 để phù hợp với thẻ Match.',
      footerNote: isEditMode
        ? 'Ảnh hồ sơ sẽ được hiển thị cho các đối tượng phù hợp.'
        : 'Đã hoàn thành Bước 2 trong hành trình onboarding của bạn.',
      continueLabel: isEditMode ? 'Lưu & quay lại hồ sơ' : 'Tiếp tục',
    }),
    [isEditMode],
  );

  if (isLoading) {
    return (
      <div className={`min-h-screen ${pastelBackground}`}>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center px-6 text-rose-500">
          Đang tải album ảnh...
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${pastelBackground}`}>
      <Navbar />
      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-4xl flex-col px-6 pb-16 pt-24 text-rose-700 md:pt-28">
        <header className="mb-14 text-center">
          {headerMeta.stepLabel ? (
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-rose-400">
              {headerMeta.stepLabel}
            </p>
          ) : (
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-300">Album hồ sơ</p>
          )}
          <h1 className="mt-3 text-3xl font-semibold text-rose-700 md:text-4xl">
            {headerMeta.title}
          </h1>
          <p className="mt-4 text-sm text-rose-500">
            {headerMeta.subtitle}
          </p>
        </header>

        <main className="flex flex-1 flex-col gap-10">
          <section className="rounded-[28px] border border-rose-100 bg-white p-7 shadow-[0_18px_60px_-40px_rgba(233,114,181,0.55)]">
            <div className="mb-6 flex items-center justify-between text-sm text-rose-500">
              <span className="font-semibold text-rose-600">
                {uploadedCount}/{MAX_PHOTOS} ảnh đã tải lên
              </span>
              {isEditMode ? (
                <span className="text-xs uppercase tracking-[0.32em] text-rose-300">
                  Nhấn giữ biểu tượng kéo để sắp xếp
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              {slots.map((item, index) => (
                <div
                  key={`slot-${index}`}
                  className="group relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[26px] border border-rose-100 bg-rose-50/50 transition hover:border-rose-200 hover:shadow-[0_16px_38px_-30px_rgba(233,114,181,0.55)]"
                >
                  {item ? (
                    <>
                      <img
                        src={item.preview}
                        alt={item.name}
                        className="h-full w-full object-cover will-change-transform"
                      />
                      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/35 via-black/8 to-black/40 opacity-0 transition group-hover:opacity-100">
                        <div className="flex items-center justify-between px-4 pt-4 text-white/80">
                          <button
                            type="button"
                            onClick={() => handleRemove(index)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/35 text-white transition hover:bg-white/70 hover:text-rose-500"
                            aria-label="Xóa ảnh"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/35 text-white">
                            <GripVertical className="h-4 w-4" />
                          </span>
                        </div>
                        <div className="px-4 pb-4 text-xs text-white/80">
                          {item.name}
                        </div>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenPicker(index)}
                      className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[26px] bg-gradient-to-br from-white via-white to-rose-50 text-rose-400 transition hover:scale-[1.015] hover:text-rose-500"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow-sm">
                        <Plus className="h-7 w-7" />
                      </span>
                      <span className="text-sm font-semibold">Thêm ảnh</span>
                      <span className="text-[11px] uppercase tracking-[0.28em] text-rose-300">
                        slot {index + 1}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="mt-10 flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-rose-500">
            <p>{headerMeta.footerNote}</p>
            {!isEditMode && (
              <p className="hidden text-xs uppercase tracking-[0.32em] text-rose-300 md:block">
                Bước 2/3
              </p>
            )}
          </div>
          {statusMessage && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                statusTone === 'success'
                  ? 'border-teal-200 bg-teal-50 text-teal-600'
                  : statusTone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-500'
                  : 'border-rose-100 bg-white text-rose-500'
              }`}
            >
              {statusMessage}
            </div>
          )}
          <button
            type="button"
            disabled={isContinueDisabled}
            onClick={handleContinue}
            className="h-14 rounded-full bg-gradient-to-r from-[#f7b0d2] via-[#f6a5c1] to-[#fdd2b7] text-base font-semibold text-white shadow-[0_25px_65px_-30px_rgba(244,114,182,0.65)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : headerMeta.continueLabel}
          </button>
        </footer>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
