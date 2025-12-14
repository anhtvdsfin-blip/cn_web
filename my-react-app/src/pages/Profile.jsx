import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  MapPin,
  Home,
  Sparkles,
  Target,
  Users,
  Ruler,
} from 'lucide-react';

const pastelGradient = 'bg-[#fff5f8]';

const defaultForm = {
  name: '',
  age: '',
  height: '',
  gender: '',
  career: '',
  classYear: '',
  location: '',
  hometown: '',
  zodiac: '',
  lookingFor: 'Tất cả',
  ageRange: { min: 18, max: 30 },
  bio: '',
  hobbies: [],
  photoGallery: [],
};

const genderOptions = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
  { value: 'Khác', label: 'Khác' },
];

const facultyOptions = [
  'Cơ Khí',
  'Công Nghệ Thông Tin',
  'Điện - Điện tử',
  'Kinh Tế & Quản Lý',
  'Ngoại Ngữ',
  'Hóa Học',
  'Vật Lý Kỹ Thuật',
  'Kiến Trúc',
  'Máy Và Tự Động',
  'Công Nghệ Sinh Học',
];

const classYearOptions = ['K65', 'K66', 'K67', 'K68', 'K69', 'K70', 'Khác'];

const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 220;

const normalizeHeightValue = (value, { asString = false } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return asString ? '' : null;
  }
  const truncated = Math.trunc(numeric);
  if (truncated < MIN_HEIGHT_CM || truncated > MAX_HEIGHT_CM) {
    return asString ? '' : null;
  }
  return asString ? String(truncated) : truncated;
};

