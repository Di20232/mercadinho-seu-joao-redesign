// Registra o service worker que deixa o Mercadinho instalável como app
// ("Adicionar à tela inicial") e mostra a página de sem conexão.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o sistema funciona igual, só não vira app.
    });
  });
}
