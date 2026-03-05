import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import defaultAvatar from "../images/defaultAvatar.png";
import { useUser } from "../context/UserContext";
import { toAbsolute, withBust } from "../utils/url";
import "../css/Header.css";

// ==== Utility Functions ====

/**
 * Formats a given date string into a human-readable "time ago" format.
 * @param {String|Date} dateString - The date to format.
 * @returns {String} Formatted string (e.g., "Just now", "5m ago", "2h ago", "3d ago").
 */
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
  
  // Fallback to standard date format if older than a week
  return date.toLocaleDateString();
};

// ==== Main Component ====

/**
 * SiteHeader Component
 * The global navigation bar that handles user routing, responsive mobile menus,
 * real-time notifications, and user authentication state (login/logout).
 */
const SiteHeader = () => {
  // ---- UI States ----
  const [showMenu, setShowMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ---- Data States ----
  const [notifications, setNotifications] = useState([]);
  
  // ---- Global Context & Routing ----
  const { user, fetchMe, signOut } = useUser();
  const navigate = useNavigate();

  // ==== Lifecycle Effects ====

  // Fetch user profile data when the component mounts
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Fetch notifications and set up event listeners once the user is authenticated
  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Listen for custom global events to trigger a notification refresh (e.g., after AI grading)
      const handleNewNotification = () => fetchNotifications();
      window.addEventListener("new_notification", handleNewNotification);
      
      // Cleanup the event listener when the component unmounts.
      return () => window.removeEventListener("new_notification", handleNewNotification);
    }
  }, [user]);

  // Handle clicks outside of dropdown menus to close them automatically
  useEffect(() => {
    const closeMenus = (e) => {
      if (!e.target.closest(".user-menu")) setShowMenu(false);
      if (!e.target.closest(".notif-menu")) setShowNotif(false);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  // ==== API & Event Handlers ====

  /**
   * Fetches the latest notifications for the logged-in user from the server.
   */
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications");
    }
  };

  // Calculate the number of unread notifications for the bell badge
  const unreadCount = notifications.filter(n => !n.isRead).length;

  /**
   * Toggles the user profile menu and ensures the notification menu is closed.
   */
  const handleToggleMenu = () => {
    setShowMenu(v => !v);
    setShowNotif(false);
  };

  /**
   * Toggles the notification menu and ensures the user profile menu is closed.
   */
  const handleToggleNotif = () => {
    setShowNotif(v => !v);
    setShowMenu(false);
  };

  /**
   * Initiates the logout process by hiding menus and showing the confirmation modal.
   */
  const handleLogoutClick = () => {
    setShowMenu(false); // Đóng menu dropdown
    setShowLogoutModal(true); // Mở Modal xác nhận lên
  };

  /**
   * Executes the actual logout API call, clears local user context, and redirects to the homepage.
   */  const confirmLogout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      signOut();  // Clear local context
      setShowLogoutModal(false);
      window.location.assign("/");  // Hard redirect to clear all local states
    }
  };

  /**
   * Handles navigation to the contact page.
   * Redirects unauthenticated users to the login page first, preserving their intended destination.
   */
  const goContact = (e) => {
    e.preventDefault();
    setShowMobileNav(false);  // Close mobile menu if open
    if (user) {
      navigate('/contact');
    } else {
      navigate('/login', { state: { from: { pathname: '/contact' } } });
    }
  };

  /**
   * Marks all notifications as read in the database and updates the local state.
   */
  const handleMarkAllRead = async (e) => {
    e.stopPropagation(); // Prevent the dropdown from closing when clicking the button
    try {
      await api.put('/notifications/read');
      // Update local state to instantly remove the unread styling and badge
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read");
    }
  };

  /**
   * Handles clicking on a specific notification.
   * Marks it as read if necessary, then navigates to the associated link.
   * @param {Object} notif - The notification object clicked.
   */
  const handleNotifClick = async (notif) => {
    setShowNotif(false); // Close the menu
    
    // If the notification is unread, call the API to mark it as read
    if (!notif.isRead) {
        try {
            await api.put(`/notifications/${notif._id}/read`);
            
            // Instantly update the local state to remove the blue background and dot
            setNotifications(prev => prev.map(n => 
                n._id === notif._id ? { ...n, isRead: true } : n
            ));
        } catch (err) {
            console.error("Failed to mark notification as read");
        }
    }

    // Redirect the user to the relevant page (e.g., test results)
    if (notif.link) navigate(notif.link);
  };

  // Prepare avatar URL with cache-busting to ensure newly uploaded avatars reflect immediately
  const rawAvatar = user?.avatarUrl ? toAbsolute(user.avatarUrl) : defaultAvatar;
  const avatarSrc = user?.avatarUrl ? withBust(rawAvatar, user.updatedAt) : defaultAvatar;
  const displayName = user?.fullname || "Name";

  // ==== Render ====

  return (
    <>
      <header className="header">

        {/* ==== Left Section: Mobile Menu Button & Logo ==== */}
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={() => setShowMobileNav(!showMobileNav)}>
            <i className={`bi ${showMobileNav ? 'bi-x' : 'bi-list'}`}></i>
          </button>
          <a className="logo" href="/">BrainBoost</a>
        </div>

        {/* ==== Center Section: Main Navigation (Responsive Drawer) ==== */}
        <nav className={`main-nav ${showMobileNav ? 'open' : ''}`}>
          {user?.role === 'admin' && <a href="/admin">Admin</a>}
          {(user?.role === 'instructor' || user?.role === 'admin') && <a href="/instructor">Teaching</a>}
          <a href="/courses">Courses</a>
          <a href="/tests">Online Exam</a>
          <a href="/about">About Us</a>
          <a href="/contact" onClick={goContact}>Contact</a>
        </nav>

        {/* ==== Right Section: Notifications & User Avatar ==== */}
        <div className="header-right">
          {user ? (
            <>
              {/* --- Notification Bell --- */}
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

              {/* --- User Profile Menu --- */}
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

                    <div className="menu-item" onClick={handleLogoutClick}>
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

      {/* ==== Mobile Navigation Backdrop Overlay ==== */}
      {/* Darkens the background when the mobile menu drawer is open */}
      {showMobileNav && (
        <div className="mobile-nav-backdrop" onClick={() => setShowMobileNav(false)}></div>
      )}

      {/* ==== Logout  Confirmation Modal ==== */}
      {showLogoutModal && (
          <div className="logout-modal-backdrop" onClick={() => setShowLogoutModal(false)}>
            <div className="logout-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="lm-icon">
                <i className="bi bi-box-arrow-right"></i>
              </div>
              <h3 className="lm-title">Sign Out</h3>
              <p className="lm-desc">
                Are you sure you want to sign out of BrainBoost?
              </p>
              <div className="lm-actions">
                <button className="lm-btn-cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                <button className="lm-btn-danger" onClick={confirmLogout}>Yes, Sign Out</button>
              </div>
            </div>
          </div>
        )}
    </>
  );
};

export default SiteHeader;