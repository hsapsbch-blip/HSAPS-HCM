import React, { useState, useEffect } from 'react';
import { supabase, uploadFileToStorage } from '../supabaseClient';
import { Profile } from '../types';
import { useAuth } from '../App';

const AccessDenied: React.FC = () => (
    <div>
        <h1 className="text-3xl font-bold text-red-600">Truy cập bị từ chối</h1>
        <p className="mt-2 text-gray-600">Bạn không có quyền xem trang này.</p>
    </div>
);

const Users: React.FC = () => {
  const { hasPermission } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> & { password?: string }>({});
  const [isNew, setIsNew] = useState(false);
  const [isUploading, setIsUploading] = useState(false);


  useEffect(() => {
    if (hasPermission('users:view')) {
      fetchProfiles();
    } else {
      setLoading(false);
    }
  }, [hasPermission]);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      setError('Lỗi khi tải danh sách người dùng: ' + error.message);
      console.error('Error fetching profiles:', error.message);
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const openModal = (profile: Partial<Profile> | null = null) => {
    const canPerformAction = profile ? hasPermission('users:edit') : hasPermission('users:create');
    if (!canPerformAction) {
      alert("Bạn không có quyền thực hiện hành động này.");
      return;
    }
    if (profile) {
      setIsNew(false);
      setEditingProfile(profile);
    } else {
      setIsNew(true);
      setEditingProfile({
        full_name: '',
        email: '',
        password: '',
        role: 'Thành viên BTC',
        avatar: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfile({});
    setError(null);
  };

  const handleSave = async () => {
    if (!editingProfile) return;
    
    setLoading(true);
    setError(null);

    try {
      if (isNew) {
        if (!hasPermission('users:create')) throw new Error("Không có quyền tạo người dùng.");
        if (!editingProfile.email || !editingProfile.password) {
            throw new Error("Email và mật khẩu là bắt buộc cho người dùng mới.");
        }
        const avatarUrl = editingProfile.avatar || `https://i.pravatar.cc/150?u=${editingProfile.email}`;
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: editingProfile.email!,
          password: editingProfile.password!,
          options: {
            data: {
              full_name: editingProfile.full_name,
              role: editingProfile.role,
              avatar: avatarUrl
            }
          }
        });

        if (signUpError) throw signUpError;
        
        if (signUpData.user) {
             const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    role: editingProfile.role, 
                    full_name: editingProfile.full_name,
                    avatar: avatarUrl
                })
                .eq('id', signUpData.user.id);
            if (updateError) console.warn("Could not immediately update new user's details. The backend trigger should handle it.", updateError.message);
        }

      } else {
        if (!hasPermission('users:edit')) throw new Error("Không có quyền sửa người dùng.");
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: editingProfile.full_name,
            role: editingProfile.role,
            avatar: editingProfile.avatar,
          })
          .eq('id', editingProfile.id!);
        
        if (updateError) throw updateError;
      }
      
      await fetchProfiles();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi.');
      console.error('Save error:', err);
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingProfile(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setIsUploading(true);
        setError(null);
        const publicUrl = await uploadFileToStorage(file, 'event_assets', 'avatars');
        if (publicUrl) {
            setEditingProfile(prev => ({ ...prev, avatar: publicUrl }));
        } else {
            setError("Tải ảnh đại diện lên thất bại. Vui lòng thử lại.");
        }
        setIsUploading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Chưa đăng nhập';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Ngày không hợp lệ';
    }
    return date.toLocaleString('vi-VN');
  };

  if (!hasPermission('users:view')) {
      return <AccessDenied />;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Quản lý Người dùng</h1>
            <p className="mt-2 text-gray-600">Thêm mới, xem và chỉnh sửa thông tin người dùng hệ thống.</p>
        </div>
        {hasPermission('users:create') && (
            <button
                onClick={() => openModal()}
                className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors w-full md:w-auto"
            >
                + Thêm người dùng
            </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        {loading && !isModalOpen && <p className="p-4">Đang tải...</p>}
        {error && !isModalOpen && <p className="p-4 text-red-500">{error}</p>}
        {!loading && !error && profiles.length === 0 && <p className="p-4">Không có người dùng nào.</p>}
        {!loading && profiles.length > 0 && (
          <table className="min-w-full divide-y divide-gray-200 responsive-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vai trò</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lần đăng nhập cuối</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 lg:divide-y-0">
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td data-label="Người dùng" className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img className="h-10 w-10 rounded-full object-cover" src={profile.avatar || `https://i.pravatar.cc/150?u=${profile.id}`} alt={profile.full_name} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{profile.full_name}</div>
                        <div className="text-sm text-gray-500">{profile.email}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Vai trò" className="px-6 py-4 whitespace-nowrap">
                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        profile.role === 'Quản trị viên' ? 'bg-red-100 text-red-800' : 
                        profile.role === 'Thành viên BTC' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                     }`}>
                        {profile.role}
                    </span>
                  </td>
                  <td data-label="Lần đăng nhập cuối" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(profile.last_login)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium actions-cell">
                    {hasPermission('users:edit') && (
                      <button onClick={() => openModal(profile)} className="text-primary hover:text-primary-dark">Sửa</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
       <p className="mt-4 text-sm text-gray-500">
            * Để đảm bảo an toàn, việc xóa người dùng cần được thực hiện trực tiếp trên trang quản trị Supabase.
       </p>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
            <h2 className="text-2xl font-bold mb-4">{isNew ? 'Thêm người dùng mới' : 'Chỉnh sửa thông tin'}</h2>
            {error && <p className="mb-4 text-red-500">{error}</p>}
            <div className="space-y-4">
                {isNew && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" name="email" value={editingProfile.email || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Mật khẩu ban đầu</label>
                            <input type="password" name="password" value={editingProfile.password || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"/>
                        </div>
                    </>
                )}
              <div>
                  <label className="block text-sm font-medium text-gray-700">Ảnh đại diện</label>
                  <div className="mt-1 flex items-center space-x-4">
                      <img
                          src={editingProfile.avatar || `https://i.pravatar.cc/150?u=${editingProfile.email || editingProfile.id}`}
                          alt="Avatar"
                          className="w-16 h-16 rounded-full object-cover bg-gray-100"
                      />
                      <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={isUploading}
                          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary hover:file:bg-primary/20"
                      />
                  </div>
                  {isUploading && <p className="text-xs text-primary mt-1">Đang tải lên...</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Họ và tên</label>
                <input type="text" name="full_name" value={editingProfile.full_name || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Vai trò</label>
                <select name="role" value={editingProfile.role || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary">
                    <option>Thành viên BTC</option>
                    <option>Tình nguyện viên</option>
                    <option>Quản trị viên</option>
                </select>
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
    </div>
  );
};

export default Users;