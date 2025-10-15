import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, uploadFileToStorage } from '../supabaseClient';
import { FinanceTransaction, Profile } from '../types';
import { useAuth } from '../App';

const PAGE_SIZE = 20;

// Helper function to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper function to format date
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Ngày không hợp lệ';
    }
    return date.toLocaleDateString('vi-VN');
};

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Finance: React.FC = () => {
    const { hasPermission } = useAuth();
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [profiles, setProfiles] = useState<Pick<Profile, 'id' | 'full_name'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Partial<FinanceTransaction>>({});
    const [isNew, setIsNew] = useState(false);
    
    const [transactionToDelete, setTransactionToDelete] = useState<FinanceTransaction | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'All' | 'Thu' | 'Chi'>('All');
    const [filterAccount, setFilterAccount] = useState<'All' | 'TK Lộc Phát' | 'TK Hội Nghị'>('All');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = currentPage * PAGE_SIZE - 1;

        let query = supabase
            .from('finance_transactions')
            .select('*, profiles (full_name)', { count: 'exact' });
            
        if (filterType !== 'All') {
            query = query.eq('type', filterType);
        }
        if (filterAccount !== 'All') {
            query = query.eq('account', filterAccount);
        }
        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }

        const { data, error, count } = await query
            .order('transaction_date', { ascending: false })
            .range(from, to);

        if (error) {
            setError('Lỗi khi tải dữ liệu thu chi: ' + error.message);
            setTransactions([]);
            setTotalCount(0);
        } else {
            setTransactions(data || []);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [currentPage, filterType, filterAccount, searchTerm]);


    const fetchSummary = useCallback(async () => {
        let query = supabase.from('finance_transactions').select('type, amount');

        if (filterAccount !== 'All') {
            query = query.eq('account', filterAccount);
        }
        if (searchTerm) {
             query = query.or(`title.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error("Error fetching summary data:", error.message);
            return;
        }

        const income = (data || [])
            .filter(t => t.type === 'Thu')
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = (data || [])
            .filter(t => t.type === 'Chi')
            .reduce((sum, t) => sum + t.amount, 0);

        setSummary({
            totalIncome: income,
            totalExpense: expense,
            balance: income - expense,
        });

    }, [filterAccount, searchTerm]);


    useEffect(() => {
        if (hasPermission('finance:view')) {
            fetchTransactions();
        } else {
            setLoading(false);
        }
    }, [hasPermission, fetchTransactions]);
    
    useEffect(() => {
        if (hasPermission('finance:view')) {
            fetchSummary();
            const fetchProfilesData = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .order('full_name');
                
                if (error) {
                    console.error("Lỗi khi tải danh sách người dùng:", error.message);
                } else {
                    setProfiles(data || []);
                }
            };
            fetchProfilesData();
        }
    }, [hasPermission, fetchSummary]);


    const openModal = (transaction: Partial<FinanceTransaction> | null = null) => {
        const canPerformAction = transaction ? hasPermission('finance:edit') : hasPermission('finance:create');
        if (!canPerformAction) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        if (transaction) {
            setIsNew(false);
            setEditingTransaction(transaction);
        } else {
            setIsNew(true);
            setEditingTransaction({
                type: 'Chi',
                amount: 0,
                transaction_date: new Date().toISOString().split('T')[0],
                payment_method: 'Chuyển khoản',
                account: 'TK Hội Nghị',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTransaction({});
        setTransactionToDelete(null);
        setError(null);
    };

    const handleSave = async () => {
        if (!editingTransaction) return;
        const permissionToCheck = isNew ? 'finance:create' : 'finance:edit';
        if (!hasPermission(permissionToCheck)) {
            setError("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        setLoading(true);
        setError(null);

        // Fix: The destructured 'profiles' property was shadowing the 'profiles' state array. Renamed to '_removedProfiles' to avoid conflict.
        const { profiles: _removedProfiles, ...transactionData } = editingTransaction;

        if (isNew) {
            delete transactionData.id;
        }

        try {
            const { error } = isNew
                ? await supabase.from('finance_transactions').insert([transactionData as any])
                : await supabase.from('finance_transactions').update(transactionData as any).eq('id', editingTransaction.id!);

            if (error) throw error;
            fetchTransactions();
            fetchSummary(); // Refresh summary after save
            closeModal();
        } catch (err: any) {
            setError('Lỗi khi lưu giao dịch: ' + (err.message || 'Đã xảy ra lỗi.'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (transaction: FinanceTransaction) => {
        if (!hasPermission('finance:delete')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setTransactionToDelete(transaction);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete || !hasPermission('finance:delete')) return;
        const { error } = await supabase.from('finance_transactions').delete().eq('id', transactionToDelete.id);
        if (error) {
            setError('Lỗi khi xóa giao dịch: ' + error.message);
        } else {
            // Refetch data to ensure pagination and totals are correct
            fetchTransactions(); 
            fetchSummary();
            setTransactionToDelete(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditingTransaction(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            setError(null);
            const publicUrl = await uploadFileToStorage(file, 'event_assets', 'receipts');
            if (publicUrl) {
                setEditingTransaction(prev => ({ ...prev, receipt_url: publicUrl }));
            } else {
                setError("Tải ảnh hóa đơn lên thất bại. Vui lòng thử lại.");
            }
            setIsUploading(false);
        }
    };
    
    const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setter(e.target.value);
        setCurrentPage(1); // Reset to first page on filter change
    };
    
    if (!hasPermission('finance:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Quản lý Thu Chi</h1>
                    <p className="mt-2 text-gray-600">Theo dõi các giao dịch tài chính của sự kiện.</p>
                </div>
                {hasPermission('finance:create') && (
                    <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                        + Thêm Giao dịch
                    </button>
                )}
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-gray-500">Tổng Thu</h3>
                    <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(summary.totalIncome)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-gray-500">Tổng Chi</h3>
                    <p className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(summary.totalExpense)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-gray-500">Số Dư</h3>
                    <p className={`text-3xl font-bold mt-2 ${summary.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(summary.balance)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Tìm theo tiêu đề, ghi chú..."
                    value={searchTerm}
                    onChange={handleFilterChange(setSearchTerm)}
                    className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select 
                    value={filterType} 
                    onChange={handleFilterChange(setFilterType)}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả loại</option>
                    <option value="Thu">Thu</option>
                    <option value="Chi">Chi</option>
                </select>
                <select 
                    value={filterAccount} 
                    onChange={handleFilterChange(setFilterAccount)}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả tài khoản</option>
                    <option value="TK Lộc Phát">TK Lộc Phát</option>
                    <option value="TK Hội Nghị">TK Hội Nghị</option>
                </select>
            </div>
            
            {/* Transactions Table */}
            <div className="bg-white shadow rounded-lg overflow-x-auto">
                {loading && <p className="p-4">Đang tải...</p>}
                {error && <p className="p-4 text-red-500">{error}</p>}
                {!loading && transactions.length === 0 && <p className="p-4">Không có giao dịch nào.</p>}
                {!loading && transactions.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề / Ngày</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số tiền</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tài khoản</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người xử lý</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.map(t => (
                                <tr key={t.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{t.title}</div>
                                        <div className="text-sm text-gray-500">{formatDate(t.transaction_date)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'Thu' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${t.type === 'Thu' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(t.amount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{t.account || <span className="text-gray-400">Chưa rõ</span>}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{t.profiles?.full_name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {hasPermission('finance:edit') && <button onClick={() => openModal(t)} className="text-primary hover:text-primary-dark mr-4">Sửa</button>}
                                        {hasPermission('finance:delete') && <button onClick={() => handleDelete(t)} className="text-red-600 hover:text-red-800">Xoá</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {totalCount > 0 && (
                    <div className="flex items-center justify-between px-6 py-3 bg-white border-t">
                        <p className="text-sm text-gray-700">
                            Hiển thị <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span> - <span className="font-medium">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> trên <span className="font-medium">{totalCount}</span> kết quả
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
                                disabled={currentPage * PAGE_SIZE >= totalCount}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm giao dịch' : 'Chỉnh sửa giao dịch'}</h2>
                        {error && <p className="mb-4 text-red-500">{error}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Loại giao dịch</label>
                                <select name="type" value={editingTransaction.type || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="Chi">Chi</option>
                                    <option value="Thu">Thu</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Ngày giao dịch</label>
                                <input type="date" name="transaction_date" value={editingTransaction.transaction_date || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                                <input type="text" name="title" value={editingTransaction.title || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Số tiền (VND)</label>
                                <input type="number" name="amount" value={String(editingTransaction.amount || 0)} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Tài khoản</label>
                                <select name="account" value={editingTransaction.account || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="">-- Chọn tài khoản --</option>
                                    <option value="TK Lộc Phát">TK Lộc Phát</option>
                                    <option value="TK Hội Nghị">TK Hội Nghị</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Người xử lý</label>
                                <select name="handler_id" value={editingTransaction.handler_id || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="">-- Chọn người xử lý --</option>
                                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phương thức thanh toán</label>
                                <select name="payment_method" value={editingTransaction.payment_method || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option>Chuyển khoản</option>
                                    <option>Tiền mặt</option>
                                    <option>Khác</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Ảnh hóa đơn/chứng từ</label>
                                <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 text-sm"/>
                                {isUploading && <p className="text-xs text-primary">Đang tải lên...</p>}
                                {editingTransaction.receipt_url && <a href={editingTransaction.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline mt-1 inline-block">Xem ảnh</a>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
                                <textarea name="notes" value={editingTransaction.notes || ''} onChange={handleChange} rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                            <button onClick={handleSave} disabled={loading || isUploading} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50">
                                {loading ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                     </div>
                 </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {transactionToDelete && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                         <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
                         <p>Bạn có chắc chắn muốn xóa giao dịch <span className="font-semibold">"{transactionToDelete.title}"</span>? Hành động này không thể hoàn tác.</p>
                         <div className="mt-6 flex justify-end space-x-3">
                             <button onClick={() => setTransactionToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                             <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xác nhận xóa</button>
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default Finance;