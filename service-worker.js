const CACHE_NAME = 'hsaps-event-manager-v4'; // Tăng phiên bản cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.tsx', // Cache tệp JS chính
  'https://cdn.tailwindcss.com', // Cache thư viện CSS chính
  'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js', // Cache thư viện QRCode
  'https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js', // Cache trình soạn thảo
  'https://ickheuhelknxktukgmxh.supabase.co/storage/v1/object/public/event_assets/documents/icon-192.png', // Cache icon
  'https://ickheuhelknxktukgmxh.supabase.co/storage/v1/object/public/event_assets/documents/icon-512.png' // Cache icon
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

// Xử lý các yêu cầu fetch
self.addEventListener('fetch', event => {
    // Bỏ qua các yêu cầu không phải GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    const requestUrl = new URL(event.request.url);

    // Chiến lược cho Supabase: network-only cho API, cache-first cho storage
    if (requestUrl.hostname.includes('supabase.co')) {
        // Storage assets (images, icons, etc.) -> Cache first
        if (requestUrl.pathname.startsWith('/storage/')) {
            event.respondWith(
                caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        // Cho phép cache các response 'opaque' từ storage cross-origin
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
            return;
        }
        
        // API calls (auth, rest) -> Network only
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Đối với các yêu cầu khác (tài nguyên của ứng dụng, CDN), sử dụng chiến lược cache-first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Nếu tìm thấy trong cache, trả về response từ cache
                if (response) {
                    return response;
                }

                // Nếu không có trong cache, fetch từ mạng
                return fetch(event.request).then(
                    networkResponse => {
                        // Kiểm tra nếu nhận được response hợp lệ
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        
                        // Chỉ cache các tài nguyên từ domain của ứng dụng và các CDN đáng tin cậy
                        if (networkResponse.type === 'basic' || requestUrl.hostname.includes('aistudiocdn.com')) {
                             // Nhân bản response vì nó là một stream và cần được sử dụng ở hai nơi
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }

                        return networkResponse;
                    }
                );
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