import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, uploadFileToStorage } from '../supabaseClient';
import { Speaker, Status } from '../types';
import { useToast } from '../contexts/ToastContext';
import { BrandIcon } from '../components/icons/BrandIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

type UploadingState = Partial<Record<keyof Speaker, boolean>>;
type FileNamesState = Partial<Record<keyof Speaker, string>>;

const SpeakerRegistration: React.FC = () => {
    const { addToast } = useToast();
    const initialFormData: Partial<Speaker> = {
        full_name: '',
        academic_rank: '',
        email: '',
        phone: '',
        workplace: '',
        report_title_vn: '',
        report_title_en: '',
        speaker_type: 'Báo cáo viên',
    };

    const [formData, setFormData] = useState<Partial<Speaker>>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState<UploadingState>({});
    const [fileNames, setFileNames] = useState<FileNamesState>({});
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    
    const notifyAdmins = async (fullName: string) => {
        const { data: admins, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'Quản trị viên');
        
        if (error || !admins) {
            console.error("Error fetching admins to notify:", error);
            return;
        }

        const message = `Có Báo cáo viên mới đăng ký: ${fullName}.`;
        const link = '/speakers';

        const notificationsToInsert = admins.map(admin => ({
            user_id: admin.id,
            message,
            link,
            read: false,
        }));
        
        const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert);
        if (insertError) console.error('Error creating admin notifications:', insertError.message);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof Speaker) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploading(prev => ({ ...prev, [fieldName]: true }));
            setFileNames(prev => ({ ...prev, [fieldName]: file.name }));
            
            const folderMap = {
                avatar_url: 'speakers/avatar_url',
                passport_url: 'speakers/passport_url',
                abstract_file_url: 'speakers/abstract_file_url',
                report_file_url: 'speakers/report_file_url',
                cv_file_url: 'speakers/cv_files',
            };
            const folder = folderMap[fieldName as keyof typeof folderMap] || 'speakers/other';

            const publicUrl = await uploadFileToStorage(file, 'event_assets', folder);
            
            if (publicUrl) {
                setFormData(prev => ({ ...prev, [fieldName]: publicUrl }));
                addToast(`Tải lên ${file.name} thành công.`, 'success');
            } else {
                addToast(`Tải lên ${file.name} thất bại. Vui lòng thử lại.`, 'error');
                setFileNames(prev => ({ ...prev, [fieldName]: undefined }));
            }
            
            setUploading(prev => ({ ...prev, [fieldName]: false }));
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.full_name || !formData.email || !formData.academic_rank || !formData.workplace || !formData.report_title_vn) {
            setError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: insertError } = await supabase
                .from('speakers')
                .insert([{ ...formData, status: Status.PENDING }]);
            
            if (insertError) {
                if (insertError.code === '23505') { // Unique constraint violation
                    throw new Error('Email này đã được sử dụng để đăng ký. Vui lòng sử dụng email khác.');
                }
                throw insertError;
            }

            await notifyAdmins(formData.full_name);
            setIsSuccess(true);
            
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
            addToast(err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const FileInput = ({ label, fieldName, accept }: { label: string, fieldName: keyof Speaker, accept: string }) => (
        <div>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="mt-1 flex items-center space-x-2">
                <label className="cursor-pointer px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <span>Chọn tệp</span>
                    <input type="file" className="sr-only" accept={accept} onChange={e => handleFileChange(e, fieldName)} disabled={uploading[fieldName]} />
                </label>
                {uploading[fieldName] && <SpinnerIcon className="w-5 h-5 text-primary" />}
                {fileNames[fieldName] && <span className="text-sm text-gray-500 truncate">{fileNames[fieldName]}</span>}
            </div>
        </div>
    );
    
    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
                <div className="max-w-2xl w-full mx-auto text-center bg-white p-8 md:p-12 rounded-lg shadow-md">
                    <BrandIcon className="w-16 h-16 mx-auto text-primary" />
                    <h1 className="text-3xl font-bold text-gray-900 mt-4">Đăng ký thành công!</h1>
                    <p className="mt-4 text-gray-600">
                        Cảm ơn bạn đã đăng ký làm báo cáo viên cho sự kiện HSAPS 2025.
                        Thông tin của bạn đã được gửi đến Ban tổ chức. Chúng tôi sẽ xem xét và liên hệ với bạn trong thời gian sớm nhất.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4">
            <div className="max-w-3xl w-full mx-auto">
                <div className="text-center mb-8">
                    <BrandIcon className="w-16 h-16 mx-auto text-primary" />
                    <h1 className="text-3xl font-bold text-gray-900 mt-4">Đăng ký Báo cáo viên</h1>
                    <p className="text-gray-600">Sự kiện HSAPS 2025</p>
                </div>
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md space-y-8">
                    {error && <p className="bg-red-100 text-red-700 p-3 rounded-md text-center text-sm">{error}</p>}

                    {/* Personal Information */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">1. Thông tin cá nhân</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Học hàm/Học vị <span className="text-red-500">*</span></label>
                                <input type="text" name="academic_rank" value={formData.academic_rank || ''} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Họ và tên <span className="text-red-500">*</span></label>
                                <input type="text" name="full_name" value={formData.full_name || ''} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                                <input type="email" name="email" value={formData.email || ''} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Điện thoại</label>
                                <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nơi công tác <span className="text-red-500">*</span></label>
                                <input type="text" name="workplace" value={formData.workplace || ''} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <FileInput label="Ảnh đại diện" fieldName="avatar_url" accept="image/*" />
                            <FileInput label="Ảnh Hộ chiếu/CCCD" fieldName="passport_url" accept="image/*" />
                            <FileInput label="Sơ yếu lý lịch khoa học" fieldName="cv_file_url" accept=".pdf,.doc,.docx" />
                        </div>
                    </div>
                    
                    {/* Report Information */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">2. Thông tin báo cáo</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Loại hình</label>
                                <select name="speaker_type" value={formData.speaker_type} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                    <option>Báo cáo viên</option>
                                    <option>Chủ tọa</option>
                                    <option>Chủ tọa/Báo cáo viên</option>
                                </select>
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Tên bài báo cáo (Tiếng Việt) <span className="text-red-500">*</span></label>
                                <textarea name="report_title_vn" value={formData.report_title_vn || ''} onChange={handleChange} required rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Tên bài báo cáo (Tiếng Anh)</label>
                                <textarea name="report_title_en" value={formData.report_title_en || ''} onChange={handleChange} rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <FileInput label="Tệp bài tóm tắt (Abstract)" fieldName="abstract_file_url" accept=".pdf,.doc,.docx" />
                            <FileInput label="Tệp bài báo cáo đầy đủ" fieldName="report_file_url" accept=".pdf,.ppt,.pptx,.doc,.docx" />
                        </div>
                    </div>

                    <div className="pt-5">
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || Object.values(uploading).some(v => v)}
                                className="w-full md:w-auto py-3 px-6 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors flex items-center justify-center"
                            >
                                {isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2" />}
                                {isSubmitting ? 'Đang gửi...' : 'Hoàn tất đăng ký'}
                            </button>
                        </div>
                    </div>
                </form>
                <div className="text-center mt-6">
                    <Link to="/login" className="text-sm text-primary hover:underline">
                        Quay lại trang đăng nhập của quản trị viên
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SpeakerRegistration;