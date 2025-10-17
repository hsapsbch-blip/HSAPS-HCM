import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Status, Task, Submission } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { UsersIcon } from '../components/icons/UsersIcon';
import { SponsorsIcon } from '../components/icons/SponsorsIcon';
import { TasksIcon } from '../components/icons/TasksIcon';
import { FinanceIcon } from '../components/icons/FinanceIcon';

// Helper function to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper function to format date
const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Ngày không hợp lệ';
    }
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const SubmissionStatusChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const statusOrder: Status[] = [Status.PAYMENT_CONFIRMED, Status.APPROVED, Status.PAYMENT_PENDING, Status.PENDING, Status.REJECTED];
    const statusDisplay: Record<Status, { label: string; color: string }> = {
        [Status.PAYMENT_CONFIRMED]: { label: 'Đã thanh toán', color: 'bg-blue-500' },
        [Status.APPROVED]: { label: 'Đã duyệt', color: 'bg-green-500' },
        [Status.PAYMENT_PENDING]: { label: 'Chờ thanh toán', color: 'bg-orange-500' },
        [Status.PENDING]: { label: 'Chờ duyệt', color: 'bg-yellow-500' },
        [Status.REJECTED]: { label: 'Từ chối', color: 'bg-red-500' },
        [Status.IN_PROGRESS]: { label: 'Đang thực hiện', color: 'bg-gray-500' },
        [Status.COMPLETED]: { label: 'Hoàn thành', color: 'bg-gray-500' },
    };
    
    // Fix: Added explicit types to the reduce callback parameters to resolve arithmetic operation error.
    const total = Object.values(data).reduce((sum: number, count: number) => sum + count, 0);
    if (total === 0) return <p className="text-sm text-gray-500 text-center py-4">Chưa có dữ liệu đăng ký.</p>;

    return (
        <div className="space-y-3">
            {statusOrder.map(status => {
                const count = data[status] || 0;
                if (count === 0) return null;
                const percentage = (count / total) * 100;
                const display = statusDisplay[status];

                return (
                    <div key={status}>
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-600">{display.label}</span>
                            <span className="font-medium text-gray-800">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`${display.color} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


const Dashboard: React.FC = () => {
    const { profile, hasPermission } = useAuth();
    const [stats, setStats] = useState({
        attendees: 0,
        sponsors: 0,
        tasks: 0,
        revenue: 0,
    });
    const [submissionStatusCounts, setSubmissionStatusCounts] = useState<Record<string, number>>({});
    const [recentSubmissions, setRecentSubmissions] = useState<Partial<Submission>[]>([]);
    const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [
                    submissionsSummary,
                    sponsorsCount,
                    tasksCount,
                    revenueData,
                    recentSubmissionsData,
                    upcomingTasksData
                ] = await Promise.all([
                    supabase.from('submissions').select('status', { count: 'exact' }),
                    supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('status', Status.PAYMENT_CONFIRMED),
                    supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', Status.COMPLETED),
                    supabase.from('finance_transactions').select('amount').eq('type', 'Thu'),
                    supabase.from('submissions').select('id, full_name, registration_time, status, attendee_type').order('registration_time', { ascending: false }).limit(5),
                    supabase.from('tasks').select('*, profiles(full_name, avatar)').neq('status', Status.COMPLETED).order('due_date', { ascending: true }).limit(5)
                ]);

                if (submissionsSummary.error) throw new Error(`Submissions: ${submissionsSummary.error.message}`);
                const totalSubmissions = submissionsSummary.count ?? 0;
                const statusCounts = (submissionsSummary.data || []).reduce((acc, { status }) => {
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
                setSubmissionStatusCounts(statusCounts);

                if (sponsorsCount.error) throw new Error(`Sponsors: ${sponsorsCount.error.message}`);
                if (tasksCount.error) throw new Error(`Tasks: ${tasksCount.error.message}`);
                if (revenueData.error) throw new Error(`Revenue: ${revenueData.error.message}`);
                if (recentSubmissionsData.error) throw new Error(`Submissions: ${recentSubmissionsData.error.message}`);
                if (upcomingTasksData.error) throw new Error(`Tasks Data: ${upcomingTasksData.error.message}`);

                const totalRevenue = revenueData.data?.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0) || 0;

                setStats({
                    attendees: totalSubmissions,
                    sponsors: sponsorsCount.count ?? 0,
                    tasks: tasksCount.count ?? 0,
                    revenue: totalRevenue,
                });
                
                setRecentSubmissions(recentSubmissionsData.data || []);
                setUpcomingTasks(upcomingTasksData.data as Task[] || []);

            } catch (err: any) {
                setError(err.message || "Đã xảy ra lỗi khi tải dữ liệu.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        
        if (hasPermission('dashboard:view')) {
            fetchDashboardData();
        } else {
            setLoading(false);
        }
    }, [hasPermission]);
    
    const getDueDateInfo = (dueDateString: string | null | undefined): { text: string; color: string } => {
        if (!dueDateString) return { text: formatDate(dueDateString), color: 'text-gray-500' };
        
        const dueDate = new Date(dueDateString);
        const today = new Date();
        
        // Normalize dates to midnight to compare days correctly
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: `Quá hạn ${-diffDays} ngày`, color: 'text-red-600 font-semibold' };
        if (diffDays === 0) return { text: 'Hôm nay', color: 'text-red-600 font-semibold' };
        if (diffDays <= 3) return { text: `Còn ${diffDays} ngày`, color: 'text-orange-600' };
        return { text: formatDate(dueDateString), color: 'text-gray-500' };
    };


    const renderStatusBadge = (status: Status) => {
        const statusMap: { [key in Status]?: string } = {
          [Status.APPROVED]: 'bg-green-100 text-green-800',
          [Status.PENDING]: 'bg-yellow-100 text-yellow-800',
          [Status.REJECTED]: 'bg-red-100 text-red-800',
          [Status.PAYMENT_CONFIRMED]: 'bg-blue-100 text-blue-800',
          [Status.PAYMENT_PENDING]: 'bg-orange-100 text-orange-800'
        };
        return (
          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMap[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
          </span>
        );
    };
    
    const quickActions = [
        { label: "Thêm Đăng Ký", href: "/submissions", permission: "submissions:create" },
        { label: "Thêm Công Việc", href: "/tasks", permission: "tasks:create" },
        { label: "Thêm Nhà Tài Trợ", href: "/sponsors", permission: "sponsors:create" },
        { label: "Thêm Giao Dịch", href: "/finance", permission: "finance:create" },
    ].filter(action => hasPermission(action.permission));


    if (!hasPermission('dashboard:view')) {
        return <AccessDenied />;
    }

    if (loading) {
        return <div>Đang tải dữ liệu bảng điều khiển...</div>;
    }

    if (error) {
        return <div className="text-red-500">Lỗi: {error}</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Chào mừng trở lại, {profile?.full_name?.split(' ').pop()}!</h1>
                <p className="mt-2 text-gray-600">Đây là tổng quan nhanh về sự kiện HSAPS 2025.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <Link to="/submissions" className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-blue-100">
                        <UsersIcon className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Tổng đăng ký</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.attendees}</p>
                    </div>
                </Link>
                <Link to="/sponsors" className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-purple-100">
                        <SponsorsIcon className="w-7 h-7 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Nhà tài trợ (đã TT)</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.sponsors}</p>
                    </div>
                </Link>
                <Link to="/tasks" className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-orange-100">
                        <TasksIcon className="w-7 h-7 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Công việc tồn đọng</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.tasks}</p>
                    </div>
                </Link>
                <Link to="/finance" className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-green-100">
                        <FinanceIcon className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Doanh thu</p>
                        <p className="text-3xl font-bold text-gray-800">{formatCurrency(stats.revenue)}</p>
                    </div>
                </Link>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Công việc sắp tới</h3>
                    <div className="space-y-4">
                        {upcomingTasks.length > 0 ? upcomingTasks.map(task => {
                            const { text, color } = getDueDateInfo(task.due_date);
                            return (
                                <div key={task.id} className="flex justify-between items-center pb-2 border-b border-gray-100 last:border-b-0">
                                    <div className="flex items-center space-x-3">
                                        <img className="h-9 w-9 rounded-full object-cover" src={task.profiles?.avatar || `https://i.pravatar.cc/150?u=${task.assignee_id}`} alt={task.profiles?.full_name || 'Unassigned'} />
                                        <div>
                                            <p className="font-medium text-gray-700">{task.title}</p>
                                            <p className="text-sm text-gray-500">{task.profiles?.full_name || 'Chưa giao'}</p>
                                        </div>
                                    </div>
                                    <p className={`text-sm text-right ${color}`}>Hạn: {text}</p>
                                </div>
                            )
                        }) : <p className="text-sm text-gray-500">Không có công việc nào sắp hết hạn.</p>}
                    </div>
                    <Link to="/tasks" className="text-primary hover:underline mt-4 inline-block text-sm font-semibold">Xem tất cả công việc →</Link>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                         <h3 className="text-lg font-semibold text-gray-800 mb-4">Trạng thái đăng ký</h3>
                         <SubmissionStatusChart data={submissionStatusCounts} />
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Đăng ký gần đây</h3>
                    <div className="space-y-3">
                        {recentSubmissions.length > 0 ? recentSubmissions.map(sub => (
                            <div key={sub.id} className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-gray-700">{sub.full_name}</p>
                                    <p className="text-sm text-gray-500">{sub.attendee_type}</p>
                                </div>
                                {renderStatusBadge(sub.status!)}
                            </div>
                        )) : <p className="text-sm text-gray-500">Chưa có đăng ký nào.</p>}
                    </div>
                    <Link to="/submissions" className="text-primary hover:underline mt-4 inline-block text-sm font-semibold">Xem tất cả đăng ký →</Link>
                </div>
                 <div className="bg-white p-6 rounded-2xl shadow-sm">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4">Tác vụ nhanh</h3>
                      <div className="space-y-3">
                        {quickActions.length > 0 ? quickActions.map(action => (
                            <Link to={action.href} key={action.href} className="flex items-center justify-center w-full text-center px-4 py-3 bg-primary-light text-primary font-semibold rounded-lg hover:bg-primary/20 transition-colors">
                                {action.label}
                            </Link>
                        )) : <p className="text-sm text-gray-500">Bạn không có quyền thực hiện tác vụ nhanh.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;