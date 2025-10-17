// The OneSignal init configuration is now handled by the OneSignalInitializer.tsx component on the main page.
// The service worker only needs to import the SDK script.

// IMPORTANT: This import must be at the top level of the service worker.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'hsaps-event-manager-v14'; // Tăng phiên bản cache để cập nhật
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // 'https://cdn.tailwindcss.com', // Bỏ qua cache CDN của Tailwind để tránh lỗi CORS
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
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .catch(err => {
        console.error('Failed to cache initial assets:', err);
      })
  );
});

// Xử lý các yêu cầu fetch với chiến lược phù hợp
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Yêu cầu API của Supabase (không phải storage): Luôn lấy từ mạng.
    if (requestUrl.hostname.includes('supabase.co') && !requestUrl.pathname.startsWith('/storage/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Yêu cầu điều hướng (trang HTML): Ưu tiên mạng, dự phòng bằng cache.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Chỉ cache các response thành công (status 200 OK)
                    if (networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Nếu mạng lỗi, lấy từ cache
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // Các tài nguyên khác (JS, CSS, ảnh...): Ưu tiên cache, dự phòng bằng mạng.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(networkResponse => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
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