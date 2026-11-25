// Registra o service worker que deixa o Mercadinho instalável como app
// ("Adicionar à tela inicial") e mostra a página de sem conexão.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o sistema funciona igual, só não vira app.
    });
  });
}

// ---------- Aviso "Instalar app" ----------
// O Android só cria o APP de verdade (ícone próprio na gaveta de aplicativos,
// sem o selo do navegador) pela instalação oficial do Chrome. "Adicionar à
// tela inicial" → "Criar atalho" vira só um atalho com o selo do Google, e os
// navegadores embutidos de outros apps (app do Google, redes sociais) só
// sabem criar atalho. Foi o que aconteceu no primeiro teste (24/11/2026).
// Este aviso chama a instalação oficial quando ela existe e, quando não
// existe, explica o caminho certo para cada caso.
(function () {
  const jaInstalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (jaInstalado) return;

  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const embutido = /; wv\)|GSA\/|FBAN|FBAV|Instagram|Line\//i.test(ua);
  const CHAVE = 'instalar-dispensado-ate';
  const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
  let pedido = null;

  const textos = {
    pronto: 'Ele ganha ícone próprio na tela inicial e abre em tela cheia, como um aplicativo.',
    embutido: 'Você abriu o Mercadinho dentro de outro aplicativo, que só consegue criar um atalho. Copie o link, abra no Chrome e instale por lá.',
    ios: 'No iPhone, abra este link no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.',
    // Link aberto de dentro de outro app (inclusive o do Claude) costuma abrir
    // numa aba do Chrome "emprestada" ao app, que se identifica igual ao
    // Chrome mas não oferece a instalação.
    manual: 'Abra no próprio Chrome (se veio por um link de outro app, toque em “Abrir no Chrome”). Depois, menu ⋮ → “Instalar app”. Se aparecer “Adicionar à tela inicial”, escolha “Instalar”, não “Criar atalho”.',
  };

  function dispensado() {
    try { return Number(localStorage.getItem(CHAVE) || 0) > Date.now(); } catch { return false; }
  }
  const caixas = () => document.querySelectorAll('[data-instalar]');

  function mostrar(estado) {
    if (dispensado()) return;
    caixas().forEach((caixa) => {
      caixa.querySelector('.install-text').textContent = textos[estado];
      caixa.querySelector('.install-go').hidden = estado !== 'pronto';
      caixa.querySelector('.install-copy').hidden = estado !== 'embutido';
      caixa.dataset.estado = estado;
      caixa.hidden = false;
    });
  }
  function esconder() { caixas().forEach((caixa) => { caixa.hidden = true; }); }

  // O Chrome avisa quando a instalação oficial está disponível.
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    pedido = evento;
    mostrar('pronto');
  });
  window.addEventListener('appinstalled', () => { pedido = null; esconder(); });

  document.addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-instalar] button');
    if (!botao) return;
    if (botao.classList.contains('install-go') && pedido) {
      pedido.prompt();
      const { outcome } = await pedido.userChoice;
      pedido = null;
      if (outcome === 'accepted') esconder();
    } else if (botao.classList.contains('install-copy')) {
      const link = `${location.origin}/`;
      try {
        await navigator.clipboard.writeText(link);
        botao.textContent = 'Link copiado!';
      } catch {
        window.prompt('Copie o link e abra no Chrome:', link);
      }
    } else if (botao.classList.contains('install-later')) {
      try { localStorage.setItem(CHAVE, String(Date.now() + SETE_DIAS)); } catch { /* sem localStorage, só esconde */ }
      esconder();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (embutido) { mostrar('embutido'); return; }
    if (ios) { mostrar('ios'); return; }
    // No Android, se o Chrome não oferecer a instalação oficial em alguns
    // segundos, mostra o caminho pelo menu.
    if (android) setTimeout(() => { if (!pedido) mostrar('manual'); }, 4000);
  });
}());
