import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ProgramItem, Speaker } from '../types';
import { useAuth } from '../App';

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const CATEGORIES = ['Phẫu thuật thẩm mỹ', 'Nội khoa thẩm mỹ'] as const;

const Program: React.FC = () => {
    const { hasPermission } = useAuth();
    const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ProgramItem> & { start_time?: string; end_time?: string }>({});
    const [isNew, setIsNew] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<ProgramItem | null>(null);

    const [filterSession, setFilterSession] = useState<string>('All');
    const [filterCategory, setFilterCategory] = useState<string>('All');

    useEffect(() => {
        if (hasPermission('program:view')) {
            fetchProgramItems();
            fetchSpeakers();
        } else {
            setLoading(false);
        }
    }, [hasPermission]);

    const fetchProgramItems = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('program_items')
            .select(`
                *,
                speakers (
                    id,
                    full_name,
                    avatar_url,
                    academic_rank
                )
            `)
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) {
            setError('Lỗi khi tải chương trình: ' + error.message);
        } else {
            setProgramItems(data || []);
        }
        setLoading(false);
    };
    
    const fetchSpeakers = async () => {
        const { data, error } = await supabase
            .from('speakers')
            // Fix: Select all fields to ensure the fetched data matches the Speaker type, resolving a type mismatch error.
            .select('*')
            .order('full_name');
        
        if (error) {
            console.error("Lỗi khi tải danh sách báo cáo viên:", error.message);
        } else {
            setSpeakers(data || []);
        }
    };


    const openModal = (item: ProgramItem | null = null) => {
        const canPerformAction = item ? hasPermission('program:edit') : hasPermission('program:create');
        if (!canPerformAction) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        if (item) {
            setIsNew(false);
            const [start_time = '', end_time = ''] = (item.time || '').split(' - ');
            setEditingItem({ ...item, start_time, end_time });
        } else {
            setIsNew(true);
            const defaultDate = '2025-12-06';
            const defaultStartTime = '08:00';
            const defaultEndTime = '08:30';

            setEditingItem({
                date: defaultDate,
                start_time: defaultStartTime,
                end_time: defaultEndTime,
                session: '',
                category: null,
                report_title_vn: '',
                report_title_en: '',
                speaker_id: undefined,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem({});
        setItemToDelete(null);
        setError(null);
    };

    const handleSave = async () => {
        if (!editingItem) return;
        const permissionToCheck = isNew ? 'program:create' : 'program:edit';
        if (!hasPermission(permissionToCheck)) {
            setError("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setLoading(true);
        setError(null);

        const { start_time, end_time, speakers, ...restOfItem } = editingItem;
        const timeString = end_time ? `${start_time || ''} - ${end_time}`.trim() : start_time || '';
        
        const itemData = {
            ...restOfItem,
            time: timeString,
            speaker_id: editingItem.speaker_id ? Number(editingItem.speaker_id) : null,
        };
        
        if (isNew) {
            delete itemData.id;
        }

        try {
            const { error } = isNew
                ? await supabase.from('program_items').insert([itemData])
                : await supabase.from('program_items').update(itemData).eq('id', editingItem.id!);

            if (error) throw error;
            fetchProgramItems();
            closeModal();
        } catch (err: any) {
            setError('Lỗi khi lưu: ' + (err.message || 'Đã xảy ra lỗi.'));
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = (item: ProgramItem) => {
        if (!hasPermission('program:delete')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setItemToDelete(item);
    };

    const confirmDelete = async () => {
        if (!itemToDelete || !hasPermission('program:delete')) return;
        const { error } = await supabase.from('program_items').delete().eq('id', itemToDelete.id);
        if (error) {
            setError('Lỗi khi xóa mục: ' + error.message);
        } else {
            setProgramItems(programItems.filter(p => p.id !== itemToDelete.id));
            setItemToDelete(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'speaker_id') {
            const speakerId = value ? Number(value) : null;
            const selectedSpeaker = speakers.find(s => s.id === speakerId);

            setEditingItem(prev => ({
                ...prev,
                speaker_id: speakerId,
                report_title_vn: selectedSpeaker ? selectedSpeaker.report_title_vn : '',
                report_title_en: selectedSpeaker ? selectedSpeaker.report_title_en : '',
            }));
        } else {
            setEditingItem(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const uniqueSessions = useMemo(() => {
        const sessions = new Set<string>();
        programItems.forEach(item => {
            if (item.session) {
                sessions.add(item.session);
            }
        });
        return Array.from(sessions).sort();
    }, [programItems]);

    const groupedProgram = useMemo(() => {
        const filteredItems = programItems.filter(item => {
            const sessionMatch = filterSession === 'All' || item.session === filterSession;
            const categoryMatch = filterCategory === 'All' || item.category === filterCategory;
            return sessionMatch && categoryMatch;
        });

        return filteredItems.reduce((acc, item) => {
            const date = new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(item);
            return acc;
        }, {} as Record<string, ProgramItem[]>);
    }, [programItems, filterSession, filterCategory]);


    if (!hasPermission('program:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Quản lý Chương trình</h1>
                    <p className="mt-2 text-gray-600">Sắp xếp lịch trình, phân công báo cáo viên và quản lý các phiên.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
                        aria-label="Lọc theo phân loại"
                    >
                        <option value="All">Tất cả phân loại</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <select
                        value={filterSession}
                        onChange={(e) => setFilterSession(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
                        aria-label="Lọc theo phiên"
                    >
                        <option value="All">Tất cả các phiên</option>
                        {uniqueSessions.map(session => (
                            <option key={session} value={session}>{session}</option>
                        ))}
                    </select>
                    {hasPermission('program:create') && (
                        <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors w-full sm:w-auto">
                            + Thêm mục
                        </button>
                    )}
                </div>
            </div>

            {loading && <p className="p-4">Đang tải chương trình...</p>}
            {error && <p className="p-4 text-red-500">{error}</p>}
            {!loading && Object.keys(groupedProgram).length === 0 && (
                 <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">
                        {filterSession === 'All' && filterCategory === 'All' ? "Chưa có mục nào trong chương trình." : "Không có mục nào phù hợp với bộ lọc."}
                    </p>
                </div>
            )}

            <div className="space-y-8">
                {Object.keys(groupedProgram).map(date => (
                    <div key={date}>
                        <h2 className="text-xl font-bold text-primary mb-3 pb-2 border-b-2 border-primary-light">{date}</h2>
                        
                        {/* Table for large screens */}
                        <div className="hidden lg:block bg-white shadow rounded-lg overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Thời gian</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phiên</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phân loại</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nội dung</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Báo cáo viên</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {groupedProgram[date].map(item => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {item.time}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.session}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.category || <span className="text-xs text-gray-400">Chưa có</span>}</td>
                                            <td className="px-6 py-4 whitespace-normal text-sm">
                                                <p className="text-gray-900 font-semibold">{item.report_title_vn}</p>
                                                {item.report_title_en && <p className="text-gray-500 italic mt-1">{item.report_title_en}</p>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {item.speakers ? (
                                                     <div className="flex items-center">
                                                        <img className="h-8 w-8 rounded-full object-cover" src={item.speakers.avatar_url || `https://i.pravatar.cc/150?u=${item.speakers.id}`} alt={item.speakers.full_name} />
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900">{item.speakers.academic_rank} {item.speakers.full_name}</div>
                                                        </div>
                                                    </div>
                                                ) : <span className="text-xs text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {hasPermission('program:edit') && <button onClick={() => openModal(item)} className="text-primary hover:text-primary-dark mr-4">Sửa</button>}
                                                {hasPermission('program:delete') && <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800">Xoá</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Cards for mobile */}
                        <div className="block lg:hidden space-y-4">
                            {groupedProgram[date].map(item => (
                                <div key={item.id} className="bg-white rounded-lg shadow p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-primary">{item.time}</p>
                                            <div className="flex items-center gap-x-3 flex-wrap mb-2">
                                                {item.session && <p className="text-xs text-gray-500">{item.session}</p>}
                                                {item.category && <p className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{item.category}</p>}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            {hasPermission('program:edit') && (
                                                <button onClick={() => openModal(item)} className="p-1 text-gray-500 hover:text-primary" aria-label="Sửa">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                </button>
                                            )}
                                            {hasPermission('program:delete') && (
                                                <button onClick={() => handleDelete(item)} className="p-1 text-gray-500 hover:text-red-600" aria-label="Xóa">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <p className="text-md font-bold text-gray-800">{item.report_title_vn}</p>
                                        {item.report_title_en && <p className="text-sm text-gray-500 italic mt-1">{item.report_title_en}</p>}
                                    </div>

                                    {item.speakers ? (
                                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center space-x-3">
                                            <img className="h-10 w-10 rounded-full object-cover" src={item.speakers.avatar_url || `https://i.pravatar.cc/150?u=${item.speakers.id}`} alt={item.speakers.full_name} />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{item.speakers.academic_rank} {item.speakers.full_name}</p>
                                            </div>
                                        </div>
                                    ): (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <p className="text-sm text-gray-400">Không có báo cáo viên</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Add/Edit Modal */}
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm mục vào chương trình' : 'Chỉnh sửa mục'}</h2>
                        {error && <p className="mb-4 text-red-500">{error}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Ngày</label>
                                <input 
                                    type="date" 
                                    name="date" 
                                    value={editingItem.date || ''} 
                                    onChange={handleChange} 
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                                    min="2025-12-06"
                                    max="2025-12-07"
                                />
                            </div>
                            <div>
                               <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Bắt đầu</label>
                                        <input type="time" name="start_time" value={editingItem.start_time || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Kết thúc</label>
                                        <input type="time" name="end_time" value={editingItem.end_time || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                                    </div>
                               </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tên phiên (Session)</label>
                                <input type="text" name="session" placeholder="VD: Phiên 1: Khai mạc" value={editingItem.session || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phân loại</label>
                                <select name="category" value={editingItem.category || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                                    <option value="">-- Chọn phân loại --</option>
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Báo cáo viên (Tùy chọn)</label>
                                <select name="speaker_id" value={editingItem.speaker_id || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                                    <option value="">-- Chọn báo cáo viên --</option>
                                    {speakers.map(s => (
                                        <option key={s.id} value={s.id}>{s.academic_rank} {s.full_name}</option>
                                    ))}
                                </select>
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nội dung / Tên bài báo cáo (Tiếng Việt)</label>
                                <textarea 
                                    name="report_title_vn" 
                                    placeholder="Tự động điền khi chọn báo cáo viên, hoặc nhập thủ công" 
                                    value={editingItem.report_title_vn || ''} 
                                    onChange={handleChange} 
                                    rows={2} 
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 read-only:bg-gray-100"
                                    readOnly={!!editingItem.speaker_id}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nội dung / Tên bài báo cáo (Tiếng Anh)</label>
                                <textarea 
                                    name="report_title_en" 
                                    placeholder="Tự động điền khi chọn báo cáo viên" 
                                    value={editingItem.report_title_en || ''} 
                                    onChange={handleChange} 
                                    rows={2} 
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 read-only:bg-gray-100"
                                    readOnly={!!editingItem.speaker_id}
                                />
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
            
            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                         <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
                         <p>Bạn có chắc chắn muốn xóa mục <span className="font-semibold">"{itemToDelete.report_title_vn}"</span> khỏi chương trình? </p>
                         <div className="mt-6 flex justify-end space-x-3">
                             <button onClick={() => setItemToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                             <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xác nhận xóa</button>
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default Program;
