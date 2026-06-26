// Configurações do primeiro SW
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11201564
}
self.lary = ""

// Cache do segundo SW
const CACHE_NAME = 'codehub-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Import do script externo (primeiro SW)
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');

// Evento de instalação (segundo SW)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  // Força o novo SW a ativar imediatamente
  self.skipWaiting();
});

// Evento de ativação
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Evento de fetch (segundo SW)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});