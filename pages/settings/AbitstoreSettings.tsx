import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App';
import { supabase } from '../../supabaseClient';
import { SystemSettings } from '../../types';

const AbitstoreSettings: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings:edit');

  // State for configuration
  const [settings, setSettings] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // State for testing
  const [testParams, setTestParams] = useState({
    send_from_number: '',
    send_to_number: '',
    message: 'Chào {{gioitinh}} {{name}}, đây là tin nhắn thử nghiệm từ hệ thống.',
    action: '',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
        setLoading(true);
        const { data, error: fetchError } = await supabase
            .from('settings')
            .select('abitstore_api_url')
            .eq('id', 1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
             setError('Lỗi khi tải cài đặt: ' + fetchError.message);
        } else if (data) {
            setSettings({
                abitstore_api_url: data.abitstore_api_url || '',
            });
        }
        setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleTestParamsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTestParams(prev => ({ ...prev, [name]: value }));
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
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
        .upsert({ id: 1, abitstore_api_url: settings.abitstore_api_url });

    if (upsertError) {
        setError('Lỗi khi lưu cài đặt: ' + upsertError.message);
    } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestStatus(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-abitstore-zalo', {
        body: testParams,
      });

      if (invokeError) throw invokeError;

      setTestStatus({ type: 'success', message: data.message || "Gửi yêu cầu thành công!" });
    } catch (err: any) {
      console.error("Test send error:", err);
      const errorMessage = err.context?.data?.error || err.message || "Đã xảy ra lỗi khi gửi yêu cầu.";
      setTestStatus({ type: 'error', message: `Lỗi: ${errorMessage}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Tích hợp Abitstore Zalo</h2>
      <p className="mt-1 text-sm text-gray-500">Cấu hình và kiểm tra việc gửi tin nhắn Zalo qua Abitstore.</p>
      
      {!canEdit && <p className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">Bạn không có quyền chỉnh sửa cài đặt này.</p>}
      {error && <p className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</p>}

      {/* Configuration Section */}
      <form onSubmit={handleConfigSubmit} className="mt-6 space-y-6 max-w-lg">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Cấu hình API</h3>
        <div>
          <label htmlFor="abitstore_api_url" className="block text-sm font-medium text-gray-700">URL API</label>
          <input
            type="text"
            name="abitstore_api_url"
            id="abitstore_api_url"
            placeholder="https://new.abitstore.vn/zalo/sendMessageZalo/6/{ma-shop}/{ma-truy-cap}"
            value={settings.abitstore_api_url || ''}
            onChange={handleSettingsChange}
            disabled={!canEdit}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500">Dán URL API đầy đủ của bạn từ Abitstore vào đây.</p>
        </div>

        <div className="flex items-center justify-end space-x-4">
           {success && <p className="text-sm text-green-600">Đã lưu cài đặt thành công!</p>}
           <button
            type="submit"
            disabled={loading || !canEdit}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </form>

      {/* Testing Section */}
      <form onSubmit={handleTestSubmit} className="mt-8 pt-6 border-t max-w-lg space-y-6">
        <h3 className="text-lg font-medium text-gray-900">Gửi tin nhắn thử nghiệm</h3>
        <div>
          <label htmlFor="send_from_number" className="block text-sm font-medium text-gray-700">SĐT Zalo gửi</label>
          <input type="text" name="send_from_number" id="send_from_number" value={testParams.send_from_number} onChange={handleTestParamsChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
        </div>
        <div>
          <label htmlFor="send_to_number" className="block text-sm font-medium text-gray-700">SĐT Zalo nhận</label>
          <input type="text" name="send_to_number" id="send_to_number" value={testParams.send_to_number} onChange={handleTestParamsChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">Nội dung tin nhắn</label>
          <textarea name="message" id="message" rows={4} value={testParams.message} onChange={handleTestParamsChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
          <p className="mt-1 text-xs text-gray-500">Sử dụng <code>{`{{gioitinh}}`}</code> hoặc <code>{`{{name}}`}</code> để cá nhân hóa.</p>
        </div>
        <div>
          <label htmlFor="action" className="block text-sm font-medium text-gray-700">Hành động (Tùy chọn)</label>
          <select name="action" id="action" value={testParams.action} onChange={handleTestParamsChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
            <option value="">Không có</option>
            <option value="make_friend">Gửi yêu cầu kết bạn</option>
          </select>
        </div>
         {testStatus && (
          <div className={`p-3 rounded-md text-sm ${testStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {testStatus.message}
          </div>
        )}
        <div className="text-right">
           <button
            type="submit"
            disabled={isTesting || !settings.abitstore_api_url}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {isTesting ? 'Đang gửi...' : 'Gửi thử'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AbitstoreSettings;