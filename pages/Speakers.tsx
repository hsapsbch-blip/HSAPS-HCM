import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, uploadFileToStorage } from '../supabaseClient';
import { Speaker, Status, EmailTemplate } from '../types';
import { useAuth } from '../App';
import { GridIcon } from '../components/icons/GridIcon';
import { ListIcon } from '../components/icons/ListIcon';

type UploadingState = {
  avatar_url: boolean;
  passport_url: boolean;
  abstract_file_url: boolean;
  report_file_url: boolean;
}

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const renderTypeBadge = (type: Speaker['speaker_type']) => {
    if (!type) return null;
    const typeMap = {
        'Chủ tọa': 'bg-blue-100 text-blue-800',
        'Báo cáo viên': 'bg-purple-100 text-purple-800',
        'Chủ tọa/Báo cáo viên': 'bg-indigo-100 text-indigo-800',
    };
    const typeKey = type as keyof typeof typeMap;
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeMap[typeKey] || 'bg-gray-100 text-gray-800'}`}>
            {type}
        </span>
    );
};

const Speakers: React.FC = () => {
  const { hasPermission } = useAuth();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const [editingSpeaker, setEditingSpeaker] = useState<Partial<Speaker>>({});
  const [viewingSpeaker, setViewingSpeaker] = useState<Speaker | null>(null);
  const [isNew, setIsNew] = useState(false);
  
  const [speakerToDelete, setSpeakerToDelete] = useState<Speaker | null>(null);

  const [uploadingState, setUploadingState] = useState<UploadingState>({
    avatar_url: false,
    passport_url: false,
    abstract_file_url: false,
    report_file_url: false,
  });
  
  const [activeTab, setActiveTab] = useState<'details' | 'email'>('details');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [openStatusMenu, setOpenStatusMenu] = useState<number | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(
    () => (localStorage.getItem('speakerViewMode') as 'card' | 'table') || 'card'
  );


  useEffect(() => {
    if (hasPermission('speakers:view')) {
      fetchSpeakers();
      fetchEmailTemplates();
    } else {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    localStorage.setItem('speakerViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
            setOpenStatusMenu(null);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSpeakers = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('speakers')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      setError('Lỗi khi tải danh sách: ' + error.message);
    } else {
      setSpeakers(data || []);
    }
    setLoading(false);
  };
  
  const fetchEmailTemplates = async () => {
    const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('module', 'speakers');
    
    if (error) {
        console.error("Error fetching speaker email templates:", error.message);
    } else {
        setEmailTemplates(data || []);
    }
  };

  const openEditModal = (speaker: Partial<Speaker> | null = null) => {
    const canPerformAction = speaker ? hasPermission('speakers:edit') : hasPermission('speakers:create');
    if (!canPerformAction) {
        alert("Bạn không có quyền thực hiện hành động này.");
        return;
    }
    if (speaker) {
      setIsNew(false);
      setEditingSpeaker(speaker);
    } else {
      setIsNew(true);
      setEditingSpeaker({
        full_name: '',
        academic_rank: '',
        email: '',
        phone: '',
        workplace: '',
        report_title_vn: '',
        report_title_en: '',
        status: Status.PENDING,
        speaker_type: 'Báo cáo viên',
      });
    }
    setIsEditModalOpen(true);
  };
  
  const openViewModal = (speaker: Speaker) => {
    setViewingSpeaker(speaker);
    setActiveTab('details');
    setEmailStatus(null);
    setSelectedTemplate('');
    setEmailSubject('');
    setEmailBody('');
    setIsViewModalOpen(true);
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setIsViewModalOpen(false);
    setEditingSpeaker({});
    setViewingSpeaker(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editingSpeaker) return;
    const permissionToCheck = isNew ? 'speakers:create' : 'speakers:edit';
    if (!hasPermission(permissionToCheck)) {
        setError("Bạn không có quyền thực hiện hành động này.");
        return;
    }
    
    setLoading(true);
    setError(null);

    const speakerData = { ...editingSpeaker };
    if (isNew) {
      delete speakerData.id;
    }

    try {
        const { error } = isNew
        ? await supabase.from('speakers').insert([speakerData])
        : await supabase.from('speakers').update(speakerData).eq('id', editingSpeaker.id!);

      if (error) throw error;
      
      fetchSpeakers();
      closeModal();
    } catch (err: any) {
      setError('Lỗi khi lưu thông tin: ' + (err.message || 'Đã xảy ra lỗi.'));
    } finally {
        setLoading(false);
    }
  };

    const handleStatusChange = async (speakerId: number, newStatus: Status) => {
        setOpenStatusMenu(null);
        if (!hasPermission('speakers:edit')) return;

        const originalSpeakers = speakers;
        setSpeakers(current => 
            current.map(s => s.id === speakerId ? { ...s, status: newStatus } : s)
        );

        const { error: updateError } = await supabase
            .from('speakers')
            .update({ status: newStatus })
            .eq('id', speakerId);

        if (updateError) {
            setSpeakers(originalSpeakers);
            setError("Lỗi khi cập nhật trạng thái: " + updateError.message);
        }
    };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingSpeaker(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof UploadingState) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setUploadingState(prev => ({...prev, [field]: true}));
        setError(null);
        
        const publicUrl = await uploadFileToStorage(file, 'event_assets', `speakers/${field}`);

        if (publicUrl) {
            setEditingSpeaker(prev => ({ ...prev, [field]: publicUrl }));
        } else {
            setError("Tải tệp lên thất bại. Vui lòng thử lại.");
        }
        setUploadingState(prev => ({...prev, [field]: false}));
    }
  };

  const handleDelete = (speaker: Speaker) => {
      if (!hasPermission('speakers:delete')) {
          alert("Bạn không có quyền thực hiện hành động này.");
          return;
      }
      setSpeakerToDelete(speaker);
  };

  const confirmDelete = async () => {
    if (!speakerToDelete || !hasPermission('speakers:delete')) return;

    const { error } = await supabase
        .from('speakers')
        .delete()
        .eq('id', speakerToDelete.id);

    if (error) {
        setError('Lỗi khi xóa: ' + error.message);
    } else {
        setSpeakers(speakers.filter(s => s.id !== speakerToDelete.id));
        setSpeakerToDelete(null);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateName = e.target.value;
    setSelectedTemplate(templateName);
    if (templateName) {
        const template = emailTemplates.find(t => t.name === templateName);
        if(template){
            setEmailSubject(template.subject);
            setEmailBody(template.body);
        }
    } else {
        setEmailSubject('');
        setEmailBody('');
    }
  };

  const handleSendEmail = async () => {
    if (!viewingSpeaker?.email) {
        setEmailStatus({ type: 'error', message: 'Không tìm thấy email người nhận.' });
        return;
    }
    setIsSendingEmail(true);
    setEmailStatus(null);
    
    let finalBody = emailBody
        .replace(/{{ho_ten}}/g, viewingSpeaker.full_name || '')
        .replace(/{{hoc_ham}}/g, viewingSpeaker.academic_rank || '')
        .replace(/{{email}}/g, viewingSpeaker.email || '')
        .replace(/{{ten_bai_bao_cao}}/g, viewingSpeaker.report_title_vn || '');

    try {
        const { error: functionError } = await supabase.functions.invoke('send-email', {
            body: {
                to: viewingSpeaker.email,
                subject: emailSubject,
                html: finalBody.replace(/\n/g, '<br>')
            },
        });

        if (functionError) throw functionError;
        setEmailStatus({ type: 'success', message: 'Email đã được gửi thành công!' });

    } catch (err: any) {
        console.error("Email sending error:", err);
        let detailedError = err.message || 'Đã xảy ra lỗi không xác định.';

        const responseBody = err?.context?.body || err?.context?.text;
        if (typeof responseBody === 'string') {
            try {
                const errorJson = JSON.parse(responseBody);
                if (errorJson.error) {
                    detailedError = errorJson.error;
                }
            } catch (e) {
                if (responseBody.length > 0 && responseBody.length < 500) {
                    detailedError = responseBody;
                }
            }
        }
        
        setEmailStatus({ type: 'error', message: 'Lỗi khi gửi email: ' + detailedError });
    } finally {
        setIsSendingEmail(false);
    }
  };

  const renderStatusBadge = (status: Status, interactive: boolean = false, onClick?: () => void) => {
    const statusMap: { [key in Status]?: string } = {
      [Status.APPROVED]: 'bg-green-100 text-green-800',
      [Status.PENDING]: 'bg-yellow-100 text-yellow-800',
      [Status.REJECTED]: 'bg-red-100 text-red-800',
    };
    const baseClasses = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMap[status] || 'bg-gray-100 text-gray-800'}`;

    if (interactive) {
      return (
          <button
              onClick={onClick}
              disabled={!hasPermission('speakers:edit')}
              className={`${baseClasses} disabled:cursor-not-allowed disabled:opacity-70 hover:opacity-80 transition-opacity`}
          >
              {status}
          </button>
      );
    }
    return <span className={baseClasses}>{status}</span>;
  };
  
  const filteredSpeakers = useMemo(() => {
      if (!searchTerm) {
          return speakers;
      }
      return speakers.filter(speaker => {
          const lowerCaseSearchTerm = searchTerm.toLowerCase();
          return (
              speaker.full_name.toLowerCase().includes(lowerCaseSearchTerm) ||
              (speaker.academic_rank && speaker.academic_rank.toLowerCase().includes(lowerCaseSearchTerm)) ||
              (speaker.workplace && speaker.workplace.toLowerCase().includes(lowerCaseSearchTerm)) ||
              speaker.report_title_vn.toLowerCase().includes(lowerCaseSearchTerm) ||
              (speaker.email && speaker.email.toLowerCase().includes(lowerCaseSearchTerm))
          );
      });
  }, [speakers, searchTerm]);
  
  if (!hasPermission('speakers:view')) {
      return <AccessDenied />;
  }
  
  const speakerStatuses = [Status.PENDING, Status.APPROVED, Status.REJECTED];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Quản lý Chủ tọa/Báo cáo viên</h1>
            <p className="mt-2 text-gray-600">Thêm mới, xem và chỉnh sửa thông tin cho chủ tọa và báo cáo viên.</p>
        </div>
        {hasPermission('speakers:create') && (
            <button
                onClick={() => openEditModal()}
                className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors"
            >
                + Thêm mới
            </button>
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
          <input
              type="text"
              placeholder="Tìm theo tên, học hàm, nơi công tác, email, bài báo cáo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
              <button 
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'card' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  aria-label="Card View"
              >
                  <GridIcon className="w-5 h-5" />
              </button>
              <button 
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'table' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  aria-label="Table View"
              >
                  <ListIcon className="w-5 h-5" />
              </button>
          </div>
      </div>

      <div>
        {loading && <p className="p-4">Đang tải...</p>}
        {error && <p className="p-4 text-red-500">{error}</p>}
        {!loading && filteredSpeakers.length === 0 && (
          <div className="text-center py-10 bg-white rounded-lg shadow">
              <p className="text-gray-500">
                  {searchTerm ? "Không tìm thấy kết quả nào phù hợp." : "Chưa có dữ liệu."}
              </p>
          </div>
        )}
        {!loading && filteredSpeakers.length > 0 && (
          <>
            {viewMode === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredSpeakers.map(speaker => (
                  <div key={speaker.id} className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col transition-shadow hover:shadow-lg">
                    <div className="p-5 flex flex-col items-center text-center">
                        <img className="h-24 w-24 rounded-full object-cover mb-3 border-4 border-gray-100" src={speaker.avatar_url || `https://i.pravatar.cc/150?u=${speaker.id}`} alt={speaker.full_name} />
                        <h3 className="text-lg font-bold text-gray-900">{speaker.academic_rank} {speaker.full_name}</h3>
                        {speaker.speaker_type && <div className="mt-2">{renderTypeBadge(speaker.speaker_type)}</div>}
                        <p className="text-sm text-gray-500 mt-1">{speaker.workplace}</p>
                    </div>
                    <div className="p-5 border-t border-gray-100 flex-grow">
                        <h4 className="font-semibold text-sm text-gray-800">Bài báo cáo:</h4>
                        <p className="text-sm text-gray-700 font-medium mt-1" title={speaker.report_title_vn}>{speaker.report_title_vn || <span className="text-gray-400">Chưa có</span>}</p>
                        {speaker.report_title_en && (
                            <p className="text-sm text-gray-500 mt-1 italic" title={speaker.report_title_en}>{speaker.report_title_en}</p>
                        )}
                    </div>
                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                        <div className="relative" ref={openStatusMenu === speaker.id ? statusMenuRef : null}>
                            {renderStatusBadge(speaker.status, true, () => setOpenStatusMenu(openStatusMenu === speaker.id ? null : speaker.id))}
                            {openStatusMenu === speaker.id && (
                                <div className="absolute z-10 bottom-full mb-2 w-48 bg-white rounded-md shadow-lg border left-0">
                                    <div className="py-1">
                                        {speakerStatuses.map(statusOption => (
                                            <button
                                                key={statusOption}
                                                onClick={() => handleStatusChange(speaker.id, statusOption)}
                                                className={`block w-full text-left px-4 py-2 text-sm ${
                                                    speaker.status === statusOption ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                {statusOption}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => openViewModal(speaker)} className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1 rounded-md hover:bg-gray-200">Xem</button>
                          {hasPermission('speakers:edit') && <button onClick={() => openEditModal(speaker)} className="text-sm text-primary hover:text-primary-dark font-medium px-3 py-1 rounded-md hover:bg-primary-light">Sửa</button>}
                          {hasPermission('speakers:delete') && <button onClick={() => handleDelete(speaker)} className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded-md hover:bg-red-50">Xoá</button>}
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {viewMode === 'table' && (
              <div className="bg-white shadow rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 responsive-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chủ tọa/Báo cáo viên</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nơi công tác</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bài báo cáo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 lg:divide-y-0">
                    {filteredSpeakers.map(speaker => (
                      <tr key={speaker.id}>
                        <td data-label="Chủ tọa/Báo cáo viên" className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <img className="h-10 w-10 rounded-full object-cover" src={speaker.avatar_url || `https://i.pravatar.cc/150?u=${speaker.id}`} alt={speaker.full_name} />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{speaker.academic_rank} {speaker.full_name}</div>
                              <div className="text-sm text-gray-500">{speaker.email}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Loại" className="px-6 py-4 whitespace-nowrap">{renderTypeBadge(speaker.speaker_type)}</td>
                        <td data-label="Nơi công tác" className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{speaker.workplace}</td>
                        <td data-label="Bài báo cáo" className="px-6 py-4 whitespace-normal text-sm text-gray-700 max-w-xs truncate" title={speaker.report_title_vn}>{speaker.report_title_vn}</td>
                        <td data-label="Trạng thái" className="px-6 py-4 whitespace-nowrap">
                           <div className="relative" ref={openStatusMenu === speaker.id ? statusMenuRef : null}>
                                {renderStatusBadge(speaker.status, true, () => setOpenStatusMenu(openStatusMenu === speaker.id ? null : speaker.id))}
                                {openStatusMenu === speaker.id && (
                                    <div className="absolute z-10 mt-2 w-48 bg-white rounded-md shadow-lg border left-0">
                                        <div className="py-1">
                                            {speakerStatuses.map(statusOption => (
                                                <button key={statusOption} onClick={() => handleStatusChange(speaker.id, statusOption)} className={`block w-full text-left px-4 py-2 text-sm ${speaker.status === statusOption ? 'bg-gray-100' : ''} text-gray-700 hover:bg-gray-100`}>
                                                    {statusOption}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                          <button onClick={() => openViewModal(speaker)} className="text-gray-600 hover:text-gray-900 mr-4">Xem</button>
                          {hasPermission('speakers:edit') && <button onClick={() => openEditModal(speaker)} className="text-primary hover:text-primary-dark mr-4">Sửa</button>}
                          {hasPermission('speakers:delete') && <button onClick={() => handleDelete(speaker)} className="text-red-600 hover:text-red-800">Xoá</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Details Modal */}
      {isViewModalOpen && viewingSpeaker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Chi tiết</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
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
            {activeTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 flex flex-col items-center">
                        <img src={viewingSpeaker.avatar_url || `https://i.pravatar.cc/150?u=${viewingSpeaker.id}`} alt="Avatar" className="w-32 h-32 rounded-full object-cover mb-4 border-2 border-primary"/>
                        <h3 className="text-xl font-semibold text-center">{viewingSpeaker.academic_rank} {viewingSpeaker.full_name}</h3>
                        {viewingSpeaker.speaker_type && <div className="mt-2">{renderTypeBadge(viewingSpeaker.speaker_type)}</div>}
                        <p className="text-sm text-gray-500 text-center mt-1">{viewingSpeaker.workplace}</p>
                        <div className="mt-2">{renderStatusBadge(viewingSpeaker.status)}</div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Thông tin liên hệ</h4>
                            <p className="text-gray-800"><span className="font-semibold">Email:</span> {viewingSpeaker.email}</p>
                            <p className="text-gray-800"><span className="font-semibold">Điện thoại:</span> {viewingSpeaker.phone}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Bài báo cáo (Tiếng Việt)</h4>
                            <p className="text-gray-800">{viewingSpeaker.report_title_vn || <span className="text-gray-400">Chưa có</span>}</p>
                        </div>
                         <div>
                            <h4 className="text-sm font-medium text-gray-500">Bài báo cáo (Tiếng Anh)</h4>
                            <p className="text-gray-800">{viewingSpeaker.report_title_en || <span className="text-gray-400">Chưa có</span>}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Tài liệu đính kèm</h4>
                            <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
                                <li>Bài tóm tắt (Abstract): {viewingSpeaker.abstract_file_url ? <a href={viewingSpeaker.abstract_file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Xem tệp</a> : 'Chưa có'}</li>
                                <li>Bài báo cáo: {viewingSpeaker.report_file_url ? <a href={viewingSpeaker.report_file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Xem tệp</a> : 'Chưa có'}</li>
                                <li>Hộ chiếu/CCCD: {viewingSpeaker.passport_url ? <a href={viewingSpeaker.passport_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Xem ảnh</a> : 'Chưa có'}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'email' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Gửi tới</label>
                        <input type="email" value={viewingSpeaker.email || ''} readOnly className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100"/>
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
                            Các biến có sẵn: <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{ho_ten}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{hoc_ham}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{email}}`}</code>, <code className="font-mono bg-gray-100 p-0.5 rounded">{`{{ten_bai_bao_cao}}`}</code>
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
            <div className="mt-6 flex justify-end">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm mới' : 'Chỉnh sửa thông tin'}</h2>
            {error && <p className="mb-4 text-red-500">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Ảnh đại diện</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar_url')} className="mt-1 text-sm"/>
                        {uploadingState.avatar_url && <p className="text-xs text-primary">Đang tải lên...</p>}
                        {editingSpeaker.avatar_url && <img src={editingSpeaker.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full mt-2"/>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Loại</label>
                        <select name="speaker_type" value={editingSpeaker.speaker_type || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                            <option value="Báo cáo viên">Báo cáo viên</option>
                            <option value="Chủ tọa">Chủ tọa</option>
                            <option value="Chủ tọa/Báo cáo viên">Chủ tọa/Báo cáo viên</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Học hàm/Học vị</label>
                        <input type="text" name="academic_rank" value={editingSpeaker.academic_rank || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Họ và tên</label>
                        <input type="text" name="full_name" value={editingSpeaker.full_name || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" value={editingSpeaker.email || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Điện thoại</label>
                        <input type="text" name="phone" value={editingSpeaker.phone || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nơi công tác</label>
                        <input type="text" name="workplace" value={editingSpeaker.workplace || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                </div>
                 {/* Column 2 */}
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Tiêu đề bài báo cáo (Tiếng Việt)</label>
                        <textarea name="report_title_vn" value={editingSpeaker.report_title_vn || ''} onChange={handleChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tiêu đề bài báo cáo (Tiếng Anh)</label>
                        <textarea name="report_title_en" value={editingSpeaker.report_title_en || ''} onChange={handleChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                        <select name="status" value={editingSpeaker.status || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                            {speakerStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tệp bài tóm tắt (Abstract)</label>
                        <input type="file" onChange={(e) => handleFileChange(e, 'abstract_file_url')} className="mt-1 text-sm"/>
                        {uploadingState.abstract_file_url && <p className="text-xs text-primary">Đang tải lên...</p>}
                        {editingSpeaker.abstract_file_url && <a href={editingSpeaker.abstract_file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">Xem tệp</a>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Tệp bài báo cáo</label>
                        <input type="file" onChange={(e) => handleFileChange(e, 'report_file_url')} className="mt-1 text-sm"/>
                        {uploadingState.report_file_url && <p className="text-xs text-primary">Đang tải lên...</p>}
                        {editingSpeaker.report_file_url && <a href={editingSpeaker.report_file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">Xem tệp</a>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Ảnh Hộ chiếu/CCCD</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'passport_url')} className="mt-1 text-sm"/>
                        {uploadingState.passport_url && <p className="text-xs text-primary">Đang tải lên...</p>}
                        {editingSpeaker.passport_url && <a href={editingSpeaker.passport_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">Xem ảnh</a>}
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
              <button onClick={handleSave} disabled={loading || Object.values(uploadingState).some(s => s)} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50">
                {loading ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Delete Confirmation Modal */}
       {speakerToDelete && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
             <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
             <p>Bạn có chắc chắn muốn xóa <span className="font-semibold">{speakerToDelete.full_name}</span>? Hành động này không thể hoàn tác.</p>
             <div className="mt-6 flex justify-end space-x-3">
               <button onClick={() => setSpeakerToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
               <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Xác nhận xóa</button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default Speakers;