export default function Profile() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  const currentUser = useMemo(
    () => JSON.parse(sessionStorage.getItem('user') || '{}'),
    [],
  );

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState(defaultForm);
  const [photoIndex, setPhotoIndex] = useState(0);
  const normalizedHeight = useMemo(
    () => normalizeHeightValue(formData.height),
    [formData.height],
  );
  const heightStatus = useMemo(() => {
    if (!formData.height) {
      return {
        helper: `Nhập chiều cao thực tế (${MIN_HEIGHT_CM}-${MAX_HEIGHT_CM} cm).`,
        isError: false,
      };
    }
    if (normalizedHeight === null) {
      return {
        helper: `Chiều cao hợp lệ từ ${MIN_HEIGHT_CM}-${MAX_HEIGHT_CM} cm.`,
        isError: true,
      };
    }
    return {
      helper: 'Chiều cao sẽ hiển thị công khai trong hồ sơ.',
      isError: false,
    };
  }, [formData.height, normalizedHeight]);
  const steps = useMemo(
    () => [
      {
        id: 'basic-info',
        label: 'Thông tin cơ bản',
        description: 'Tên hiển thị, tuổi, vị trí và lời giới thiệu.',
        icon: Users,
      },
      {
        id: 'connections',
        label: 'Sở thích & mục tiêu',
        description: 'Sở thích và đối tượng mong muốn.',
        icon: Heart,
      },
      {
        id: 'academic',
        label: 'Học thuật HUST',
        description: 'Khoa, khóa học và câu chuyện học thuật.',
        icon: BookOpen,
      },
    ],
    [],
  );
  const [currentStep, setCurrentStep] = useState(0);
  const completionMetrics = useMemo(() => {
    const checklist = [
      {
        id: 'photo',
        label: 'Ảnh đại diện',
        completed: formData.photoGallery.length > 0,
      },
      {
        id: 'basic',
        label: 'Thông tin cơ bản',
        completed: Boolean(
          formData.name &&
          formData.gender &&
          formData.hometown.trim() &&
          formData.bio.trim() &&
          normalizedHeight,
        ),
      },
      {
        id: 'connections',
        label: 'Sở thích & mục tiêu',
        completed: formData.hobbies.length > 0,
      },
      {
        id: 'academic',
        label: 'Học thuật HUST',
        completed: Boolean(formData.career && formData.career !== 'Not updated'),
      },
    ];
    const total = checklist.length;
    const completedCount = checklist.filter((item) => item.completed).length;
    const percent = Math.round((completedCount / total) * 100);
    return { checklist, completedCount, total, percent };
  }, [formData]);
  const displayLocation = useMemo(() => {
    const current = typeof formData.location === 'string' && formData.location !== 'Not updated' && formData.location.trim().length > 0
      ? formData.location
      : '';
    const fallback = typeof profile?.location === 'string' && profile.location !== 'Not updated' && profile.location.trim().length > 0
      ? profile.location
      : '';
    return current || fallback || 'nơi chưa rõ';
  }, [formData.location, profile]);
  const displayHometown = useMemo(() => {
    const sanitize = (value) =>
      typeof value === 'string' && value !== 'Not updated' && value.trim().length > 0
        ? value.trim()
        : '';
    const current = sanitize(formData.hometown);
    const fallback = sanitize(profile?.hometown);
    return current || fallback || 'quê quán chưa rõ';
  }, [formData.hometown, profile]);
  const stepCompletion = useMemo(
    () => ({
      'basic-info': Boolean(
        formData.name &&
        formData.gender &&
        formData.hometown.trim() &&
        formData.bio.trim() &&
        normalizedHeight,
      ),
      
      connections:
        Array.isArray(formData.hobbies) && formData.hobbies.length > 0 &&
        typeof formData.lookingFor === 'string' && formData.lookingFor.trim().length > 0,
      academic: Boolean(formData.career && formData.classYear),
    }),
    [formData],
  );
  const currentStepMeta = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const contentRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id && !currentUser?._id) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const userId = currentUser.id || currentUser._id;
        const res = await axios.get(`${API_URL}/api/users/${userId}/profile`);
        const user = res.data?.user;
        setProfile(user);

        const hobbies = Array.isArray(user?.hobbies)
          ? user.hobbies
          : typeof user?.hobbies === 'string'
          ? user.hobbies.split(',').map((item) => item.trim()).filter(Boolean)
          : [];
        const gallery = Array.isArray(user?.photoGallery) ? user.photoGallery : [];

        setFormData({
          name: user?.name || '',
          age: user?.age || '',
          height: normalizeHeightValue(user?.height, { asString: true }),
          gender: user?.gender || '',
          career: user?.career && user.career !== 'Not updated' ? user.career : '',
          classYear: user?.classYear && user.classYear !== 'Not updated' ? user.classYear : '',
          location: user?.location && user.location !== 'Not updated' ? user.location : '',
          hometown: user?.hometown && user.hometown !== 'Not updated' ? user.hometown : '',
          zodiac: user?.zodiac || '',
          lookingFor: user?.lookingFor || user?.preferences?.lookingFor || 'Tất cả',
          ageRange: user?.ageRange || user?.preferences?.ageRange || { min: 18, max: 30 },
          bio: user?.bio || '',
          hobbies,
          photoGallery: gallery.length > 0 ? gallery : user?.avatar ? [user.avatar] : [],
        });
        setPhotoIndex(0);
      } catch (error) {
        console.error('Lỗi khi tải profile:', error);
        setMessage('Không thể tải thông tin hồ sơ.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [API_URL, currentUser, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined' || !contentRef.current) {
      return;
    }
    const offsetTop = contentRef.current.offsetTop - 120;
    window.scrollTo({
      top: offsetTop > 0 ? offsetTop : 0,
      behavior: 'smooth',
    });
  }, [currentStep]);


  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleHeightInputChange = (value) => {
    const sanitized = value.replace(/[^0-9]/g, '').slice(0, 3);
    setFormData((prev) => ({
      ...prev,
      height: sanitized,
    }));
  };

  const handleAgeRangeChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      ageRange: {
        ...prev.ageRange,
        [field]: value,
      },
    }));
  };

  const handleAddTag = (field, rawValue) => {
    const value = rawValue.trim();
    if (!value) {
      return;
    }
    setFormData((prev) => {
      if (prev[field].includes(value)) {
        return prev;
      }
      return {
        ...prev,
        [field]: [...prev[field], value].slice(0, 20),
      };
    });
  };

  const handleRemoveTag = (field, target) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item !== target),
    }));
  };

  const handlePhotoNavigate = (direction) => {
    if (formData.photoGallery.length <= 1) {
      return;
    }
    setPhotoIndex((prev) => {
      if (direction === 'next') {
        return (prev + 1) % formData.photoGallery.length;
      }
      return (prev - 1 + formData.photoGallery.length) % formData.photoGallery.length;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const userId = currentUser.id || currentUser._id;
    if (!userId) {
      setMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      return;
    }

    const normalizedHeightForSubmit = normalizeHeightValue(formData.height);
    if (normalizedHeightForSubmit === null) {
      setMessage(`Chiều cao phải nằm trong khoảng ${MIN_HEIGHT_CM}-${MAX_HEIGHT_CM} cm.`);
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        age: formData.age,
        gender: formData.gender,
        height: normalizedHeightForSubmit,
        career: formData.career.trim(),
        classYear: formData.classYear.trim(),
        location: formData.location.trim(),
        hometown: formData.hometown.trim(),
        zodiac: formData.zodiac.trim(),
        lookingFor: formData.lookingFor,
        ageRange: formData.ageRange,
        bio: formData.bio.trim(),
        hobbies: formData.hobbies,
        photoGallery: formData.photoGallery,
        avatar: formData.photoGallery[0] || profile?.avatar || '',
      };

      const res = await axios.put(`${API_URL}/api/users/${userId}/profile`, payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });

      const nextUser = res.data?.user;
      if (!nextUser) {
        throw new Error('Server không trả về dữ liệu người dùng.');
      }

      setProfile(nextUser);
      setFormData((prev) => ({
        ...prev,
        height:
          normalizeHeightValue(nextUser.height, { asString: true }) || prev.height,
        photoGallery: Array.isArray(nextUser.photoGallery) ? nextUser.photoGallery : prev.photoGallery,
      }));
      const storedHeight = normalizeHeightValue(nextUser.height) ?? normalizedHeightForSubmit;
      sessionStorage.setItem(
        'user',
        JSON.stringify({
          ...(currentUser || {}),
          ...nextUser,
          id: nextUser.id || nextUser._id,
          _id: nextUser._id || nextUser.id,
          avatar: nextUser.avatar || payload.avatar,
          hometown: nextUser.hometown || payload.hometown || currentUser.hometown || '',
          location: nextUser.location || payload.location || currentUser.location || '',
          height: storedHeight,
        }),
      );
      window.dispatchEvent(new Event('userChanged'));
      setIsEditing(false);
      setMessage('Cập nhật hồ sơ thành công.');
    } catch (error) {
      console.error('Lỗi khi cập nhật hồ sơ:', error);
      const serverMessage = error.response?.data?.message || error.message || 'Không thể cập nhật hồ sơ.';
      setMessage(serverMessage);
    }
  };

  const handleStepSelect = (index) => {
    setCurrentStep(index);
  };

  const handleNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const renderTagList = (field, emptyLabel, accent) => {
    if (!formData[field]?.length) {
      return <span className="text-sm text-slate-400">{emptyLabel}</span>;
    }
    return formData[field].map((item) => (
      <span
        key={item}
        className={`group inline-flex items-center gap-2 rounded-full border ${accent.border} ${accent.bg} px-3 py-1 text-sm font-medium ${accent.text}`}
      >
        {item}
        {isEditing && (
          <button
            type="button"
            onClick={() => handleRemoveTag(field, item)}
            className="rounded-full border border-transparent p-1 text-inherit transition group-hover:border-current"
          >
            x
          </button>
        )}
      </span>
    ));
  };

  const renderStepContent = () => {
    if (!currentStepMeta) {
      return null;
    }

    if (currentStepMeta.id === 'basic-info') {
      return (
        <section className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-white/95 p-6 shadow-sm shadow-rose-100/60">
          <div className="absolute -right-16 -top-20 h-40 w-40 rounded-full bg-rose-100/50 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 shadow-sm shadow-rose-200">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Thông tin cơ bản</h2>
                  <p className="text-xs text-slate-500">Giúp mọi người nhanh chóng hiểu về bạn.</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
                Bước {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Users className="h-3.5 w-3.5" /> Tên hiển thị
                </span>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                  placeholder="Tên mà bạn muốn mọi người gọi"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Sparkles className="h-3.5 w-3.5" /> Tuổi
                </span>
                <input
                  type="number"
                  min={18}
                  max={99}
                  disabled={!isEditing}
                  value={formData.age}
                  onChange={(event) => handleFieldChange('age', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                  placeholder="Ví dụ: 21"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Ruler className="h-3.5 w-3.5" /> Chiều cao (cm)
                </span>
                <div className="relative">
                  <Ruler className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isEditing}
                    value={formData.height}
                    onChange={(event) => handleHeightInputChange(event.target.value)}
                    className={`w-full rounded-3xl border ${heightStatus.isError ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-rose-100 focus:border-rose-300 focus:ring-rose-100'} bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:outline-none disabled:cursor-not-allowed`}
                    placeholder={`${MIN_HEIGHT_CM}-${MAX_HEIGHT_CM}`}
                  />
                </div>
                <p className={`text-xs ${heightStatus.isError ? 'text-rose-500' : 'text-slate-400'}`}>
                  {heightStatus.helper}
                </p>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Heart className="h-3.5 w-3.5" /> Giới tính
                </span>
                <select
                  disabled={!isEditing}
                  value={formData.gender}
                  onChange={(event) => handleFieldChange('gender', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                >
                  <option value="">Chọn giới tính</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Home className="h-3.5 w-3.5" /> Quê quán
                </span>
                <div className="relative">
                  <Home className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.hometown}
                    onChange={(event) => handleFieldChange('hometown', event.target.value)}
                    className="w-full rounded-3xl border border-rose-100 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                    placeholder="Ví dụ: Hải Phòng, Nghệ An..."
                  />
                </div>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <MapPin className="h-3.5 w-3.5" /> Nơi sinh sống
                </span>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.location}
                    onChange={(event) => handleFieldChange('location', event.target.value)}
                    className="w-full rounded-3xl border border-rose-100 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                    placeholder="Ví dụ: KTX Bách Khoa, Hai Bà Trưng"
                  />
                </div>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600 md:col-span-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Sparkles className="h-3.5 w-3.5" /> Giới thiệu bản thân
                </span>
                <textarea
                  rows={4}
                  disabled={!isEditing}
                  value={formData.bio}
                  onChange={(event) => handleFieldChange('bio', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                  placeholder="Chia sẻ đôi nét về tính cách, sở thích hoặc câu chuyện của bạn."
                />
              </label>
            </div>
          </div>
        </section>
      );
    }

    if (currentStepMeta.id === 'connections') {
      return (
        <section className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-white/95 p-6 shadow-sm shadow-rose-100/60">
          <div className="absolute -right-24 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-rose-50 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 shadow-sm shadow-rose-200">
                  <Heart className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Sở thích & mục tiêu</h2>
                  <p className="text-xs text-slate-500">Chia sẻ điều bạn tìm kiếm và hoạt động yêu thích.</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
                Bước {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Target className="h-3.5 w-3.5" /> Đối tượng mong muốn
                </span>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.lookingFor}
                  onChange={(event) => handleFieldChange('lookingFor', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                  placeholder="Ví dụ: Kết bạn, đồng hành học tập"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Sparkles className="h-3.5 w-3.5" /> Cung hoàng đạo
                </span>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.zodiac}
                  onChange={(event) => handleFieldChange('zodiac', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                  placeholder="Ví dụ: Ma Kết"
                />
              </label>
              <div className="space-y-3 text-sm font-semibold text-slate-600 md:col-span-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Target className="h-3.5 w-3.5" /> Độ tuổi mong muốn
                </span>
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex-1">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                      <span>Min</span>
                      <input
                        type="number"
                        min={18}
                        max={formData.ageRange.max}
                        disabled={!isEditing}
                        value={formData.ageRange.min}
                        onChange={(event) => handleAgeRangeChange('min', Number(event.target.value))}
                        className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                        placeholder="Từ"
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                      <span>Max</span>
                      <input
                        type="number"
                        min={formData.ageRange.min}
                        max={99}
                        disabled={!isEditing}
                        value={formData.ageRange.max}
                        onChange={(event) => handleAgeRangeChange('max', Number(event.target.value))}
                        className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                        placeholder="Đến"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-600">Sở thích nổi bật</p>
                <div className="flex flex-wrap gap-2">
                  {renderTagList(
                    'hobbies',
                    'Chưa thêm sở thích',
                    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600' },
                  )}
                </div>
                {isEditing && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddTag('hobbies', event.currentTarget.value);
                          event.currentTarget.value = '';
                        }
                      }}
                      className="flex-1 rounded-3xl border border-rose-100 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
                      placeholder="Nhập sở thích và nhấn Enter"
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        const input = event.currentTarget.previousElementSibling;
                        if (input && input.value) {
                          handleAddTag('hobbies', input.value);
                          input.value = '';
                        }
                      }}
                      className="rounded-3xl bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-200/70 transition hover:scale-[1.02]"
                    >
                      Thêm
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (currentStepMeta.id === 'academic') {
      return (
        <section className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-white/95 p-6 shadow-sm shadow-rose-100/60">
          <div className="absolute -left-20 -bottom-16 h-44 w-44 rounded-full bg-rose-50 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 shadow-sm shadow-rose-200">
                  <BookOpen className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Học thuật HUST</h2>
                  <p className="text-xs text-slate-500">Những thông tin giúp kết nối với bạn học đồng môn.</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
                Bước {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <BookOpen className="h-3.5 w-3.5" /> Khoa đang học
                </span>
                <select
                  disabled={!isEditing}
                  value={formData.career}
                  onChange={(event) => handleFieldChange('career', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                >
                  <option value="">Chọn khoa đang học</option>
                  {facultyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-400">
                  <Sparkles className="h-3.5 w-3.5" /> Khóa học (K-Class)
                </span>
                <select
                  disabled={!isEditing}
                  value={formData.classYear}
                  onChange={(event) => handleFieldChange('classYear', event.target.value)}
                  className="w-full rounded-3xl border border-rose-100 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed"
                >
                  <option value="">Chọn khóa học</option>
                  {classYearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-sm text-slate-500">
              Cập nhật đúng khoa và khóa học giúp hệ thống gợi ý bạn bè đồng môn chính xác hơn.
            </p>
          </div>
        </section>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className={`${pastelGradient} min-h-screen`}>
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center text-rose-500">
          <Sparkles className="mr-3 h-5 w-5 animate-spin" />
          Đang tải hồ sơ...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`${pastelGradient} min-h-screen`}>
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center text-rose-500">
          <span className="text-xl font-semibold">Không tìm thấy hồ sơ</span>
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="mt-6 rounded-full bg-rose-400 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-200/60 transition hover:bg-rose-500"
          >
            Quay lại trang chính
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${pastelGradient} min-h-screen pb-24 pt-28`}>
      <Navbar />
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="rounded-[32px] border border-rose-100 bg-white p-8 shadow-[0_24px_60px_-40px_rgba(233,114,181,0.45)]">
          <header className="relative rounded-[28px] border border-rose-100 bg-white p-8 shadow-[0_18px_45px_-35px_rgba(233,114,181,0.4)]">
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1.5fr,1fr] lg:items-center">
              <div className="space-y-5 text-rose-950">
                <p className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">
                  <Heart className="h-4 w-4" /> Hồ sơ HUSTLove
                </p>
                <div className="space-y-3">
                  <h1 className="text-3xl font-extrabold leading-tight md:text-4xl">
                    Chào {formData.name || profile?.name || 'bạn'}, cùng tạo nên hồ sơ thật ấn tượng nhé!
                  </h1>
                  <p className="text-sm font-medium text-rose-700">
                    Chia sẻ câu chuyện của bạn theo từng bước. Hệ thống sẽ định hướng để bạn được ghép đôi chuẩn nhất trong cộng đồng sinh viên HUST.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-rose-700/80">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2">
                    <Sparkles className="h-4 w-4" /> Hồ sơ càng đầy đủ càng dễ được chú ý
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2">
                    <MapPin className="h-4 w-4" /> Bạn đang ở {displayLocation}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2">
                    <Home className="h-4 w-4" /> Đến từ {displayHometown}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2">
                    <Ruler className="h-4 w-4" />
                    {normalizedHeight ? `${normalizedHeight} cm` : 'Chiều cao chưa cập nhật'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4 rounded-[24px] border border-rose-100 bg-white p-6 text-sm text-rose-700 shadow-[0_12px_32px_-26px_rgba(233,114,181,0.45)]">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.22em] text-rose-400">
                  <span>Tiến độ</span>
                  <span className="text-sm font-semibold text-rose-600">{completionMetrics.percent}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-rose-100/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 transition-all"
                    style={{ width: `${completionMetrics.percent}%` }}
                  />
                </div>
                <div className="text-xs text-rose-600">
                  Bước hiện tại: <span className="font-semibold">{currentStepMeta?.label}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-5 py-2 font-semibold text-rose-600 shadow-sm transition hover:bg-white"
                  >
                    {isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa hồ sơ'}
                  </button>
                  <span className="rounded-full bg-rose-100/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                    {isEditing ? 'Chế độ chỉnh sửa' : 'Chế độ xem'}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-8 grid gap-8 lg:grid-cols-[320px,1fr]">
            <aside className="space-y-6 rounded-[28px] border border-rose-100 bg-white p-6 shadow-[0_12px_32px_-26px_rgba(233,114,181,0.4)]">
              <div className="rounded-[24px] border border-rose-100 bg-white p-5 shadow-inner shadow-rose-100/40">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">Hành trình hồ sơ</p>
                <div className="mt-4 space-y-2">
                  {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = currentStep === index;
                    const isComplete = Boolean(stepCompletion[step.id]);
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => handleStepSelect(index)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-rose-300 bg-rose-50 shadow-sm'
                            : 'border-transparent bg-white hover:border-rose-200 hover:bg-rose-50'
                        }`}
                        aria-current={isActive}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span
                              className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                                isActive ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-500'
                              }`}
                            >
                              {isComplete ? (
                                <CheckCircle className="h-[20px] w-[20px]" strokeWidth={2.2} />
                              ) : (
                                <StepIcon className="h-[20px] w-[20px]" strokeWidth={2.2} />
                              )}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{step.label}</p>
                              <p className="text-xs text-slate-400">{step.description}</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-rose-300">0{index + 1}</span>
                        </div>
                        {isActive && (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
                            Đang mở
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-rose-100 bg-white p-6 text-center shadow-inner shadow-rose-100/60">
                <div className="flex items-center justify-between text-xs font-semibold text-rose-500">
                  <span>Ảnh hồ sơ</span>
                  <span>{formData.photoGallery.length} ảnh</span>
                </div>
                <div className="relative mx-auto mt-4 h-56 w-full max-w-xs overflow-hidden rounded-[24px] border-4 border-rose-200/70 bg-rose-50">
                  {formData.photoGallery.length ? (
                    <img
                      src={formData.photoGallery[photoIndex]}
                      alt={`Ảnh ${photoIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-rose-300">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-sm font-semibold">Thêm ảnh để tạo ấn tượng</span>
                    </div>
                  )}
                  {formData.photoGallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePhotoNavigate('prev')}
                        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-rose-400 shadow-sm transition hover:bg-white"
                        aria-label="Ảnh trước"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhotoNavigate('next')}
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-rose-400 shadow-sm transition hover:bg-white"
                        aria-label="Ảnh tiếp theo"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {formData.photoGallery.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {formData.photoGallery.map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        onClick={() => setPhotoIndex(index)}
                        className={`relative h-14 w-14 overflow-hidden rounded-2xl border-2 transition ${
                          index === photoIndex ? 'border-rose-400 shadow-lg shadow-rose-200/60' : 'border-transparent'
                        }`}
                      >
                        <img src={photo} alt={`Thumb ${index + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/profile/manage-photos')}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-rose-200/60 transition hover:scale-[1.02]"
                >
                  <Camera className="h-4 w-4" />
                  Quản lý album ảnh
                </button>
              </div>

              <div className="space-y-6 rounded-[28px] border border-rose-100 bg-white/95 p-5 text-left shadow-inner shadow-rose-200/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-400">Tiến độ hồ sơ</p>
                  <span className="text-sm font-semibold text-rose-500">{completionMetrics.percent}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-rose-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 transition-all"
                    style={{ width: `${completionMetrics.percent}%` }}
                  />
                </div>
                <div className="space-y-3 text-sm text-slate-600">
                  {completionMetrics.checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-rose-50/60 px-3 py-2">
                      <span>{item.label}</span>
                      <span className={`text-xs font-semibold ${item.completed ? 'text-teal-600' : 'text-rose-400'}`}>
                        {item.completed ? 'Đã xong' : 'Chưa xong'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <form ref={contentRef} onSubmit={handleSubmit} className="flex flex-col gap-10">
              {renderStepContent()}

              <footer className="rounded-[32px] border border-rose-100 bg-white/80 p-6 shadow-lg shadow-rose-100/60">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-slate-500">
                    <p className="font-semibold text-slate-700">{currentStepMeta?.label || 'Hồ sơ'}</p>
                    <p className="text-xs text-slate-400">
                      Hoàn tất từng bước để hồ sơ của bạn nổi bật trong mắt cộng đồng.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/feed')}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-100 px-5 py-2 text-sm font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Quay lại
                    </button>
                    {!isFirstStep && (
                      <button
                        type="button"
                        onClick={handlePreviousStep}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-100 px-5 py-2 text-sm font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Bước trước
                      </button>
                    )}
                    {!isLastStep && (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-rose-200/70 transition hover:bg-rose-600"
                      >
                        Tiếp tục
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                    {isEditing && (
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-rose-200/60 transition hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-rose-200"
                      >
                        Lưu Hồ Sơ
                        <Sparkles className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-rose-400">
                  <a href="/tokens" className="transition hover:text-rose-500 hover:underline">
                    Quản lý Token (Thiết bị)
                  </a>
                  <a href="/safety" className="transition hover:text-rose-500 hover:underline">
                    Báo cáo / Chặn người dùng
                  </a>
                </div>
                {message && (
                  <div
                    className={`mt-6 rounded-2xl border px-5 py-3 text-sm font-semibold ${
                      message.includes('thành công')
                        ? 'border-teal-200 bg-teal-50 text-teal-600'
                        : 'border-rose-200 bg-rose-50 text-rose-500'
                    }`}
                  >
                    {message}
                  </div>
                )}
              </footer>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
