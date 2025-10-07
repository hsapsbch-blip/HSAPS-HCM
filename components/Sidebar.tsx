import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useAuth } from '../App';
import { LogoutIcon } from './icons/LogoutIcon';
import { BrandIcon } from './icons/BrandIcon';
import { XIcon } from './icons/XIcon';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { logout, hasPermission } = useAuth();
  
  const visibleNavItems = NAV_ITEMS.filter(item => !item.permission || hasPermission(item.permission));

  return (
    <aside className={`w-64 bg-white text-gray-800 flex flex-col flex-shrink-0 border-r border-gray-200 transition-transform duration-300 ease-in-out z-40
      fixed inset-y-0 left-0 lg:relative lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <BrandIcon className="w-8 h-8 text-primary" />
          <span className="text-xl font-semibold text-gray-900">HSAPS 2025</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-800">
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            end={item.href === '/'}
            onClick={() => setIsOpen(false)} // Close sidebar on navigation
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            {item.icon}
            <span className="ml-3">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-200">
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogoutIcon className="w-5 h-5" />
          <span className="ml-3">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;