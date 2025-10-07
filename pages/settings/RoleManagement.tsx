import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../App';

const permissionGroups = {
  'Chung': [
    { id: 'dashboard:view', label: 'Xem Bảng điều khiển' },
  ],
  'Quản lý Người dùng': [
    { id: 'users:view', label: 'Xem danh sách' },
    { id: 'users:create', label: 'Tạo mới' },
    { id: 'users:edit', label: 'Chỉnh sửa' },
    { id: 'users:delete', label: 'Xóa (yêu cầu quyền DB)' },
  ],
  'Quản lý Báo cáo viên': [
    { id: 'speakers:view', label: 'Xem danh sách' },
    { id: 'speakers:create', label: 'Tạo mới' },
    { id: 'speakers:edit', label: 'Chỉnh sửa' },
    { id: 'speakers:delete', label: 'Xóa' },
  ],
  'Quản lý Chương trình': [
    { id: 'program:view', label: 'Xem lịch trình' },
    { id: 'program:create', label: 'Thêm mục mới' },
    { id: 'program:edit', label: 'Chỉnh sửa mục' },
    { id: 'program:delete', label: 'Xóa mục' },
  ],
  'Quản lý Nhà tài trợ': [
    { id: 'sponsors:view', label: 'Xem danh sách' },
    { id: 'sponsors:create', label: 'Tạo mới' },
    { id: 'sponsors:edit', label: 'Chỉnh sửa' },
    { id: 'sponsors:delete', label: 'Xóa' },
  ],
  'Quản lý Đăng ký': [
    { id: 'submissions:view', label: 'Xem danh sách' },
    { id: 'submissions:create', label: 'Tạo mới' },
    { id: 'submissions:edit', label: 'Chỉnh sửa' },
    { id: 'submissions:delete', label: 'Xóa' },
    { id: 'submissions:approve', label: 'Duyệt/Từ chối trạng thái' },
  ],
  'Quản lý Thu Chi': [
    { id: 'finance:view', label: 'Xem báo cáo' },
    { id: 'finance:create', label: 'Tạo giao dịch' },
    { id: 'finance:edit', label: 'Chỉnh sửa' },
    { id: 'finance:delete', label: 'Xóa' },
  ],
  'Quản lý Công việc': [
    { id: 'tasks:view', label: 'Xem danh sách' },
    { id: 'tasks:create', label: 'Tạo mới' },
    { id: 'tasks:edit', label: 'Chỉnh sửa' },
    { id: 'tasks:delete', label: 'Xóa' },
  ],
  'Quản lý Tài liệu': [
    { id: 'documents:view', label: 'Xem danh sách' },
    { id: 'documents:create', label: 'Tải lên' },
    { id: 'documents:edit', label: 'Chỉnh sửa' },
    { id: 'documents:delete', label: 'Xóa' },
  ],
  'Cài đặt hệ thống': [
    { id: 'settings:view', label: 'Truy cập Cài đặt' },
    { id: 'settings:edit', label: 'Chỉnh sửa Email/Zalo' },
  ],
};


const rolesConfig = {
  'Quản trị viên': {
    description: 'Toàn quyền truy cập và quản lý hệ thống.',
    permissions: Object.values(permissionGroups).flat().map(p => p.id),
  },
  'Thành viên BTC': {
    description: 'Truy cập các chức năng chính để quản lý sự kiện.',
    permissions: [
      'dashboard:view', 'speakers:view', 'speakers:create', 'speakers:edit', 'speakers:delete',
      'program:view', 'program:create', 'program:edit', 'program:delete', 'sponsors:view',
      'sponsors:create', 'sponsors:edit', 'sponsors:delete', 'submissions:view', 'submissions:create', 
      'submissions:edit', 'submissions:delete', 'submissions:approve', 'finance:view', 
      'finance:create', 'finance:edit', 'finance:delete', 'tasks:view', 'tasks:create', 'tasks:edit', 
      'tasks:delete', 'documents:view', 'documents:create','documents:edit', 'documents:delete',
    ],
  },
  'Tình nguyện viên': {
    description: 'Truy cập giới hạn để xem thông tin và công việc được giao.',
    permissions: ['dashboard:view', 'program:view', 'tasks:view'],
  },
};


