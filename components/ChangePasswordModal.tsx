import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../App';
import { useToast } from '../contexts/ToastContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { session } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền tất cả các trường.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và mật khẩu xác nhận không khớp.');
      return;
    }
    if (!session?.user?.email) {
      setError('Không thể xác định người dùng hiện tại.');
      return;
    }

    setLoading(true);

    // 1. Verify the current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });

    if (verifyError) {
      setError('Mật khẩu hiện tại không đúng.');
      setLoading(false);
      return;
    }

    // 2. Update to the new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError('Lỗi khi cập nhật mật khẩu: ' + updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    addToast('Đổi mật khẩu thành công!', 'success');
    onClose();
  };
  
  const handleClose = () => {
    // Reset state on close
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <form onSubmit={handleSave}>
          <h2 className="text-2xl font-bold mb-4">Đổi mật khẩu</h2>
          {error && <p className="mb-4 text-red-500 text-sm p-3 bg-red-50 rounded-md">{error}</p>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mật khẩu hiện tại</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50">
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
