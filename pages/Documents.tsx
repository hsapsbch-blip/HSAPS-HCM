import React, { useState, useEffect, useMemo } from 'react';
import { supabase, uploadFileToStorage } from '../supabaseClient';
import { EventDocument, DocumentType } from '../types';
import { useAuth } from '../App';

// Icon components for different file types
const FileIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
);
const ImageIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
);
const PdfIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z"></path></svg>
);
const VideoIcon = ({ className }: { className?: string }) => (
     <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
);

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Documents: React.FC = () => {
    const { hasPermission } = useAuth();
    const [documents, setDocuments] = useState<EventDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState<Partial<EventDocument>>({});
    const [isNew, setIsNew] = useState(false);
    
    const [documentToDelete, setDocumentToDelete] = useState<EventDocument | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'All' | DocumentType>('All');

    useEffect(() => {
        if (hasPermission('documents:view')) {
            fetchDocuments();
        } else {
            setLoading(false);
        }
    }, [hasPermission]);

    const fetchDocuments = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('event_documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            setError('Lỗi khi tải tài liệu: ' + error.message);
        } else {
            setDocuments(data || []);
        }
        setLoading(false);
    };

    const openModal = (doc: Partial<EventDocument> | null = null) => {
        const canPerformAction = doc ? hasPermission('documents:edit') : hasPermission('documents:create');
        if (!canPerformAction) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        if (doc) {
            setIsNew(false);
            setEditingDocument(doc);
        } else {
            setIsNew(true);
            setEditingDocument({
                name: '',
                description: '',
                type: DocumentType.OTHER,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingDocument({});
        setDocumentToDelete(null);
        setError(null);
    };

    const handleSave = async () => {
        const permissionToCheck = isNew ? 'documents:create' : 'documents:edit';
        if (!hasPermission(permissionToCheck)) {
            setError("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        if (!editingDocument.name || !editingDocument.file_url) {
            setError("Tên tài liệu và tệp tin không được để trống.");
            return;
        }
        setLoading(true);
        setError(null);

        const documentData = { ...editingDocument };
        if (isNew) {
            delete documentData.id;
        }

        try {
            const { error } = isNew
                ? await supabase.from('event_documents').insert([documentData])
                : await supabase.from('event_documents').update(documentData).eq('id', editingDocument.id!);

            if (error) throw error;
            fetchDocuments();
            closeModal();
        } catch (err: any) {
            setError('Lỗi khi lưu tài liệu: ' + (err.message || 'Đã xảy ra lỗi.'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (doc: EventDocument) => {
        if (!hasPermission('documents:delete')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setDocumentToDelete(doc);
    };

    const confirmDelete = async () => {
        if (!documentToDelete || !hasPermission('documents:delete')) return;
        const { error } = await supabase.from('event_documents').delete().eq('id', documentToDelete.id);
        if (error) {
            setError('Lỗi khi xóa tài liệu: ' + error.message);
        } else {
            setDocuments(documents.filter(d => d.id !== documentToDelete.id));
            setDocumentToDelete(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditingDocument(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            setError(null);
            const publicUrl = await uploadFileToStorage(file, 'event_assets', 'documents');
            if (publicUrl) {
                if (!editingDocument.name) {
                    setEditingDocument(prev => ({...prev, name: file.name}));
                }
                const thumbnail_url = file.type.startsWith('image/') ? publicUrl : '';
                setEditingDocument(prev => ({ ...prev, file_url: publicUrl, thumbnail_url }));
            } else {
                setError("Tải tệp lên thất bại. Vui lòng thử lại.");
            }
            setIsUploading(false);
        }
    };
    
    const getIconForType = (doc: EventDocument) => {
        if (doc.type === DocumentType.IMAGE && doc.thumbnail_url) {
            return <img src={doc.thumbnail_url} alt={doc.name} className="w-full h-full object-cover" />;
        }
        const iconProps = { className: "w-16 h-16 text-gray-400" };
        switch (doc.type) {
            case DocumentType.IMAGE: return <ImageIcon {...iconProps} />;
            case DocumentType.PDF: return <PdfIcon {...iconProps} />;
            case DocumentType.VIDEO: return <VideoIcon {...iconProps} />;
            default: return <FileIcon {...iconProps} />;
        }
    };
    
    const filteredDocuments = useMemo(() => {
        return documents.filter(doc => {
            const typeMatch = filterType === 'All' || doc.type === filterType;
            const searchMatch = searchTerm === '' || 
                doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()));
            return typeMatch && searchMatch;
        });
    }, [documents, searchTerm, filterType]);

    if (!hasPermission('documents:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Quản lý Tài liệu</h1>
                    <p className="mt-2 text-gray-600">Lưu trữ và chia sẻ các tệp tin quan trọng của sự kiện.</p>
                </div>
                {hasPermission('documents:create') && (
                    <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                        + Thêm tài liệu
                    </button>
                )}
            </div>

            <div className="flex space-x-4 mb-4">
                <input
                    type="text"
                    placeholder="Tìm theo tên, mô tả..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value as 'All' | DocumentType)}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả loại</option>
                    {Object.values(DocumentType).map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>

            {loading && <p className="p-4">Đang tải tài liệu...</p>}
            {error && !isModalOpen && <p className="p-4 text-red-500">{error}</p>}
            {!loading && filteredDocuments.length === 0 && (
                <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">Không có tài liệu nào phù hợp.</p>
                </div>
            )}
            
            {!loading && filteredDocuments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredDocuments.map(doc => (
                        <div key={doc.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                            <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                                {getIconForType(doc)}
                            </div>
                            <div className="p-4 flex-grow flex flex-col justify-between">
                                <div>
                                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mb-2 ${
                                        doc.type === DocumentType.IMAGE ? 'bg-blue-100 text-blue-800' :
                                        doc.type === DocumentType.PDF ? 'bg-red-100 text-red-800' :
                                        doc.type === DocumentType.VIDEO ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                    }`}>{doc.type}</span>
                                    <h3 className="font-bold text-gray-800 truncate" title={doc.name}>{doc.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1 h-10 overflow-hidden">{doc.description}</p>
                                </div>
                                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Tải xuống</a>
                                    <div className="space-x-2">
                                        {hasPermission('documents:edit') && <button onClick={() => openModal(doc)} className="text-sm text-gray-600 hover:text-gray-900">Sửa</button>}
                                        {hasPermission('documents:delete') && <button onClick={() => handleDelete(doc)} className="text-sm text-red-600 hover:text-red-800">Xóa</button>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
             {/* Add/Edit Modal */}
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm tài liệu mới' : 'Chỉnh sửa tài liệu'}</h2>
                        {error && <p className="mb-4 text-red-500">{error}</p>}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tệp tin</label>
                                <input type="file" onChange={handleFileChange} className="mt-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-primary hover:file:bg-pink-100"/>
                                {isUploading && <p className="text-xs text-primary mt-1">Đang tải lên...</p>}
                                {editingDocument.file_url && <a href={editingDocument.file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline mt-1 inline-block">Xem tệp đã tải lên</a>}
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Tên tài liệu</label>
                                <input type="text" name="name" value={editingDocument.name || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Loại tài liệu</label>
                                <select name="type" value={editingDocument.type || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    {Object.values(DocumentType).map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Mô tả</label>
                                <textarea name="description" value={editingDocument.description || ''} onChange={handleChange} rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
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
            {documentToDelete && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                         <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
                         <p>Bạn có chắc chắn muốn xóa tài liệu <span className="font-semibold">"{documentToDelete.name}"</span>? Hành động này không thể hoàn tác.</p>
                         <div className="mt-6 flex justify-end space-x-3">
                             <button onClick={() => setDocumentToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                             <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xác nhận xóa</button>
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default Documents;