// Service worker do Mercadinho: deixa o sistema instalável como app e mostra
// uma página de "sem conexão" quando a internet cai.
//
// De propósito, ele NÃO guarda a API nem as páginas: tudo vai para a rede
// primeiro, para o caixa nunca ver estoque, preço ou venda desatualizados.
// O cache só serve de reserva para a página offline e o visual dela.
const CACHE = 'mercadinho-v1';
const OFFLINE = '/offline.html';
const RESERVA = [OFFLINE, '/css/style.css', '/fonts/inter-latin-wght.woff2', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(RESERVA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Troca de página: rede primeiro; sem internet, a página offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Só os arquivos da reserva caem para o cache, e só se a rede falhar.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && RESERVA.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
});
