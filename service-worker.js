const CACHE_NAME = 'hsaps-event-manager-v3'; // Tăng phiên bản cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
  // Đã xóa các URL icon của Supabase để việc cài đặt diễn ra ổn định.
  // Chúng sẽ được cache lại khi được sử dụng lần đầu bởi trình xử lý fetch.
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});