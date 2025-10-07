import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App';
import { supabase } from '../../supabaseClient';
import { SystemSettings } from '../../types';

const ZaloSettings: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings:edit');

  const [settings, setSettings] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);


  useEffect(() => {
    const fetchSettings = async () => {
        setLoading(true);
        const { data, error: fetchError } = await supabase
            .from('settings')
            .select('oa_id, oa_secret_key')
            .eq('id', 1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
             setError('Lỗi khi tải cài đặt: ' + fetchError.message);
        } else if (data) {
            setSettings({
                oa_id: data.oa_id || '',
                oa_secret_key: data.oa_secret_key || '',
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

    const dataToSave = {
        oa_id: settings.oa_id,
        ...(settings.oa_secret_key && { oa_secret_key: settings.oa_secret_key })
    };

    const { error: upsertError } = await supabase
        .from('settings')
        .upsert({ id: 1, ...dataToSave });

    if (upsertError) {
        setError('Lỗi khi lưu cài đặt: ' + upsertError.message);
    } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  const handleManualRefresh = async () => {
    if (!canEdit) {
      setRefreshStatus({ type: 'error', message: "Bạn không có quyền thực hiện hành động này." });
      return;
    }
    setRefreshing(true);
    setRefreshStatus(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('refresh-zalo-token');
      if (invokeError) throw invokeError;
      setRefreshStatus({ type: 'success', message: (data as any)?.message || "Làm mới token thành công!" });
    } catch (err: any) {
      console.error("Refresh error:", err);
      const errorMessage = err.context?.data?.error || err.message || "Đã xảy ra lỗi khi làm mới token.";
      setRefreshStatus({ type: 'error', message: `Lỗi: ${errorMessage}` });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Cài đặt Zalo</h2>
      <p className="mt-1 text-sm text-gray-500">Cấu hình Zalo Official Account (OA) để tích hợp các tính năng Zalo.</p>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-md">
        <h3 className="font-semibold">Cơ chế tự động</h3>
        <p className="text-sm mt-1">
          Hệ thống sẽ tự động lấy và làm mới <strong>Access Token</strong> mỗi 23 giờ bằng cách sử dụng <strong>OA ID</strong> và <strong>Secret Key</strong> bạn cung cấp.
          Bạn không cần phải nhập Access Token thủ công. Để cơ chế này hoạt động, một cron job cần được thiết lập trên Supabase.
        </p>
      </div>
      
      {!canEdit && <p className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">Bạn không có quyền chỉnh sửa cài đặt này.</p>}
      {error && <p className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6 max-w-lg">
        <div>
          <label htmlFor="oa_id" className="block text-sm font-medium text-gray-700">Official Account ID</label>
          <input
            type="text"
            name="oa_id"
            id="oa_id"
            value={settings.oa_id || ''}
            onChange={handleChange}
            disabled={!canEdit}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label htmlFor="oa_secret_key" className="block text-sm font-medium text-gray-700">OA Secret Key</label>
          <input
            type="password"
            name="oa_secret_key"
            id="oa_secret_key"
            value={settings.oa_secret_key || ''}
            onChange={handleChange}
            placeholder="Để trống nếu không muốn thay đổi"
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

      <div className="mt-8 pt-6 border-t max-w-lg">
        <h3 className="text-lg font-medium text-gray-900">Làm mới thủ công</h3>
        <p className="mt-1 text-sm text-gray-500">
          Nếu bạn cần Access Token mới ngay lập tức, bạn có thể kích hoạt quá trình làm mới thủ công.
        </p>
        {refreshStatus && (
          <p className={`mt-2 text-sm p-2 rounded-md ${refreshStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {refreshStatus.message}
          </p>
        )}
        <button
          onClick={handleManualRefresh}
          disabled={refreshing || !canEdit}
          className="mt-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {refreshing ? 'Đang làm mới...' : 'Làm mới Access Token'}
        </button>
      </div>

    </div>
  );
};

export default ZaloSettings;