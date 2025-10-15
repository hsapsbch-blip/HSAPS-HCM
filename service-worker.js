const CACHE_NAME = 'hsaps-event-manager-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Cài đặt service worker và cache các tài nguyên ban đầu
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Xử lý các yêu cầu fetch, ưu tiên trả về từ cache nếu có
self.addEventListener('fetch', event => {
    // Bỏ qua các yêu cầu không phải GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    const requestUrl = new URL(event.request.url);

    // Luôn đi đến mạng cho các API call của Supabase để đảm bảo dữ liệu mới nhất
    if (requestUrl.hostname.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Đối với các yêu cầu khác (tài nguyên của ứng dụng), sử dụng chiến lược cache-first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Nếu tìm thấy trong cache, trả về response từ cache
                if (response) {
                    return response;
                }

                // Nếu không có trong cache, fetch từ mạng
                return fetch(event.request).then(
                    response => {
                        // Kiểm tra nếu nhận được response hợp lệ
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        // Chỉ cache các tài nguyên từ domain của ứng dụng và các CDN đáng tin cậy
                        if (response.type === 'basic' || requestUrl.hostname.includes('aistudiocdn.com')) {
                             // Nhân bản response vì nó là một stream và cần được sử dụng ở hai nơi
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }

                        return response;
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
