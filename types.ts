// Fix: Define all necessary types and enums for the application.
// This file was previously misconfigured and contained Supabase client code.

export enum Status {
    PENDING = 'Chờ duyệt',
    APPROVED = 'Đã duyệt',
    REJECTED = 'Từ chối',
    PAYMENT_PENDING = 'Chờ thanh toán',
    PAYMENT_CONFIRMED = 'Đã thanh toán',
    IN_PROGRESS = 'Đang thực hiện',
    COMPLETED = 'Hoàn thành',
}

export enum DocumentType {
    IMAGE = 'Hình ảnh',
    PDF = 'PDF',
    VIDEO = 'Video',
    PRESENTATION = 'Bài trình bày',
    OTHER = 'Khác',
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar: string | null;
  role: 'Quản trị viên' | 'Thành viên BTC' | 'Tình nguyện viên';
  last_login: string | null;
}

export interface Notification {
  id: number;
  user_id: string;
  created_at: string;
  read: boolean;
  message: string;
  link: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string;
  assignee_id: string | null;
  status: Status;
  profiles: {
    full_name: string;
    avatar?: string | null;
  } | null;
}

export interface Submission {
  id: number;
  attendance_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  workplace: string | null;
  address: string | null;
  attendee_type: string;
  registration_time: string;
  status: Status;
  payment_amount: number;
  payment_image_url: string | null;
  cme: boolean;
  gala_dinner: boolean;
  badge_url: string | null;
}

export interface Sponsor {
    id: number;
    name: string;
    sponsorship_package: string;
    amount: number;
    status: Status;
    contact_person: string;
    email: string | null;
    phone: string | null;
    logo_url: string | null;
    notes: string | null;
    location: string | null;
}

export interface Speaker {
    id: number;
    full_name: string;
    academic_rank: string | null;
    email: string;
    phone: string | null;
    workplace: string | null;
    report_title_vn: string;
    report_title_en: string | null;
    status: Status;
    speaker_type: 'Chủ tọa' | 'Báo cáo viên' | 'Chủ tọa/Báo cáo viên' | null;
    avatar_url: string | null;
    passport_url: string | null;
    abstract_file_url: string | null;
    report_file_url: string | null;
}

export interface ProgramItem {
    id: number;
    date: string;
    time: string;
    session: string | null;
    report_title_vn: string;
    report_title_en: string | null;
    speaker_id: number | null;
    speakers: {
        id: number;
        full_name: string;
        avatar_url: string | null;
        academic_rank: string | null;
    } | null;
}

export interface FinanceTransaction {
    id: number;
    type: 'Thu' | 'Chi';
    title: string;
    amount: number;
    category: string | null;
    transaction_date: string;
    handler_id: string | null;
    payment_method: string | null;
    receipt_url: string | null;
    notes: string | null;
    account: 'TK Lộc Phát' | 'TK Hội Nghị' | null;
    profiles: {
        full_name: string;
    } | null;
}

export interface EventDocument {
    id: number;
    name: string;
    description: string | null;
    type: DocumentType;
    file_url: string;
    thumbnail_url: string | null;
    created_at: string;
}

export interface SystemSettings {
    id: number;
    sender_name: string | null;
    sender_email: string | null;
    oa_id: string | null;
    oa_secret_key: string | null;
    access_token: string | null;
    abitstore_api_url: string | null;
}

export interface EmailTemplate {
    id: number;
    name: string;
    module: 'submissions' | 'speakers';
    description: string | null;
    subject: string;
    body: string;
}