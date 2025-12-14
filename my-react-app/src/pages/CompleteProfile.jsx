import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Heart,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  Briefcase,
  Users,
  Compass,
  Camera,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Plus,
  X,
  Tag,
  Target,
  BookOpen,
  GraduationCap,
  Ruler,
} from 'lucide-react';

const steps = [
  {
    id: 'basics',
    title: 'Thông tin cơ bản',
    subtitle: 'Giúp mọi người cảm nhận bạn nhanh hơn',
    icon: Users,
  },
  {
    id: 'connections',
    title: 'Sở thích & Mục tiêu',
    subtitle: 'Chia sẻ điều bạn mong đợi từ HUSTLove',
    icon: Heart,
  },
  {
    id: 'academic',
    title: 'Thông tin học thuật',
    subtitle: 'Cho cộng đồng biết bạn đang học gì',
    icon: GraduationCap,
  },
];

const zodiacRanges = [
  { name: 'Bạch Dương', start: '03-21', end: '04-19' },
  { name: 'Kim Ngưu', start: '04-20', end: '05-20' },
  { name: 'Song Tử', start: '05-21', end: '06-20' },
  { name: 'Cự Giải', start: '06-21', end: '07-22' },
  { name: 'Sư Tử', start: '07-23', end: '08-22' },
  { name: 'Xử Nữ', start: '08-23', end: '09-22' },
  { name: 'Thiên Bình', start: '09-23', end: '10-22' },
  { name: 'Bọ Cạp', start: '10-23', end: '11-21' },
  { name: 'Nhân Mã', start: '11-22', end: '12-21' },
  { name: 'Ma Kết', start: '12-22', end: '01-19' },
  { name: 'Bảo Bình', start: '01-20', end: '02-18' },
  { name: 'Song Ngư', start: '02-19', end: '03-20' },
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
];

const classYearOptions = ['K65', 'K66', 'K67', 'K68', 'K69', 'Khác'];

const connectionGoalOptions = [
  {
    value: 'friendship',
    label: 'Kết bạn',
    description: 'Mở rộng vòng tròn bạn bè Bách khoa',
    icon: Users,
  },
  {
    value: 'relationship',
    label: 'Hẹn hò',
    description: 'Kết nối cảm xúc, tìm một nửa phù hợp',
    icon: Heart,
  },
];

const MIN_MATCHING_AGE = 18;
const MAX_MATCHING_AGE = 26;
const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 220;

const defaultForm = {
  gender: '',
  dob: '',
  career: '',
  classYear: '',
  location: '',
  geoLocation: null,
  bio: '',
  hobbies: [],
  height: '',
  zodiac: '',
  connectionGoal: '',
  academicHighlights: '',
  preferences: {
    lookingFor: 'All',
    ageRange: { min: 20, max: MAX_MATCHING_AGE },
    distance: 30,
  },
};

const getAgeFromDob = (dob) => {
  if (!dob) {
    return '';
  }
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) {
    return '';
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

const getZodiacFromDob = (dob) => {
  if (!dob) {
    return '';
  }
  const [year, month, day] = dob.split('-').map(Number);
  if (!year || !month || !day) {
    return '';
  }
  const formatted = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  for (const zodiac of zodiacRanges) {
    if (zodiac.start <= zodiac.end) {
      if (formatted >= zodiac.start && formatted <= zodiac.end) {
        return zodiac.name;
      }
    } else {
      if (formatted >= zodiac.start || formatted <= zodiac.end) {
        return zodiac.name;
      }
    }
  }
  return '';
};

const sanitizeText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const lowered = trimmed.toLowerCase();
  if (lowered === 'not updated' || lowered === 'unknown') {
    return '';
  }
  return trimmed;
};

const pickFirstText = (...candidates) => {
  for (const candidate of candidates) {
    const sanitized = sanitizeText(candidate);
    if (sanitized) {
      return sanitized;
    }
  }
  return '';
};

const sanitizeStringArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((item) => sanitizeText(item))
    .filter(Boolean);
};

const parseNumericValue = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return fallback;
};

const normalizeAgeRange = (range = {}) => {
  const { min, max } = range || {};
  let normalizedMin = Number.isFinite(min) ? Math.trunc(min) : MIN_MATCHING_AGE;
  let normalizedMax = Number.isFinite(max) ? Math.trunc(max) : MAX_MATCHING_AGE;

  if (normalizedMin < MIN_MATCHING_AGE) {
    normalizedMin = MIN_MATCHING_AGE;
  }
  if (normalizedMin > MAX_MATCHING_AGE - 1) {
    normalizedMin = MAX_MATCHING_AGE - 1;
  }

  if (normalizedMax > MAX_MATCHING_AGE) {
    normalizedMax = MAX_MATCHING_AGE;
  }
  if (normalizedMax <= normalizedMin) {
    normalizedMax = Math.min(MAX_MATCHING_AGE, normalizedMin + 1);
  }

  return {
    min: normalizedMin,
    max: normalizedMax,
  };
};

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

