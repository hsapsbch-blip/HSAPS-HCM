import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, uploadFileToStorage } from '../supabaseClient';
import { Submission, Status, EmailTemplate, FinanceTransaction, Profile } from '../types';
import { useAuth } from '../App';
import { useToast } from '../contexts/ToastContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Badge from '../components/Badge';

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const PAGE_SIZE = 20;

const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Helper for live input formatting
const formatAmountInput = (value?: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat('vi-VN').format(value);
};

const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Ngày không hợp lệ';
    return date.toLocaleString('vi-VN');
};
const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};


const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Submissions: React.FC = () => {
    const { notifyAdmins, hasPermission, profile: currentUser } = useAuth();
    const { addToast } = useToast();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [editingSubmission, setEditingSubmission] = useState<Partial<Submission>>({});
    
    const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | Status>('All');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [activeTab, setActiveTab] = useState<'details' | 'email'>('details');
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    
    const [printingSubmission, setPrintingSubmission] = useState<Submission | null>(null);
    const badgeRef = useRef<HTMLDivElement>(null);

    const attendeeTypes = [
        'Hội viên VSPAPS', 'Hội viên các hội chuyên ngành khác', 'Học viên, sinh viên',
        'Đại biểu tự do', 'Báo cáo viên', 'Ban tổ chức', 'Nhà tài trợ'
    ];
    
    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        setError(null);

        const from = (currentPage - 1) * PAGE_SIZE;
        const to = currentPage * PAGE_SIZE - 1;

        let query = supabase
            .from('submissions')
            .select('*', { count: 'exact' });

        if (filterStatus !== 'All') {
            query = query.eq('status', filterStatus);
        }

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,attendance_id.ilike.%${searchTerm}%`);
        }

        const { data, error, count } = await query
            .order('registration_time', { ascending: false })
            .range(from, to);

        if (error) {
            setError('Lỗi khi tải danh sách đăng ký: ' + error.message);
            setSubmissions([]);
            setTotalCount(0);
        } else {
            setSubmissions(data || []);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [currentPage, filterStatus, searchTerm]);


    useEffect(() => {
        if (hasPermission('submissions:view')) {
            fetchSubmissions();
        } else {
            setLoading(false);
        }
    }, [hasPermission, fetchSubmissions]);
    
    useEffect(() => {
        const fetchEmailTemplates = async () => {
            const { data, error } = await supabase
                .from('email_templates')
                .select('*')
                .eq('module', 'submissions');
            
            if (error) {
                console.error("Error fetching submission email templates:", error.message);
            } else {
                setEmailTemplates(data || []);
            }
        };
        if (hasPermission('submissions:view')) {
           fetchEmailTemplates();
        }
    }, [hasPermission]);

    useEffect(() => {
        if (isModalOpen && isViewOnly && editingSubmission.attendance_id && qrCanvasRef.current) {
            const qrContent = [
                editingSubmission.attendance_id,
                editingSubmission.full_name,
                editingSubmission.phone,
                editingSubmission.email,
                editingSubmission.attendee_type
            ].filter(Boolean).join('|');

            if ((window as any).QRCode) {
                (window as any).QRCode.toCanvas(
                    qrCanvasRef.current,
                    qrContent,
                    { errorCorrectionLevel: 'H', width: 200, margin: 1 },
                    (error: any) => {
                        if (error) console.error("QR Code generation error:", error);
                    }
                );
            } else {
                console.error("QRCode library not loaded.");
            }
        }
    }, [isModalOpen, isViewOnly, editingSubmission, activeTab]);

    const generateAndUploadBadge = useCallback(async (submission: Submission): Promise<string | null> => {
        addToast('Đang tạo file PDF cho thẻ đeo...', 'info');
        setPrintingSubmission(submission);
    
        // Wait for the next render cycle for the badge to be in the DOM
        await new Promise(resolve => setTimeout(resolve, 300));
    
        const element = badgeRef.current;
        if (!element) {
            throw new Error('Không tìm thấy thành phần thẻ để in.');
        }
    
        try {
            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [80, 50] });
            pdf.addImage(imgData, 'PNG', 0, 0, 80, 50, undefined, 'FAST');
            const pdfBlob = pdf.output('blob');
    
            const fileName = `Badge_${submission.attendance_id}_${submission.full_name.replace(/\s+/g, '_')}.pdf`;
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const publicUrl = await uploadFileToStorage(pdfFile, 'event_assets', 'badges');
    
            if (!publicUrl) {
                throw new Error('Tải file PDF lên thất bại.');
            }
    
            const { error: updateError } = await supabase
                .from('submissions')
                .update({ badge_url: publicUrl })
                .eq('id', submission.id);
    
            if (updateError) {
                console.error("Lỗi khi lưu URL thẻ vào CSDL:", updateError.message);
                throw new Error('Lỗi khi cập nhật CSDL với link PDF.');
            }
            
            setSubmissions(current =>
                current.map(s => s.id === submission.id ? { ...s, badge_url: publicUrl } : s)
            );
            addToast('Đã tạo và lưu file PDF thành công!', 'success');
            return publicUrl;
        } catch (err: any) {
            console.error("Lỗi khi tạo PDF:", err);
            addToast(`Lỗi khi tạo PDF: ${err.message}`, 'error');
            return null;
        } finally {
            setPrintingSubmission(null);
        }
    }, [addToast]);


    const createFinanceTransactionFromSubmission = async (submission: Submission, handlerId: string) => {
        if (!submission.payment_amount || submission.payment_amount <= 0) {
          // Don't create a transaction for free registrations
          return;
        }
      
        const newTransaction: Omit<FinanceTransaction, 'id' | 'profiles'> = {
          title: `Phí đăng ký - ${submission.full_name} - ${submission.attendance_id}`,
          type: 'Thu',
          amount: submission.payment_amount,
          transaction_date: new Date().toISOString(),
          handler_id: handlerId,
          notes: `Giao dịch tự động từ đăng ký #${submission.attendance_id}.`,
          payment_method: 'Chuyển khoản', // Default assumption
          account: 'TK Hội Nghị',
          receipt_url: null
        };
      
        const { error: transactionError } = await supabase.from('finance_transactions').insert([newTransaction]);
      
        if (transactionError) {
          console.error('Failed to create finance transaction:', transactionError.message);
          addToast(`Lỗi: Không thể tạo giao dịch thu tự động. Vui lòng tạo thủ công.`, 'error');
        } else {
          addToast(`Đã tạo giao dịch thu ${formatCurrency(submission.payment_amount)}.`, 'success');
        }
    };

    const openModal = (submission: Submission | null = null, viewOnly: boolean = false) => {
        if (submission === null) { // Create new
            if (!hasPermission('submissions:create')) {
                alert("Bạn không có quyền thực hiện hành động này.");
                return;
            }
            setIsNew(true);
            setIsViewOnly(false);
            setEditingSubmission({
                status: Status.PAYMENT_PENDING,
                attendee_type: 'Đại biểu tự do',
                payment_amount: undefined,
                cme: false,
                gala_dinner: false,
                dob: new Date().toISOString().split('T')[0],
            });
        } else { // View or Edit existing
            setIsNew(false);
            setEditingSubmission(submission);
            setIsViewOnly(viewOnly || !hasPermission('submissions:edit'));
        }
        setActiveTab('details');
        setEmailStatus(null);
        setSelectedTemplate('');
        setEmailSubject('');
        setEmailBody('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSubmission({});
        setSubmissionToDelete(null);
        setError(null);
    };
    
    const handleSave = async () => {
        const permissionToCheck = isNew ? 'submissions:create' : 'submissions:edit';
        if (!hasPermission(permissionToCheck)) {
            setError("Bạn không có quyền thực hiện hành động này.");
            return;
        }

        if (!editingSubmission.full_name || !editingSubmission.email) {
            setError("Họ tên và email không được để trống.");
            return;
        }

        setLoading(true);
        setError(null);
        let shouldCloseModal = true;

        try {
            let finalSubmissionData: Submission | null = null;
            const originalStatus = isNew ? null : submissions.find(s => s.id === editingSubmission.id)?.status;

            if (isNew) {
                const submissionData = { ...editingSubmission };
                submissionData.registration_time = new Date().toISOString();
                delete submissionData.id;
                submissionData.attendance_id = `PENDING_ID_${Date.now()}`;

                const { data: newSubmission, error: insertError } = await supabase
                    .from('submissions')
                    .insert(submissionData)
                    .select()
                    .single();

                if (insertError || !newSubmission) throw insertError || new Error("Không thể tạo đăng ký mới.");
                
                const newAttendanceId = `HSAPS25-${String(newSubmission.id).padStart(4, '0')}`;
                const { data: updatedSubmission, error: updateError } = await supabase
                    .from('submissions')
                    .update({ attendance_id: newAttendanceId })
                    .eq('id', newSubmission.id)
                    .select()
                    .single();
                
                if (updateError || !updatedSubmission) throw updateError || new Error("Không thể cập nhật mã tham dự.");
                
                finalSubmissionData = updatedSubmission;

                if (finalSubmissionData) {
                    const message = `Có đăng ký mới từ "${finalSubmissionData.full_name}".`;
                    addToast(message, 'success');
                    await notifyAdmins(message, '/submissions');
                }

            } else {
                const { data: updatedSubmission, error: updateError } = await supabase
                    .from('submissions')
                    .update(editingSubmission)
                    .eq('id', editingSubmission.id!)
                    .select()
                    .single();
                
                if (updateError || !updatedSubmission) throw updateError || new Error("Không thể cập nhật đăng ký.");

                finalSubmissionData = updatedSubmission;
            }

            if (finalSubmissionData && finalSubmissionData.status === Status.PAYMENT_CONFIRMED && originalStatus !== Status.PAYMENT_CONFIRMED) {
                await notifyAdmins(
                   `Thanh toán cho đăng ký #${finalSubmissionData.attendance_id} (${finalSubmissionData.full_name}) đã được xác nhận.`,
                   '/submissions'
                );
                await sendPaymentConfirmationEmail(finalSubmissionData);
                if (currentUser) {
                    await createFinanceTransactionFromSubmission(finalSubmissionData, currentUser.id);
                }
            }

            // Check if badge needs to be generated
            const shouldGenerateBadge = (finalSubmissionData?.status === Status.APPROVED || finalSubmissionData?.status === Status.PAYMENT_CONFIRMED);
            if (finalSubmissionData && shouldGenerateBadge && !finalSubmissionData.badge_url) {
                await generateAndUploadBadge(finalSubmissionData);
            }

        } catch (err: any) {
             setError('Lỗi khi lưu: ' + (err.message || 'Đã xảy ra lỗi.'));
             shouldCloseModal = false;
        } finally {
            await fetchSubmissions();
            if (shouldCloseModal) {
                closeModal();
            }
            setLoading(false);
        }
    };
    
    const sendPaymentConfirmationEmail = async (submission: Submission) => {
        const paymentConfirmationTemplate = emailTemplates.find(t => t.name === 'payment_confirmed');
        if (paymentConfirmationTemplate && submission.email) {
            try {
                let finalBody = paymentConfirmationTemplate.body
                    .replace(/{{ho_ten}}/g, submission.full_name || '')
                    .replace(/{{id_tham_du}}/g, submission.attendance_id || '');
        
                const { error: functionError } = await supabase.functions.invoke('send-email', {
                    body: {
                        to: submission.email,
                        subject: paymentConfirmationTemplate.subject,
                        html: finalBody.replace(/\n/g, '<br>')
                    },
                });
                if (functionError) throw functionError;
                console.log(`Payment confirmation email successfully sent to ${submission.email}`);
            } catch (emailError: any) {
                const detailedError = emailError.context?.data?.error || emailError.message || "Lỗi không xác định.";
                const errorMessage = `Đã lưu đăng ký, nhưng gửi email xác nhận tự động thất bại: ${detailedError}`;
                setError(errorMessage);
                // In a quick-change context, we might not be in a modal, so we just log the error.
                console.error("Auto-email failure:", errorMessage);
                alert(errorMessage);
            }
        }
    };

    const handleStatusChange = async (submission: Submission, newStatus: Status) => {
        if (submission.status === newStatus || !hasPermission('submissions:approve')) return;

        setLoading(true);
        const { data: updatedSubmission, error: updateError } = await supabase
            .from('submissions')
            .update({ status: newStatus })
            .eq('id', submission.id)
            .select()
            .single();
    
        if (updateError || !updatedSubmission) {
            setError("Lỗi khi cập nhật trạng thái: " + updateError?.message);
            setLoading(false);
            return;
        }
    
        // Trigger side effects
        if (newStatus === Status.PAYMENT_CONFIRMED && submission.status !== Status.PAYMENT_CONFIRMED) {
            await notifyAdmins(
                `Thanh toán cho đăng ký #${updatedSubmission.attendance_id} (${updatedSubmission.full_name}) đã được xác nhận.`,
                '/submissions'
            );
            await sendPaymentConfirmationEmail(updatedSubmission);
            if (currentUser) {
                await createFinanceTransactionFromSubmission(updatedSubmission, currentUser.id);
            }
        }

        // Check if badge needs to be generated
        const shouldGenerateBadge = (updatedSubmission.status === Status.APPROVED || updatedSubmission.status === Status.PAYMENT_CONFIRMED);
        if (shouldGenerateBadge && !updatedSubmission.badge_url) {
            await generateAndUploadBadge(updatedSubmission);
        }
        
        // Refetch all data to ensure consistency
        await fetchSubmissions(); 
        setLoading(false);
    };

    const handleRegenerateBadge = async (submission: Submission) => {
        if (!hasPermission('submissions:edit')) {
            addToast('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }
    
        if (!window.confirm(`Bạn có chắc muốn tạo lại file PDF in thẻ cho "${submission.full_name}"? Thao tác này sẽ tạo một file mới và cập nhật đường dẫn.`)) {
            return;
        }
    
        setLoading(true);
        try {
            await generateAndUploadBadge(submission);
        } catch (err: any) {
            addToast(`Lỗi khi tạo lại thẻ: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (submission: Submission) => {
        if (!hasPermission('submissions:delete')) {
            alert("Bạn không có quyền thực hiện hành động này.");
            return;
        }
        setSubmissionToDelete(submission);
    };

    const confirmDelete = async () => {
        if (!submissionToDelete || !hasPermission('submissions:delete')) return;
        const { error } = await supabase.from('submissions').delete().eq('id', submissionToDelete.id);
        if (error) {
            setError('Lỗi khi xóa đăng ký: ' + error.message);
        } else {
            setSubmissions(submissions.filter(s => s.id !== submissionToDelete.id));
            setSubmissionToDelete(null);
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setEditingSubmission(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'payment_amount') {
            const sanitizedValue = value.replace(/\D/g, '');
            const numericValue = sanitizedValue === '' ? undefined : Number(sanitizedValue);
            if (numericValue !== undefined && isNaN(numericValue)) return;
            setEditingSubmission(prev => ({ ...prev, payment_amount: numericValue }));
        } else if (name === 'full_name') {
            setEditingSubmission(prev => ({ ...prev, [name]: toTitleCase(value) }));
        } else {
            setEditingSubmission(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            setError(null);
            const publicUrl = await uploadFileToStorage(file, 'event_assets', 'payment_proofs');
            if (publicUrl) {
                setEditingSubmission(prev => ({ ...prev, payment_image_url: publicUrl }));
            } else {
                setError("Tải minh chứng lên thất bại. Vui lòng thử lại.");
            }
            setIsUploading(false);
        }
    };

    const handleDownloadQR = () => {
        if (qrCanvasRef.current && editingSubmission) {
            const link = document.createElement('a');
            const fileName = `QR_HSAPS25_${editingSubmission.attendance_id}_${editingSubmission.full_name?.replace(/\s+/g, '_') || 'attendee'}.png`;
            link.download = fileName;
            link.href = qrCanvasRef.current.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateName = e.target.value;
        setSelectedTemplate(templateName);
        if (templateName) {
            const template = emailTemplates.find(t => t.name === templateName);
            if(template) {
                setEmailSubject(template.subject);
                setEmailBody(template.body);
            }
        } else {
            setEmailSubject('');
            setEmailBody('');
        }
    };

    const handleSendEmail = async () => {
        if (!editingSubmission.email) {
            setEmailStatus({ type: 'error', message: 'Không tìm thấy email người nhận.' });
            return;
        }
        setIsSendingEmail(true);
        setEmailStatus(null);
        
        let finalBody = emailBody
            .replace(/{{ho_ten}}/g, editingSubmission.full_name || '')
            .replace(/{{id_tham_du}}/g, editingSubmission.attendance_id || '')
            .replace(/{{email}}/g, editingSubmission.email || '')
            .replace(/{{loai_dai_bieu}}/g, editingSubmission.attendee_type || '');

        try {
            const { error: functionError } = await supabase.functions.invoke('send-email', {
                body: {
                    to: editingSubmission.email,
                    subject: emailSubject,
                    html: finalBody.replace(/\n/g, '<br>') // Simple conversion to HTML
                },
            });

            if (functionError) throw functionError;

            setEmailStatus({ type: 'success', message: 'Email đã được gửi thành công!' });

        } catch (err: any) {
            console.error("Email sending error:", err);
            const detailedError = err.context?.data?.error || err.message || 'Đã xảy ra lỗi không xác định.';
            setEmailStatus({ type: 'error', message: 'Lỗi khi gửi email: ' + detailedError });
        } finally {
            setIsSendingEmail(false);
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
    
    const getModalTitle = () => {
        if (isNew) return 'Thêm đăng ký mới';
        if (isViewOnly) return `Chi tiết đăng ký #${editingSubmission.attendance_id}`;
        return `Chỉnh sửa đăng ký #${editingSubmission.attendance_id}`;
    };

    const submissionStatuses = Object.values(Status).filter(s => s !== Status.COMPLETED && s !== Status.IN_PROGRESS);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilterStatus(e.target.value as 'All' | Status);
        setCurrentPage(1);
    }
    
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }
    
    const submissionsAwaitingPayment = useMemo(() => 
        submissions.filter(s => 
            s.status === Status.PENDING || 
            s.status === Status.APPROVED || 
            s.status === Status.PAYMENT_PENDING
        ), [submissions]);

    const submissionsConfirmed = useMemo(() => 
        submissions.filter(s => s.status === Status.PAYMENT_CONFIRMED), 
    [submissions]);

    const submissionsRejected = useMemo(() => 
        submissions.filter(s => s.status === Status.REJECTED), 
    [submissions]);

    if (!hasPermission('submissions:view')) {
        return <AccessDenied />;
    }

    return (
        <div>
            {printingSubmission && (
                <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
                    <Badge ref={badgeRef} submission={printingSubmission} />
                </div>
            )}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Đăng ký</h1>
                    <p className="mt-2 text-gray-600">Xem và duyệt các đơn đăng ký tham dự sự kiện.</p>
                </div>
                {hasPermission('submissions:create') && (
                     <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                        + Thêm đăng ký
                    </button>
                )}
            </div>

            <div className="flex space-x-4 mb-4">
                <input
                    type="text"
                    placeholder="Tìm theo tên, email, mã tham dự..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                 <select 
                    value={filterStatus} 
                    onChange={handleFilterChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Tất cả trạng thái</option>
                    {submissionStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="bg-white shadow rounded-lg overflow-x-auto">
                {loading && !isModalOpen && <p className="p-4">Đang tải...</p>}
                {error && <p className="p-4 text-red-500">{error}</p>}
                {!loading && submissions.length === 0 && <p className="p-4">Không có đơn đăng ký nào.</p>}
                {!loading && submissions.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200 lg:divide-y-0 responsive-table submission-cards">
                         <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người đăng ký</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số tiền</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tài liệu</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y-0">
                             {submissionsAwaitingPayment.length > 0 && (
                                <>
                                    <tr className="is-group-header">
                                        <td colSpan={6} className="px-6 py-2 text-left text-sm font-semibold text-gray-700 bg-gray-100">
                                            Chờ Xử Lý ({submissionsAwaitingPayment.length})
                                        </td>
                                    </tr>
                                    {submissionsAwaitingPayment.map(s => (
                                         <tr key={s.id} className="bg-white lg:bg-transparent shadow-sm lg:shadow-none">
                                            <td data-label="Đại biểu" className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex justify-between items-start w-full">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900 responsive-name">{s.full_name}</div>
                                                        <div className="text-sm text-gray-500 font-mono mt-1 responsive-id">{s.attendance_id}</div>
                                                    </div>
                                                    <div className="lg:hidden flex-shrink-0">
                                                        {renderStatusBadge(s.status)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Loại" className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.attendee_type}</td>
                                            <td data-label="Số tiền" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(s.payment_amount)}</td>
                                            <td data-label="Tài liệu" className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex flex-col space-y-1 items-end lg:items-start">
                                                    {s.payment_image_url ? (
                                                        <button onClick={() => setViewingImage(s.payment_image_url)} className="text-primary hover:underline">Ảnh CK</button>
                                                    ) : ( <span className="text-gray-400">Ảnh CK</span> )}
                                                    {s.badge_url ? (
                                                        <a href={s.badge_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">File In</a>
                                                    ) : ( <span className="text-gray-400">File In</span> )}
                                                </div>
                                            </td>
                                            <td data-label="Trạng thái" className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                                {renderStatusBadge(s.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                                               <div className="flex flex-wrap gap-x-3 gap-y-2 lg:justify-end">
                                                    <button onClick={() => openModal(s, true)} className="text-gray-600 hover:text-gray-900">Xem</button>
                                                    <button 
                                                        onClick={() => window.open(s.badge_url!, '_blank')} 
                                                        disabled={!s.badge_url}
                                                        className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                    >
                                                        In thẻ
                                                    </button>
                                                    {s.badge_url && hasPermission('submissions:edit') && (
                                                        <button
                                                            onClick={() => handleRegenerateBadge(s)}
                                                            className="text-orange-600 hover:text-orange-900"
                                                            title="Tạo lại file PDF in thẻ"
                                                        >
                                                            Tạo lại
                                                        </button>
                                                    )}
                                                    {hasPermission('submissions:edit') && <button onClick={() => openModal(s, false)} className="text-primary hover:text-primary-dark">Sửa</button>}
                                                    
                                                    {hasPermission('submissions:approve') && s.status === Status.PENDING && (
                                                        <>
                                                            <button onClick={() => handleStatusChange(s, Status.APPROVED)} className="text-green-600 hover:text-green-800">Duyệt</button>
                                                            <button onClick={() => handleStatusChange(s, Status.REJECTED)} className="text-yellow-600 hover:text-yellow-800">Từ chối</button>
                                                        </>
                                                    )}
                                                    
                                                    {hasPermission('submissions:approve') && s.status === Status.PAYMENT_PENDING && (
                                                        <>
                                                            <button onClick={() => handleStatusChange(s, Status.PAYMENT_CONFIRMED)} className="text-blue-600 hover:text-blue-800">Xác nhận TT</button>
                                                            <button onClick={() => handleStatusChange(s, Status.REJECTED)} className="text-yellow-600 hover:text-yellow-800">Từ chối</button>
                                                        </>
                                                    )}
                                                    
                                                    {hasPermission('submissions:delete') && <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800">Xóa</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                             )}
                              {submissionsConfirmed.length > 0 && (
                                <>
                                    <tr className="is-group-header">
                                        <td colSpan={6} className="px-6 py-2 text-left text-sm font-semibold text-gray-700 bg-gray-100">
                                            Đã Thanh Toán ({submissionsConfirmed.length})
                                        </td>
                                    </tr>
                                    {submissionsConfirmed.map(s => (
                                         <tr key={s.id} className="bg-white lg:bg-transparent shadow-sm lg:shadow-none">
                                            <td data-label="Đại biểu" className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex justify-between items-start w-full">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900 responsive-name">{s.full_name}</div>
                                                        <div className="text-sm text-gray-500 font-mono mt-1 responsive-id">{s.attendance_id}</div>
                                                    </div>
                                                    <div className="lg:hidden flex-shrink-0">
                                                        {renderStatusBadge(s.status)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Loại" className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.attendee_type}</td>
                                            <td data-label="Số tiền" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(s.payment_amount)}</td>
                                            <td data-label="Tài liệu" className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex flex-col space-y-1 items-end lg:items-start">
                                                    {s.payment_image_url ? (
                                                        <button onClick={() => setViewingImage(s.payment_image_url)} className="text-primary hover:underline">Ảnh CK</button>
                                                    ) : ( <span className="text-gray-400">Ảnh CK</span> )}
                                                    {s.badge_url ? (
                                                        <a href={s.badge_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">File In</a>
                                                    ) : ( <span className="text-gray-400">File In</span> )}
                                                </div>
                                            </td>
                                            <td data-label="Trạng thái" className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                                {renderStatusBadge(s.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                                               <div className="flex flex-wrap gap-x-3 gap-y-2 lg:justify-end">
                                                    <button onClick={() => openModal(s, true)} className="text-gray-600 hover:text-gray-900">Xem</button>
                                                    <button 
                                                        onClick={() => window.open(s.badge_url!, '_blank')} 
                                                        disabled={!s.badge_url}
                                                        className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                    >
                                                        In thẻ
                                                    </button>
                                                    {s.badge_url && hasPermission('submissions:edit') && (
                                                        <button
                                                            onClick={() => handleRegenerateBadge(s)}
                                                            className="text-orange-600 hover:text-orange-900"
                                                            title="Tạo lại file PDF in thẻ"
                                                        >
                                                            Tạo lại
                                                        </button>
                                                    )}
                                                    {hasPermission('submissions:edit') && <button onClick={() => openModal(s, false)} className="text-primary hover:text-primary-dark">Sửa</button>}
                                                    {hasPermission('submissions:delete') && <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800">Xóa</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                             )}
                             {submissionsRejected.length > 0 && (
                                <>
                                    <tr className="is-group-header">
                                        <td colSpan={6} className="px-6 py-2 text-left text-sm font-semibold text-gray-700 bg-gray-100">
                                            Đã Từ Chối ({submissionsRejected.length})
                                        </td>
                                    </tr>
                                    {submissionsRejected.map(s => (
                                         <tr key={s.id} className="bg-white lg:bg-transparent shadow-sm lg:shadow-none">
                                            <td data-label="Đại biểu" className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex justify-between items-start w-full">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900 responsive-name">{s.full_name}</div>
                                                        <div className="text-sm text-gray-500 font-mono mt-1 responsive-id">{s.attendance_id}</div>
                                                    </div>
                                                    <div className="lg:hidden flex-shrink-0">
                                                        {renderStatusBadge(s.status)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Loại" className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.attendee_type}</td>
                                            <td data-label="Số tiền" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(s.payment_amount)}</td>
                                            <td data-label="Tài liệu" className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex flex-col space-y-1 items-end lg:items-start">
                                                    {s.payment_image_url ? (
                                                        <button onClick={() => setViewingImage(s.payment_image_url)} className="text-primary hover:underline">Ảnh CK</button>
                                                    ) : ( <span className="text-gray-400">Ảnh CK</span> )}
                                                    {s.badge_url ? (
                                                        <a href={s.badge_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">File In</a>
                                                    ) : ( <span className="text-gray-400">File In</span> )}
                                                </div>
                                            </td>
                                            <td data-label="Trạng thái" className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                                {renderStatusBadge(s.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                                               <div className="flex flex-wrap gap-x-3 gap-y-2 lg:justify-end">
                                                    <button onClick={() => openModal(s, true)} className="text-gray-600 hover:text-gray-900">Xem</button>
                                                    {hasPermission('submissions:edit') && <button onClick={() => openModal(s, false)} className="text-primary hover:text-primary-dark">Sửa</button>}
                                                    {hasPermission('submissions:delete') && <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800">Xóa</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                             )}
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
            
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <h2 className="text-2xl font-bold mb-4 text-gray-800">{getModalTitle()}</h2>
                            <button onClick={closeModal} className="text-2xl text-gray-500 hover:text-gray-800">&times;</button>
                        </div>
                        
                        {!isNew && (
                            <div className="border-b border-gray-200 mb-4">
                                <nav className="-mb-px flex space-x-6">
                                    <button onClick={() => setActiveTab('details')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                        Thông tin chi tiết
                                    </button>
                                    <button onClick={() => setActiveTab('email')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'email' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                        Gửi Email
                                    </button>
                                </nav>
                            </div>
                        )}
                        
                        {error && <p className="mb-4 text-red-500">{error}</p>}

                        {activeTab === 'details' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    {/* Col 1 */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Họ tên</label>
                                            <input type="text" name="full_name" value={editingSubmission.full_name || ''} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Email</label>
                                            <input type="email" name="email" value={editingSubmission.email || ''} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Điện thoại</label>
                                            <input type="text" name="phone" value={editingSubmission.phone || ''} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Ngày sinh</label>
                                            <input type="date" name="dob" value={formatDateForInput(editingSubmission.dob)} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Nơi công tác</label>
                                            <input type="text" name="workplace" value={editingSubmission.workplace || ''} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Địa chỉ</label>
                                            <input type="text" name="address" value={editingSubmission.address || ''} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                    </div>
                                    {/* Col 2 */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Loại đại biểu</label>
                                            <select name="attendee_type" value={editingSubmission.attendee_type || ''} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100">
                                                {attendeeTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Số tiền thanh toán (VND)</label>
                                            <input type="text" inputMode="numeric" name="payment_amount" value={formatAmountInput(editingSubmission.payment_amount)} onChange={handleChange} disabled={isViewOnly} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                                            <select name="status" value={editingSubmission.status || ''} onChange={handleChange} disabled={isViewOnly || !hasPermission('submissions:approve')} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100">
                                                {submissionStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center space-x-8 pt-2">
                                            <label className="flex items-center">
                                                <input type="checkbox" name="cme" checked={!!editingSubmission.cme} onChange={handleChange} disabled={isViewOnly} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:bg-gray-200"/>
                                                <span className="ml-2 text-sm text-gray-700">Đăng ký CME</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input type="checkbox" name="gala_dinner" checked={!!editingSubmission.gala_dinner} onChange={handleChange} disabled={isViewOnly} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:bg-gray-200"/>
                                                <span className="ml-2 text-sm text-gray-700">Tham dự Gala Dinner</span>
                                            </label>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Minh chứng thanh toán</label>
                                            {!isViewOnly && <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 text-sm"/>}
                                            {isUploading && <p className="text-xs text-primary">Đang tải lên...</p>}
                                            {editingSubmission.payment_image_url ? (
                                                <a href={editingSubmission.payment_image_url} target="_blank" rel="noopener noreferrer">
                                                    <img src={editingSubmission.payment_image_url} alt="Payment Proof" className="mt-2 max-w-xs rounded-lg border shadow-sm"/>
                                                </a>
                                            ) : <p className="text-sm text-gray-500 mt-2">Chưa có minh chứng.</p>}
                                        </div>
                                    </div>
                                </div>

                                {isViewOnly && editingSubmission.attendance_id && (
                                    <div className="mt-6 pt-4 border-t">
                                        <h3 className="text-lg font-medium text-gray-900">Mã QR Tham dự</h3>
                                        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                            <div className="bg-white p-2 border rounded-lg">
                                                <canvas ref={qrCanvasRef} width="200" height="200"></canvas>
                                            </div>
                                            <div>
                                                <button 
                                                    onClick={handleDownloadQR} 
                                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                                                >
                                                    Tải xuống QR Code
                                                </button>
                                                <p className="text-sm text-gray-500 mt-2">Sử dụng mã này để check-in tại sự kiện.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'email' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Gửi tới</label>
                                    <input type="email" value={editingSubmission.email || ''} readOnly className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Chọn mẫu email</label>
                                    <select value={selectedTemplate} onChange={handleTemplateChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                        <option value="">-- Soạn thủ công --</option>
                                        {emailTemplates.map(t => (
                                            <option key={t.id} value={t.name}>{t.subject}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                                    <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nội dung</label>
                                    <textarea rows={10} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                                    <p className="mt-2 text-xs text-gray-500">
                                        Các biến có sẵn: <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{ho_ten}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{email}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{id_tham_du}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{loai_dai_bieu}}`}</code>
                                    </p>
                                </div>
                                {emailStatus && (
                                    <div className={`p-3 rounded-md text-sm ${emailStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {emailStatus.message}
                                    </div>
                                )}
                                <div className="text-right">
                                    <button onClick={handleSendEmail} disabled={isSendingEmail} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50">
                                        {isSendingEmail ? 'Đang gửi...' : 'Gửi Email'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">{isViewOnly ? 'Đóng' : 'Hủy'}</button>
                            {!isViewOnly && activeTab === 'details' && (
                                <button onClick={handleSave} disabled={loading || isUploading} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50">
                                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            )}
                        </div>
                     </div>
                </div>
            )}

            {submissionToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
                        <p>Bạn có chắc chắn muốn xóa đơn đăng ký của <span className="font-semibold">{submissionToDelete.full_name}</span>? Hành động này không thể hoàn tác.</p>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setSubmissionToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xóa</button>
                        </div>
                    </div>
                </div>
            )}
            
            {viewingImage && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setViewingImage(null)}>
                    <div className="relative p-4" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => setViewingImage(null)} 
                            className="absolute -top-2 -right-2 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-2xl font-bold z-10 hover:bg-gray-200 transition-colors"
                            aria-label="Đóng"
                        >
                            &times;
                        </button>
                        <img 
                            src={viewingImage} 
                            alt="Minh chứng thanh toán (kích thước đầy đủ)" 
                            className="max-w-screen-lg max-h-[90vh] object-contain rounded-lg shadow-xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Submissions;