const RoleManagement: React.FC = () => {
  const { profile } = useAuth();
  const [rolesPermissions, setRolesPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchPermissions = async () => {
        setLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
            .from('role_permissions')
            .select('role, permission');
            
        if (fetchError) {
            console.warn("Could not fetch permissions from DB, falling back to static config. Error:", fetchError.message);
            const staticPermissions: Record<string, string[]> = {};
            for (const role in rolesConfig) {
                staticPermissions[role] = rolesConfig[role as keyof typeof rolesConfig].permissions;
            }
            setRolesPermissions(staticPermissions);
            setError("Không thể tải quyền từ CSDL, có thể do chính sách RLS. Hiển thị cấu hình mặc định và vô hiệu hóa chỉnh sửa.");
        } else {
            const groupedPermissions = data.reduce((acc, { role, permission }) => {
                if (!acc[role]) {
                    acc[role] = [];
                }
                acc[role].push(permission);
                return acc;
            }, {} as Record<string, string[]>);
            
            const finalPermissions: Record<string, string[]> = {};
            Object.keys(rolesConfig).forEach(role => {
                finalPermissions[role] = groupedPermissions[role] || [];
            });
            setRolesPermissions(finalPermissions);
        }
        setLoading(false);
    };
    
    fetchPermissions();
  }, []);

  const handlePermissionChange = (role: string, permissionId: string, isChecked: boolean) => {
    setRolesPermissions(prev => {
        const currentPermissions = prev[role] ? [...prev[role]] : [];
        if (isChecked) {
            if (!currentPermissions.includes(permissionId)) {
                currentPermissions.push(permissionId);
            }
        } else {
            const index = currentPermissions.indexOf(permissionId);
            if (index > -1) {
                currentPermissions.splice(index, 1);
            }
        }
        return { ...prev, [role]: currentPermissions };
    });
  };

  const handleSave = async (role: string) => {
    if (error) {
        alert("Không thể lưu vì có lỗi khi tải dữ liệu ban đầu.");
        return;
    }
    setSaving(prev => ({ ...prev, [role]: true }));
    setSuccess(prev => ({ ...prev, [role]: false}));
    const permissionsToSave = rolesPermissions[role] || [];
    
    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role', role);
        
    if (deleteError) {
        setError(`Lỗi khi xóa quyền cũ của vai trò ${role}: ${deleteError.message}`);
        setSaving(prev => ({ ...prev, [role]: false }));
        return;
    }
    
    if (permissionsToSave.length > 0) {
        const rowsToInsert = permissionsToSave.map(permission => ({ role, permission }));
        const { error: insertError } = await supabase.from('role_permissions').insert(rowsToInsert);
            
        if (insertError) {
            setError(`Lỗi khi lưu quyền mới cho vai trò ${role}: ${insertError.message}`);
            setSaving(prev => ({ ...prev, [role]: false }));
            return;
        }
    }
    
    setSaving(prev => ({ ...prev, [role]: false }));
    setSuccess(prev => ({ ...prev, [role]: true }));
    setTimeout(() => setSuccess(prev => ({ ...prev, [role]: false})), 3000);
  };

  if (loading) {
    return <div>Đang tải cấu hình vai trò...</div>;
  }
  
  if (profile?.role !== 'Quản trị viên') {
      return (
         <div>
            <h2 className="text-2xl font-bold text-gray-800">Quản lý vai trò và phân quyền</h2>
            <p className="mt-4 text-red-600">Bạn không có quyền truy cập chức năng này.</p>
        </div>
      )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Quản lý vai trò và phân quyền</h2>
      <p className="mt-1 text-sm text-gray-500">
        Cấp hoặc thu hồi quyền cho từng vai trò. Vai trò 'Quản trị viên' bị khóa để đảm bảo an toàn.
      </p>
      {error && <p className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">{error}</p>}

      <div className="mt-6 space-y-8">
        {Object.entries(rolesConfig).map(([role, config]) => {
          const isRoleAdmin = role === 'Quản trị viên';
          const isSaving = saving[role];
          const isSuccess = success[role];

          return (
          <div key={role} className="border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
                <div>
                    <h3 className="text-lg font-semibold text-primary">{role}</h3>
                    <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                </div>
                {!isRoleAdmin && !error && (
                     <button
                        onClick={() => handleSave(role)}
                        disabled={isSaving}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            isSaving ? 'bg-gray-200 text-gray-500' :
                            isSuccess ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark'
                        }`}
                    >
                        {isSaving ? 'Đang lưu...' : (isSuccess ? 'Đã lưu!' : 'Lưu thay đổi')}
                    </button>
                )}
            </div>
            
            <div className="mt-4 space-y-4">
              {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                <div key={groupName}>
                  <h4 className="font-medium text-gray-800 mb-3 border-b pb-2">{groupName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                    {permissions.map(permission => (
                      <div key={permission.id} className="flex items-center">
                        <input
                          id={`${role}-${permission.id}`}
                          type="checkbox"
                          className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary ${isRoleAdmin || !!error ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          checked={(rolesPermissions[role] || []).includes(permission.id)}
                          disabled={isRoleAdmin || !!error}
                          onChange={(e) => handlePermissionChange(role, permission.id, e.target.checked)}
                          aria-label={`${role} - ${permission.label}`}
                        />
                        <label htmlFor={`${role}-${permission.id}`} className="ml-3 text-sm text-gray-600">
                          {permission.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default RoleManagement;