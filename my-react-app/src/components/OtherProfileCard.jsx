import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  GraduationCap,
  MapPin,
  MoonStar,
  Ruler,
  Sparkles,
  Venus,
  VenusAndMars,
  X,
  Mars,
  Briefcase,
  MoreHorizontal,
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import InputModal from './InputModal';

function InfoTag({ children }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
      <Sparkles className="h-3.5 w-3.5 text-teal-500" />
      {children}
    </span>
  );
}

function SimpleTag({ children }) {
  return (
    <span className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-medium text-teal-600 shadow-sm">
      {children}
    </span>
  );
}

export default function OtherProfileCard({ profile, onBlocked }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const photos = useMemo(() => {
    if (!profile) {
      return [];
    }
    if (Array.isArray(profile.images) && profile.images.length > 0) {
      return profile.images.slice(0, 6);
    }
    return [];
  }, [profile]);

  useEffect(() => {
    setPhotoIndex(0);
    setIsExpanded(false);
  }, [profile?.id]);

  if (!profile) {
    return null;
  }

  const summary = profile.summary || profile.fullBio || '';
  const fullBio = profile.fullBio || summary;
  const courses = Array.isArray(profile.courses) ? profile.courses : [];
  const interests = Array.isArray(profile.interests) ? profile.interests : [];
  const rawConnectionGoal = profile.connectionGoal || profile.connectionGoalKey || '';
  const connectionGoal = rawConnectionGoal;
  const connectionGoalLabels = {
    study: 'Học cùng nhau',
    friendship: 'Kết bạn mới',
    relationship: 'Quan hệ nghiêm túc',
  };
  const connectionGoalLabel = connectionGoalLabels[connectionGoal] || (connectionGoal ? connectionGoal : 'Kết nối mới');
  const parseHeight = (val) => {
    if (val == null) return null;
    if (typeof val === 'number') {
      return Number.isFinite(val) && val > 0 ? val : null;
    }
    const cleaned = String(val).replace(/[^0-9\-]/g, '');
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const heightValue = parseHeight(profile.height);
  const hasHeight = heightValue != null;
  const position = profile.position || profile.occupation || profile.job || profile.title || '';
  const genderLabels = {
    Male: 'Nam',
    Female: 'Nữ',
    Other: 'Khác',
  };
  const genderIcons = {
    Male: Mars,
    Female: Venus,
    Other: VenusAndMars,
  };
  const normalizedGender = profile.gender && genderLabels[profile.gender] ? profile.gender : 'Other';
  const GenderIcon = genderIcons[normalizedGender];
  const genderLabel = genderLabels[normalizedGender];
  const zodiacLabel = typeof profile.zodiac === 'string' && profile.zodiac.trim().length > 0
    ? profile.zodiac.trim()
    : '';

  const moveTo = (direction) => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => {
      if (direction === 'prev') {
        return (prev - 1 + photos.length) % photos.length;
      }
      return (prev + 1) % photos.length;
    });
  };
  const isPrimaryPhoto = photoIndex === 0;
  const detailOverlayVisibility = isPrimaryPhoto ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0';
  const gradientVisibility = isPrimaryPhoto ? 'opacity-100' : 'opacity-0';

  const CollapsedCarousel = () => {
    if (photos.length === 0) {
      return null;
    }

    return (
      <div className="absolute inset-0">
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${photoIndex * 100}%)` }}
        >
          {photos.map((photoUrl, index) => (
            <img
              key={`${profile.id}-photo-${index}`}
              src={photoUrl}
              alt={`${profile.name} ${index + 1}`}
              loading="lazy"
              className="h-full w-full flex-shrink-0 object-cover"
            />
          ))}
        </div>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => moveTo('prev')}
              className="absolute inset-y-0 left-0 w-1/3 rounded-l-[36px] bg-gradient-to-r from-black/20 to-transparent opacity-0 transition hover:opacity-80 focus-visible:opacity-80"
              aria-label="Xem ảnh trước"
            />
            <button
              type="button"
              onClick={() => moveTo('next')}
              className="absolute inset-y-0 right-0 w-1/3 rounded-r-[36px] bg-gradient-to-l from-black/20 to-transparent opacity-0 transition hover:opacity-80 focus-visible:opacity-80"
              aria-label="Xem ảnh tiếp theo"
            />
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <article className="relative mx-auto flex h-full min-h-[84vh] max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[36px] border border-rose-100/70 bg-rose-100/5 shadow-[0_30px_80px_-60px_rgba(233,114,181,0.7)] aspect-[9/18]">
        <CollapsedCarousel />
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-rose-950/75 via-rose-900/25 to-transparent transition-opacity duration-300 ease-out ${gradientVisibility}`} />
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-rose-900/20 via-rose-900/5 to-transparent transition-opacity duration-300 ease-out ${gradientVisibility}`} />

        {photos.length > 1 && (
          <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 gap-2">
            {photos.map((_, index) => (
              <span
                key={`${profile.id}-indicator-${index}`}
                className={`h-[3px] w-12 rounded-full transition ${index === photoIndex ? 'bg-white/95' : 'bg-white/35'}`}
              />
            ))}
          </div>
        )}

        <div
          className={`absolute inset-x-0 bottom-0 z-20 p-8 text-white transition-all duration-300 ease-out md:p-8 ${detailOverlayVisibility}`}
        >
          <div className="flex flex-wrap items-baseline gap-3 text-[2.4rem] font-semibold tracking-tight leading-[1.05] md:text-[2.7rem]">
            <h2>{profile.name}</h2>
            <div className="flex-shrink-0 -translate-y-1">
              <span className="inline-flex h-9 items-center justify-center rounded-full bg-white/20 px-3 text-base font-medium text-white/90">
                {profile.age}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-teal-100">
            <span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-teal-50/95">
              <GraduationCap className="h-4 w-4 text-teal-100" />
              {profile.major} · {profile.classYear}
            </span>
            {hasHeight && (
              <span className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-rose-50/95">
                <Ruler className="h-4 w-4" />
                {profile.height} cm
              </span>
            )}
            {genderLabel && (
              <span className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-rose-50/95">
                <GenderIcon className="h-4 w-4" />
                {genderLabel}
              </span>
            )}
            {zodiacLabel && (
              <span className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-rose-50/95">
                <MoonStar className="h-4 w-4" />
                {zodiacLabel}
              </span>
            )}
          </div>

          {isPrimaryPhoto && (
            <>
              <p className="mt-6 max-w-xl whitespace-pre-line break-words text-base leading-relaxed text-rose-50/95">
                {summary}
              </p>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/90 backdrop-blur-sm transition hover:scale-[1.03]"
              >
                Xem thêm
                <ChevronDown className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {!isPrimaryPhoto && (
          <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/90 backdrop-blur-sm transition hover:scale-[1.03]"
            >
              Xem thêm
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </article>

      {isExpanded && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-rose-950/55 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-rose-100 bg-white shadow-[0_32px_120px_-60px_rgba(233,114,181,0.65)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-rose-50" aria-hidden="true" />
            <div className="relative p-7">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm transition hover:bg-rose-50"
                aria-label="Đóng chi tiết"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col gap-6 overflow-y-auto pt-4" style={{ maxHeight: '80vh' }}>
              <header className="border-b border-rose-100 pb-5">
                <div className="flex flex-wrap items-end gap-3 text-3xl font-semibold tracking-tight text-slate-900">
                  <h3>{profile.name}</h3>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-base font-medium text-rose-600 shadow-sm">{profile.age}</span>
                </div>
                <p className="mt-3 text-sm font-medium uppercase tracking-[0.35em] text-rose-400">HUST vibes</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                  <span className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-teal-700 shadow-sm">
                    <GraduationCap className="h-4 w-4 text-teal-500" />
                    {profile.major} · {profile.classYear}
                  </span>
                  {position && (
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-rose-500 shadow-sm">
                      <Briefcase className="h-4 w-4 text-rose-400" />
                      {position}
                    </span>
                  )}
                  {hasHeight && (
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-rose-500 shadow-sm">
                      <Ruler className="h-4 w-4 text-rose-400" />
                      {heightValue} cm
                    </span>
                  )}
                  {genderLabel && (
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-rose-500 shadow-sm">
                      <GenderIcon className="h-4 w-4 text-rose-400" />
                      {genderLabel}
                    </span>
                  )}
                  {zodiacLabel && (
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-rose-500 shadow-sm">
                      <MoonStar className="h-4 w-4 text-rose-400" />
                      {zodiacLabel}
                    </span>
                  )}
                </div>
              </header>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">Bio đầy đủ</h4>
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{fullBio}</p>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">Địa điểm</h4>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {profile.location} · {profile.distance}
                </p>
              </section>

              {courses.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">Danh sách môn học</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {courses.map((course) => (
                      <SimpleTag key={course}>{course}</SimpleTag>
                    ))}
                  </div>
                </section>
              )}

              {interests.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">Sở thích</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <InfoTag key={interest}>{interest}</InfoTag>
                    ))}
                  </div>
                </section>
              )}

              {connectionGoalLabel && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">Mục tiêu kết nối</h4>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{connectionGoalLabel}</p>
                </section>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      <InputModal
        isOpen={showReportModal}
        onClose={() => { setShowReportModal(false); setReportText(''); }}
        title={`Báo cáo ${profile.name}`}
        message="Vui lòng mô tả lý do bạn báo cáo người này."
        placeholder="Nội dung báo cáo (không bắt buộc)"
        confirmText="Gửi báo cáo"
        cancelText="Hủy"
        value={reportText}
        onChange={setReportText}
        onSubmit={async (reason) => {
          try {
            setActionLoading(true);
            const API_URL = import.meta.env.VITE_API_URL;
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${API_URL}/api/users/report/${profile.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ reason }),
            });
            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              throw new Error(payload?.message || 'Không thể gửi báo cáo.');
            }
            toast.success('Báo cáo của bạn đã được gửi.');
            setReportText('');
          } catch (err) {
            console.error('report error', err);
            toast.error(err.message || 'Không thể gửi báo cáo.');
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <ConfirmModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        title={`Chặn ${profile.name}?`}
        message="Người dùng này sẽ bị chặn và bạn sẽ không thấy họ nữa."
        confirmText="Chặn và ẩn"
        cancelText="Hủy"
        type="danger"
        onConfirm={async () => {
          try {
            setActionLoading(true);
            const API_URL = import.meta.env.VITE_API_URL;
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${API_URL}/api/users/block/${profile.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });
            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              throw new Error(payload?.message || 'Không thể chặn người dùng.');
            }
            toast.success('Người dùng đã bị chặn.');
            setShowBlockConfirm(false);
            if (typeof onBlocked === 'function') onBlocked(profile.id);
          } catch (err) {
            console.error('block error', err);
            toast.error(err.message || 'Không thể chặn người dùng.');
          } finally {
            setActionLoading(false);
          }
        }}
      />

        <div className="absolute top-4 right-4 z-30">
          <div className="relative">
            <button
              onClick={() => setShowMenu((s) => !s)}
              aria-label="More options"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white/90 shadow-sm hover:scale-105"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-rose-100 bg-white text-rose-700 shadow-lg">
                <button
                  onClick={() => { setShowMenu(false); setShowReportModal(true); }}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 disabled:opacity-60"
                >
                  Báo cáo người dùng
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowBlockConfirm(true);
                  }}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  Chặn người dùng
                </button>
              </div>
            )}
          </div>
        </div>
    </>
  );
}
