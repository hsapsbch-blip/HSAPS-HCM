import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useAuth } from '../App';
import { useTheme, themes } from '../contexts/ThemeContext';
import { BellIcon } from './icons/BellIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { MenuIcon } from './icons/MenuIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import ChangePasswordModal from './ChangePasswordModal';

// Helper function to format time difference
const timeSince = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return "vài giây trước";
};

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const { profile, notifications, markNotificationAsRead, clearAllNotifications, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  
  const notificationRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentNavItem = NAV_ITEMS.find(item => location.pathname.startsWith(item.href) && item.href !== '/');
  const title = currentNavItem ? currentNavItem.label : 'Bảng điều khiển';
  
  const unreadCount = notifications.filter(n => !n.read).length;

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0">
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-500 hover:text-gray-800 mr-4"
            aria-label="Open menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">{title}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative hidden md:block">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="bg-gray-100 text-gray-800 rounded-full py-2 pl-10 pr-4 w-48 lg:w-64 focus:outline-none focus:ring-2 focus:ring-primary border border-gray-300"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          
          {/* Settings */}
          <div className="relative" ref={settingsRef}>
              <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600 focus:outline-none"
                  aria-label="Cài đặt giao diện"
              >
                  <SettingsIcon className="w-6 h-6" />
              </button>
              {isSettingsOpen && (
                   <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-xl overflow-hidden z-20">
                      <div className="py-2 px-4 border-b">
                          <h4 className="text-base font-semibold text-gray-800">Chọn giao diện</h4>
                      </div>
                      <div className="p-4 space-y-3">
                          {Object.entries(themes).map(([key, value]) => (
                              <label key={key} className="flex items-center cursor-pointer">
                                  <input
                                      type="radio"
                                      name="theme"
                                      value={key}
                                      checked={theme === key}
                                      onChange={() => setTheme(key as keyof typeof themes)}
                                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                  />
                                  <span className="ml-3 text-sm text-gray-700">{value.name}</span>
                                  <div className="ml-auto flex space-x-1">
                                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: `rgb(${value.primary})` }}></span>
                                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: `rgb(${value.primaryDark})` }}></span>
                                  </div>
                              </label>
                          ))}
                      </div>
                  </div>
              )}
          </div>
          
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
              <button 
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600 focus:outline-none"
                  aria-label="Thông báo"
              >
                  <BellIcon className="w-6 h-6" />
                  {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center border-2 border-white">
                          {unreadCount}
                      </span>
                  )}
              </button>
              {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-20">
                      <div className="py-2 px-4 border-b flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-800">Thông báo</h4>
                          <button onClick={clearAllNotifications} className="text-sm text-primary hover:underline">Xóa tất cả</button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                          {notifications.length > 0 ? notifications.map(n => (
                              <Link 
                                  to={n.link || '#'} 
                                  key={n.id} 
                                  onClick={() => markNotificationAsRead(n.id)}
                                  className={`flex items-start px-4 py-3 hover:bg-gray-50 ${!n.read ? 'bg-primary-light' : ''}`}
                              >
                                  <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-primary' : 'bg-gray-300'}`}></div>
                                  <div className="ml-3">
                                      <p className="text-sm text-gray-700">{n.message}</p>
                                      <p className="text-xs text-gray-500 mt-1">{timeSince(n.created_at)}</p>
                                  </div>
                              </Link>
                          )) : (
                             <div className="text-center py-6">
                               <p className="text-sm text-gray-500">Không có thông báo mới.</p>
                             </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
          
          {/* Profile Dropdown */}
          {profile && (
            <div className="relative" ref={profileRef}>
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 focus:outline-none">
                  <img 
                    src={profile.avatar || `https://i.pravatar.cc/150?u=${profile.id}`} 
                    alt={profile.full_name} 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="hidden md:block text-left">
                      <p className="font-semibold text-gray-900 truncate">{profile.full_name}</p>
                      <p className="text-sm text-gray-500">{profile.role}</p>
                  </div>
                  <ChevronDownIcon className="w-4 h-4 text-gray-500 hidden md:block" />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl overflow-hidden z-20">
                  <button
                    onClick={() => {
                      setIsChangePasswordOpen(true);
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <SettingsIcon className="w-5 h-5 mr-3 text-gray-500"/>
                    Đổi mật khẩu
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
                  >
                    <LogoutIcon className="w-5 h-5 mr-3"/>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </>
  );
};

export default Header;