const formatDobForInput = (dobValue) => {
  if (!dobValue) {
    return '';
  }
  if (dobValue instanceof Date && Number.isFinite(dobValue.getTime())) {
    return dobValue.toISOString().split('T')[0];
  }
  if (typeof dobValue !== 'string') {
    return '';
  }
  const sanitized = sanitizeText(dobValue);
  if (!sanitized) {
    return '';
  }
  if (sanitized.includes('T')) {
    return sanitized.split('T')[0];
  }
  return sanitized;
};

const hydrateFormFromUser = (user) => {
  const sanitizedHobbies = sanitizeStringArray(user.hobbies);
  const normalizedHeight = normalizeHeightValue(user.height, { asString: true });

  return {
    gender: pickFirstText(user.gender),
    dob: formatDobForInput(user.dob),
    career: pickFirstText(user.faculty, user.career, user.job),
    classYear: pickFirstText(user.classYear, user.khoaHoc),
    location: pickFirstText(user.hometown, user.location),
    geoLocation: user.geoLocation || null,
    bio: pickFirstText(user.bio),
    hobbies: sanitizedHobbies,
    height: normalizedHeight,
    zodiac: pickFirstText(user.zodiac),
    connectionGoal: pickFirstText(
      user.connectionGoal,
      user.preferences?.connectionGoal,
      user.lookingForGoal,
    ),
    academicHighlights: pickFirstText(user.academicHighlights),
    preferences: {
      lookingFor:
        pickFirstText(
          user.preferences?.lookingFor,
          user.lookingFor,
          user.preferencesLookingFor,
        ) || 'All',
      ageRange: normalizeAgeRange({
        min: parseNumericValue(
          user.preferences?.ageRange?.min ?? user.preferenceAgeMin,
          20,
        ),
        max: parseNumericValue(
          user.preferences?.ageRange?.max ?? user.preferenceAgeMax,
          MAX_MATCHING_AGE,
        ),
      }),
      distance: parseNumericValue(
        user.preferences?.distance ?? user.preferenceDistance,
        30,
      ),
    },
  };
};

