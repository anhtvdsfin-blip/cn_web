import { Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import CompleteProfile from "./pages/CompleteProfile";
import PhotoManagement from "./pages/PhotoManagement";
import OpeningMoveOnboarding from "./pages/OpeningMoveOnboarding";
import Messenger from "./pages/Messenger";
import LibraryInvite from './pages/LibraryInvite';
import Community from "./pages/Community";
import Chat from "./pages/Chat";
import YourCrush from './pages/YourCrush';
import { io } from "socket.io-client";
import { useState, useEffect } from "react";
import { SocketContext, UserContext } from "./contexts";
import axios from "./utils/axiosConfig";

const BlankPage = () => <div className="min-h-screen bg-white pt-24" />;

function App() {
  const navigate = useNavigate();
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

  // Set axios Authorization header from stored accessToken when app loads or user changes
  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [user]);

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

  // Listen for session expiration from axios interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('🔐 Session expired, logging out...');
      setUser(null);
      setSocket(null);
      navigate('/login');
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    console.log("🔌 Creating socket for user:", user.id);
    const newSocket = io(API_URL, { withCredentials: true });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      newSocket.emit("set_user", { userId: user.id });
      // Also emit server-expected auth/join events so user is in both rooms
      try {
        newSocket.emit('user:join', user.id); // postSocket
      } catch (e) {
        console.warn('user:join emit failed', e);
      }
      try {
        // Use userId for socket auth (persistent connection doesn't work well with short-lived JWT)
        newSocket.emit('auth_user', { userId: user.id });
      } catch (e) {
        console.warn('auth_user emit failed', e);
      }
      try {
        // Join notification room to receive notification events
        newSocket.emit('auth_notification', { userId: user.id });
      } catch (e) {
        console.warn('auth_notification emit failed', e);
      }
      try {
        newSocket.emit('join_conversations', user.id); // ensure join of user_<id> room for chat messages
      } catch (e) {
        console.warn('join_conversations emit failed', e);
      }
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
    // When a mutual match happens anywhere in the app, open Messenger and select the match
    const handleMutualNavigate = ({ conversationId, matchId }) => {
      try {
        const id = matchId || conversationId;
        console.debug('App socket mutual_match received', { conversationId, matchId, id });
        if (id) navigate(`/messenger/${encodeURIComponent(String(id))}`);
        else navigate('/messenger');
      } catch (e) {
        console.error('Failed to navigate to messenger on mutual_match', e);
      }
    };
    socket.on('mutual_match', handleMutualNavigate);

    const handleNewNotification = ({ notification }) => {
      console.log('🔔 Received new_notification event:', notification);
      // Add new notification to top of array
      setNotifications(prev => [notification, ...prev]);
      // Increment unread if not read
      if (!notification.isRead) {
        setUnreadCount(prev => prev + 1);
      }
    };

    socket.on("new_notification", handleNewNotification);

    // Also listen for new chat messages and push them into notifications
    const handleNewMessageForNotif = (payload) => {
      console.debug('socket new_message received at App:', payload);
      try {
        // payload may be { conversationId, message } or { message }
        const message = payload?.message || payload;
        if (!message) return;

        // Ignore messages sent by ourselves to avoid self-notifications
        if (user?.id && (String(message.senderId) === String(user.id))) {
          return;
        }

        const senderName = message.senderName || message.sender?.name || message.fromName || message.from?.name || 'Ai đó';
        const preview = (message.content || '').slice(0, 120);

        const notif = {
          _id: `m-${Date.now()}`,
          type: 'message',
          content: `${senderName}: ${preview}`,
          createdAt: new Date().toISOString(),
          isRead: false,
          // attach reference so click can navigate later
          meta: {
            conversationId: payload.conversationId || message.conversationId || message.chatRoomId
          }
        };

        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(prev => prev + 1);
      } catch (e) {
        console.error('Error handling new_message for notif', e);
      }
    };

    socket.on('new_message', handleNewMessageForNotif);

    return () => {
      socket.off("new_notification", handleNewNotification);
      socket.off('new_message', handleNewMessageForNotif);
      socket.off('mutual_match', handleMutualNavigate);
    };
  }, [socket, user?.id]);

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
          <Route path="/chat" element={<Chat />} />
          <Route path="/messenger" element={<Messenger />} />
          <Route path="/library-invite" element={<LibraryInvite />} />
          <Route path="/your-crush" element={<YourCrush />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/home" element={<BlankPage />} />
          <Route path="/onboarding/photo-upload" element={<PhotoManagement />} />
          <Route path="/onboarding/opening-move" element={<OpeningMoveOnboarding onComplete={() => { window.location.href = '/feed'; }} />} />
          <Route path="/community" element={<Community />} />
          <Route path="/messenger/:id" element={<Messenger />} />
        </Routes>
      </SocketContext.Provider>
    </UserContext.Provider>
  );
}

export default App;