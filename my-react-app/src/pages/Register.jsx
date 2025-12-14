import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Sparkles } from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (form.password !== form.confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
      };

      const res = await axios.post(`${API_URL}/api/auth/register`, payload, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true, // keep refresh token cookie
      });

      const user = res.data?.user;

      if (!user) {
        throw new Error("Không nhận được thông tin người dùng.");
      }

      const userForSession = {
        _id: user.id || user._id,
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        gender: user.gender || "Other",
        dob: user.dob || null,
        age: user.age || null,
        avatar: user.avatar || "",
        career: user.career || user.job || "",
        job: user.job || user.career || "",
        hometown: user.hometown || user.location || "",
        location: user.location || "",
        geoLocation: user.geoLocation || null,
        hobbies: user.hobbies || [],
        bio: user.bio || "",
        zodiac: user.zodiac || "Unknown",
        preferences: user.preferences || null,
        lookingFor: user.preferences?.lookingFor || user.lookingFor || "All",
        height: (() => {
          const numeric = Number(user.height);
          if (!Number.isFinite(numeric)) {
            return null;
          }
          const truncated = Math.trunc(numeric);
          return truncated >= 120 && truncated <= 220 ? truncated : null;
        })(),
        isProfileComplete: user.isProfileComplete ?? user.profileCompleted ?? false,
      };

      sessionStorage.setItem("user", JSON.stringify(userForSession));
      window.dispatchEvent(new Event("userChanged"));
      navigate(userForSession.isProfileComplete ? "/feed" : "/complete-profile");
    } catch (err) {
      console.error("❌ Lỗi khi gửi request:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Lỗi kết nối tới server!";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-rose-200/40 to-transparent" aria-hidden />
      <Sparkles className="absolute left-12 top-12 h-12 w-12 text-rose-200" aria-hidden />
      <Sparkles className="absolute right-16 bottom-24 hidden h-16 w-16 -rotate-12 text-rose-100 lg:block" aria-hidden />

      <div className="relative z-10 w-full max-w-xl px-4 md:px-0">
        <div className="overflow-hidden rounded-[32px] border border-rose-100/70 bg-white/90 shadow-xl shadow-rose-200/60 backdrop-blur-sm">
          <div className="space-y-8 px-8 py-10 md:px-12">
            <div className="space-y-3 text-center md:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1 text-sm font-semibold text-rose-500">
                <Sparkles className="h-4 w-4" />
                Bắt đầu kết nối Bách khoa
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">
                Tạo tài khoản HUSTLove
              </h1>
              <p className="text-base text-slate-600">
                Điền thông tin của bạn để mở cánh cửa đến cộng đồng sinh viên năng động nhất HUST.
              </p>
            </div>

            {message.text && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  message.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-500"
                    : "border-teal-200 bg-teal-50 text-teal-600"
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    value={form.name}
                    onChange={updateField("name")}
                    required
                    className="w-full rounded-2xl border border-rose-100 bg-white px-5 py-3 text-base text-slate-800 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Email HUST
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-500">
                      @sis.hust.edu.vn
                    </span>
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-rose-300" />
                    <input
                      type="email"
                      placeholder="nguyen.anh@sis.hust.edu.vn"
                      value={form.email}
                      onChange={updateField("email")}
                      required
                      className="w-full rounded-2xl border border-rose-100 bg-white px-12 py-3 text-base text-slate-800 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      Mật khẩu
                    </label>
                    <input
                      type="password"
                      placeholder="Tối thiểu 8 ký tự"
                      value={form.password}
                      onChange={updateField("password")}
                      required
                      className="w-full rounded-2xl border border-rose-100 bg-white px-5 py-3 text-base text-slate-800 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      Xác nhận
                    </label>
                    <input
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      value={form.confirmPassword}
                      onChange={updateField("confirmPassword")}
                      required
                      className="w-full rounded-2xl border border-rose-100 bg-white px-5 py-3 text-base text-slate-800 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-pink-400 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-200/70 transition hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
              </button>

              <p className="text-center text-sm text-slate-600">
                Đã có tài khoản?{" "}
                <Link to="/login" className="font-semibold text-teal-500 hover:text-teal-600">
                  Đăng nhập
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
