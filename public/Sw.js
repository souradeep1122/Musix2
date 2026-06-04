// Aura Music Service Worker
// Place this file at: /public/sw.js

const AUDIO_CACHE = 'aura-audio-v1';

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== AUDIO_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => clients.claim())
    );
});

// ─── Fetch Intercept ─────────────────────────────────────────────────────────
// Intercepts Cloudinary audio requests and serves from cache when available.
// Uses cors mode so the response is cacheable (opaque responses are not).

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isCloudinary = url.hostname.includes('cloudinary.com') ||
                         url.hostname.includes('res.cloudinary');

    if (!isCloudinary) return;

    event.respondWith(
        caches.open(AUDIO_CACHE).then(async (cache) => {
            const cached = await cache.match(event.request.url);
            if (cached) return cached;

            // Must use cors + omit — 'no-cors' produces an opaque response
            // that the Cache API will silently reject on production domains
            const networkReq = new Request(event.request.url, {
                mode: 'cors',
                credentials: 'omit',
            });

            try {
                const response = await fetch(networkReq);
                if (response.ok && response.type !== 'opaque') {
                    cache.put(event.request.url, response.clone());
                }
                return response;
            } catch {
                // Network failed and nothing in cache — let the browser handle it
                return fetch(event.request);
            }
        })
    );
});

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', async (event) => {
    const { type, url, trackId } = event.data;

    // Helper — safely reply to the client that sent this message
    const reply = (payload) => {
        try { event.source?.postMessage(payload); } catch { /* tab closed */ }
    };

    // ── CACHE_AUDIO ──────────────────────────────────────────────────────────
    if (type === 'CACHE_AUDIO') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            const existing = await cache.match(url);

            if (existing) {
                reply({ type: 'CACHE_SUCCESS', trackId, url, alreadyCached: true });
                return;
            }

            // Explicit CORS mode — critical for production deployments (Render, Vercel, etc.)
            // Cloudinary must have your production domain in its allowed-origins list.
            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            if (response.type === 'opaque') {
                throw new Error('Opaque response — add your domain to Cloudinary CORS settings');
            }

            await cache.put(url, response.clone());
            reply({ type: 'CACHE_SUCCESS', trackId, url });

        } catch (err) {
            console.error('[SW] CACHE_AUDIO failed:', err.message);
            reply({ type: 'CACHE_ERROR', trackId, error: err.message });
        }
    }

    // ── REMOVE_AUDIO ─────────────────────────────────────────────────────────
    if (type === 'REMOVE_AUDIO') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            await cache.delete(url);
            reply({ type: 'REMOVE_SUCCESS', trackId });
        } catch (err) {
            console.error('[SW] REMOVE_AUDIO failed:', err.message);
            reply({ type: 'REMOVE_ERROR', trackId, error: err.message });
        }
    }

    // ── GET_CACHE_STATUS ─────────────────────────────────────────────────────
    if (type === 'GET_CACHE_STATUS') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            const keys  = await cache.keys();
            reply({ type: 'CACHE_STATUS', cachedUrls: keys.map(r => r.url) });
        } catch {
            reply({ type: 'CACHE_STATUS', cachedUrls: [] });
        }
    }

    // ── GET_CACHE_SIZE ───────────────────────────────────────────────────────
    if (type === 'GET_CACHE_SIZE') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            const keys  = await cache.keys();

            // Use Content-Length header first (fast path — avoids reading blobs)
            let totalBytes = 0;
            let count = 0;

            await Promise.all(keys.map(async (req) => {
                const resp = await cache.match(req);
                if (!resp) return;
                count++;
                const cl = resp.headers.get('content-length');
                if (cl) {
                    totalBytes += parseInt(cl, 10);
                } else {
                    // Fallback: read blob (slower but accurate)
                    const blob = await resp.blob();
                    totalBytes += blob.size;
                }
            }));

            reply({ type: 'CACHE_SIZE', bytes: totalBytes, count });
        } catch (err) {
            console.error('[SW] GET_CACHE_SIZE failed:', err.message);
            reply({ type: 'CACHE_SIZE', bytes: 0, count: 0 });
        }
    }
});