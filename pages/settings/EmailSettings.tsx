import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App';
import { supabase } from '../../supabaseClient';
import { SystemSettings } from '../../types';

const EmailSettings: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings:edit');

  const [settings, setSettings] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchSettings = async () => {
        setLoading(true);
        const { data, error: fetchError } = await supabase
            .from('settings')
            .select('sender_name, sender_email')
            .eq('id', 1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'JSON object requested, multiple (or no) rows returned'
            setError('Lỗi khi tải cài đặt: ' + fetchError.message);
        } else if (data) {
            setSettings({
                sender_name: data.sender_name || '',
                sender_email: data.sender_email || '',
            });
        }
        setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
        setError("Bạn không có quyền thực hiện hành động này.");
        return;
    }
    setLoading(true);
    setSuccess(false);
    setError('');
    
    const { error: upsertError } = await supabase
        .from('settings')
        .upsert({ id: 1, ...settings });

    if (upsertError) {
        setError('Lỗi khi lưu cài đặt: ' + upsertError.message);
    } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Cài đặt Email (với Resend)</h2>
      <p className="mt-1 text-sm text-gray-500">Cấu hình thông tin người gửi. Hệ thống sử dụng Resend để gửi email.</p>
      
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-md">
        <h3 className="font-semibold">Hướng dẫn quan trọng</h3>
        <p className="text-sm mt-1">
          Để tính năng gửi email hoạt động, bạn cần tạo một API Key từ <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Resend.com</a> và thêm nó vào hệ thống.
        </p>
        <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
            <li>Trong Supabase Dashboard, đi đến <strong>Edge Functions &gt; Secrets</strong>.</li>
            <li>Thêm một secret mới với <strong>Key</strong> là <code>RESEND_API_KEY</code> và <strong>Value</strong> là API key của bạn từ Resend.</li>
            <li>Email người gửi dưới đây phải thuộc một tên miền bạn đã xác thực trên Resend.</li>
        </ol>
      </div>

      {!canEdit && <p className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">Bạn không có quyền chỉnh sửa cài đặt này.</p>}
      {error && <p className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6 max-w-lg">
        <div>
           <label htmlFor="sender_name" className="block text-sm font-medium text-gray-700">Tên người gửi</label>
           <input
            type="text"
            name="sender_name"
            id="sender_name"
            placeholder="Ví dụ: Ban tổ chức HSAPS 2025"
            value={settings.sender_name || ''}
            onChange={handleChange}
            disabled={!canEdit}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100"
          />
        </div>
        <div>
           <label htmlFor="sender_email" className="block text-sm font-medium text-gray-700">Email người gửi</label>
           <input
            type="email"
            name="sender_email"
            id="sender_email"
            placeholder="Ví dụ: contact@your-verified-domain.com"
            value={settings.sender_email || ''}
            onChange={handleChange}
            disabled={!canEdit}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100"
          />
        </div>
        
        <div className="flex items-center justify-end space-x-4">
           {success && <p className="text-sm text-green-600">Đã lưu cài đặt thành công!</p>}
           <button
            type="submit"
            disabled={loading || !canEdit}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailSettings;