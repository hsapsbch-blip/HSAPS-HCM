import React from 'react';
import { DashboardIcon } from './components/icons/DashboardIcon';
import { UsersIcon } from './components/icons/UsersIcon';
import { SponsorsIcon } from './components/icons/SponsorsIcon';
import { TasksIcon } from './components/icons/TasksIcon';
import { SubmissionsIcon } from './components/icons/SubmissionsIcon';
import { SpeakersIcon } from './components/icons/SpeakersIcon';
import { ProgramIcon } from './components/icons/ProgramIcon';
import { FinanceIcon } from './components/icons/FinanceIcon';
import { DocumentIcon } from './components/icons/DocumentIcon';
import { SettingsIcon } from './components/icons/SettingsIcon';

export const NAV_ITEMS = [
  { href: '/', label: 'Bảng điều khiển', icon: <DashboardIcon className="w-5 h-5" />, permission: 'dashboard:view' },
  { href: '/users', label: 'Người dùng', icon: <UsersIcon className="w-5 h-5" />, permission: 'users:view' },
  { href: '/speakers', label: 'Chủ tọa/Báo cáo viên', icon: <SpeakersIcon className="w-5 h-5" />, permission: 'speakers:view' },
  { href: '/program', label: 'Chương trình', icon: <ProgramIcon className="w-5 h-5" />, permission: 'program:view' },
  { href: '/sponsors', label: 'Nhà tài trợ', icon: <SponsorsIcon className="w-5 h-5" />, permission: 'sponsors:view' },
  { href: '/submissions', label: 'Danh sách đăng ký', icon: <SubmissionsIcon className="w-5 h-5" />, permission: 'submissions:view' },
  { href: '/finance', label: 'Thu Chi', icon: <FinanceIcon className="w-5 h-5" />, permission: 'finance:view' },
  { href: '/tasks', label: 'Công việc', icon: <TasksIcon className="w-5 h-5" />, permission: 'tasks:view' },
  { href: '/documents', label: 'Tài liệu', icon: <DocumentIcon className="w-5 h-5" />, permission: 'documents:view' },
  { href: '/settings', label: 'Cài đặt', icon: <SettingsIcon className="w-5 h-5" />, permission: 'settings:view' },
];