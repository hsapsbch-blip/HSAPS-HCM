import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../App';
import { supabase } from '../../supabaseClient';
import { EmailTemplate } from '../../types';

// Add type declaration for CKEditor on the window object
declare global {
  interface Window {
    ClassicEditor: any;
  }
}

const EmailTemplates: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings:edit');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStates, setSavingStates] = useState<Record<number, boolean>>({});
  const [successStates, setSuccessStates] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');

  // Use a ref to store CKEditor instances
  const editorInstances = useRef<Record<number, any>>({});

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .order('module')
        .order('id');
      
      if (fetchError) {
        setError('Lỗi khi tải các mẫu email: ' + fetchError.message);
      } else {
        setTemplates(data || []);
      }
      setLoading(false);
    };

    fetchTemplates();
  }, []);

  // Effect for initializing and cleaning up CKEditor instances
  useEffect(() => {
    // Wait for loading to finish, permissions to be checked, and the script to be available
    if (loading || !canEdit || !window.ClassicEditor) {
      return;
    }

    templates.forEach(template => {
      const element = document.querySelector<HTMLElement>(`#body-${template.id}`);
      // Initialize editor only if the element exists and an instance hasn't been created yet
      if (element && !editorInstances.current[template.id]) {
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
            editorInstances.current[template.id] = editor;
          })
          .catch((err: any) => {
            console.error(`Error initializing editor for template #${template.id}:`, err);
          });
      }
    });

    // Cleanup function: destroy all editor instances when the component unmounts
    return () => {
      Object.values(editorInstances.current).forEach((editor: any) => {
        if (editor && typeof editor.destroy === 'function') {
          editor.destroy().catch((err: any) => console.error("Editor destroy error:", err));
        }
      });
      editorInstances.current = {};
    };
  }, [loading, canEdit, templates]);

  const handleSubjectChange = (id: number, value: string) => {
    setTemplates(currentTemplates =>
      currentTemplates.map(t => (t.id === id ? { ...t, subject: value } : t))
    );
  };

  const handleSave = async (templateId: number) => {
    if (!canEdit) {
      setError("Bạn không có quyền thực hiện hành động này.");
      return;
    }
    
    const templateToSave = templates.find(t => t.id === templateId);
    const editorInstance = editorInstances.current[templateId];

    if (!templateToSave || !editorInstance) {
      setError(`Không tìm thấy mẫu hoặc trình soạn thảo cho ID #${templateId}.`);
      return;
    }

    setSavingStates(prev => ({ ...prev, [templateId]: true }));
    setSuccessStates(prev => ({ ...prev, [templateId]: false }));
    setError('');

    const updatedBody = editorInstance.getData();

    const { error: upsertError } = await supabase
      .from('email_templates')
      .update({ subject: templateToSave.subject, body: updatedBody })
      .eq('id', templateId);
    
    if (upsertError) {
      setError(`Lỗi khi lưu mẫu #${templateId}: ` + upsertError.message);
    } else {
      // Update local state with the saved body content
      setTemplates(current => current.map(t => t.id === templateId ? {...t, body: updatedBody} : t));
      setSuccessStates(prev => ({ ...prev, [templateId]: true }));
      setTimeout(() => setSuccessStates(prev => ({ ...prev, [templateId]: false })), 3000);
    }

    setSavingStates(prev => ({ ...prev, [templateId]: false }));
  };

  const groupedTemplates = useMemo(() => {
    return templates.reduce<Record<string, EmailTemplate[]>>((acc, template) => {
      const moduleKey = template.module === 'submissions' ? 'Đăng ký' : 'Báo cáo viên';
      if (!acc[moduleKey]) {
        acc[moduleKey] = [];
      }
      acc[moduleKey].push(template);
      return acc;
    }, {});
  }, [templates]);

  if (loading) {
    return <div>Đang tải các mẫu email...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Quản lý Mẫu Email</h2>
      <p className="mt-1 text-sm text-gray-500">Chỉnh sửa nội dung email tự động được gửi từ hệ thống.</p>
      
      {!canEdit && <p className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">Bạn không có quyền chỉnh sửa chức năng này.</p>}
      {error && <p className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</p>}

      <div className="mt-6 space-y-8">
        {Object.entries(groupedTemplates).map(([moduleName, templateList]) => (
          <div key={moduleName}>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b-2">{moduleName}</h3>
            <div className="space-y-6">
              {Array.isArray(templateList) && templateList.map(template => {
                const isSaving = savingStates[template.id];
                const isSuccess = successStates[template.id];

                return (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h4 className="font-semibold text-primary">{template.subject}</h4>
                            <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                        </div>
                         <button
                            onClick={() => handleSave(template.id)}
                            disabled={isSaving || !canEdit}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-28 text-center ${
                                isSaving ? 'bg-gray-200 text-gray-500' :
                                isSuccess ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark'
                            } disabled:opacity-70 disabled:cursor-not-allowed`}
                        >
                            {isSaving ? 'Đang lưu...' : (isSuccess ? 'Đã lưu!' : 'Lưu')}
                        </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tiêu đề (Subject)</label>
                        <input
                          type="text"
                          value={template.subject}
                          onChange={(e) => handleSubjectChange(template.id, e.target.value)}
                          disabled={!canEdit}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Nội dung (Body)</label>
                        <textarea
                            id={`body-${template.id}`}
                            defaultValue={template.body}
                            rows={10}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailTemplates;