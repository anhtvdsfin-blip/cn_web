import { useState } from 'react';
import { X, Sliders, GraduationCap, Users, Heart, MapPin, Calendar } from 'lucide-react';

const DEFAULT_FILTERS = {
  ageRange: { min: 18, max: 30 },
  distance: 5,
  classYear: [],
  major: [],
  interests: [],
  activities: [],
  commonSubjects: false
};

export default function MatchFilter({ isOpen, onClose, onApplyFilter, currentFilters }) {
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    ...currentFilters
  });

  const classYears = ['K61', 'K62', 'K63', 'K64', 'K65', 'K66', 'K67', 'K68'];

  const majors = [
    'Công nghệ Thông tin',
    'Điện tử Viễn thông',
    'Cơ khí',
    'Điện',
    'Hóa học',
    'Kinh tế',
    'Ngoại ngữ',
    'Vật lý Kỹ thuật',
    'Toán - Tin',
    'Kỹ thuật Xây dựng'
  ];

  const commonInterests = [
    'Thể thao',
    'Âm nhạc',
    'Du lịch',
    'Đọc sách',
    'Phim ảnh',
    'Nhiếp ảnh',
    'Vẽ tranh',
    'Game',
    'Nấu ăn',
    'Yoga'
  ];

  const activities = [
    'CLB Sinh viên',
    'Đội tình nguyện',
    'Nghiên cứu khoa học',
    'Workshop',
    'Hackathon',
    'Hoạt động văn hóa',
    'Thể thao'
  ];

  const handleToggleArray = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const handleApply = () => {
    onApplyFilter(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl mx-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-rose-100 p-2">
              <Sliders className="h-5 w-5 text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-rose-600">Bộ lọc tìm kiếm</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-rose-400 transition hover:bg-rose-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Độ tuổi */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-700">Độ tuổi</h3>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="18"
                max="50"
                value={filters.ageRange.min}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  ageRange: { ...prev.ageRange, min: parseInt(e.target.value) }
                }))}
                className="w-20 rounded-xl border border-rose-200 px-3 py-2 text-center focus:border-rose-400 focus:outline-none"
              />
              <span className="text-rose-400">—</span>
              <input
                type="number"
                min="18"
                max="50"
                value={filters.ageRange.max}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  ageRange: { ...prev.ageRange, max: parseInt(e.target.value) }
                }))}
                className="w-20 rounded-xl border border-rose-200 px-3 py-2 text-center focus:border-rose-400 focus:outline-none"
              />
              <span className="text-sm text-rose-500">tuổi</span>
            </div>
          </div>

          {/* Khoảng cách */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-700">Khoảng cách: {filters.distance} km</h3>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={filters.distance}
              onChange={(e) => setFilters(prev => ({ ...prev, distance: parseInt(e.target.value) }))}
              className="w-full accent-rose-500"
            />
            <div className="flex justify-between text-xs text-rose-400 mt-2">
              <span>1 km</span>
              <span>20 km</span>
            </div>
          </div>

          {/* Khóa học */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-700">Khóa học</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {classYears.map(year => (
                <button
                  key={year}
                  onClick={() => handleToggleArray('classYear', year)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${filters.classYear.includes(year)
                      ? 'bg-rose-500 text-white'
                      : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50'
                    }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Ngành học */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-700">Ngành học</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {majors.map(major => (
                <button
                  key={major}
                  onClick={() => handleToggleArray('major', major)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${filters.major.includes(major)
                      ? 'bg-rose-500 text-white'
                      : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50'
                    }`}
                >
                  {major}
                </button>
              ))}
            </div>
          </div>

          {/* Sở thích */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-700">Sở thích chung</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {commonInterests.map(interest => (
                <button
                  key={interest}
                  onClick={() => handleToggleArray('interests', interest)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${filters.interests.includes(interest)
                      ? 'bg-rose-500 text-white'
                      : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50'
                    }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {/* Hoạt động ngoại khóa */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-700">Hoạt động ngoại khóa</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {activities.map(activity => (
                <button
                  key={activity}
                  onClick={() => handleToggleArray('activities', activity)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${filters.activities.includes(activity)
                      ? 'bg-rose-500 text-white'
                      : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50'
                    }`}
                >
                  {activity}
                </button>
              ))}
            </div>
          </div>

          {/* Môn học chung */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.commonSubjects}
                onChange={(e) => setFilters(prev => ({ ...prev, commonSubjects: e.target.checked }))}
                className="h-5 w-5 rounded accent-rose-500"
              />
              <span className="font-medium text-rose-700">Ưu tiên người có môn học chung</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex gap-4 border-t border-rose-100 bg-white p-6">
          <button
            onClick={handleReset}
            className="flex-1 rounded-xl border-2 border-rose-200 py-3 font-semibold text-rose-500 transition hover:bg-rose-50"
          >
            Đặt lại
          </button>
          <button
            onClick={handleApply}
            className="flex-1 rounded-xl border-2 border-rose-200 py-3 font-semibold text-rose-500 transition hover:bg-rose-50"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
