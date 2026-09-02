// sw.js — service worker mínimo. Solo existe para cumplir el requisito
// técnico de Chrome/PWA (instalar requiere un service worker con "fetch"
// registrado). No cachea nada a propósito: la ficha del activo siempre debe
// leerse fresca desde Firestore, nunca desde una copia vieja guardada en el
// celular.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
