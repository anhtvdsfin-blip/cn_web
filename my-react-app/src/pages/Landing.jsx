import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Fingerprint,
  Target,
  BookOpenCheck,
  MessageCircleHeart,
  Quote,
  Sparkles,
  Instagram,
  Facebook,
  Linkedin
} from 'lucide-react';

const featureGroups = [
    {
    title: 'Authentication & Security',
    subtitle: 'Giữ an toàn cho từng kết nối',
    accent: 'from-rose-200 via-pink-200 to-purple-200',
    Icon: ShieldCheck,
    bullets: [
      'Đăng ký nhanh với email @hust.edu.vn',
      'Xác minh avatar, họ tên, khoa và khóa học',
    ],
  },
  {
    title: 'Smart Matching & Discovery',
    subtitle: 'Thuật toán hiểu sinh viên Bách khoa',
    accent: 'from-pink-200 via-rose-100 to-amber-100',
    Icon: Target,
    bullets: [
      'Lọc hồ sơ theo Khoa, Khóa, Môn học, Sở thích',
      'BK Crush – tỏ tình ẩn danh an toàn',
      'Đề xuất ghép đôi bằng học máy tối ưu',
    ],
  },
  {
    title: 'Study & Connection',
    subtitle: 'Tạo động lực học và phát triển',
    accent: 'from-purple-200 via-pink-100 to-rose-100',
    Icon: BookOpenCheck,
    bullets: [
      'Learning Buddies: ghép bạn học cùng lớp/môn',
      'Library Invite: gửi lời mời học tại thư viện, khuôn viên',
      'Group Study: tự tạo nhóm khi trùng lịch học',
    ],
  },
  {
    title: 'Chat & Interaction',
    subtitle: 'Nuôi dưỡng cảm xúc đúng chất BK',
    accent: 'from-rose-100 via-orange-100 to-pink-200',
    Icon: MessageCircleHeart,
    bullets: [
      'Chat 1-1 mở ngay sau khi Match',
      'BK-Style Opening Move được gợi ý cá nhân hóa',
      'Reaction, sticker và kỷ niệm chung thời sinh viên',
    ],
  },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-50 via-pink-100 to-purple-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
        <div className="absolute top-40 right-10 h-80 w-80 rounded-full bg-purple-200/30 blur-3xl" />
        <div className="absolute bottom-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),transparent_55%)]" />
      </div>

      <header className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(253,221,249,0.5),transparent_50%)]" />
        <div className="max-w-6xl mx-auto px-6 pt-28 pb-20 lg:flex lg:items-center lg:gap-14">
          <div className="flex-1 space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-5 py-2 text-sm font-medium text-rose-600 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Tình yêu dành riêng cho sinh viên Bách khoa
            </span>
            <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Find Your Algorithm of Love: <span className="text-rose-500">HUSTLove</span>
            </h1>
            <p className="max-w-xl text-lg text-slate-700">
              Nền tảng hẹn hò kết nối sinh viên Bách khoa qua đam mê học thuật và mục tiêu phát triển chung.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-rose-400 via-orange-200 to-pink-300 px-8 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-rose-200/60 transition hover:scale-105 hover:shadow-rose-200/90"
              >
                <Sparkles className="h-5 w-5" />
                Đăng ký ngay
              </Link>
              <div className="flex flex-col text-sm text-slate-600">
                <span>Trải nghiệm web dành riêng cho HUSTers</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6 text-slate-700">
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm shadow-rose-100/70">
                <p className="text-3xl font-semibold text-rose-500">15K+</p>
                <p className="mt-1 text-xs uppercase tracking-wide">Đăng ký</p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm shadow-pink-100/70">
                <p className="text-3xl font-semibold text-rose-500">99%</p>
                <p className="mt-1 text-xs uppercase tracking-wide">Xác thực email HUST</p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm shadow-purple-100/70">
                <p className="text-3xl font-semibold text-rose-500">5 phút</p>
                <p className="mt-1 text-xs uppercase tracking-wide">Hoàn thành hồ sơ</p>
              </div>
            </div>
          </div>

          <div className="relative mt-16 flex-1 lg:mt-0">
            <div className="absolute inset-0 -translate-y-6 translate-x-6 rounded-[3rem] bg-gradient-to-br from-white/70 via-rose-100/70 to-purple-100/70 blur-xl" />
            <div className="relative mx-auto w-full max-w-sm rounded-[2.5rem] border border-rose-100/70 bg-white/80 p-6 shadow-2xl shadow-rose-200/60 backdrop-blur-md">
              <div className="mx-auto h-1 w-16 rounded-full bg-rose-200/80" />
              <div className="mt-8 space-y-5 text-slate-700">
                <div className="rounded-[2rem] bg-gradient-to-br from-pink-200/70 via-rose-100/70 to-purple-200/70 p-5">
                  <p className="text-sm text-slate-700">“Mình và bạn ấy cùng K67 CNTT – HUSTLove ghép đôi vì cả hai đều yêu Robotics. Giờ bọn mình cùng trực lab và uống trà chiều mỗi thứ Sáu.”</p>
                </div>
                <div className="rounded-[2rem] bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-rose-400">Match chỉ số đồng điệu</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-500">94%</p>
                  <p className="text-xs text-rose-300">Dựa trên sở thích project &amp; môn chuyên ngành</p>
                </div>
                <div className="rounded-[2rem] border border-dashed border-rose-200/80 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-rose-400">Sự kiện cộng đồng</p>
                  <p className="text-base font-semibold text-rose-600">HUST Couple Workshop • Thư viện TQB</p>
                  <p className="text-xs text-rose-300">20:00 - Thứ 6 hàng tuần</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative py-24">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-200/70 to-transparent" />
          <div className="max-w-5xl mx-auto px-6">
            <div className="mb-12 max-w-2xl text-center md:mx-auto">
              <h2 className="text-3xl font-semibold text-slate-900">Các tính năng chuyên biệt cho HUSTLove</h2>
              <p className="mt-4 text-base text-slate-600">
                Tối ưu trải nghiệm web với những công cụ được thiết kế riêng cho nhịp sống Bách khoa – từ bảo mật đến học tập và tương tác.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              {featureGroups.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-[2.5rem] border border-rose-100/70 bg-white/80 p-8 shadow-xl shadow-rose-100/60 transition hover:-translate-y-1 hover:shadow-rose-200/70"
                >
                  <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${feature.accent} opacity-60 blur-2xl`} />
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-rose-50/90 px-4 py-2 text-rose-600 shadow-sm">
                    <feature.Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{feature.subtitle}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {feature.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Fingerprint className="mt-0.5 h-4 w-4 text-rose-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative py-16">
          <div className="max-w-4xl mx-auto px-6">
            <div className="relative rounded-[3rem] bg-white/80 p-10 shadow-2xl shadow-rose-200/60">
              <div className="absolute -top-10 left-12 h-24 w-24 rounded-full bg-rose-200/60 blur-2xl" />
              <Quote className="relative h-10 w-10 text-rose-400" />
              <p className="mt-6 text-lg text-slate-700">
                “HUSTLove không chỉ giúp mình tìm người yêu mà còn xây dựng một nhóm học thuật ăn ý. Thuật toán matching thực sự hiểu sinh viên Bách khoa – bọn mình chung tới 3 dự án và 2 môn tự chọn!”
              </p>
              <div className="mt-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-rose-300 to-purple-300 shadow-inner shadow-white/70" />
                <div>
                  <p className="text-base font-semibold text-slate-800">Lan Trinh • K67-CNTT</p>
                  <p className="text-sm text-slate-500">Thành viên CLB AI HUST</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rose-100/80 bg-white/80 py-10">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-between gap-6 px-6 text-sm text-slate-600 md:flex-row">
          <p className="font-semibold text-slate-800">© {new Date().getFullYear()} HUSTLove</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-rose-500">Điều khoản</a>
            <a href="#" className="hover:text-rose-500">Bảo mật</a>
          </div>
          <div className="flex items-center gap-4 text-rose-500">
            <a href="#" className="rounded-full border border-transparent p-2 hover:border-rose-300/60 hover:text-rose-500">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="rounded-full border border-transparent p-2 hover:border-rose-300/60 hover:text-rose-500">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="rounded-full border border-transparent p-2 hover:border-rose-300/60 hover:text-rose-500">
              <Linkedin className="h-5 w-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
