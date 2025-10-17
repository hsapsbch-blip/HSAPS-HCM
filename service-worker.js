// Explicitly define a configuration for OneSignal to use within the service worker scope.
// This is a workaround for sandboxed environments (like the Vercel/AI Studio iframe) where the script's origin
// might be incorrectly inferred as 'https://ai.studio' instead of the actual site URL.
// By setting this config, we force the OneSignal worker to use the correct origin and paths.
self.OneSignal = self.OneSignal || {};
self.OneSignal.init = {
  appId: "42cf9351-9baf-4cb8-8c69-9e660fe161bc", // This must match the main page init
  origin: "https://hsaps-hcm.vercel.app",
  serviceWorkerPath: "service-worker.js",
  serviceWorkerUpdaterPath: "service-worker.js",
  serviceWorkerParam: { scope: '/' },
};

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'hsaps-event-manager-v8'; // Tăng phiên bản cache để cập nhật
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js',
  'https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js',
  'https://ickheuhelknxktukgmxh.supabase.co/storage/v1/object/public/event_assets/documents/icon-192.png',
  'https://ickheuhelknxktukgmxh.supabase.co/storage/v1/object/public/event_assets/documents/icon-512.png'
];

// Cài đặt service worker và cache các tài nguyên ban đầu
self.addEventListener('install', event => {
  self.skipWaiting(); // Kích hoạt service worker mới ngay lập tức
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching initial assets');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache initial assets:', err);
      })
  );
});

// Xử lý các yêu cầu fetch với logic mạnh mẽ hơn
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Các yêu cầu API của Supabase: Luôn lấy từ mạng để đảm bảo dữ liệu mới nhất.
    if (requestUrl.hostname.includes('supabase.co') && !requestUrl.pathname.startsWith('/storage/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Đối với tất cả các yêu cầu khác (HTML, JS, CSS, ảnh, Supabase Storage):
    // Sử dụng chiến lược "Cache first" để tối ưu tốc độ và khả năng offline.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Nếu có trong cache, trả về ngay lập tức.
            if (cachedResponse) {
                return cachedResponse;
            }

            // Nếu không có trong cache, fetch từ mạng.
            return fetch(event.request).then(networkResponse => {
                // Clone response và lưu vào cache để sử dụng cho lần sau.
                // Hỗ trợ cả tài nguyên cùng nguồn (JS,...) và khác nguồn (CDN, Storage).
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(error => {
                // Nếu fetch mạng thất bại (ví dụ: offline):
                console.error('Network request failed:', event.request.url, error);
                // Đối với yêu cầu điều hướng (tải trang), trả về trang chính của ứng dụng.
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                // Đối với các tài nguyên khác, để yêu cầu thất bại.
                throw error;
            });
        })
    );
});


// Kích hoạt service worker và xóa các cache cũ
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Kiểm soát các client ngay lập tức
  );
});