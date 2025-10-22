import React from 'react';
import { DashboardIcon } from './components/icons/DashboardIcon';
import { SponsorsIcon } from './components/icons/SponsorsIcon';
import { TasksIcon } from './components/icons/TasksIcon';
import { SubmissionsIcon } from './components/icons/SubmissionsIcon';
import { SpeakersIcon } from './components/icons/SpeakersIcon';
import { ProgramIcon } from './components/icons/ProgramIcon';
import { FinanceIcon } from './components/icons/FinanceIcon';
import { DocumentIcon } from './components/icons/DocumentIcon';
import { SettingsIcon } from './components/icons/SettingsIcon';
import { MailIcon } from './components/icons/MailIcon';
import { NotificationIcon } from './components/icons/NotificationIcon';
import { UsersIcon } from './components/icons/UsersIcon';

export const NAV_ITEMS = [
  { href: '/', label: 'Bảng điều khiển', icon: <DashboardIcon className="w-5 h-5" />, permission: 'dashboard:view' },
  { href: '/submissions', label: 'Đăng ký', icon: <SubmissionsIcon className="w-5 h-5" />, permission: 'submissions:view' },
  { href: '/speakers', label: 'CT/BCV', icon: <SpeakersIcon className="w-5 h-5" />, permission: 'speakers:view' },
  { href: '/sponsors', label: 'Nhà tài trợ', icon: <SponsorsIcon className="w-5 h-5" />, permission: 'sponsors:view' },
  { href: '/program', label: 'Chương trình', icon: <ProgramIcon className="w-5 h-5" />, permission: 'program:view' },
  { href: '/finance', label: 'Thu Chi', icon: <FinanceIcon className="w-5 h-5" />, permission: 'finance:view' },
  { href: '/tasks', label: 'Công việc', icon: <TasksIcon className="w-5 h-5" />, permission: 'tasks:view' },
  { href: '/bulk-email', label: 'Gửi Email', icon: <MailIcon className="w-5 h-5" />, permission: 'email:send_bulk' },
  { href: '/documents', label: 'Tài liệu', icon: <DocumentIcon className="w-5 h-5" />, permission: 'documents:view' },
  { href: '/notifications', label: 'Thông báo', icon: <NotificationIcon className="w-5 h-5" />, permission: 'dashboard:view' },
  { href: '/users', label: 'Người dùng', icon: <UsersIcon className="w-5 h-5" />, permission: 'users:view' },
  { href: '/settings', label: 'Cài đặt', icon: <SettingsIcon className="w-5 h-5" />, permission: 'settings:view' },
];