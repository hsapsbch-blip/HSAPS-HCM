import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

// Cờ để đảm bảo OneSignal chỉ được khởi tạo một lần
let oneSignalInitialized = false;

const OneSignalInitializer = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  // Sử dụng ref để lưu trữ hàm navigate, tránh việc useEffect chạy lại không cần thiết
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Effect này chỉ chạy một lần để khởi tạo OneSignal và gắn các listener
  useEffect(() => {
    if (oneSignalInitialized) {
      return;
    }

    window.OneSignal = window.OneSignal || [];
    const OneSignal = window.OneSignal;
    
    OneSignal.push(() => {
        OneSignal.init({
            // QUAN TRỌNG: Thay thế bằng App ID thật từ tài khoản onsignal.com của bạn
            appId: "YOUR_ONESIGNAL_APP_ID", 
            allowLocalhostAsSecureOrigin: true, // Hữu ích cho việc phát triển trên localhost
        });

        // Xử lý sự kiện khi người dùng nhấp vào thông báo
        OneSignal.on('notificationClick', (event) => {
            console.log('OneSignal notification clicked:', event);
            
            // Ví dụ: Nếu thông báo có launch URL, điều hướng đến đó.
            // Bạn có thể tùy chỉnh logic này dựa trên `event.notification.additionalData`
            const url = event.notification.launchURL;
            if (url) {
                try {
                    // Trích xuất đường dẫn từ URL đầy đủ (giả định dùng hash router)
                    const path = new URL(url).hash.substring(1);
                    if (path) {
                        navigateRef.current(path);
                    }
                } catch (e) {
                    console.error("Không thể phân tích launchURL:", e);
                }
            }
        });
    });
    
    oneSignalInitialized = true;

  }, []); // Mảng phụ thuộc rỗng đảm bảo effect chỉ chạy một lần

  // Effect này chạy mỗi khi thông tin người dùng thay đổi để đồng bộ với OneSignal
  useEffect(() => {
    if (!oneSignalInitialized) return;

    const OneSignal = window.OneSignal;
    if (profile?.id) {
        // Nếu người dùng đã đăng nhập, gắn ID của họ vào OneSignal
        console.log(`Setting OneSignal external user ID: ${profile.id}`);
        OneSignal.push(() => {
            OneSignal.setExternalUserId(profile.id);
        });
    } else {
        // Nếu người dùng đăng xuất, gỡ bỏ ID
        console.log('Removing OneSignal external user ID.');
        OneSignal.push(() => {
            OneSignal.removeExternalUserId();
        });
    }
  }, [profile]);

  return null; // Component này không hiển thị gì cả
};

export default OneSignalInitializer;