import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { UsersIcon } from '../components/icons/UsersIcon';
import { MailIcon } from '../components/icons/MailIcon';
import { MessageIcon } from '../components/icons/MessageIcon';
import { ApiIcon } from '../components/icons/ApiIcon';
import { useAuth } from '../App';

const settingsNav = [
    { name: 'Quản lý vai trò', href: '/settings/roles', icon: UsersIcon },
    { name: 'Mẫu Email', href: '/settings/templates', icon: MailIcon },
    { name: 'Cài đặt Email', href: '/settings/email', icon: MailIcon },
    { name: 'Cài đặt Zalo', href: '/settings/zalo', icon: MessageIcon },
    { name: 'Tích hợp Abitstore', href: '/settings/abitstore', icon: ApiIcon },
];

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Settings: React.FC = () => {
    const { hasPermission } = useAuth();
    
    if (!hasPermission('settings:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Cài đặt hệ thống</h1>
            <p className="mt-2 text-gray-600">Quản lý cấu hình chung cho ứng dụng.</p>

            <div className="flex flex-col lg:flex-row mt-8 gap-8">
                <aside className="lg:w-1/4">
                    <nav className="space-y-1">
                        {settingsNav.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={({ isActive }) =>
                                    `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        isActive
                                            ? 'bg-primary-light text-primary'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon
                                            className={`mr-3 h-6 w-6 flex-shrink-0 ${
                                                isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
                                            }`}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{item.name}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <main className="flex-1 bg-white p-6 rounded-lg shadow">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Settings;