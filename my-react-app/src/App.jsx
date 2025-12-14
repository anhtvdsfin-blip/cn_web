import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import CompleteProfile from "./pages/CompleteProfile";
import PhotoManagement from "./pages/PhotoManagement";
import Messenger from "./pages/Messenger";
import LibraryInvite from './pages/LibraryInvite';
import { io } from "socket.io-client";
import { useState, useEffect } from "react";
import { SocketContext, UserContext } from "./contexts";
import axios from "axios";

const BlankPage = () => <div className="min-h-screen bg-white pt-24" />;

function App() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const handleUserChange = () => {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error("Lỗi parse user từ sessionStorage:", error);
          sessionStorage.removeItem("user");
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    window.addEventListener("userChanged", handleUserChange);
    return () => window.removeEventListener("userChanged", handleUserChange);
  }, []);

  useEffect(() => {
    if (!user) return;

    console.log("🔌 Creating socket for user:", user.id);
    const newSocket = io(API_URL, { withCredentials: true });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      newSocket.emit("set_user", { userId: user.id });
    });

    setSocket(newSocket);

    return () => {
      console.log("🔌 Disconnecting socket");
      newSocket.disconnect();
    };
  }, [user, API_URL]);

  // 🔔 Fetch notifications on app load
  useEffect(() => {
    if (!user?.id || !API_URL) return;

    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/notifications?userId=${user.id}&limit=20`);
        if (res.data.success) {
          setNotifications(res.data.data);
          const unread = res.data.data.filter(n => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error("❌ Error fetching notifications:", error);
      }
    };

    fetchNotifications();
  }, [user?.id, API_URL]);

  // 🔔 Listen to new notifications via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = ({ notification }) => {
      // Add new notification to top of array
      setNotifications(prev => [notification, ...prev]);
      // Increment unread if not read
      if (!notification.isRead) {
        setUnreadCount(prev => prev + 1);
      }
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [socket]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <SocketContext.Provider value={{ socket, notifications, unreadCount, setNotifications, setUnreadCount }}>
        <Navbar user={user} socket={socket} unreadCount={unreadCount} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/feed" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/manage-photos" element={<PhotoManagement />} />
          <Route path="/chat" element={<BlankPage />} />
          <Route path="/messenger" element={<Messenger />} />
          <Route path="/library-invite" element={<LibraryInvite />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/ai-chat" element={<AIChatPage />} />
          <Route path="/home" element={<BlankPage />} />
          <Route path="/onboarding/photo-upload" element={<PhotoManagement />} />
          <Route path="/community" element={<Community />} />
        </Routes>
      </SocketContext.Provider>
    </UserContext.Provider>
  );
}

export default App;