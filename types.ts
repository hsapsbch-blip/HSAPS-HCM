export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'Quản trị viên' | 'Thành viên BTC' | 'Tình nguyện viên';
  avatar?: string | null;
  last_login?: string | null;
}

export interface Notification {
  id: number;
  user_id: string;
  message: string;
  link?: string | null;
  read: boolean;
  created_at: string;
}

export enum Status {
  PENDING = 'Chờ duyệt',
  APPROVED = 'Đã duyệt',
  REJECTED = 'Từ chối',
  PAYMENT_PENDING = 'Chờ thanh toán',
  PAYMENT_CONFIRMED = 'Đã thanh toán',
  IN_PROGRESS = 'Đang thực hiện',
  COMPLETED = 'Hoàn thành',
}

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: Status | 'IN_PROGRESS' | 'COMPLETED';
  due_date?: string | null;
  assignee_id?: string | null;
  profiles?: Pick<Profile, 'full_name' | 'avatar'> | null;
}

export interface Submission {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  dob: string;
  workplace: string;
  address: string;
  attendee_type: string;
  cme: boolean;
  gala_dinner: boolean;
  payment_amount: number;
  payment_image_url?: string | null;
  status: Status;
  registration_time: string;
  attendance_id: string;
  badge_url?: string | null;
}

export interface Sponsor {
  id: number;
  name: string;
  sponsorship_package: 'Kim cương' | 'Vàng' | 'Bạc' | 'Đồng' | 'Khác';
  amount: number;
  status: Status;
  logo_url?: string | null;
  contact_person: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  location?: string | null;
  contract_status?: 'Chưa có' | 'Chờ ký' | 'Đã ký' | null;
  contract_url?: string | null;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  module: 'submissions' | 'speakers';
  description?: string;
}

export interface FinanceTransaction {
  id: number;
  title: string;
  type: 'Thu' | 'Chi';
  amount: number;
  transaction_date: string;
  handler_id: string;
  notes?: string | null;
  payment_method: string;
  account: 'TK Lộc Phát' | 'TK Hội Nghị' | string;
  receipt_url?: string | null;
  profiles?: Pick<Profile, 'full_name'> | null;
}

export interface Speaker {
  id: number;
  full_name: string;
  academic_rank: string;
  email: string;
  phone?: string | null;
  workplace: string;
  report_title_vn: string;
  report_title_en?: string | null;
  report_summary?: string | null;
  status: Status;
  speaker_type: 'Chủ tọa' | 'Báo cáo viên' | 'Chủ tọa/Báo cáo viên';
  avatar_url?: string | null;
  passport_url?: string | null;
  abstract_file_url?: string | null;
  report_file_url?: string | null;
  take_care_notes?: string | null;
}

export interface ProgramItem {
  id: number;
  date: string;
  time: string;
  session: string;
  category?: 'Phẫu thuật thẩm mỹ' | 'Nội khoa thẩm mỹ' | null;
  report_title_vn: string;
  report_title_en?: string | null;
  speaker_id?: number | null;
  speakers?: Speaker | null; 
}

export enum DocumentType {
    IMAGE = 'Ảnh',
    PDF = 'PDF',
    VIDEO = 'Video',
    OTHER = 'Khác'
}

export interface EventDocument {
  id: number;
  name: string;
  description?: string | null;
  type: DocumentType;
  file_url: string;
  thumbnail_url?: string | null;
  created_at: string;
}

export interface SystemSettings {
  id: 1;
  sender_name?: string;
  sender_email?: string;
  oa_id?: string;
  oa_secret_key?: string;
  access_token?: string;
  abitstore_api_url?: string;
}