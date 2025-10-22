import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../App';
import { useToast } from '../contexts/ToastContext';
import { Status, Speaker, Submission, Sponsor } from '../types';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

declare global {
  interface Window {
    ClassicEditor: any;
  }
}

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

type Recipient = {
    email: string;
    name?: string;
}

const BulkEmail: React.FC = () => {
    const { hasPermission } = useAuth();
    const { addToast } = useToast();
    const editorInstance = useRef<any>(null);

    const [activeTab, setActiveTab] = useState<'list' | 'csv' | 'manual'>('list');
    const [selectedList, setSelectedList] = useState<string>('');
    const [manualEmails, setManualEmails] = useState('');
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const [isFetchingList, setIsFetchingList] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    useEffect(() => {
        if (window.ClassicEditor) {
            const element = document.querySelector<HTMLElement>('#email-body-editor');
            if (element && !editorInstance.current) {
                window.ClassicEditor
                    .create(element, { 
                         toolbar: {
                            items: [
                                'undo', 'redo', '|', 'heading', '|', 
                                'bold', 'italic', '|', 'link', 'bulletedList', 'numberedList', 'blockQuote'
                            ],
                            shouldNotGroupWhenFull: true
                        },
                        removePlugins: ['ImageUpload', 'EasyImage', 'CKFinder']
                     })
                    .then((editor: any) => {
                        editorInstance.current = editor;
                        editor.model.document.on('change:data', () => {
                            setBody(editor.getData());
                        });
                    })
                    .catch((err: any) => console.error("CKEditor initialization error:", err));
            }
        }
        return () => {
            if (editorInstance.current) {
                editorInstance.current.destroy().catch((err:any) => console.error("CKEditor destroy error:", err));
                editorInstance.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const fetchList = async () => {
            if (activeTab !== 'list' || !selectedList) {
                setRecipients([]);
                return;
            }
            setIsFetchingList(true);
            let fetchedRecipients: Recipient[] = [];
            try {
                if (selectedList === 'confirmed_attendees') {
                    const { data, error } = await supabase
                        .from('submissions')
                        .select('full_name, email')
                        .eq('status', Status.PAYMENT_CONFIRMED);
                    if (error) throw error;
                    fetchedRecipients = data.map((item: Pick<Submission, 'full_name' | 'email'>) => ({ name: item.full_name, email: item.email }));
                } else if (selectedList === 'approved_speakers') {
                    const { data, error } = await supabase
                        .from('speakers')
                        .select('full_name, email')
                        .eq('status', Status.APPROVED);
                    if (error) throw error;
                     fetchedRecipients = data.map((item: Pick<Speaker, 'full_name' | 'email'>) => ({ name: item.full_name, email: item.email }));
                }
            } catch (err: any) {
                addToast('Lỗi khi tải danh sách người nhận: ' + err.message, 'error');
            }
            setRecipients(fetchedRecipients);
            setIsFetchingList(false);
        };
        fetchList();
    }, [selectedList, activeTab, addToast]);
    
    const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r\n|\n/);
            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            const emailIndex = header.indexOf('email');
            const nameIndex = header.indexOf('name');

            if (emailIndex === -1) {
                addToast("Tệp CSV phải có cột 'email'.", 'error');
                return;
            }
            
            const parsedRecipients = lines.slice(1)
                .map(line => line.split(','))
                .map(row => {
                    const email = row[emailIndex]?.trim();
                    if (email) {
                        return { email, name: nameIndex > -1 ? row[nameIndex]?.trim() : undefined };
                    }
                    return null;
                })
                .filter(r => !!(r && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))) as Recipient[];

            setRecipients(parsedRecipients);
            addToast(`Đã tìm thấy ${parsedRecipients.length} email hợp lệ.`, 'info');
        };
        reader.readAsText(file);
    };

    const parsedManualEmails = useMemo(() => {
        if (activeTab !== 'manual' || typeof manualEmails !== 'string' || !manualEmails) {
            return [];
        }
        return manualEmails
            .split(/[\s,;]+/)
            .map(email => email.trim())
            .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            .map(email => ({ email }));
    }, [manualEmails, activeTab]);

    const currentRecipients = useMemo(() => {
        switch (activeTab) {
            case 'list': return recipients;
            case 'csv': return recipients;
            case 'manual': return parsedManualEmails;
            default: return [];
        }
    }, [activeTab, recipients, parsedManualEmails]);

    const handleSend = async () => {
        if (currentRecipients.length === 0) {
            addToast('Vui lòng chọn hoặc nhập ít nhất một người nhận.', 'warning');
            return;
        }
        if (!subject.trim()) {
            addToast('Tiêu đề email không được để trống.', 'warning');
            return;
        }
        if (!body.trim()) {
            addToast('Nội dung email không được để trống.', 'warning');
            return;
        }

        if (!window.confirm(`Bạn có chắc muốn gửi email này đến ${currentRecipients.length} người nhận?`)) {
            return;
        }

        setIsSending(true);

        try {
            const { error } = await supabase.functions.invoke('send-bulk-email', {
                body: {
                    recipients: currentRecipients,
                    subject,
                    html: body,
                },
            });

            if (error) throw error;
            
            addToast(`Đã gửi thành công email đến ${currentRecipients.length} người nhận.`, 'success');
            // Reset form
            setSubject('');
            if (editorInstance.current) editorInstance.current.setData('');
            setManualEmails('');
            setSelectedList('');
            setRecipients([]);
        } catch (err: any) {
            addToast('Lỗi khi gửi email: ' + (err.context?.data?.error || err.message), 'error');
        } finally {
            setIsSending(false);
        }
    };
    
    if (!hasPermission('email:send_bulk')) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Gửi Email Hàng Loạt</h1>
                <p className="mt-2 text-gray-600">Soạn và gửi email đến các nhóm người dùng khác nhau.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">1. Chọn người nhận</h2>
                        <div className="mt-2 text-sm text-gray-600">
                           Tổng số người nhận: <span className="font-bold text-primary">{currentRecipients.length}</span>
                        </div>
                    </div>
                    
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button onClick={() => { setActiveTab('list'); setRecipients([]); }} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                Danh sách
                            </button>
                             <button onClick={() => { setActiveTab('csv'); setRecipients([]); }} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'csv' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                Tệp CSV
                            </button>
                             <button onClick={() => setActiveTab('manual')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                Thủ công
                            </button>
                        </nav>
                    </div>

                    <div>
                        {activeTab === 'list' && (
                             <div className="space-y-4">
                                <p className="text-sm text-gray-500">Chọn một danh sách người nhận có sẵn.</p>
                                <select value={selectedList} onChange={(e) => setSelectedList(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="">-- Chọn danh sách --</option>
                                    <option value="confirmed_attendees">Đại biểu đã xác nhận thanh toán</option>
                                    <option value="approved_speakers">Báo cáo viên đã duyệt</option>
                                </select>
                                {isFetchingList && <div className="flex items-center text-sm text-gray-500"><SpinnerIcon className="w-4 h-4 mr-2" /> Đang tải...</div>}
                            </div>
                        )}
                         {activeTab === 'csv' && (
                             <div className="space-y-2">
                                <p className="text-sm text-gray-500">Tải lên tệp CSV với cột 'email' và (tùy chọn) cột 'name'.</p>
                                <input type="file" accept=".csv" onChange={handleCsvUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary hover:file:bg-primary/20"/>
                            </div>
                        )}
                         {activeTab === 'manual' && (
                            <div className="space-y-2">
                               <p className="text-sm text-gray-500">Nhập danh sách email, phân tách bằng dấu phẩy, khoảng trắng, hoặc xuống dòng.</p>
                               <textarea value={manualEmails} onChange={(e) => setManualEmails(e.target.value)} rows={8} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm space-y-6">
                     <h2 className="text-lg font-semibold text-gray-800">2. Soạn email</h2>
                     <div>
                        <label htmlFor="email-subject" className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                        <input id="email-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                    </div>
                     <div>
                        <label htmlFor="email-body-editor" className="block text-sm font-medium text-gray-700">Nội dung</label>
                        <div className="mt-1">
                            <textarea id="email-body-editor" defaultValue={body}></textarea>
                        </div>
                         <p className="mt-2 text-xs text-gray-500">
                            Biến có sẵn: <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{name}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{email}}`}</code>. Biến `name` sẽ được thay thế nếu có trong danh sách.
                        </p>
                    </div>
                    <div>
                         <button onClick={handleSend} disabled={isSending || currentRecipients.length === 0} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark disabled:opacity-50">
                            {isSending ? <><SpinnerIcon className="w-5 h-5 mr-2" /> Đang gửi...</> : `Gửi đến ${currentRecipients.length} người`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkEmail;