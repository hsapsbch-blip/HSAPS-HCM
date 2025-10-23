import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, uploadFileToStorage, getTransformedImageUrl } from '../supabaseClient';
import { Sponsor, Status } from '../types';
import { useAuth } from '../App';

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper for live input formatting
const formatAmountInput = (value?: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat('vi-VN').format(value);
};

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Sponsors: React.FC = () => {
    const { notifyAdmins, hasPermission } = useAuth();
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSponsor, setEditingSponsor] = useState<Partial<Sponsor>>({});
    const [isNew, setIsNew] = useState(false);
    
    const [sponsorToDelete, setSponsorToDelete] = useState<Sponsor | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | Status>('All');
    
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingSponsor, setViewingSponsor] = useState<Sponsor | null>(null);
    
    const contractStatuses = ['Chưa có', 'Chờ ký', 'Đã ký'] as const;


    useEffect(() => {
        if (hasPermission('sponsors:view')) {
            fetchSponsors();
        } else {
            setLoading(false);
        }
    }, [hasPermission]);

    const fetchSponsors = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('sponsors')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            setError('Lỗi khi tải danh sách nhà tài trợ: ' + error.message);
        } else {
            setSponsors(data || []);
        }
        setLoading(false);
    };

    const openModal = (sponsor: Partial<Sponsor> | null = null) => {
        const canPerformAction = sponsor ? hasPermission('sponsors:edit') : hasPermission('sponsors:create');
        if (!canPerformAction) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        if (sponsor) {
            setIsNew(false);
            setEditingSponsor(sponsor);
        } else {
            setIsNew(true);
            setEditingSponsor({
                name: '',
                sponsorship_package: 'Đồng',
                status: Status.PENDING,
                amount: undefined,
                location: '',
                contract_status: 'Chưa có',
                contract_url: null,
            });
        }
        setIsModalOpen(true);
    };

    const openViewModal = (sponsor: Sponsor) => {
        setViewingSponsor(sponsor);
        setIsViewModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsViewModalOpen(false);
        setEditingSponsor({});
        setViewingSponsor(null);
        setSponsorToDelete(null);
        setError(null);
    };

    const handleSave = async () => {
        const permissionToCheck = isNew ? 'sponsors:create' : 'sponsors:edit';
        if (!hasPermission(permissionToCheck)) {
            setError("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        if (!editingSponsor.name) {
            setError("Tên nhà tài trợ không được để trống.");
            return;
        }
        setLoading(true);
        setError(null);

        const sponsorData = { ...editingSponsor };
        const originalSponsor = isNew ? null : sponsors.find(s => s.id === editingSponsor.id);
        if (isNew) {
            delete sponsorData.id;
        }

        try {
            const { error } = isNew
                ? await supabase.from('sponsors').insert([sponsorData])
                : await supabase.from('sponsors').update(sponsorData).eq('id', editingSponsor.id!);

            if (error) throw error;
            
            if (editingSponsor.status === Status.PAYMENT_CONFIRMED && (!originalSponsor || originalSponsor.status !== Status.PAYMENT_CONFIRMED)) {
                await notifyAdmins(`Nhà tài trợ "${editingSponsor.name}" đã xác nhận thanh toán.`, '/sponsors');
            }
            
            fetchSponsors();
            closeModal();
        } catch (err: any) {
            setError('Lỗi khi lưu thông tin: ' + (err.message || 'Đã xảy ra lỗi.'));
        } finally {
            setLoading(false);
        }
    };
    
    const handleStatusChange = async (sponsorId: number, newStatus: Status) => {
        if (!hasPermission('sponsors:edit')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        const originalSponsors = [...sponsors];
        // Optimistic update
        setSponsors(current =>
            current.map(s => s.id === sponsorId ? { ...s, status: newStatus } : s)
        );

        const originalSponsor = originalSponsors.find(s => s.id === sponsorId);

        const { error: updateError } = await supabase
            .from('sponsors')
            .update({ status: newStatus })
            .eq('id', sponsorId);

        if (updateError) {
            setSponsors(originalSponsors); // Revert on error
            setError("Lỗi khi cập nhật trạng thái: " + updateError.message);
            return;
        }
        
        if (newStatus === Status.PAYMENT_CONFIRMED && originalSponsor?.status !== Status.PAYMENT_CONFIRMED) {
             const sponsorName = originalSponsor?.name || 'Không rõ';
             await notifyAdmins(`Nhà tài trợ "${sponsorName}" đã xác nhận thanh toán.`, '/sponsors');
        }
    };


    const handleDelete = (sponsor: Sponsor) => {
        if (!hasPermission('sponsors:delete')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setSponsorToDelete(sponsor);
    };

    const confirmDelete = async () => {
        if (!sponsorToDelete || !hasPermission('sponsors:delete')) return;
        const { error } = await supabase.from('sponsors').delete().eq('id', sponsorToDelete.id);
        if (error) {
            setError('Lỗi khi xóa nhà tài trợ: ' + error.message);
        } else {
            setSponsors(sponsors.filter(s => s.id !== sponsorToDelete.id));
            setSponsorToDelete(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'amount') {
            // Remove all non-digit characters
            const sanitizedValue = value.replace(/\D/g, '');
            // Convert to number, or undefined if empty
            const numericValue = sanitizedValue === '' ? undefined : Number(sanitizedValue);

            // Update state only with valid numbers (or undefined for empty)
            if (numericValue !== undefined && isNaN(numericValue)) return;
            
            setEditingSponsor(prev => ({ ...prev, amount: numericValue }));
        } else if (name === 'contact_person') {
            setEditingSponsor(prev => ({ ...prev, [name]: toTitleCase(value) }));
        } else {
            setEditingSponsor(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            setError(null);
            const publicUrl = await uploadFileToStorage(file, 'event_assets', 'sponsors_logos');
            if (publicUrl) {
                setEditingSponsor(prev => ({ ...prev, logo_url: publicUrl }));
            } else {
                setError("Tải logo lên thất bại. Vui lòng thử lại.");
            }
            setIsUploading(false);
        }
    };
    
    const handleContractFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            setError(null);
            const publicUrl = await uploadFileToStorage(file, 'event_assets', 'sponsors_contracts');
            if (publicUrl) {
                setEditingSponsor(prev => ({ ...prev, contract_url: publicUrl }));
            } else {
                setError("Tải tệp hợp đồng lên thất bại. Vui lòng thử lại.");
            }
            setIsUploading(false);
        }
    };

    const renderStatusBadge = (status: Status) => {
        const statusMap: { [key in Status]?: string } = {
          [Status.APPROVED]: 'bg-green-100 text-green-800',
          [Status.PENDING]: 'bg-yellow-100 text-yellow-800',
          [Status.REJECTED]: 'bg-red-100 text-red-800',
          [Status.PAYMENT_CONFIRMED]: 'bg-blue-100 text-blue-800',
          [Status.PAYMENT_PENDING]: 'bg-orange-100 text-orange-800'
        };
        const baseClasses = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMap[status] || 'bg-gray-100 text-gray-800'}`;
        return <span className={baseClasses}>{status}</span>;
    };
    
    const renderContractStatusBadge = (status: Sponsor['contract_status']) => {
        if (!status) return null;
        const statusMap: Record<NonNullable<Sponsor['contract_status']>, string> = {
            'Chưa có': 'bg-gray-100 text-gray-800',
            'Chờ ký': 'bg-yellow-100 text-yellow-800',
            'Đã ký': 'bg-green-100 text-green-800',
        };
        return (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMap[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        );
    };
    
    const sponsorStatuses = Object.values(Status).filter(s=>s.startsWith("Đã") || s.startsWith("Chờ") || s.startsWith("Từ chối"));

    const filteredSponsors = useMemo(() => {
        return sponsors.filter(s => {
            const statusMatch = filterStatus === 'All' || s.status === filterStatus;
            const searchMatch = searchTerm === '' || 
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.phone && s.phone.toLowerCase().includes(searchTerm.toLowerCase()));
            return statusMatch && searchMatch;
        });
    }, [sponsors, searchTerm, filterStatus]);

    if (!hasPermission('sponsors:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Quản lý Nhà tài trợ</h1>
                    <p className="mt-2 text-gray-600">Theo dõi, thêm mới và quản lý các nhà tài trợ cho sự kiện.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <button onClick={() => setIsLayoutModalOpen(true)} className="px-4 py-2 bg-white text-primary border border-primary font-semibold rounded-lg hover:bg-primary-light transition-colors w-full sm:w-auto">
                        Xem Sơ đồ Gian hàng
                    </button>
                    {hasPermission('sponsors:create') && (
                        <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors w-full sm:w-auto">
                            + Thêm Nhà tài trợ
                        </button>
                    )}
                </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 md:space-x-4 mb-4">
                <input
                    type="text"
                    placeholder="Tìm theo tên, người liên hệ, SĐT..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value as 'All' | Status)}
                    className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả trạng thái</option>
                    {sponsorStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            
            <div className="bg-white shadow rounded-lg overflow-x-auto">
                {loading && <p className="p-4">Đang tải...</p>}
                {error && !isModalOpen && <p className="p-4 text-red-500">{error}</p>}
                {!loading && filteredSponsors.length === 0 && <p className="p-4">Không có nhà tài trợ nào.</p>}
                {!loading && filteredSponsors.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200 responsive-table sponsor-cards">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nhà tài trợ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gói tài trợ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số tiền</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hợp đồng</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái HĐ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 lg:divide-y-0">
                            {filteredSponsors.map(s => (
                                <tr key={s.id}>
                                    <td data-label="Nhà tài trợ" className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex justify-between items-start w-full">
                                            <div className="flex items-center">
                                                <div className="hidden lg:flex flex-shrink-0 h-10 w-10">
                                                    <img className="h-10 w-10 rounded-full object-contain bg-gray-50" src={getTransformedImageUrl(s.logo_url, 80, 80) || `https://i.pravatar.cc/150?u=${s.id}`} alt={s.name} loading="lazy" />
                                                </div>
                                                <div className="lg:ml-4">
                                                    <div className="text-sm font-medium text-gray-900 responsive-name">{s.name}</div>
                                                    <div className="text-sm text-gray-500 responsive-subtext mt-1">{s.contact_person}</div>
                                                    {s.phone && <div className="text-sm text-gray-400 responsive-subtext">{s.phone}</div>}
                                                </div>
                                            </div>
                                            <div className="lg:hidden flex-shrink-0">
                                                {renderStatusBadge(s.status)}
                                            </div>
                                        </div>
                                    </td>
                                    <td data-label="Gói tài trợ" className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.sponsorship_package}</td>
                                    <td data-label="Số tiền" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(s.amount)}</td>
                                    <td data-label="Hợp đồng" className="px-6 py-4 whitespace-nowrap text-sm">
                                        {s.contract_url ? (
                                            <a href={s.contract_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                Xem file
                                            </a>
                                        ) : (
                                            <span className="text-gray-400">Chưa có</span>
                                        )}
                                    </td>
                                    <td data-label="Trạng thái HĐ" className="px-6 py-4 whitespace-nowrap">
                                        {renderContractStatusBadge(s.contract_status)}
                                    </td>
                                    <td data-label="Trạng thái" className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                        {renderStatusBadge(s.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                                        <div className="flex flex-wrap gap-x-3 gap-y-2 lg:justify-end">
                                            <button onClick={() => openViewModal(s)} className="text-gray-600 hover:text-gray-900">Xem</button>
                                            {hasPermission('sponsors:edit') && <button onClick={() => openModal(s)} className="text-primary hover:text-primary-dark">Sửa</button>}

                                            {hasPermission('sponsors:edit') && s.status === Status.PENDING && (
                                                <>
                                                    <button title="Duyệt" onClick={() => handleStatusChange(s.id, Status.APPROVED)} className="text-green-600 hover:text-green-800">Duyệt</button>
                                                    <button title="Từ chối" onClick={() => handleStatusChange(s.id, Status.REJECTED)} className="text-red-600 hover:text-red-800">Từ chối</button>
                                                </>
                                            )}
                                            {hasPermission('sponsors:edit') && s.status === Status.APPROVED && (
                                                <button title="Chuyển sang Chờ thanh toán" onClick={() => handleStatusChange(s.id, Status.PAYMENT_PENDING)} className="text-orange-600 hover:text-orange-800">Chờ TT</button>
                                            )}
                                            {hasPermission('sponsors:edit') && s.status === Status.PAYMENT_PENDING && (
                                                <>
                                                    <button title="Xác nhận đã thanh toán" onClick={() => handleStatusChange(s.id, Status.PAYMENT_CONFIRMED)} className="text-blue-600 hover:text-blue-800">Xác nhận TT</button>
                                                    <button title="Từ chối" onClick={() => handleStatusChange(s.id, Status.REJECTED)} className="text-red-600 hover:text-red-800">Từ chối</button>
                                                </>
                                            )}
                                            
                                            {hasPermission('sponsors:delete') && <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800">Xoá</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm nhà tài trợ' : 'Chỉnh sửa thông tin'}</h2>
                        {error && <p className="mb-4 text-red-500">{error}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Logo</label>
                                <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 text-sm"/>
                                {isUploading && <p className="text-xs text-primary">Đang tải lên...</p>}
                                {editingSponsor.logo_url && <img src={editingSponsor.logo_url} alt="Logo" className="w-24 h-24 object-contain mt-2"/>}
                            </div>
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tên nhà tài trợ</label>
                                    <input type="text" name="name" value={editingSponsor.name || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Người liên hệ</label>
                                    <input type="text" name="contact_person" value={editingSponsor.contact_person || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input type="email" name="email" value={editingSponsor.email || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Điện thoại</label>
                                <input type="text" name="phone" value={editingSponsor.phone || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Gói tài trợ</label>
                                <select name="sponsorship_package" value={editingSponsor.sponsorship_package || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option>Kim cương</option>
                                    <option>Vàng</option>
                                    <option>Bạc</option>
                                    <option>Đồng</option>
                                    <option>Khác</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Vị trí gian hàng</label>
                                <input type="text" name="location" placeholder="VD: A1, B2..." value={editingSponsor.location || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Số tiền (VND)</label>
                                <input type="text" inputMode="numeric" name="amount" value={formatAmountInput(editingSponsor.amount)} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                                <select name="status" value={editingSponsor.status || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    {sponsorStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Trạng thái Hợp đồng</label>
                                <select name="contract_status" value={editingSponsor.contract_status || 'Chưa có'} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    {contractStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Tệp Hợp đồng</label>
                                <input type="file" onChange={handleContractFileChange} className="mt-1 text-sm"/>
                                {editingSponsor.contract_url && <a href={editingSponsor.contract_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline mt-1 inline-block">Xem tệp đã tải</a>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
                                <textarea name="notes" value={editingSponsor.notes || ''} onChange={handleChange} rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
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

            {isViewModalOpen && viewingSponsor && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <h2 className="text-2xl font-bold text-gray-800">Chi tiết Nhà tài trợ</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
                        </div>
                        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 flex flex-col items-center md:items-start">
                                <img
                                    src={getTransformedImageUrl(viewingSponsor.logo_url, 200, 200) || `https://i.pravatar.cc/150?u=${viewingSponsor.id}`}
                                    alt={`Logo of ${viewingSponsor.name}`}
                                    className="w-40 h-40 rounded-lg object-contain mb-4 border bg-gray-50"
                                />
                                <h3 className="text-xl font-semibold text-gray-900 text-center md:text-left">{viewingSponsor.name}</h3>
                                <div className="mt-2">{renderStatusBadge(viewingSponsor.status)}</div>
                            </div>
                            <div className="md:col-span-2 space-y-4">
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                    <div>
                                        <dt className="font-medium text-gray-500">Gói tài trợ</dt>
                                        <dd className="text-gray-900 mt-1">{viewingSponsor.sponsorship_package}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-gray-500">Số tiền</dt>
                                        <dd className="text-gray-900 mt-1 font-semibold">{formatCurrency(viewingSponsor.amount)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-gray-500">Người liên hệ</dt>
                                        <dd className="text-gray-900 mt-1">{viewingSponsor.contact_person}</dd>
                                    </div>
                                     <div>
                                        <dt className="font-medium text-gray-500">Vị trí gian hàng</dt>
                                        <dd className="text-gray-900 mt-1">{viewingSponsor.location || <span className="text-gray-400">Chưa có</span>}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-gray-500">Email</dt>
                                        <dd className="text-gray-900 mt-1">{viewingSponsor.email || <span className="text-gray-400">Chưa có</span>}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-gray-500">Điện thoại</dt>
                                        <dd className="text-gray-900 mt-1">{viewingSponsor.phone || <span className="text-gray-400">Chưa có</span>}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-gray-500">Trạng thái Hợp đồng</dt>
                                        <dd className="text-gray-900 mt-1">{renderContractStatusBadge(viewingSponsor.contract_status)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-gray-500">File Hợp đồng</dt>
                                        <dd className="text-gray-900 mt-1">
                                            {viewingSponsor.contract_url ? (
                                                <a href={viewingSponsor.contract_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                    Tải xuống / Xem file
                                                </a>
                                            ) : (
                                                <span className="text-gray-400">Chưa có</span>
                                            )}
                                        </dd>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <dt className="font-medium text-gray-500">Ghi chú</dt>
                                        <dd className="text-gray-900 mt-1 whitespace-pre-wrap">{viewingSponsor.notes || <span className="text-gray-400">Không có</span>}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                         <div className="mt-6 flex justify-end">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {sponsorToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                        <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
                        <p>Bạn có chắc chắn muốn xóa nhà tài trợ <span className="font-semibold">{sponsorToDelete.name}</span>?</p>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setSponsorToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xóa</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isLayoutModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                    onClick={() => setIsLayoutModalOpen(false)}
                >
                    <div 
                        className="relative bg-white rounded-lg shadow-xl p-4 max-w-5xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <h2 className="text-2xl font-bold mb-4 text-gray-800">Sơ đồ Gian hàng Sự kiện</h2>
                        <button 
                            onClick={() => setIsLayoutModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-3xl leading-none"
                            aria-label="Đóng"
                        >
                            &times;
                        </button>
                        <div className="w-full">
                            <img 
                                src="https://ickheuhelknxktukgmxh.supabase.co/storage/v1/object/public/event_assets/documents/1759326770397_fu9zdodzzpc.png" 
                                alt="Sơ đồ gian hàng sự kiện"
                                className="w-full h-auto object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sponsors;