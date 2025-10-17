import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "../css/Header.css";
import defaultAvatar from "../images/defaultAvatar.png";
import { useUser } from "../context/UserContext";
import { toAbsolute, withBust } from "../utils/url";

const SiteHeader = () => {
  const [showMenu, setShowMenu] = useState(false);
  const { user, fetchMe, signOut } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMe()
  }, [fetchMe]);

  const handleToggleMenu = () => setShowMenu(v => !v);

  useEffect(() => {
    const closeMenu = (e) => {
      if (!e.target.closest(".user-menu")) setShowMenu(false);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
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

                <div className="menu-item">
                  <div className="menu-left">
                    <i className="bi bi-person-circle menu-icon"></i>
                    <a href="/profile">My Profile</a>
                  </div>
                  <span className="arrow">›</span>
                </div>

                <div className="menu-item">
                  <div className="menu-left">
                    <i className="bi bi-journals menu-icon"></i>
                    <a href="/learning">Learning</a>
                  </div>
                  <span className="arrow">›</span>
                </div>

                <div className="menu-item">
                  <div className="menu-left">
                    <i className="bi bi-gear-fill menu-icon"></i>
                    <a href="/settings">Settings</a>
                  </div>
                  <span className="arrow">›</span>
                </div>

                <div className="menu-item">
                  <div className="menu-left">
                    <i className="bi bi-question-circle-fill menu-icon"></i>
                    <a href="/help">Help</a>
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
        ) : (
          <a href="/login" className="account-link">Login</a>
        )}
      </div>
    </header>
  );
};

export default SiteHeader;