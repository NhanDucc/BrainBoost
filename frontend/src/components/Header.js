import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import defaultAvatar from "../images/defaultAvatar.png";
import { useUser } from "../context/UserContext";
import { toAbsolute, withBust } from "../utils/url";
import "../css/Header.css";

// Hàm hỗ trợ format thời gian (VD: "2 hours ago", "Just now")
const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
};

const SiteHeader = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  const { user, fetchMe, signOut } = useUser();
  const navigate = useNavigate();

  // Load User Data & Notifications
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Lắng nghe tín hiệu báo có thông báo mới từ các component khác
      const handleNewNotification = () => fetchNotifications();
      window.addEventListener("new_notification", handleNewNotification);
      
      // Cleanup event khi component bị unmount
      return () => window.removeEventListener("new_notification", handleNewNotification);
    }
  }, [user]);

  // Hàm gọi API lấy thông báo
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications");
    }
  };

  // Tính toán số lượng thông báo chưa đọc
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleToggleMenu = () => {
    setShowMenu(v => !v);
    setShowNotif(false); // Đóng Notif nếu đang mở
  };

  const handleToggleNotif = () => {
    setShowNotif(v => !v);
    setShowMenu(false); // Đóng Menu User nếu đang mở
  };

  // Xử lý Click Outside để đóng các Dropdown
  useEffect(() => {
    const closeMenus = (e) => {
      if (!e.target.closest(".user-menu")) setShowMenu(false);
      if (!e.target.closest(".notif-menu")) setShowNotif(false);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      signOut();
      setShowMenu(false);
      window.location.assign("/");
    }
  };

  const goContact = (e) => {
    e.preventDefault();
    if (user) {
      navigate('/contact');
    } else {
      navigate('/login', { state: { from: { pathname: '/contact' } } });
    }
  };

  // Xử lý khi bấm nút "Mark all as read"
  const handleMarkAllRead = async (e) => {
    e.stopPropagation(); // Ngăn dropdown bị đóng
    try {
      await api.put('/notifications/read');
      // Update state local
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read");
    }
  };

  // Xử lý khi click vào 1 thông báo
  const handleNotifClick = async (notif) => {
    setShowNotif(false); // Đóng menu
    
    // Nếu thông báo chưa đọc, gọi API đánh dấu đã đọc
    if (!notif.isRead) {
        try {
            await api.put(`/notifications/${notif._id}/read`);
            
            // Cập nhật state local để UI mất nền xanh và chấm xanh ngay lập tức
            setNotifications(prev => prev.map(n => 
                n._id === notif._id ? { ...n, isRead: true } : n
            ));
        } catch (err) {
            console.error("Failed to mark notification as read");
        }
    }

    // Chuyển hướng đến trang kết quả
    if (notif.link) navigate(notif.link);
  };

  const rawAvatar = user?.avatarUrl ? toAbsolute(user.avatarUrl) : defaultAvatar;
  const avatarSrc = user?.avatarUrl ? withBust(rawAvatar, user.updatedAt) : defaultAvatar;
  const displayName = user?.fullname || "Name";

  return (
    <header className="header">
      <a className="logo" href="/">BrainBoost</a>

      <nav>
        {user?.role === 'admin' && <a href="/admin">Admin</a>}
        {(user?.role === 'instructor' || user?.role === 'admin') && <a href="/instructor">Teaching</a>}
        <a href="/courses">Courses</a>
        <a href="/tests">Online Exam</a>
        <a href="/about">About Us</a>
        <a href="/contact" onClick={goContact}>Contact</a>
      </nav>

      <div className="header-right">
        {user ? (
          <>
            {/* ==== Notification Bell ==== */}
            <div className="notif-menu">
              <div className="notif-icon-btn" onClick={handleToggleNotif}>
                <i className="bi bi-bell-fill"></i>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </div>

              {showNotif && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <h4>Notifications</h4>
                    {unreadCount > 0 && (
                      <button className="mark-read-btn" onClick={handleMarkAllRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  
                  <div className="notif-body">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">
                        <i className="bi bi-bell-slash"></i>
                        <p>No notifications yet.</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif._id} 
                          className={`notif-item ${!notif.isRead ? 'unread' : ''}`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <div className={`notif-icon-circle type-${notif.type}`}>
                            {notif.type === 'ai_grading' && <i className="bi bi-stars"></i>}
                            {notif.type === 'leaderboard' && <i className="bi bi-trophy-fill"></i>}
                            {notif.type === 'system' && <i className="bi bi-info-circle-fill"></i>}
                            {!['ai_grading', 'leaderboard', 'system'].includes(notif.type) && <i className="bi bi-bell-fill"></i>}
                          </div>
                          <div className="notif-content">
                            <div className="notif-title">{notif.title}</div>
                            <div className="notif-message">{notif.message}</div>
                            <div className="notif-time">{formatTimeAgo(notif.createdAt)}</div>
                          </div>
                          {!notif.isRead && <div className="notif-unread-dot"></div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ==== User Profile Menu ==== */}
            <div className="user-menu">
              <img
                src={avatarSrc}
                alt="User Avatar"
                className="avatar"
                onClick={handleToggleMenu}
              />
              {showMenu && (
                <div className="dropdown-menu">
                  <img src={avatarSrc} alt="User Avatar" className="dropdown-avatar" />
                  <div className="dropdown-name">{displayName}</div>

                  <div className="menu-item" onClick={() => navigate("/profile")}>
                    <div className="menu-left">
                      <i className="bi bi-person-circle menu-icon"></i>
                      <span>My Profile</span>
                    </div>
                    <span className="arrow">›</span>
                  </div>

                  <div className="menu-item" onClick={() => navigate("/learning")}>
                    <div className="menu-left">
                      <i className="bi bi-journals menu-icon"></i>
                      <span>Learning</span>
                    </div>
                    <span className="arrow">›</span>
                  </div>

                  <div className="menu-item" onClick={() => navigate("/settings")}>
                    <div className="menu-left">
                      <i className="bi bi-gear-fill menu-icon"></i>
                      <span>Settings</span>
                    </div>
                    <span className="arrow">›</span>
                  </div>

                  <div className="menu-item" onClick={() => navigate("/help")}>
                    <div className="menu-left">
                      <i className="bi bi-question-circle-fill menu-icon"></i>
                      <span>Help</span>
                    </div>
                    <span className="arrow">›</span>
                  </div>

                  <div className="menu-item" onClick={handleLogout}>
                    <div className="menu-left">
                      <i className="bi bi-box-arrow-right menu-icon"></i>
                      <button className="logout-link">Logout</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <a href="/login" className="account-link">Login</a>
        )}
      </div>
    </header>
  );
};

export default SiteHeader;