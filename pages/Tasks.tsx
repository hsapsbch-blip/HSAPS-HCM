import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Task, Profile, Status } from '../types';
import { useAuth } from '../App';
import { useToast } from '../contexts/ToastContext';

// Helper to format date
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Ngày không hợp lệ';
    }
    return date.toLocaleDateString('vi-VN');
};

// Helper to get display value for a status.
// Handles cases where DB stores English keys for some task statuses.
const getStatusDisplay = (status: string | null | undefined): string => {
    if (!status) return Status.PENDING; // Default display value
    switch (status) {
        case 'IN_PROGRESS': return Status.IN_PROGRESS;
        case 'COMPLETED': return Status.COMPLETED;
        default: return status; // Assumes other statuses are already display values
    }
};

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Tasks: React.FC = () => {
    const { profile: currentUser, createNotification, hasPermission } = useAuth();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [profiles, setProfiles] = useState<Pick<Profile, 'id' | 'full_name'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Partial<Task>>({});
    const [isNew, setIsNew] = useState(false);
    
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterAssignee, setFilterAssignee] = useState<'All' | 'Me' | string>('All');


    useEffect(() => {
        if (hasPermission('tasks:view')) {
            fetchTasks();
            fetchProfiles();
        } else {
            setLoading(false);
        }
    }, [hasPermission]);

    const fetchTasks = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('tasks')
            .select(`*, profiles(full_name, avatar)`)
            .order('due_date', { ascending: true });

        if (error) {
            setError('Lỗi khi tải công việc: ' + error.message);
        } else {
            setTasks(data || []);
        }
        setLoading(false);
    };

    const fetchProfiles = async () => {
        const { data, error } = await supabase.from('profiles').select('id, full_name');
        if (error) console.error("Error fetching profiles:", error.message);
        else setProfiles(data || []);
    };

    const openModal = (task: Partial<Task> | null = null) => {
        const canPerformAction = task ? hasPermission('tasks:edit') : hasPermission('tasks:create');
        if (!canPerformAction) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        if (task) {
            setIsNew(false);
            setEditingTask(task);
        } else {
            setIsNew(true);
            setEditingTask({
                title: '',
                description: '',
                status: Status.PENDING,
                due_date: new Date().toISOString().split('T')[0],
                assignee_id: currentUser?.id,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTask({});
        setTaskToDelete(null);
        setError(null);
    };

    const handleSave = async () => {
        const permissionToCheck = isNew ? 'tasks:create' : 'tasks:edit';
        if (!hasPermission(permissionToCheck)) {
            setError("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        if (!editingTask.title) {
            setError("Tiêu đề công việc không được để trống.");
            return;
        }
        setLoading(true);
        setError(null);

        const originalTask = isNew ? null : tasks.find(t => t.id === editingTask.id);
        // Fix: The destructured 'profiles' property was shadowing the 'profiles' state array. Renamed to '_removedProfiles' to avoid conflict.
        const { profiles: _removedProfiles, ...taskData } = editingTask;

        if (isNew) {
            delete taskData.id;
        }

        try {
            const { error } = isNew
                ? await supabase.from('tasks').insert([taskData])
                : await supabase.from('tasks').update(taskData).eq('id', editingTask.id!);

            if (error) throw error;
            
            if (editingTask.assignee_id && (!originalTask || originalTask.assignee_id !== editingTask.assignee_id)) {
                await createNotification({
                    user_id: editingTask.assignee_id,
                    message: `Bạn được giao công việc: "${editingTask.title}"`,
                    link: '/tasks'
                });

                const assignee = profiles.find(p => p.id === editingTask.assignee_id);
                if (assignee) {
                    addToast(`Đã giao công việc "${editingTask.title}" cho ${assignee.full_name}.`, 'success');
                }
            } else {
                 addToast('Đã lưu công việc thành công!', 'success');
            }

            fetchTasks();
            closeModal();
        } catch (err: any) {
            const errorMessage = 'Lỗi khi lưu công việc: ' + (err.message || 'Đã xảy ra lỗi.');
            setError(errorMessage);
            addToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (task: Task) => {
        if (!hasPermission('tasks:delete')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setTaskToDelete(task);
    }

    const confirmDelete = async () => {
        if (!taskToDelete || !hasPermission('tasks:delete')) return;
        const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete.id);
        if (error) {
            const errorMessage = 'Lỗi khi xóa công việc: ' + error.message;
            setError(errorMessage);
            addToast(errorMessage, 'error');
        } else {
            setTasks(tasks.filter(t => t.id !== taskToDelete.id));
            setTaskToDelete(null);
            addToast('Đã xóa công việc thành công.', 'success');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditingTask(prev => ({ ...prev, [name]: value }));
    };

    const renderStatusBadge = (status: string) => {
        const displayStatus = getStatusDisplay(status);
        const statusMap: { [key: string]: string } = {
          [Status.COMPLETED]: 'bg-green-100 text-green-800',
          [Status.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
          [Status.PENDING]: 'bg-yellow-100 text-yellow-800',
          [Status.REJECTED]: 'bg-red-100 text-red-800',
        };
        return (
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMap[displayStatus] || 'bg-gray-100 text-gray-800'}`}>
            {displayStatus}
          </span>
        );
    };
    
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const statusMatch = filterStatus === 'All' || t.status === filterStatus;
            let assigneeMatch = true;
            if (filterAssignee === 'Me') {
                assigneeMatch = t.assignee_id === currentUser?.id;
            } else if (filterAssignee !== 'All') {
                assigneeMatch = t.assignee_id === filterAssignee;
            }
            return statusMatch && assigneeMatch;
        });
    }, [tasks, filterStatus, filterAssignee, currentUser]);

    if (!hasPermission('tasks:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Quản lý Công việc</h1>
                    <p className="mt-2 text-gray-600">Phân công và theo dõi tiến độ các công việc của ban tổ chức.</p>
                </div>
                {hasPermission('tasks:create') && (
                    <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors w-full md:w-auto">
                        + Thêm công việc
                    </button>
                )}
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 md:space-x-4 mb-4">
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả trạng thái</option>
                    <option value={Status.PENDING}>{Status.PENDING}</option>
                    <option value="IN_PROGRESS">{Status.IN_PROGRESS}</option>
                    <option value="COMPLETED">{Status.COMPLETED}</option>
                </select>
                <select 
                    value={filterAssignee} 
                    onChange={e => setFilterAssignee(e.target.value)}
                    className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả thành viên</option>
                    <option value="Me">Giao cho tôi</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
            </div>

            <div className="bg-white shadow rounded-lg overflow-x-auto">
                 {loading && <p className="p-4">Đang tải...</p>}
                {error && !isModalOpen && <p className="p-4 text-red-500">{error}</p>}
                {!loading && filteredTasks.length === 0 && <p className="p-4">Không có công việc nào.</p>}
                {!loading && filteredTasks.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200 responsive-table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Công việc</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người thực hiện</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hạn chót</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 lg:divide-y-0">
                            {filteredTasks.map(t => (
                                <tr key={t.id}>
                                    <td data-label="Công việc" className="px-6 py-4 whitespace-normal">
                                        <div className="text-sm font-medium text-gray-900">{t.title}</div>
                                        <div className="text-sm text-gray-500 max-w-md truncate">{t.description}</div>
                                    </td>
                                    <td data-label="Người thực hiện" className="px-6 py-4 whitespace-nowrap">
                                        {t.profiles ? (
                                            <div className="flex items-center">
                                                <img className="h-8 w-8 rounded-full object-cover" src={t.profiles.avatar || `https://i.pravatar.cc/150?u=${t.assignee_id}`} alt={t.profiles.full_name} />
                                                <span className="ml-2 text-sm text-gray-800">{t.profiles.full_name}</span>
                                            </div>
                                        ) : <span className="text-xs text-gray-400">Chưa giao</span>}
                                    </td>
                                    <td data-label="Hạn chót" className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(t.due_date)}</td>
                                    <td data-label="Trạng thái" className="px-6 py-4 whitespace-nowrap">{renderStatusBadge(t.status)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                                        {hasPermission('tasks:edit') && <button onClick={() => openModal(t)} className="text-primary hover:text-primary-dark mr-4">Sửa</button>}
                                        {hasPermission('tasks:delete') && <button onClick={() => handleDelete(t)} className="text-red-600 hover:text-red-800">Xoá</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
             {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg m-4">
                        <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm công việc mới' : 'Chỉnh sửa công việc'}</h2>
                        {error && <p className="mb-4 text-red-500">{error}</p>}
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                                <input type="text" name="title" value={editingTask.title || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Mô tả</label>
                                <textarea name="description" value={editingTask.description || ''} onChange={handleChange} rows={4} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Người thực hiện</label>
                                    <select name="assignee_id" value={editingTask.assignee_id || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                        <option value="">-- Chọn thành viên --</option>
                                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Hạn chót</label>
                                    <input type="date" name="due_date" value={editingTask.due_date || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                                <select name="status" value={editingTask.status || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value={Status.PENDING}>Chờ duyệt</option>
                                    <option value="IN_PROGRESS">Đang thực hiện</option>
                                    <option value="COMPLETED">Hoàn thành</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                            <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50">
                                {loading ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                     </div>
                 </div>
            )}
            
            {taskToDelete && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                         <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
                         <p>Bạn có chắc chắn muốn xóa công việc <span className="font-semibold">"{taskToDelete.title}"</span>?</p>
                         <div className="mt-6 flex justify-end space-x-3">
                             <button onClick={() => setTaskToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                             <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xóa</button>
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default Tasks;