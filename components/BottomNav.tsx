import React from 'react';
import { NavLink } from 'react-router-dom';
import { SubmissionsIcon } from './icons/SubmissionsIcon';
import { SponsorsIcon } from './icons/SponsorsIcon';
import { FinanceIcon } from './icons/FinanceIcon';
import { SpeakersIcon } from './icons/SpeakersIcon';

const BOTTOM_NAV_ITEMS = [
  { href: '/submissions', label: 'Đăng ký', icon: SubmissionsIcon },
  { href: '/sponsors', label: 'NTT', icon: SponsorsIcon },
  { href: '/finance', label: 'Thu Chi', icon: FinanceIcon },
  { href: '/speakers', label: 'CT/BCV', icon: SpeakersIcon },
];

const BottomNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-1px_3px_0_rgba(0,0,0,0.08)] z-40">
      <div className="flex justify-around items-center h-16">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full text-xs transition-colors duration-200 ${
                isActive ? 'text-primary' : 'text-gray-500 hover:text-primary'
              }`
            }
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;