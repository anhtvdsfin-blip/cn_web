import { useContext, useEffect, useMemo, useState } from "react";
import axios from 'axios';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, Bell, Menu, X } from "lucide-react";
import { UserContext, SocketContext } from "../contexts";
import NotificationPanel from "./NotificationPanel";

export default function Navbar({ user: controlledUser, socket, unreadCount = 0 }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user: contextUser, setUser: setUserContext } = useContext(UserContext) ?? {};
  const [user, setLocalUser] = useState(controlledUser ?? contextUser ?? null);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Find Love", path: "/feed" },
    { label: "Random Chat", path: "/chat" },
    { label: "Messages", path: "/messenger" },
    { label: "Library", path: "/library-invite" },
    { label: "Community", path: "/community" },
  ];

  useEffect(() => {
    if (controlledUser !== undefined) {
      setLocalUser(controlledUser);
      return;
    }

    if (contextUser !== undefined) {
      setLocalUser(contextUser);
      return;
    }

    const loadUser = () => {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser && storedUser !== "undefined") {
        try {
          const parsed = JSON.parse(storedUser);
          setLocalUser(parsed);
          setUserContext?.(parsed);
        } catch (error) {
          console.error("Lỗi khi parse user:", error);
          sessionStorage.removeItem("user");
          setLocalUser(null);
          setUserContext?.(null);
        }
      } else {
        setLocalUser(null);
        setUserContext?.(null);
      }
    };

    loadUser();
    const handleUserChange = () => loadUser();
    window.addEventListener("userChanged", handleUserChange);

    return () => {
      window.removeEventListener("userChanged", handleUserChange);
    };
  }, [controlledUser, contextUser, setUserContext]);

  useEffect(() => {
    setShowDropdown(false);
    setMobileOpen(false);
  }, [location.pathname]);


  const handleLogout = () => {
    console.log("🚪 Đăng xuất...");
    
    if (socket) {
      console.log("🔌 Disconnecting socket...");
      socket.disconnect();
    }
    
    sessionStorage.removeItem("user");
    sessionStorage.removeItem('accessToken');
    delete axios.defaults.headers.common['Authorization'];
    console.log("🗑️ Đã xóa sessionStorage");
    
    setLocalUser(null);
    setUserContext?.(null);
    console.log("✅ Đã clear user context");
    
    setShowDropdown(false);
    window.dispatchEvent(new Event("userChanged"));
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-rose-100/80 bg-white/90 backdrop-blur">
      <div className="mx-auto ml-2 lg:ml-[calc(52%-640px)] grid w-full max-w-[1280px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 lg:px-8">
        <Link to="/" className="flex min-w-max items-center gap-2 text-[22px] font-semibold text-slate-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <Heart className="h-4 w-4" />
          </span>
          <span className="tracking-tight">HUSTYEU</span>
        </Link>

        <div className="hidden items-center justify-center md:flex">
          <nav className="flex items-center justify-center gap-10 text-sm font-semibold text-slate-800">
            {navItems.map(({ label, path }) => {
              const isActive = location.pathname.startsWith(path);
              return (
                <Link
                  key={label}
                  to={path}
                  className={`relative transition-colors duration-150 hover:text-teal-500 ${
                    isActive ? "text-teal-500" : ""
                  }`}
                >
                  {label}
                  {isActive && (
                    <span className="absolute -bottom-2 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-teal-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="ml-auto hidden flex-shrink-0 items-center gap-4 justify-self-end md:flex">
          {!user ? (
            <div className="flex items-center gap-3 text-sm font-semibold">
              <Link
                to="/login"
                className="rounded-full border border-rose-200 px-5 py-2 text-slate-700 transition hover:border-rose-300 hover:text-teal-500"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-rose-500 px-5 py-2 text-white shadow-sm shadow-rose-200 transition hover:shadow-md"
              >
                Đăng ký
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white/80 text-rose-400 transition hover:border-rose-300 hover:text-rose-500"
                aria-label="Thông báo"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowDropdown((prev) => !prev)}
                  className="flex items-center gap-3 rounded-full border border-transparent bg-white/80 px-3 py-1.5 shadow-sm shadow-rose-100/70 transition hover:border-rose-200"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-10 w-10 rounded-full border-2 border-rose-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-200 text-rose-600">
                      {user.name?.charAt(0)?.toUpperCase() || "H"}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-rose-100 bg-white/95 p-2 text-sm text-slate-600 shadow-xl shadow-rose-100/70">
                    <Link
                      to="/profile"
                      className="block rounded-xl px-4 py-2 transition hover:bg-rose-50"
                    >
                      Hồ sơ cá nhân
                    </Link>
                    <Link
                      to="/settings"
                      className="block rounded-xl px-4 py-2 transition hover:bg-rose-50"
                    >
                      Cài đặt
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="mt-1 w-full rounded-xl px-4 py-2 text-left text-rose-500 transition hover:bg-rose-100"
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-white/90 p-2 text-rose-500 transition hover:border-rose-300 hover:text-rose-600 md:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Mở menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Notification Panel - works for both mobile and desktop */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {mobileOpen && (
        <div className="md:hidden">
          <div className="space-y-4 border-t border-rose-100/70 bg-white/95 px-4 py-6 text-sm font-semibold text-slate-700 shadow-lg">
            <div className="flex flex-col gap-2">
              {navItems.map(({ label, path }) => {
                const isActive = location.pathname.startsWith(path);
                return (
                  <Link
                    key={label}
                    to={path}
                    className={`rounded-xl px-3 py-2 transition hover:bg-rose-50 ${
                      isActive ? "text-teal-500" : ""
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            {user ? (
              <div className="space-y-3 rounded-2xl bg-rose-50/70 p-4">
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-10 w-10 rounded-full border border-rose-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-200 text-rose-600">
                      {user.name?.charAt(0)?.toUpperCase() || "H"}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                    <Link to="/profile" className="text-xs text-teal-500">Xem hồ sơ</Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setMobileOpen(false);
                    }}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-400 transition hover:border-rose-300 hover:text-rose-500"
                    aria-label="Thông báo"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex gap-3">
                  <Link
                    to="/settings"
                    className="flex-1 rounded-full border border-rose-200 px-4 py-2 text-center text-sm transition hover:border-rose-300 hover:text-teal-500"
                  >
                    Cài đặt
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm text-white shadow-sm shadow-rose-200"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-sm font-semibold">
                <Link
                  to="/login"
                  className="rounded-full border border-rose-200 px-4 py-2 text-center text-slate-700 transition hover:border-rose-300 hover:text-teal-500"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-rose-500 px-4 py-2 text-center text-white shadow-sm shadow-rose-200"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}