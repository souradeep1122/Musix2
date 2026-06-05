// Aura Music Service Worker — place at /public/sw.js

const AUDIO_CACHE = 'aura-audio-v2';

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== AUDIO_CACHE).map(k => caches.delete(k))
            ))
            .then(() => clients.claim())
    );
});

// ─── Fetch Intercept ─────────────────────────────────────────────────────────
// Only intercepts same-origin /proxy-audio/ requests — no CORS issues ever.

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (!url.pathname.startsWith('/proxy-audio/')) return;

    event.respondWith(
        caches.open(AUDIO_CACHE).then(async (cache) => {
            const cached = await cache.match(event.request.url);
            if (cached) {
                console.log('[SW] Cache hit:', url.pathname);
                return cached;
            }
            const response = await fetch(event.request);
            if (response.ok) {
                cache.put(event.request.url, response.clone());
            }
            return response;
        })
    );
});

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', async (event) => {
    // Allow client to trigger immediate SW activation (used on update)
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }

    const { type, url, trackId } = event.data || {};
    if (!type) return;

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
            // Same-origin fetch — proxy URL → Express → Cloudinary
            // No CORS headers needed at all
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
            let totalBytes = 0, count = 0;
            await Promise.all(keys.map(async (req) => {
                const resp = await cache.match(req);
                if (!resp) return;
                count++;
                const cl = resp.headers.get('content-length');
                totalBytes += cl ? parseInt(cl, 10) : (await resp.blob()).size;
            }));
            reply({ type: 'CACHE_SIZE', bytes: totalBytes, count });
        } catch (err) {
            reply({ type: 'CACHE_SIZE', bytes: 0, count: 0 });
        }
    }
});