export default function CompleteProfile() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [hobbyInput, setHobbyInput] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(true);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const isDev = import.meta.env.DEV;
  const fileInputRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }

    let parsedUser;
    try {
      parsedUser = JSON.parse(stored);
    } catch (error) {
      console.error('Failed to parse user session', error);
      navigate('/login');
      return;
    }

    const sessionUser = parsedUser
      ? {
          ...parsedUser,
          height: normalizeHeightValue(parsedUser.height) ?? parsedUser.height,
          preferences: {
            ...(parsedUser.preferences || {}),
            ageRange: normalizeAgeRange(parsedUser.preferences?.ageRange),
          },
        }
      : null;

    if (sessionUser?.isProfileComplete) {
      setIsCheckingCompletion(false);
      navigate('/profile', { replace: true });
      return;
    }

    const userId = sessionUser?.id || sessionUser?._id;
    if (!userId) {
      navigate('/login');
      return;
    }

    const verifyProfileCompletion = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users/${userId}/profile`, {
          withCredentials: true,
        });
        const rawServerUser = response.data?.user;
        const serverUser = rawServerUser
          ? {
              ...rawServerUser,
              height: normalizeHeightValue(rawServerUser.height),
              preferences: {
                ...(rawServerUser.preferences || {}),
                ageRange: normalizeAgeRange(rawServerUser.preferences?.ageRange),
              },
            }
          : null;

        if (serverUser?.isProfileComplete) {
          sessionStorage.setItem('user', JSON.stringify({ ...sessionUser, ...serverUser }));
          setIsCheckingCompletion(false);
          navigate('/profile', { replace: true });
          return;
        }

        const mergedUser = serverUser ? { ...sessionUser, ...serverUser } : sessionUser;
        const hydrated = hydrateFormFromUser(mergedUser);
        setUser(mergedUser);
        setFormData((prev) => ({ ...prev, ...hydrated }));
        const initialPreview =
          mergedUser.avatar ||
          (Array.isArray(mergedUser.photoGallery) && mergedUser.photoGallery.length > 0
            ? mergedUser.photoGallery[0]
            : '');
        setPhotoPreview(initialPreview || '');
        setPhotoData(initialPreview || '');
      } catch (error) {
        console.error('Failed to verify profile completion', error);
        if (sessionUser?.isProfileComplete) {
          setIsCheckingCompletion(false);
          navigate('/profile', { replace: true });
          return;
        }
        setUser(sessionUser);
        setFormData((prev) => ({ ...prev, ...hydrateFormFromUser(sessionUser) }));
        const fallbackPreview =
          sessionUser?.avatar ||
          (Array.isArray(sessionUser?.photoGallery) && sessionUser.photoGallery.length > 0
            ? sessionUser.photoGallery[0]
            : '');
        setPhotoPreview(fallbackPreview || '');
        setPhotoData(fallbackPreview || '');
      } finally {
        setIsCheckingCompletion(false);
      }
    };

    verifyProfileCompletion();
  }, [API_URL, navigate]);

  const coordinatesForDisplay = useMemo(() => {
    const coords = formData.geoLocation?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      return null;
    }
    const [lng, lat] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null;
    }
    return { lat, lng };
  }, [formData.geoLocation]);

  const hasGeoLocation = useMemo(() => {
    if (!coordinatesForDisplay) {
      return false;
    }
    const { lat, lng } = coordinatesForDisplay;
    return Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001;
  }, [coordinatesForDisplay]);

  const locationCoordinateSummary = useMemo(() => {
    if (!coordinatesForDisplay) {
      return '';
    }
    const { lat, lng } = coordinatesForDisplay;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }, [coordinatesForDisplay]);

  const locationSummary = useMemo(() => {
    if (formData.location && formData.location !== 'Not updated') {
      return formData.location;
    }
    if (!coordinatesForDisplay) {
      return '';
    }
    const { lat, lng } = coordinatesForDisplay;
    return `Vĩ độ ${lat.toFixed(4)}, Kinh độ ${lng.toFixed(4)}`;
  }, [formData.location, coordinatesForDisplay]);

  const isGeolocationSupported = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  useEffect(() => {
    if (hasGeoLocation) {
      setLocationError('');
    }
  }, [hasGeoLocation]);

  const derivedAge = getAgeFromDob(formData.dob);
  const derivedZodiac = formData.zodiac || getZodiacFromDob(formData.dob);

  if (isCheckingCompletion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#ffe8ef] via-[#ffe5d9] to-[#f0f4ff]">
        <div className="flex items-center gap-3 text-rose-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Đang kiểm tra trạng thái hồ sơ...</span>
        </div>
      </div>
    );
  }

  const updateField = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'dob') {
        next.zodiac = getZodiacFromDob(value);
      }
      return next;
    });
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      if (field === 'dob' && next.zodiac) {
        delete next.zodiac;
      }
      return next;
    });
  };

  const updatePreference = (field, value) => {
    setFormData((prev) => {
      const nextPreferences = {
        ...prev.preferences,
        [field]: field === 'ageRange' ? normalizeAgeRange(value) : value,
      };
      return {
        ...prev,
        preferences: nextPreferences,
      };
    });
    const key = `preferences.${field}`;
    setErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const buildStepErrors = (index) => {
    const stepErrors = {};
    if (index === 0) {
      if (!formData.gender) {
        stepErrors.gender = 'Vui lòng chọn giới tính.';
      }
      if (!formData.dob) {
        stepErrors.dob = 'Vui lòng chọn ngày sinh.';
      }
      const numericHeight = Number(formData.height);
      if (!Number.isFinite(numericHeight)) {
        stepErrors.height = 'Vui lòng nhập chiều cao hợp lệ.';
      } else if (numericHeight < MIN_HEIGHT_CM || numericHeight > MAX_HEIGHT_CM) {
        stepErrors.height = `Chiều cao nằm trong khoảng ${MIN_HEIGHT_CM}-${MAX_HEIGHT_CM} cm.`;
      }
      if (!hasGeoLocation) {
        stepErrors.location = 'Cho phép HUSTLove truy cập vị trí hiện tại để tiếp tục.';
      }
      
    }
    if (index === 1) {
      if (!formData.connectionGoal) {
        stepErrors.connectionGoal = 'Vui lòng chọn mục tiêu kết nối.';
      }
      if (!formData.preferences.lookingFor) {
        stepErrors['preferences.lookingFor'] = 'Vui lòng chọn đối tượng mong muốn.';
      }
      const { ageRange } = formData.preferences;
      if (ageRange.min < MIN_MATCHING_AGE) {
        stepErrors['preferences.ageRange'] = `Độ tuổi tối thiểu phải từ ${MIN_MATCHING_AGE} trở lên.`;
      } else if (ageRange.max > MAX_MATCHING_AGE) {
        stepErrors['preferences.ageRange'] = `Độ tuổi tối đa không vượt quá ${MAX_MATCHING_AGE}.`;
      } else if (ageRange.min >= ageRange.max) {
        stepErrors['preferences.ageRange'] = 'Tuổi tối đa phải lớn hơn tuổi tối thiểu.';
      }
      if (formData.preferences.distance < 1) {
        stepErrors['preferences.distance'] = 'Khoảng cách phải lớn hơn 0 km.';
      }
    }
    if (index === 2) {
      if (!formData.career) {
        stepErrors.career = 'Vui lòng chọn khoa đang theo học.';
      }
      if (!formData.classYear) {
        stepErrors.classYear = 'Vui lòng chọn khóa học.';
      }
    }
    return stepErrors;
  };

  const handleNext = () => {
    const stepErrors = buildStepErrors(currentStep);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      if (stepErrors.location) {
        setLocationError(stepErrors.location);
      }
      return;
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    setServerMessage('');
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setServerMessage('');
  };

  const handleAddHobby = () => {
    const value = hobbyInput.trim();
    if (!value) {
      return;
    }
    setFormData((prev) => {
      if (prev.hobbies.includes(value)) {
        return prev;
      }
      return { ...prev, hobbies: [...prev.hobbies, value] };
    });
    setHobbyInput('');
    setErrors((prev) => {
      if (!prev.hobbies) {
        return prev;
      }
      const next = { ...prev };
      delete next.hobbies;
      return next;
    });
  };

  const handleRemoveHobby = (hobby) => {
    setFormData((prev) => ({
      ...prev,
      hobbies: prev.hobbies.filter((item) => item !== hobby),
    }));
  };

  const handleRequestLocation = () => {
    if (!isGeolocationSupported) {
      const message = 'Trình duyệt của bạn không hỗ trợ chia sẻ vị trí.';
      setLocationError(message);
      setErrors((prev) => ({ ...prev, location: message }));
      return;
    }

    setIsRequestingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = Number(position.coords.latitude.toFixed(6));
          const longitude = Number(position.coords.longitude.toFixed(6));

          let resolvedLabel = '';
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
            );
            if (response.ok) {
              const data = await response.json();
              const pieces = [
                data?.locality,
                data?.city,
                data?.principalSubdivision,
                data?.countryName,
              ].filter(Boolean);
              resolvedLabel = pieces.length > 0 ? Array.from(new Set(pieces)).join(', ') : '';
            }
          } catch (reverseError) {
            console.warn('Reverse geocoding failed', reverseError);
          }

          const fallbackLabel = `Vĩ độ ${latitude.toFixed(4)}, Kinh độ ${longitude.toFixed(4)}`;

          setFormData((prev) => ({
            ...prev,
            geoLocation: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            location: resolvedLabel || fallbackLabel,
          }));

          setErrors((prev) => {
            if (!prev.location) {
              return prev;
            }
            const next = { ...prev };
            delete next.location;
            return next;
          });

          setLocationError('');
        } catch (error) {
          console.error('Failed to process location', error);
          setLocationError('Không thể xử lý vị trí hiện tại. Vui lòng thử lại.');
        } finally {
          setIsRequestingLocation(false);
        }
      },
      (error) => {
        setIsRequestingLocation(false);
        let message = 'Không thể lấy vị trí. Vui lòng thử lại.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Bạn cần cho phép truy cập vị trí để hoàn tất hồ sơ.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Không thể xác định vị trí hiện tại. Vui lòng thử lại sau.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Quá thời gian truy vấn vị trí. Thử lại nhé!';
        }
        setLocationError(message);
        setErrors((prev) => ({ ...prev, location: message }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 300000,
        timeout: 10000,
      }
    );
  };

  const handleUseMockLocation = () => {
    const mockLatitude = 21.0049;
    const mockLongitude = 105.8431;
    setFormData((prev) => ({
      ...prev,
      geoLocation: {
        type: 'Point',
        coordinates: [mockLongitude, mockLatitude],
      },
      location: 'Kí túc xá Bách Khoa, Hai Bà Trưng (mô phỏng)',
    }));
    setIsRequestingLocation(false);
    setErrors((prev) => {
      if (!prev.location) {
        return prev;
      }
      const next = { ...prev };
      delete next.location;
      return next;
    });
    setLocationError('');
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setServerMessage('Vui lòng chọn đúng định dạng ảnh.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setServerMessage('Không thể đọc file ảnh.');
        return;
      }
      setPhotoPreview(result);
      setPhotoData(result);
    };
    reader.onerror = () => {
      setServerMessage('Không thể đọc file ảnh.');
    };
    reader.readAsDataURL(file);
  };

  const handleSectionHeaderClick = (index) => {
    if (index < currentStep) {
      setCurrentStep(index);
      setServerMessage('');
      return;
    }

    if (index === currentStep) {
      return;
    }

    if (index === currentStep + 1) {
      const stepErrors = buildStepErrors(currentStep);
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
      setErrors({});
      setCurrentStep(index);
      setServerMessage('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validations = steps.map((_, index) => buildStepErrors(index));
    const flatErrors = validations.reduce(
      (acc, curr) => ({ ...acc, ...curr }),
      {}
    );

    if (Object.keys(flatErrors).length > 0) {
      setErrors(flatErrors);
      if (flatErrors.location) {
        setLocationError(flatErrors.location);
      }
      const firstInvalidStep = validations.findIndex((item) => Object.keys(item).length > 0);
      if (firstInvalidStep >= 0) {
        setCurrentStep(firstInvalidStep);
      }
      return;
    }
    if (!user) {
      setServerMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSubmitting(true);
    setServerMessage('');

    try {
      const coordinates = coordinatesForDisplay;
      const normalizedLocationText =
        formData.location && formData.location !== 'Not updated' ? formData.location : '';
      const fallbackLocationText = coordinates
        ? `Vĩ độ ${coordinates.lat.toFixed(4)}, Kinh độ ${coordinates.lng.toFixed(4)}`
        : '';
      const locationForSubmit = normalizedLocationText || fallbackLocationText;
      const sanitizeLocationValue = (value) =>
        value && value !== 'Not updated' ? value : '';
      const currentLocation = sanitizeLocationValue(user?.location);
      const currentHometown = sanitizeLocationValue(user?.hometown);
      const normalizedHeight = normalizeHeightValue(formData.height);

      const payload = {
        gender: formData.gender,
        age: typeof derivedAge === 'number' ? derivedAge : undefined,
        dob: formData.dob,
        career: formData.career,
        classYear: formData.classYear,
        location: locationForSubmit,
        geoLocation: hasGeoLocation ? formData.geoLocation : undefined,
        bio: formData.bio,
        hobbies: formData.hobbies,
        zodiac: derivedZodiac,
        connectionGoal: formData.connectionGoal,
        height: normalizedHeight ?? undefined,
        academicHighlights: formData.academicHighlights,
        preferences: {
          lookingFor: formData.preferences.lookingFor,
          ageRange: formData.preferences.ageRange,
          distance: formData.preferences.distance,
          connectionGoal: formData.connectionGoal,
        },
        photoGallery: photoData
          ? [photoData]
          : Array.isArray(user?.photoGallery) && user.photoGallery.length > 0
          ? user.photoGallery
          : user?.avatar
          ? [user.avatar]
          : [],
        avatar: photoData
          || (Array.isArray(user?.photoGallery) && user.photoGallery.length > 0
            ? user.photoGallery[0]
            : user?.avatar
          )
          || '',
      };

      const response = await axios.put(`${API_URL}/api/users/${user.id || user._id}/profile`, payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });

      const nextUser = response.data?.user;
      if (!nextUser) {
        throw new Error('Server không trả về dữ liệu người dùng.');
      }

      const responseHeight = normalizeHeightValue(nextUser.height);

      const mergedUser = {
        ...user,
        ...nextUser,
        id: nextUser.id || nextUser._id,
        _id: nextUser._id || nextUser.id,
        dob: nextUser.dob,
        age: getAgeFromDob(nextUser.dob),
        career: nextUser.career || payload.career,
        faculty: nextUser.faculty || payload.career,
        classYear: nextUser.classYear || payload.classYear || user.classYear || '',
        height:
          responseHeight
          ?? payload.height
          ?? normalizeHeightValue(user.height),
        academicHighlights: nextUser.academicHighlights || payload.academicHighlights || '',
        job: nextUser.career || nextUser.job,
        hometown:
          sanitizeLocationValue(nextUser.hometown) ||
          sanitizeLocationValue(nextUser.location) ||
          locationForSubmit ||
          currentHometown ||
          currentLocation,
        location:
          sanitizeLocationValue(nextUser.location) ||
          locationForSubmit ||
          currentLocation,
        geoLocation:
          nextUser.geoLocation ||
          payload.geoLocation ||
          formData.geoLocation ||
          user.geoLocation,
        zodiac: nextUser.zodiac,
        hobbies: Array.isArray(nextUser.hobbies) ? nextUser.hobbies : payload.hobbies,
        connectionGoal: nextUser.connectionGoal || payload.connectionGoal || '',
        preferences: {
          ...nextUser.preferences,
          lookingFor: nextUser.preferences?.lookingFor || payload.preferences.lookingFor,
          ageRange: normalizeAgeRange(
            nextUser.preferences?.ageRange || payload.preferences.ageRange,
          ),
          distance: nextUser.preferences?.distance || payload.preferences.distance,
          connectionGoal:
            nextUser.preferences?.connectionGoal || payload.preferences.connectionGoal,
        },
        lookingFor:
          nextUser.preferences?.lookingFor ||
          nextUser.lookingFor ||
          payload.preferences.lookingFor,
        avatar: nextUser.avatar || payload.avatar || user.avatar || '',
        photoGallery: Array.isArray(nextUser.photoGallery)
          ? nextUser.photoGallery
          : payload.photoGallery,
        isProfileComplete: nextUser.isProfileComplete ?? true,
      };

      sessionStorage.setItem('user', JSON.stringify(mergedUser));
      window.dispatchEvent(new Event('userChanged'));
      setServerMessage('Cập nhật hồ sơ thành công.');

      navigate('/onboarding/photo-upload', { replace: true });
    } catch (error) {
      console.error('Failed to update profile', error);
      const message = error.response?.data?.message || error.message || 'Không thể cập nhật hồ sơ.';
      setServerMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Đang tải thông tin hồ sơ...</span>
        </div>
      </div>
    );
  }

  const renderStepFields = (stepIndex) => {
    if (stepIndex === 0) {
      return (
        <div className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Users className="h-4 w-4 text-rose-400" />
                Giới tính
                <span className="text-rose-500">*</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'Male', label: 'Nam' },
                  { value: 'Female', label: 'Nữ' },
                  { value: 'Other', label: 'Khác' },
                ].map((option) => {
                  const isActive = formData.gender === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => updateField('gender', option.value)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-rose-100 ${
                        isActive
                          ? 'border-rose-300 bg-rose-50 text-rose-500 shadow-sm shadow-rose-100'
                          : 'border-rose-100 bg-white/90 text-slate-500 hover:border-rose-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {errors.gender && <p className="text-sm text-rose-500">{errors.gender}</p>}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Calendar className="h-4 w-4 text-rose-400" />
                Ngày sinh
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(event) => updateField('dob', event.target.value)}
                  className="w-full rounded-2xl border border-rose-100 bg-white px-10 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-rose-500">
                {derivedAge ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1">
                    <Sparkles className="h-3 w-3" /> Tuổi {derivedAge}
                  </span>
                ) : null}
                {derivedZodiac ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-white px-3 py-1">
                    <Heart className="h-3 w-3" /> {derivedZodiac}
                  </span>
                ) : null}
              </div>
              {errors.dob && <p className="text-sm text-rose-500">{errors.dob}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Ruler className="h-4 w-4 text-rose-400" />
              Chiều cao (cm)
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Ruler className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
              <input
                type="number"
                inputMode="numeric"
                min={MIN_HEIGHT_CM}
                max={MAX_HEIGHT_CM}
                value={formData.height}
                onChange={(event) => updateField('height', event.target.value.replace(/[^0-9]/g, ''))}
                placeholder={`Ví dụ: 170`}
                className="w-full rounded-2xl border border-rose-100 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Khoảng chấp nhận: {MIN_HEIGHT_CM}-{MAX_HEIGHT_CM} cm</span>
              {errors.height && <span className="text-rose-500">{errors.height}</span>}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <MapPin className="h-4 w-4 text-rose-400" />
              Nơi sinh sống
              <span className="text-rose-500">*</span>
            </label>
            <div className="rounded-3xl border border-rose-100 bg-white/95 px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-700">
                      {hasGeoLocation ? 'Vị trí hiện tại đã được lưu' : 'Chia sẻ vị trí hiện tại'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {hasGeoLocation
                        ? locationSummary
                        : isGeolocationSupported
                        ? 'Cho phép truy cập vị trí để HUSTLove gợi ý các kết nối gần bạn hơn.'
                        : 'Trình duyệt của bạn chưa hỗ trợ lấy vị trí tự động. Hãy thử trình duyệt khác nhé.'}
                    </p>
                    {hasGeoLocation && locationCoordinateSummary ? (
                      <p className="text-xs font-mono text-slate-400">
                        {locationCoordinateSummary}
                      </p>
                    ) : null}
                    {locationError ? (
                      <p className="text-xs font-semibold text-rose-500">{locationError}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={handleRequestLocation}
                    disabled={!isGeolocationSupported || isRequestingLocation}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRequestingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang lấy vị trí...
                      </>
                    ) : isGeolocationSupported ? (
                      <>
                        <Compass className="h-4 w-4" />
                        {hasGeoLocation ? 'Cập nhật lại' : 'Chia sẻ vị trí'}
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        Không hỗ trợ
                      </>
                    )}
                  </button>
                  {isDev ? (
                    <button
                      type="button"
                      onClick={handleUseMockLocation}
                      className="text-xs font-medium text-slate-400 underline-offset-2 transition hover:text-rose-500 hover:underline"
                    >
                      Dùng vị trí mô phỏng
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {!hasGeoLocation && errors.location ? (
              <p className="text-sm text-rose-500">{errors.location}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Sparkles className="h-4 w-4 text-rose-400" />
              Giới thiệu bản thân
            </label>
            <textarea
              value={formData.bio}
              onChange={(event) => updateField('bio', event.target.value.slice(0, 500))}
              rows={4}
              placeholder="Chia sẻ tính cách, niềm đam mê hoặc câu chuyện khiến bạn nổi bật."
              className="w-full rounded-3xl border border-rose-100 bg-white px-6 py-4 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formData.bio.length}/500 ký tự</span>
              {errors.bio && <span className="text-rose-500">{errors.bio}</span>}
            </div>
          </div>
        </div>
      );
    }

    if (stepIndex === 1) {
      return (
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Target className="h-4 w-4 text-rose-400" />
              Mục tiêu kết nối
              <span className="text-rose-500">*</span>
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              {connectionGoalOptions.map((option) => {
                const Icon = option.icon;
                const isActive = formData.connectionGoal === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => updateField('connectionGoal', option.value)}
                    className={`rounded-3xl border px-4 py-4 text-left transition focus:outline-none focus:ring-4 focus:ring-rose-100 ${
                      isActive
                        ? 'border-rose-300 bg-rose-50 text-rose-500 shadow-sm shadow-rose-100'
                        : 'border-rose-100 bg-white/95 text-slate-600 hover:border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                        isActive ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'
                      }`}>
                        {isActive ? (
                          <CheckCircle className="h-[20px] w-[20px]" strokeWidth={2.2} />
                        ) : (
                          <Icon className="h-[20px] w-[20px]" strokeWidth={2.2} />
                        )}
                      </span>
                      <span className="text-sm font-semibold">{option.label}</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{option.description}</p>
                  </button>
                );
              })}
            </div>
            {errors.connectionGoal && <p className="text-sm text-rose-500">{errors.connectionGoal}</p>}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Sparkles className="h-4 w-4 text-rose-400" />
              Sở thích nổi bật
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.hobbies.map((hobby) => (
                <span
                  key={hobby}
                  className="group inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-500"
                >
                  {hobby}
                  <button
                    type="button"
                    onClick={() => handleRemoveHobby(hobby)}
                    className="rounded-full border border-transparent p-1 text-rose-400 transition group-hover:border-rose-200 group-hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                <input
                  type="text"
                  value={hobbyInput}
                  onChange={(event) => setHobbyInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddHobby();
                    }
                  }}
                  placeholder="Thêm sở thích mới..."
                  className="w-full rounded-2xl border border-rose-100 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
                />
              </div>
              <button
                type="button"
                onClick={handleAddHobby}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-rose-200/70 transition hover:scale-[1.01]"
              >
                <Plus className="h-4 w-4" />
                Thêm sở thích
              </button>
            </div>
            {errors.hobbies && <p className="text-sm text-rose-500">{errors.hobbies}</p>}
          </div>

          <div className="space-y-4 rounded-3xl border border-rose-100 bg-rose-50/60 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-500">
              <Compass className="h-4 w-4" />
              Bộ lọc ghép đôi
            </div>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Đối tượng ưu tiên
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'All', label: 'Tất cả' },
                  { value: 'Male', label: 'Nam' },
                  { value: 'Female', label: 'Nữ' },
                ].map((option) => {
                  const isActive = formData.preferences.lookingFor === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => updatePreference('lookingFor', option.value)}
                      className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-rose-100 ${
                        isActive
                          ? 'border-rose-400 bg-white text-rose-500 shadow-sm'
                          : 'border-rose-100 bg-white/90 text-slate-500 hover:border-rose-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {errors['preferences.lookingFor'] && (
                <p className="text-sm text-rose-500">{errors['preferences.lookingFor']}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Độ tuổi từ
                </span>
                <input
                  type="number"
                  min={MIN_MATCHING_AGE}
                  max={MAX_MATCHING_AGE - 1}
                  value={formData.preferences.ageRange.min}
                  onChange={(event) =>
                    updatePreference('ageRange', {
                      ...formData.preferences.ageRange,
                      min: Number(event.target.value ?? MIN_MATCHING_AGE),
                    })
                  }
                  className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
                />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Đến
                </span>
                <input
                  type="number"
                  min={formData.preferences.ageRange.min + 1}
                  max={MAX_MATCHING_AGE}
                  value={formData.preferences.ageRange.max}
                  onChange={(event) =>
                    updatePreference('ageRange', {
                      ...formData.preferences.ageRange,
                      max: Number(
                        event.target.value ?? formData.preferences.ageRange.min + 1,
                      ),
                    })
                  }
                  className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
                />
              </div>
            </div>
            {errors['preferences.ageRange'] && (
              <p className="text-sm text-rose-500">{errors['preferences.ageRange']}</p>
            )}

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Khoảng cách tối đa
              </span>
              <input
                type="range"
                min="1"
                max="200"
                value={formData.preferences.distance}
                onChange={(event) => updatePreference('distance', Number(event.target.value))}
                className="w-full accent-rose-400"
              />
              <p className="text-sm font-medium text-rose-500">
                Tối đa {formData.preferences.distance} km
              </p>
              {errors['preferences.distance'] && (
                <p className="text-sm text-rose-500">{errors['preferences.distance']}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Briefcase className="h-4 w-4 text-rose-400" />
              Khoa
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Briefcase className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
              <input
                list="faculty-options"
                value={formData.career}
                onChange={(event) => updateField('career', event.target.value)}
                placeholder="Ví dụ: Công Nghệ Thông Tin"
                className="w-full rounded-2xl border border-rose-100 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
              />
              <datalist id="faculty-options">
                {facultyOptions.map((faculty) => (
                  <option key={faculty} value={faculty} />
                ))}
              </datalist>
            </div>
            {errors.career && <p className="text-sm text-rose-500">{errors.career}</p>}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <GraduationCap className="h-4 w-4 text-rose-400" />
              Khóa học
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
              <input
                list="classyear-options"
                value={formData.classYear}
                onChange={(event) => updateField('classYear', event.target.value)}
                placeholder="Ví dụ: K68"
                className="w-full rounded-2xl border border-rose-100 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
              />
              <datalist id="classyear-options">
                {classYearOptions.map((year) => (
                  <option key={year} value={year} />
                ))}
              </datalist>
            </div>
            {errors.classYear && <p className="text-sm text-rose-500">{errors.classYear}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Sparkles className="h-4 w-4 text-rose-400" />
            Thành tựu học thuật (tùy chọn)
          </label>
          <textarea
            value={formData.academicHighlights || ''}
            onChange={(event) => updateField('academicHighlights', event.target.value.slice(0, 400))}
            rows={3}
            placeholder="Chia sẻ học bổng, dự án nghiên cứu hoặc CLB học thuật bạn tham gia."
            className="w-full rounded-3xl border border-rose-100 bg-white px-6 py-4 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100"
          />
        </div>
      </div>
    );
  };

  const completionPercent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="relative min-h-screen bg-[#fff5f8] py-24">
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-6 rounded-[28px] border border-rose-100 bg-white p-8 shadow-[0_18px_45px_-32px_rgba(244,114,182,0.4)]">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-3 text-rose-500">
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">Xin chào</p>
                <h2 className="text-xl font-semibold text-slate-800">{user.name}</h2>
              </div>
            </div>

            <div className="rounded-[24px] border border-rose-100 bg-rose-50/60 p-5 text-sm text-rose-500">
              <p className="font-semibold">Hồ sơ đầy đủ = ấn tượng tốt</p>
              <p className="mt-1 text-xs text-rose-400">
                Những hồ sơ hoàn thiện thường nhận được nhiều lượt ghép đôi hơn 3 lần so với trung bình.
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                return (
                  <button
                    type="button"
                    key={step.id}
                    onClick={() => handleSectionHeaderClick(index)}
                    className={`group flex w-full items-center justify-between rounded-3xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-rose-300 bg-rose-50 text-rose-500 shadow-sm shadow-rose-100'
                        : isCompleted
                        ? 'border-teal-200 bg-teal-50 text-teal-600'
                        : 'border-rose-100 bg-white/90 text-slate-500 hover:border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                        isCompleted ? 'bg-teal-500 text-white' : 'bg-rose-100 text-rose-500'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-[20px] w-[20px]" strokeWidth={2.2} />
                        ) : (
                          <Icon className="h-[20px] w-[20px]" strokeWidth={2.2} />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="text-xs text-slate-500">{step.subtitle}</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition ${isActive ? 'rotate-180 text-rose-400' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>

            <div className="rounded-[24px] border border-rose-100 bg-white/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">
                <span>Tiến độ</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-rose-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 via-pink-400 to-teal-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Bước {currentStep + 1}/{steps.length} • {steps[currentStep].title}
              </p>
            </div>
          </aside>

          <main className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-white p-8 shadow-[0_24px_60px_-40px_rgba(233,114,181,0.45)] md:p-10">
            <header className="relative space-y-6 border-b border-rose-100/80 pb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">
                <Sparkles className="h-3 w-3" /> Hoàn thiện hồ sơ
              </span>
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="max-w-xl space-y-2">
                  <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
                    Hồ sơ của {user.name}
                  </h1>
                  <p className="text-base text-slate-600">
                    Bổ sung vài chi tiết nữa để HUSTLove tìm đúng người đồng điệu với bạn.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-rose-200/80 bg-rose-50 shadow-inner">
                      {photoPreview ? (
                        <img src={photoPreview} alt={user.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl text-rose-300">
                          <Heart className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-400 to-pink-400 p-2 text-white shadow-md shadow-rose-200/60"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </div>
                  <div className="max-w-xs text-xs text-slate-500">
                    <p className="text-sm font-semibold text-slate-700">Ảnh đại diện</p>
                    <p>Ảnh rõ nét, tươi sáng sẽ khiến hồ sơ của bạn thu hút hơn. Bạn có thể cập nhật sau khi lưu.</p>
                  </div>
                </div>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="relative mt-8 space-y-8">
              <div className="space-y-6">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isOpen = index === currentStep;
                  const isCompleted = index < currentStep;
                  return (
                    <div
                      key={step.id}
                      className={`rounded-[28px] border border-rose-100 bg-white shadow-sm transition ${
                        isOpen ? 'ring-2 ring-rose-200' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSectionHeaderClick(index)}
                        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${
                            isCompleted
                              ? 'bg-teal-500 text-white'
                              : isOpen
                              ? 'bg-rose-100 text-rose-500'
                              : 'bg-rose-50 text-rose-400'
                          }`}>
                            {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                          </span>
                          <div>
                            <p className="text-base font-semibold text-slate-700">{step.title}</p>
                            <p className="text-xs text-slate-500">{step.subtitle}</p>
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-rose-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="space-y-6 border-t border-rose-100/70 px-6 py-6">
                          {renderStepFields(index)}

                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm text-slate-500">
                              {index < steps.length - 1
                                ? `Tiếp theo: ${steps[index + 1].title}`
                                : 'Khi lưu lại, hồ sơ của bạn sẽ được bật sáng trong cộng đồng.'}
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={handlePrevious}
                                disabled={index === 0 || isSubmitting}
                                className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <ArrowLeft className="h-4 w-4" />
                                Quay lại
                              </button>
                              {index < steps.length - 1 && (
                                <button
                                  type="button"
                                  onClick={handleNext}
                                  disabled={isSubmitting}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-rose-200/70 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Tiếp tục
                                  <ArrowRight className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {serverMessage && (
                <div
                  className={`rounded-3xl border px-5 py-4 text-sm font-semibold ${
                    serverMessage.includes('thành công')
                      ? 'border-teal-200 bg-teal-50 text-teal-600'
                      : 'border-rose-200 bg-rose-50 text-rose-500'
                  }`}
                >
                  {serverMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-rose-400 via-pink-400 to-teal-300 px-6 py-3 text-base font-semibold text-white shadow-xl shadow-rose-200/60 transition hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang lưu hồ sơ...
                  </>
                ) : (
                  <>
                    Lưu hồ sơ
                    <Sparkles className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}