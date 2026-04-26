import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import defaultAvatar from "../images/defaultAvatar.png";
import { useUser } from "../context/UserContext";
import { toAbsolute, withBust } from "../utils/url";
import { useSocket } from "../context/SocketContext";
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

  // ---- Toast State ----
  const [toast, setToast] = useState({ show: false, title: "", msg: "", type: "system" });

  // ---- Data States ----
  const [notifications, setNotifications] = useState([]);
  
  // ---- Global Context & Routing ----
  const { user, fetchMe, signOut } = useUser();
  const socket = useSocket();
  const navigate = useNavigate();

  // ==== Lifecycle Effects ====

  // Fetch user profile data when the component mounts
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Fetch initial notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // ---- SOCKET.IO LISTENER (The Magic Happens Here) ----
  useEffect(() => {
    if (!socket) {
        console.log("No socket connection in Header!");
        return;
    }

    console.log("Header connected to Socket:", socket.id);

    const handleNewNotification = (newNotif) => {
      console.log("Received new notification:", newNotif);
      // Add the new notification to the TOP of the current list
      setNotifications(prev => [newNotif, ...prev]);

      // Trigger the Toast display at the corner of the screen
      setToast({
        show: true,
        title: newNotif.title,
        msg: newNotif.message,
        type: newNotif.type || "system"
      });
    };

    socket.on('new_notification', handleNewNotification);

    // Listen for the "Read" status sync event from other tabs
    const handleSyncRead = ({ notifId }) => {
        if (notifId === 'all') {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } else {
            setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
        }
    };
    
    socket.on('sync_read_status', handleSyncRead);

    // Cleanup listeners when the component unmounts
    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('sync_read_status', handleSyncRead);
    };
  }, [socket]);

  // Automatically hide the Toast after 4 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ show: false, title: "", msg: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Handle clicks outside of dropdown menus to close them automatically
  useEffect(() => {
    const closeMenus = (e) => {
      // If the click is outside the user profile menu, close it
      if (!e.target.closest(".user-menu")) setShowMenu(false);
      // If the click is outside the notification menu, close it
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
    setShowMenu(false); // Close the dropdown menu
    setShowLogoutModal(true); // Open the confirmation modal
  };

  /**
   * Executes the actual logout API call, clears local user context, and redirects.
   * Prevents "Zombie Sessions" by enforcing strict cleanup sequence.
   */
  const confirmLogout = async () => {
    try {
      // Request backend to destroy all authentication cookies
      await api.post("/auth/logout");
      
      // Clear frontend context ONLY if the backend request succeeds
      signOut();  
      setShowLogoutModal(false);

      // Manually destroy the CSRF cookie on the client side as a fallback
      document.cookie = "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Hard redirect to the login page to snap all data-fetching loops
      window.location.href = "/"; 
      
    } catch (error) {
      console.error("Logout Error:", error);
      alert("Logout failed due to a network or server error. Please try again.");
      setShowLogoutModal(false);
    }
  };

  /**
   * Handles navigation to the contact page.
   * Redirects unauthenticated users to the login page first, preserving their intended destination.
   */
  const goContact = (e) => {
    e.preventDefault();
    setShowMobileNav(false);

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

  // ==== Render Preparation & UI ====

  // Calculate the number of unread notifications for the bell badge
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Prepare avatar URL with cache-busting to ensure newly uploaded avatars reflect immediately
  const rawAvatar = user?.avatarUrl ? toAbsolute(user.avatarUrl) : defaultAvatar;
  const avatarSrc = user?.avatarUrl ? withBust(rawAvatar, user.updatedAt) : defaultAvatar;
  const displayName = user?.fullname || "Name";

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
          {(user?.role === 'instructor') && <a href="/instructor">Teaching</a>}
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
                              {notif.type === 'content' && <i className="bi bi-journal-check"></i>}
                              {!['ai_grading', 'leaderboard', 'system', 'content'].includes(notif.type) && <i className="bi bi-bell-fill"></i>}
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

      {/* ==== CORNER TOAST NOTIFICATION ==== */}
      {toast.show && (
          <div className={`toast ${toast.type}`} style={{
              position: 'fixed', right: '20px', bottom: '20px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              padding: '16px 20px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px var(--shadow-color)',
              zIndex: 9999,
              borderLeft: '4px solid var(--primary)',
              display: 'flex', flexDirection: 'column', gap: '6px',
              minWidth: '280px', maxWidth: '350px',
              cursor: 'pointer'
          }} onClick={() => setToast({...toast, show: false})}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '15px' }}>
                  <i className="bi bi-bell-fill" style={{ color: 'var(--primary)' }}></i>
                  {toast.title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {toast.msg}
              </div>
          </div>
      )}
    </>
  );
};

export default SiteHeader;