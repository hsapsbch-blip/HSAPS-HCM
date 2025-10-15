import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../App';
import { Notification } from '../types';
import { BellIcon } from '../components/icons/BellIcon';

const PAGE_SIZE = 15;

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

const NotificationsPage: React.FC = () => {
  const { profile, markNotificationAsRead, clearAllNotifications } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const from = (currentPage - 1) * PAGE_SIZE;
    const to = currentPage * PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      setError('Lỗi khi tải thông báo: ' + error.message);
    } else {
      setNotifications(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [profile, currentPage]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('public:notifications:page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => {
          // New notification arrived, refetch to show it at the top
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchNotifications]);

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications(current => current.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (id: number) => {
    markNotificationAsRead(id);
    setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n));
  };
  
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Thông báo</h1>
                <p className="mt-2 text-gray-600">Lịch sử tất cả các thông báo của bạn.</p>
            </div>
            <button 
                onClick={handleClearAll}
                className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors w-full sm:w-auto"
            >
                Đánh dấu tất cả đã đọc
            </button>
        </div>

        <div className="bg-white shadow rounded-lg">
            {loading && <p className="p-6 text-center text-gray-500">Đang tải thông báo...</p>}
            {error && <p className="p-6 text-center text-red-500">{error}</p>}
            {!loading && notifications.length === 0 && (
                 <div className="p-10 text-center">
                    <BellIcon className="w-12 h-12 mx-auto text-gray-300" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900">Không có thông báo</h3>
                    <p className="mt-1 text-sm text-gray-500">Bạn sẽ thấy các cập nhật và thông báo quan trọng tại đây.</p>
                </div>
            )}
            {!loading && notifications.length > 0 && (
                <ul className="divide-y divide-gray-200">
                    {notifications.map(n => (
                        <li key={n.id}>
                            <Link 
                                to={n.link || '#'}
                                onClick={() => handleNotificationClick(n.id)}
                                className={`block hover:bg-gray-50 transition-colors ${!n.read ? 'bg-primary-light' : ''}`}
                            >
                                <div className="p-4 sm:p-6 flex items-start space-x-4">
                                     <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-primary' : 'bg-gray-300'}`}></div>
                                     <div className="flex-1">
                                         <p className="text-sm text-gray-800">{n.message}</p>
                                         <p className="text-xs text-gray-500 mt-1">{timeSince(n.created_at)}</p>
                                     </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            
            {totalCount > PAGE_SIZE && (
                 <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
                    <p className="text-sm text-gray-700">
                        Trang <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span>
                    </p>
                    <div className="space-x-2">
                        <button 
                            onClick={() => setCurrentPage(p => p - 1)} 
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Trước
                        </button>
                        <button 
                            onClick={() => setCurrentPage(p => p + 1)} 
                            disabled={currentPage >= totalPages}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sau
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default NotificationsPage;
