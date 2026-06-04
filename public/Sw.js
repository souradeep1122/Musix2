// Aura Music Service Worker
// Place this file at: /public/sw.js

const CACHE_NAME = 'aura-music-v1';
const AUDIO_CACHE = 'aura-audio-v1';

// Install event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Fetch event — intercept audio requests and serve from cache if available
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept Cloudinary audio requests
    if (url.hostname.includes('cloudinary.com') || url.hostname.includes('res.cloudinary')) {
        event.respondWith(
            caches.open(AUDIO_CACHE).then(async (cache) => {
                const cached = await cache.match(event.request.url);
                if (cached) {
                    return cached;
                }
                // Not in cache, fetch from network
                return fetch(event.request);
            })
        );
    }
});

// Message handler — cache or delete specific audio URLs
self.addEventListener('message', async (event) => {
    const { type, url, trackId } = event.data;

    if (type === 'CACHE_AUDIO') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            const existing = await cache.match(url);
            if (!existing) {
                // Fetch and cache the audio
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                    event.source.postMessage({ type: 'CACHE_SUCCESS', trackId, url });
                } else {
                    event.source.postMessage({ type: 'CACHE_ERROR', trackId, error: 'Fetch failed' });
                }
            } else {
                // Already cached
                event.source.postMessage({ type: 'CACHE_SUCCESS', trackId, url, alreadyCached: true });
            }
        } catch (err) {
            event.source.postMessage({ type: 'CACHE_ERROR', trackId, error: err.message });
        }
    }

    if (type === 'REMOVE_AUDIO') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            await cache.delete(url);
            event.source.postMessage({ type: 'REMOVE_SUCCESS', trackId });
        } catch (err) {
            event.source.postMessage({ type: 'REMOVE_ERROR', trackId, error: err.message });
        }
    }

    if (type === 'GET_CACHE_STATUS') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            const keys = await cache.keys();
            const cachedUrls = keys.map(r => r.url);
            event.source.postMessage({ type: 'CACHE_STATUS', cachedUrls });
        } catch (err) {
            event.source.postMessage({ type: 'CACHE_STATUS', cachedUrls: [] });
        }
    }

    if (type === 'GET_CACHE_SIZE') {
        try {
            const cache = await caches.open(AUDIO_CACHE);
            const keys = await cache.keys();
            let totalSize = 0;
            for (const req of keys) {
                const resp = await cache.match(req);
                if (resp) {
                    const blob = await resp.blob();
                    totalSize += blob.size;
                }
            }
            event.source.postMessage({ type: 'CACHE_SIZE', bytes: totalSize, count: keys.length });
        } catch (err) {
            event.source.postMessage({ type: 'CACHE_SIZE', bytes: 0, count: 0 });
        }
    }
});