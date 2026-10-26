// Tema claro/escuro. Carregado no <head> (sem defer) para aplicar o tema antes
// da primeira pintura e evitar o "piscar" do tema errado. Sem escolha salva, a
// página segue o tema do sistema operacional via prefers-color-scheme no CSS.
(function () {
  const KEY = 'mj-theme';
  const root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  function effective() {
    const explicit = root.dataset.theme;
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const initial = stored();
  if (initial === 'light' || initial === 'dark') root.dataset.theme = initial;

  window.mjTheme = {
    current: effective,
    toggle() {
      const next = effective() === 'dark' ? 'light' : 'dark';
      // A classe desliga as transições por um instante: sem ela, cada
      // elemento animaria a troca de cor no seu próprio ritmo.
      root.classList.add('theme-switching');
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch { /* modo privado: vale só nesta aba */ }
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
      return next;
    },
  };
})();
