let currentUser = null;
let cart = []; // { productId, name, unit, price, quantity }
let saleInFlight = false;
let productsPage = 1;
let movementsPage = 1;
const LIST_PAGE_SIZE = 20;

const content = document.getElementById('content');

const PAGES = {
  dashboard: { title: 'Painel', subtitle: () => `${greeting()}, ${currentUser.name.split(' ')[0]}! Este é o resumo de ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}.` },
  vendas: { title: 'Vendas', subtitle: () => 'Registre a venda e acompanhe as mais recentes.' },
  produtos: { title: 'Produtos', subtitle: () => 'Catálogo, preços, estoque e validade.' },
  estoque: { title: 'Estoque', subtitle: () => 'Entradas de mercadoria, perdas e histórico de movimentações.' },
  importar: { title: 'Importar planilha', subtitle: () => 'Cadastre e atualize produtos a partir do Excel ou do Google Planilhas.' },
  relatorios: { title: 'Relatórios', subtitle: () => 'Vendas por período, mais vendidos e capital parado.' },
  usuarios: { title: 'Usuários', subtitle: () => 'Contas de acesso e perfis.' },
};

function activeTemplate(name) {
  const tpl = document.getElementById(`tpl-${name}`);
  content.innerHTML = '';
  content.appendChild(tpl.content.cloneNode(true));
  // Reinicia a animação de entrada a cada troca de tela.
  content.classList.remove('view-enter');
  void content.offsetWidth;
  content.classList.add('view-enter');
  stagger(content.querySelectorAll('.reveal'));
}

// Abre um <template> como um modal sobreposto (fundo escurecido + card
// centralizado), em vez de anexado ao final do conteúdo da aba. Sem isso, o
// formulário de editar produto/usuário aparecia depois de toda a lista —
// numa tela com muitos produtos, era preciso rolar a página inteira até o
// fim para achar o formulário que acabou de abrir.
function openModal(templateId) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const tpl = document.getElementById(templateId);
  backdrop.appendChild(tpl.content.cloneNode(true));
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const onKeydown = (e) => {
    if (e.key === 'Escape') closeModal(backdrop);
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(backdrop);
  });
  document.addEventListener('keydown', onKeydown);
  backdrop._onKeydown = onKeydown;

  const firstField = backdrop.querySelector('input:not([type="hidden"]), select, textarea');
  if (firstField) setTimeout(() => firstField.focus(), 60);

  return backdrop;
}

function closeModal(backdrop) {
  if (!backdrop || backdrop.classList.contains('is-closing')) return;
  if (backdrop._onKeydown) document.removeEventListener('keydown', backdrop._onKeydown);
  backdrop.classList.add('is-closing');
  const done = () => {
    backdrop.remove();
    if (!document.querySelector('.modal-backdrop')) document.body.style.overflow = '';
  };
  if (reducedMotion.matches) done();
  else setTimeout(done, 200);
}

// ---------- Navegação ----------
const navIndicator = document.getElementById('nav-indicator');

function moveNavIndicator() {
  const active = document.querySelector('#tabs .tab-btn.active');
  if (!active || active.offsetParent === null) {
    navIndicator.classList.remove('is-ready');
    return;
  }
  navIndicator.style.transform = `translateY(${active.offsetTop}px)`;
  navIndicator.style.height = `${active.offsetHeight}px`;
  navIndicator.classList.add('is-ready');
}

function setPageTitle(name) {
  const page = PAGES[name] || PAGES.dashboard;
  const box = document.getElementById('topbar-title');
  document.getElementById('page-title').textContent = page.title;
  document.getElementById('page-subtitle').textContent = page.subtitle();
  document.title = `${page.title} · Mercadinho do João`;
  box.classList.remove('swap');
  void box.offsetWidth;
  box.classList.add('swap');
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  moveNavIndicator();
  setPageTitle(name);
  document.body.classList.remove('nav-open');
  window.scrollTo({ top: 0, behavior: 'instant' });
  const renderers = {
    dashboard: renderDashboard,
    vendas: renderVendas,
    produtos: renderProdutos,
    estoque: renderEstoque,
    importar: renderImportar,
    relatorios: renderRelatorios,
    usuarios: renderUsuarios,
  };
  (renderers[name] || renderDashboard)();
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api.post('/auth/logout');
  location.href = '/index.html';
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  window.mjTheme.toggle();
});

// Barra lateral recolhida fica lembrada neste navegador.
const SIDEBAR_KEY = 'mj-sidebar';
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const toggle = document.getElementById('sidebar-toggle');
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  toggle.querySelector('span').textContent = collapsed ? 'Expandir menu' : 'Recolher menu';
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* sem armazenamento: vale só agora */ }
}
try { if (localStorage.getItem(SIDEBAR_KEY) === '1') setSidebarCollapsed(true); } catch { /* idem */ }
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  moveNavIndicator();
});
document.getElementById('sidebar').addEventListener('transitionend', (e) => {
  if (e.propertyName === 'width') moveNavIndicator();
});
document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.add('nav-open'));
document.getElementById('sidebar-scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
window.addEventListener('resize', debounce(moveNavIndicator, 100));

const topbar = document.getElementById('topbar');
window.addEventListener('scroll', () => topbar.classList.toggle('is-scrolled', window.scrollY > 4), { passive: true });

// Só esconde/mostra na tela; quem barra de verdade é a API.
function can(permission) {
  return currentUser.permissions.includes(permission);
}

// ---------- Boot ----------
(async () => {
  try {
    currentUser = await api.get('/auth/me');
  } catch {
    location.href = '/index.html';
    return;
  }
  // Mostra o nome de usuário junto do nome: é por ele que quem acabou de se
  // cadastrar descobre o login curto que pode usar no lugar do e-mail.
  document.getElementById('user-name').textContent = currentUser.name;
  const roleLabel = currentUser.role === 'ADMIN' ? 'dono' : (currentUser.permissions.length ? 'equipe' : 'caixa');
  document.getElementById('user-role').textContent = `@${currentUser.username} · ${roleLabel}`;
  document.getElementById('user-avatar').textContent = currentUser.name.trim().charAt(0).toUpperCase();
  document.body.classList.toggle('role-admin', currentUser.role === 'ADMIN');
  // Classes que mostram/escondem pedaços da tela (ver [data-perm] no CSS).
  const flags = {
    stock: can('stock.manage'),
    reports: can('reports.view'),
    prices: can('prices.manage'),
    catalog: can('products.manage') || can('prices.manage'),
  };
  flags.manage = flags.stock || flags.reports || flags.prices || currentUser.role === 'ADMIN';
  Object.entries(flags).forEach(([name, on]) => document.body.classList.toggle(`can-${name}`, on));
  switchTab('dashboard');
})();

// ---------- Painel ----------
function dayKey(offsetDays) {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);
}

function daysFromToday(value) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function kpiCard({ label, iconName, tone, value, format, sub }) {
  const valueNode = el('span', { class: 'kpi-value' }, format(0));
  const card = el('div', { class: 'kpi reveal', 'data-tone': tone || null }, [
    el('div', { class: 'kpi-top' }, [
      el('span', { class: 'kpi-label' }, label),
      el('span', { class: 'kpi-icon' }, icon(iconName)),
    ]),
    valueNode,
    el('span', { class: 'kpi-sub' }, sub),
  ]);
  return { card, run: () => animateValue(valueNode, value, format) };
}

function fillItemList(listId, countId, items, renderItem, empty) {
  const list = document.getElementById(listId);
  const count = document.getElementById(countId);
  if (!list) return;
  list.innerHTML = '';
  if (count) {
    count.textContent = String(items.length);
    count.classList.toggle('has-items', items.length > 0);
  }
  if (items.length === 0) {
    list.appendChild(el('li', {}, emptyState(empty.icon, empty.title, empty.text, { good: true })));
    return;
  }
  items.slice(0, 6).forEach((item, i) => {
    const li = renderItem(item);
    li.style.setProperty('--i', String(i));
    list.appendChild(li);
  });
  if (items.length > 6) {
    list.appendChild(el('li', { class: 'muted' }, `+ ${items.length - 6} outro(s)`));
  }
}

async function renderDashboard() {
  activeTemplate('dashboard');
  const isAdmin = can('reports.view'); // vê faturamento e gráficos

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthFrom = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;

  const [data, summary, top] = await Promise.all([
    api.get('/dashboard'),
    isAdmin ? api.get(`/reports/sales-summary?from=${dayKey(13)}&to=${dayKey(0)}`).catch(() => null) : null,
    isAdmin ? api.get(`/reports/top-products?from=${monthFrom}&limit=5`).catch(() => null) : null,
  ]);
  if (!document.getElementById('kpi-grid')) return; // trocou de tela enquanto carregava

  // KPIs
  const alerts = data.lowStock.length + data.soonOut.length + data.expiring.length;
  const kpis = isAdmin
    ? [
      { label: 'Vendas hoje', iconName: 'shopping-cart', value: data.today.total, format: formatMoney, sub: `${data.today.count} venda(s) registradas` },
      { label: 'Vendas no mês', iconName: 'trending-up', tone: 'accent', value: data.month.total, format: formatMoney, sub: `${data.month.count} venda(s) desde o dia 1º` },
      { label: 'Ticket médio', iconName: 'receipt', tone: 'info', value: data.month.count ? data.month.total / data.month.count : 0, format: formatMoney, sub: 'por venda neste mês' },
      { label: 'Alertas de estoque', iconName: 'triangle-alert', tone: 'danger', value: alerts, format: (v) => String(Math.round(v)), sub: `${data.lowStock.length} baixo · ${data.expiring.length} vencendo` },
    ]
    : [
      { label: 'Estoque baixo', iconName: 'triangle-alert', tone: 'danger', value: data.lowStock.length, format: (v) => String(Math.round(v)), sub: 'produtos abaixo do mínimo' },
      { label: 'Vai acabar em 7 dias', iconName: 'hourglass', tone: 'accent', value: data.soonOut.length, format: (v) => String(Math.round(v)), sub: 'pelo ritmo de vendas' },
      { label: 'Vencendo em breve', iconName: 'calendar', tone: 'info', value: data.expiring.length, format: (v) => String(Math.round(v)), sub: 'confira a validade' },
    ];
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = '';
  grid.classList.toggle('cols-3', kpis.length === 3);
  const built = kpis.map(kpiCard);
  built.forEach(({ card }) => grid.appendChild(card));
  stagger(grid.children);
  built.forEach(({ run }) => run());

  // Listas de alerta
  fillItemList('tb-low-stock', 'count-low-stock', data.lowStock, (p) => {
    const meter = el('span');
    meter.style.setProperty('--w', `${p.minStock > 0 ? Math.min(100, Math.max(4, (p.currentStock / p.minStock) * 100)) : 4}%`);
    return el('li', {}, [
      el('div', { class: 'item-main' }, [
        el('span', { class: 'item-name' }, p.name),
        el('span', { class: 'item-meta' }, `Mínimo: ${p.minStock} ${p.unit}`),
        el('div', { class: 'meter' }, meter),
      ]),
      el('span', { class: 'item-side' }, el('span', { class: 'badge bad' }, `${p.currentStock} ${p.unit}`)),
    ]);
  }, { icon: 'circle-check', title: 'Tudo em dia', text: 'Nenhum produto abaixo do mínimo.' });

  fillItemList('tb-soon-out', 'count-soon-out', data.soonOut, (p) => el('li', {}, [
    el('div', { class: 'item-main' }, [
      el('span', { class: 'item-name' }, p.name),
      el('span', { class: 'item-meta' }, `Em estoque: ${p.currentStock} ${p.unit}`),
    ]),
    el('span', { class: 'item-side' }, el('span', { class: 'badge warn' }, `${p.daysUntilStockout} dia(s)`)),
  ]), { icon: 'circle-check', title: 'Sem risco de falta', text: 'Nada deve acabar nos próximos 7 dias.' });

  fillItemList('tb-expiring', 'count-expiring', data.expiring, (p) => {
    const days = daysFromToday(p.expiryDate);
    const label = days < 0 ? 'Vencido' : days === 0 ? 'Vence hoje' : `em ${days} dia(s)`;
    return el('li', {}, [
      el('div', { class: 'item-main' }, [
        el('span', { class: 'item-name' }, p.name),
        el('span', { class: 'item-meta' }, `Validade ${formatDate(p.expiryDate)} · estoque ${p.currentStock}`),
      ]),
      el('span', { class: 'item-side' }, el('span', { class: `badge ${days <= 0 ? 'bad' : 'info'}` }, label)),
    ]);
  }, { icon: 'circle-check', title: 'Validades em dia', text: 'Nenhum produto vencendo em breve.' });

  if (data.pricePending) {
    fillItemList('tb-price-pending', 'count-price-pending', data.pricePending, (p) => el('li', {}, [
      el('div', { class: 'item-main' }, [
        el('span', { class: 'item-name' }, p.name),
        el('span', { class: 'item-meta' }, `Cadastrado em ${formatDate(p.createdAt)}`),
      ]),
      el('span', { class: 'item-side' }, el('button', {
        class: 'small secondary', type: 'button',
        onclick: async () => openProductForm(await api.get(`/products/${p.id}`)),
      }, [icon('pencil'), 'Definir preço'])),
    ]), { icon: 'circle-check', title: 'Nenhum pendente', text: 'Todos os produtos já têm preço.' });
  }

  if (!isAdmin) return;

  fillItemList('tb-slow-moving', 'count-slow-moving', data.slowMoving, (p) => el('li', {}, [
    el('div', { class: 'item-main' }, [
      el('span', { class: 'item-name' }, p.name),
      el('span', { class: 'item-meta' }, `Em estoque: ${p.currentStock}`),
    ]),
    el('span', { class: 'item-side' }, p.capitalParado !== undefined ? `${formatMoney(p.capitalParado)} parado` : ''),
  ]), { icon: 'circle-check', title: 'Tudo girando', text: 'Nenhum produto parado há 60 dias.' });

  // Gráfico de vendas dos últimos 14 dias
  const chartBox = document.getElementById('chart-sales');
  if (summary) {
    const points = [];
    for (let i = 13; i >= 0; i -= 1) {
      const key = dayKey(i);
      const date = new Date(`${key}T12:00:00Z`);
      points.push({
        label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        fullLabel: date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        value: summary.byDay[key] || 0,
      });
    }
    document.getElementById('chart-sales-caption').textContent = `${summary.count} venda(s) no período`;
    animateValue(document.getElementById('chart-sales-total'), summary.total, formatMoney, 1100);
    areaChart(chartBox, points);
  } else {
    chartBox.innerHTML = '';
    chartBox.appendChild(emptyState('circle-alert', 'Não foi possível carregar o gráfico', 'Tente abrir o painel de novo.'));
    document.getElementById('chart-sales-caption').textContent = '';
  }

  const topBox = document.getElementById('chart-top');
  if (top && top.length > 0) {
    barList(topBox, top.map((p) => ({ label: p.name, value: p.revenue })));
  } else {
    topBox.appendChild(emptyState('shopping-basket', 'Sem vendas neste mês', 'Os campeões de venda aparecem aqui.'));
  }
}

// ---------- Vendas ----------
let cartAnim = { enterId: null, bumpId: null };

async function renderVendas() {
  activeTemplate('vendas');
  cart = [];
  renderCart();

  const searchInput = document.getElementById('sale-search');
  const resultsBox = document.getElementById('sale-results');
  let searchTimer = null;
  let results = [];
  let activeIndex = 0;

  const closeResults = () => { resultsBox.innerHTML = ''; results = []; };

  const highlight = (index) => {
    activeIndex = index;
    Array.from(resultsBox.querySelectorAll('.result-item')).forEach((node, i) => {
      node.classList.toggle('is-active', i === index);
      if (i === index) node.scrollIntoView({ block: 'nearest' });
    });
  };

  const pick = (product, node) => {
    flyTo(node, document.getElementById('cart-total')).then(() => bump(document.getElementById('cart-total')));
    addToCart(product);
    searchInput.value = '';
    closeResults();
    searchInput.focus();
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const term = searchInput.value.trim();
    if (!term) { closeResults(); return; }
    searchTimer = setTimeout(async () => {
      const products = await api.get(`/products?query=${encodeURIComponent(term)}`);
      if (searchInput.value.trim() !== term) return; // chegou resposta de uma busca antiga
      resultsBox.innerHTML = '';
      results = products.filter((p) => !p.pricePending).slice(0, 8);
      results.forEach((p, i) => {
        const outOfStock = p.currentStock <= 0;
        const node = el('div', { class: 'result-item', role: 'option' }, [
          el('span', { class: 'result-thumb' }, p.name.trim().charAt(0).toUpperCase()),
          el('span', { class: 'result-info' }, [
            el('span', { class: 'result-name' }, p.name),
            el('span', { class: 'result-meta' }, [
              el('span', { class: `badge ${outOfStock ? 'bad' : (p.currentStock <= p.minStock ? 'warn' : 'ok')}` }, `${p.currentStock} ${p.unit}`),
              p.category ? ` · ${p.category}` : '',
            ]),
          ]),
          el('span', { class: 'result-price' }, formatMoney(p.salePrice)),
        ]);
        node.style.setProperty('--i', String(i));
        node.addEventListener('mouseenter', () => highlight(i));
        node.addEventListener('click', () => pick(p, node));
        resultsBox.appendChild(node);
      });
      if (results.length === 0) resultsBox.appendChild(el('div', { class: 'muted' }, 'Nenhum produto encontrado.'));
      highlight(0);
    }, 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeResults(); return; }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight((activeIndex + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); highlight((activeIndex - 1 + results.length) % results.length); }
    if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIndex], resultsBox.querySelectorAll('.result-item')[activeIndex]);
    }
  });

  document.addEventListener('click', function closeOnOutside(e) {
    if (!document.body.contains(searchInput)) { document.removeEventListener('click', closeOnOutside); return; }
    if (!e.target.closest('.sale-picker')) closeResults();
  });

  document.getElementById('confirm-sale-btn').addEventListener('click', confirmSale);
  searchInput.focus();

  await loadRecentSales();
}

function addToCart(product) {
  const existing = cart.find((i) => i.productId === product.id);
  if (existing) {
    existing.quantity += 1;
    cartAnim = { enterId: null, bumpId: product.id };
  } else {
    cart.push({ productId: product.id, name: product.name, unit: product.unit, price: product.salePrice, quantity: 1 });
    cartAnim = { enterId: product.id, bumpId: null };
  }
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function updateCartTotal() {
  animateValue(document.getElementById('cart-total'), cartTotal(), formatMoney, 450);
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);
  const linesNode = document.getElementById('cart-lines');
  if (linesNode) linesNode.textContent = String(cart.length);
  const unitsNode = document.getElementById('cart-units');
  if (unitsNode) unitsNode.textContent = units.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const countNode = document.getElementById('cart-count');
  if (countNode) countNode.textContent = String(cart.length);
}

function setConfirmButton() {
  const btn = document.getElementById('confirm-sale-btn');
  if (!btn) return;
  btn.disabled = cart.length === 0 || saleInFlight;
  btn.classList.toggle('is-loading', saleInFlight);
}

function removeFromCart(index, row) {
  const finish = () => { cart.splice(index, 1); cartAnim = { enterId: null, bumpId: null }; renderCart(); };
  if (reducedMotion.matches) { finish(); return; }
  row.classList.add('row-leave');
  setTimeout(finish, 240);
}

function renderCart() {
  const body = document.getElementById('cart-body');
  if (!body) return;
  body.innerHTML = '';

  document.getElementById('cart-table-wrap').hidden = cart.length === 0;
  const emptyBox = document.getElementById('cart-empty');
  emptyBox.innerHTML = '';
  if (cart.length === 0) {
    emptyBox.appendChild(emptyState('shopping-basket', 'Nenhum item ainda', 'Busque um produto acima para começar a venda.'));
  }

  cart.forEach((item, index) => {
    // A célula de subtotal é atualizada diretamente pelo "oninput" abaixo,
    // em vez de chamar renderCart() de novo a cada tecla digitada — recriar
    // a <tr>/<input> em todo keystroke troca o nó DOM do campo de
    // quantidade, e o navegador perde o foco nele. Na prática, o segundo
    // dígito de "12" nunca chegava a ser digitado: o campo perdia o foco
    // assim que o "1" era digitado.
    const subtotalCell = el('td', { class: 'num' }, formatMoney(item.price * item.quantity));
    const qtyInput = el('input', {
      type: 'number', min: '0.001', step: '0.001', value: String(item.quantity), 'aria-label': `Quantidade de ${item.name}`,
      oninput: (e) => {
        const v = parseFloat(e.target.value);
        item.quantity = Number.isFinite(v) && v > 0 ? v : item.quantity;
        subtotalCell.textContent = formatMoney(item.price * item.quantity);
        updateCartTotal();
      },
    });
    const step = (delta) => {
      const next = Math.round((item.quantity + delta) * 1000) / 1000;
      if (next <= 0) return;
      item.quantity = next;
      qtyInput.value = String(next);
      subtotalCell.textContent = formatMoney(item.price * item.quantity);
      updateCartTotal();
    };
    const row = el('tr', {}, [
      el('td', { class: 'cart-name' }, [item.name, el('span', { class: 'cart-unit' }, item.unit)]),
      el('td', {}, el('div', { class: 'stepper' }, [
        el('button', { type: 'button', 'aria-label': 'Diminuir', onclick: () => step(-1) }, icon('minus')),
        qtyInput,
        el('button', { type: 'button', 'aria-label': 'Aumentar', onclick: () => step(1) }, icon('plus')),
      ])),
      el('td', { class: 'num' }, formatMoney(item.price)),
      subtotalCell,
      el('td', { class: 'td-actions' }),
    ]);
    row.lastChild.appendChild(el('button', {
      class: 'icon-btn', type: 'button', title: 'Remover item', 'aria-label': `Remover ${item.name}`,
      onclick: () => removeFromCart(index, row),
    }, icon('trash-2')));
    if (cartAnim.enterId === item.productId) row.classList.add('row-enter');
    if (cartAnim.bumpId === item.productId) row.classList.add('row-bump');
    body.appendChild(row);
  });

  updateCartTotal();
  setConfirmButton();
}

// Última confirmação sem resposta de sucesso. Se a rede cair depois de o
// servidor gravar, tentar de novo com o mesmo carrinho reenvia a mesma
// Idempotency-Key e recebe a venda já criada, em vez de registrar outra.
let pendingSale = null; // { body, key }

function newIdempotencyKey() {
  // randomUUID só existe em contexto seguro (HTTPS/localhost); acessando
  // pelo IP da rede local em HTTP, getRandomValues continua disponível.
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function confirmSale() {
  if (saleInFlight || cart.length === 0) return;
  const msg = document.getElementById('sale-msg');
  msg.hidden = true;
  saleInFlight = true;
  setConfirmButton();
  try {
    const items = cart.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    // Carrinho diferente da tentativa anterior é outra venda: chave nova.
    const body = JSON.stringify(items);
    if (pendingSale?.body !== body) pendingSale = { body, key: newIdempotencyKey() };
    const sale = await api.post('/sales', { items }, { 'Idempotency-Key': pendingSale.key });
    pendingSale = null;
    cart = [];
    cartAnim = { enterId: null, bumpId: null };
    saleInFlight = false;
    renderCart();
    openReceipt(sale);
    toast(`Venda de ${formatMoney(sale.totalAmount)} registrada.`);
    await loadRecentSales();
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    saleInFlight = false;
    setConfirmButton();
  }
}

function openReceipt(sale) {
  const modal = openModal('tpl-receipt');
  const when = formatDateTime(sale.createdAt);
  document.getElementById('receipt-meta').textContent = `${when} · ${sale.items.length} item(ns)`;
  const body = document.getElementById('receipt-items');
  body.innerHTML = '';
  sale.items.forEach((item) => {
    body.appendChild(el('tr', {}, [
      el('td', {}, item.product),
      el('td', {}, `${item.quantity} ${item.unit || ''}`.trim()),
      el('td', { class: 'num' }, formatMoney(item.unitPrice)),
      el('td', { class: 'num' }, formatMoney(item.subtotal)),
    ]));
  });
  document.getElementById('receipt-total').textContent = formatMoney(sale.totalAmount);
  document.getElementById('receipt-print-btn').addEventListener('click', () => window.print());
  document.getElementById('receipt-close-btn').addEventListener('click', () => {
    closeModal(modal);
    const search = document.getElementById('sale-search');
    if (search) search.focus();
  });
}

async function loadRecentSales() {
  const body = document.getElementById('sales-list');
  if (!body) return;
  if (!body.children.length) skeletonRows(body, 5, 4);
  const data = await api.get('/sales?pageSize=15');
  if (!document.body.contains(body)) return;
  body.innerHTML = '';
  data.sales.forEach((s) => {
    const cells = [
      el('td', {}, formatDateTime(s.createdAt)),
      el('td', {}, s.seller),
      el('td', { class: 'num' }, String(s.itemCount)),
      el('td', { class: 'num' }, el('strong', {}, formatMoney(s.totalAmount))),
    ];
    if (s.canCancel) {
      cells.push(el('td', { class: 'td-actions' }, el('button', {
        class: 'small ghost', type: 'button',
        onclick: async () => {
          const ok = await confirmDialog({ title: 'Cancelar esta venda?', text: `Venda de ${formatMoney(s.totalAmount)} feita por ${s.seller}. O estoque dos itens será devolvido.`, confirmLabel: 'Cancelar venda', cancelLabel: 'Manter', tone: 'danger', iconName: 'receipt' });
          if (!ok) return;
          try {
            await api.post(`/sales/${s.id}/cancel`);
            toast('Venda cancelada e estoque devolvido.', 'info');
          } catch (err) {
            toast(err.message, 'error');
          }
          await loadRecentSales();
        },
      }, [icon('x'), 'Cancelar'])));
    } else {
      cells.push(el('td', {}));
    }
    body.appendChild(el('tr', {}, cells));
  });
  if (data.sales.length === 0) body.appendChild(emptyRow(5, 'Nenhuma venda registrada.'));
  revealRows(body);
}

// ---------- Produtos ----------
let productFilter = 'all';

async function renderProdutos() {
  activeTemplate('produtos');
  productsPage = 1;
  productFilter = 'all';

  document.getElementById('product-search').addEventListener('input', debounce(() => {
    productsPage = 1;
    loadProducts();
  }, 250));
  document.getElementById('product-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    productFilter = btn.dataset.filter;
    setSegmented('product-filter', btn);
    productsPage = 1;
    loadProducts();
  });
  const newBtn = document.getElementById('new-product-btn');
  if (newBtn) newBtn.addEventListener('click', () => openProductForm(null));

  await loadProducts();
}

function setSegmented(groupId, activeBtn) {
  document.querySelectorAll(`#${groupId} button`).forEach((b) => b.classList.toggle('active', b === activeBtn));
}

function renderPager(containerId, { page, pageSize, totalCount }, onPage) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  box.innerHTML = '';
  if (totalCount <= pageSize) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  box.appendChild(el('span', {}, `Mostrando ${from}–${to} de ${totalCount}`));
  const actions = el('div', { class: 'pager-actions' });
  const prev = el('button', {
    type: 'button',
    class: 'small secondary',
    onclick: () => { if (page > 1) onPage(page - 1); },
  }, [icon('chevron-left'), 'Anterior']);
  prev.disabled = page <= 1;
  const next = el('button', {
    type: 'button',
    class: 'small secondary',
    onclick: () => { if (page < totalPages) onPage(page + 1); },
  }, ['Próxima', icon('chevron-right')]);
  next.disabled = page >= totalPages;
  actions.appendChild(prev);
  actions.appendChild(next);
  box.appendChild(actions);
}

function expiryBadge(value) {
  if (!value) return el('span', { class: 'muted' }, '—');
  const days = daysFromToday(value);
  if (days < 0) return el('span', { class: 'badge bad', title: 'Produto vencido' }, formatDate(value));
  if (days <= 7) return el('span', { class: 'badge warn', title: `Vence em ${days} dia(s)` }, formatDate(value));
  return el('span', {}, formatDate(value));
}

async function loadProducts() {
  const body = document.getElementById('products-list');
  if (!body) return;
  const canPrices = can('prices.manage');
  const canCatalog = canPrices || can('products.manage');
  if (!body.children.length) skeletonRows(body, canPrices ? 8 : 7, 6);

  const term = document.getElementById('product-search')?.value.trim() || '';
  const params = new URLSearchParams({ query: term, page: String(productsPage), pageSize: String(LIST_PAGE_SIZE) });
  if (canCatalog) params.set('includeInactive', 'true');
  if (productFilter === 'low') params.set('lowStock', 'true');
  if (productFilter === 'pending') params.set('pricePending', 'true');
  const data = await api.get(`/products?${params.toString()}`);
  if (!document.body.contains(body)) return;

  const caption = document.getElementById('products-caption');
  const captions = { low: 'abaixo do mínimo', pending: 'aguardando preço', all: 'cadastrados' };
  if (caption) caption.textContent = `${data.totalCount} produto(s) ${captions[productFilter]}`;

  body.innerHTML = '';
  data.products.forEach((p) => {
    const low = p.currentStock <= p.minStock;
    const cells = [
      el('td', {}, el('div', { class: 'cell-main' }, [
        el('span', { class: `cell-avatar${p.active ? '' : ' is-muted'}` }, p.name.trim().charAt(0).toUpperCase()),
        el('span', {}, [
          el('span', { class: 'cell-title' }, p.name),
          el('span', { class: 'cell-sub' }, p.active ? (p.barcode ? `Cód. ${p.barcode}` : `Unidade: ${p.unit}`) : 'Inativo'),
        ]),
      ])),
      el('td', {}, p.category ? el('span', { class: 'badge' }, p.category) : el('span', { class: 'muted' }, '—')),
      el('td', {}, el('span', { class: `badge ${low ? 'bad' : 'ok'}` }, `${formatQuantity(p.currentStock)} ${p.unit}`)),
      el('td', { class: 'num' }, formatQuantity(p.minStock)),
      el('td', { class: 'num' }, p.pricePending
        ? el('span', { class: 'badge warn' }, 'Aguardando preço')
        : el('strong', {}, formatMoney(p.salePrice))),
    ];
    const costCell = el('td', { class: 'num' }, canPrices && p.costPrice !== null ? formatMoney(p.costPrice) : '');
    costCell.setAttribute('data-perm', 'prices');
    cells.push(costCell);
    cells.push(el('td', {}, expiryBadge(p.expiryDate)));
    cells.push(el('td', { class: 'td-actions' }, canCatalog
      ? el('button', { class: 'icon-btn', type: 'button', title: 'Editar produto', 'aria-label': `Editar ${p.name}`, onclick: () => openProductForm(p) }, icon('pencil'))
      : null));
    body.appendChild(el('tr', { class: p.active ? '' : 'is-inactive' }, cells));
  });

  if (data.products.length === 0) {
    body.appendChild(emptyRow(8, term ? `Nenhum produto encontrado para "${term}".` : 'Nenhum produto por aqui.'));
  }
  revealRows(body);
  renderPager('products-pager', data, (nextPage) => {
    productsPage = nextPage;
    loadProducts();
  });
}

function updateMarginPreview() {
  const box = document.getElementById('p-margin');
  if (!box) return;
  const sale = parseFloat(document.getElementById('p-sale-price').value);
  const cost = parseFloat(document.getElementById('p-cost-price').value);
  const valueNode = box.querySelector('strong');
  box.classList.remove('is-good', 'is-bad');
  if (!Number.isFinite(sale) || !Number.isFinite(cost) || sale <= 0) {
    valueNode.textContent = '—';
    return;
  }
  const margin = sale - cost;
  const pct = (margin / sale) * 100;
  valueNode.textContent = `${formatMoney(margin)} (${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`;
  box.classList.add(margin > 0 ? 'is-good' : 'is-bad');
}

function openProductForm(product) {
  const modal = openModal('tpl-product-form');

  const isEdit = Boolean(product);
  document.getElementById('product-form-title').textContent = isEdit ? 'Editar produto' : 'Novo produto';
  document.getElementById('product-form-sub').textContent = isEdit
    ? 'Mudanças de estoque são feitas na tela Estoque.'
    : 'Preencha os dados do produto.';
  document.getElementById('p-initial-stock-field').hidden = isEdit;

  // Sugere as categorias já usadas, para não nascer "Mercearia" e "mercearia".
  api.get('/products').then((all) => {
    const list = document.getElementById('p-category-list');
    if (!list) return;
    [...new Set(all.map((p) => p.category).filter(Boolean))].sort().forEach((c) => list.appendChild(el('option', { value: c })));
  }).catch(() => {});

  if (isEdit) {
    document.getElementById('p-id').value = product.id;
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-category').value = product.category || '';
    document.getElementById('p-barcode').value = product.barcode || '';
    document.getElementById('p-unit').value = product.unit;
    document.getElementById('p-sale-price').value = product.salePrice ?? '';
    document.getElementById('p-cost-price').value = product.costPrice ?? '';
    document.getElementById('p-min-stock').value = product.minStock;
    document.getElementById('p-expiry').value = product.expiryDate ? product.expiryDate.slice(0, 10) : '';
    const deleteBtn = document.getElementById('product-delete-btn');
    deleteBtn.hidden = false;
    if (product.active) {
      deleteBtn.textContent = 'Desativar produto';
      deleteBtn.classList.add('danger');
      deleteBtn.classList.remove('secondary');
      deleteBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: `Desativar "${product.name}"?`,
          text: 'Ele deixa de aparecer em vendas novas. O histórico continua guardado e dá para reativar depois.',
          confirmLabel: 'Desativar',
          tone: 'danger',
          iconName: 'package-x',
        });
        if (!ok) return;
        await api.del(`/products/${product.id}`);
        closeModal(modal);
        toast(`"${product.name}" foi desativado.`, 'info');
        await loadProducts();
      });
    } else {
      // Sem isto, um produto desativado não tinha NENHUMA forma de voltar —
      // nem pela tela, nem pela API — a não ser mexendo direto no banco.
      deleteBtn.textContent = 'Reativar produto';
      deleteBtn.classList.add('secondary');
      deleteBtn.classList.remove('danger');
      deleteBtn.addEventListener('click', async () => {
        await api.put(`/products/${product.id}`, { active: true });
        closeModal(modal);
        toast(`"${product.name}" voltou a ficar ativo.`);
        await loadProducts();
      });
    }
  }

  // Sem permissão de preço os campos ficam escondidos e não podem travar o envio.
  const canPrices = can('prices.manage');
  document.getElementById('p-sale-price').required = canPrices;
  document.getElementById('p-cost-price').required = canPrices;

  document.getElementById('p-sale-price').addEventListener('input', updateMarginPreview);
  document.getElementById('p-cost-price').addEventListener('input', updateMarginPreview);
  updateMarginPreview();

  document.getElementById('product-cancel-btn').addEventListener('click', () => closeModal(modal));
  document.getElementById('product-close-btn').addEventListener('click', () => closeModal(modal));

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const msg = document.getElementById('product-form-msg');
    const saveBtn = document.getElementById('product-save-btn');
    msg.hidden = true;
    const payload = {
      name: document.getElementById('p-name').value,
      category: document.getElementById('p-category').value || null,
      barcode: document.getElementById('p-barcode').value || null,
      unit: document.getElementById('p-unit').value,
      minStock: parseFloat(document.getElementById('p-min-stock').value || '0'),
      expiryDate: document.getElementById('p-expiry').value || null,
    };
    if (!isEdit) payload.initialStock = parseFloat(document.getElementById('p-initial-stock').value || '0');
    if (canPrices) {
      payload.salePrice = parseFloat(document.getElementById('p-sale-price').value);
      payload.costPrice = parseFloat(document.getElementById('p-cost-price').value);
    }

    setButtonLoading(saveBtn, true);
    try {
      if (isEdit) await api.put(`/products/${product.id}`, payload);
      else await api.post('/products', payload);
      closeModal(modal);
      toast(isEdit ? 'Produto atualizado.' : `"${payload.name}" cadastrado.`);
      if (document.getElementById('products-list')) await loadProducts();
      else if (document.getElementById('tb-price-pending')) renderDashboard();
    } catch (err) {
      setButtonLoading(saveBtn, false);
      msg.textContent = err.message;
      msg.hidden = false;
    }
  });
}

// ---------- Estoque ----------
const MOVEMENT_TYPES = {
  ENTRY: { label: 'Entrada', badge: 'ok', icon: 'arrow-down-to-line' },
  SALE: { label: 'Venda', badge: 'info', icon: 'shopping-cart' },
  LOSS: { label: 'Perda', badge: 'bad', icon: 'package-x' },
  ADJUSTMENT: { label: 'Ajuste', badge: 'warn', icon: 'pencil' },
};
let movementType = '';
let stockProducts = [];

async function renderEstoque() {
  activeTemplate('estoque');
  movementsPage = 1;
  movementType = '';

  const entrySelect = document.getElementById('entry-product');
  const adjSelect = document.getElementById('adjustment-product');

  const fillSelects = async () => {
    stockProducts = await api.get('/products');
    [entrySelect, adjSelect].forEach((select) => {
      const keep = select.value;
      select.innerHTML = '';
      select.appendChild(el('option', { value: '' }, 'Escolha o produto…'));
      stockProducts.forEach((p) => select.appendChild(el('option', { value: p.id }, p.name)));
      select.value = keep;
    });
    updateStockHint('entry', 1);
    updateStockHint('adjustment', -1);
  };

  // Mostra o saldo atual e como fica depois do lançamento, antes de gravar.
  const bindHint = (prefix, sign) => {
    document.getElementById(`${prefix}-product`).addEventListener('change', () => updateStockHint(prefix, sign));
    document.getElementById(`${prefix}-qty`).addEventListener('input', () => updateStockHint(prefix, sign));
  };
  bindHint('entry', 1);
  bindHint('adjustment', -1);

  const submitMovement = async (formId, prefix, send, successText) => {
    const form = document.getElementById(formId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const msg = document.getElementById(`${prefix}-msg`);
      const btn = document.getElementById(`${prefix}-submit`);
      msg.hidden = true;
      setButtonLoading(btn, true);
      try {
        const product = stockProducts.find((p) => p.id === document.getElementById(`${prefix}-product`).value);
        await send();
        form.reset();
        toast(successText(product));
        movementsPage = 1;
        await Promise.all([fillSelects(), loadMovements()]);
      } catch (err) {
        msg.textContent = err.message;
        msg.hidden = false;
      } finally {
        setButtonLoading(btn, false);
      }
    });
  };

  submitMovement('entry-form', 'entry', () => api.post('/stock/entries', {
    productId: entrySelect.value,
    quantity: parseFloat(document.getElementById('entry-qty').value),
    reason: document.getElementById('entry-reason').value || undefined,
  }), (p) => `Entrada registrada${p ? ` em "${p.name}"` : ''}.`);

  submitMovement('adjustment-form', 'adjustment', () => api.post('/stock/adjustments', {
    productId: adjSelect.value,
    quantity: -Math.abs(parseFloat(document.getElementById('adjustment-qty').value)),
    reason: document.getElementById('adjustment-reason').value,
    type: 'LOSS',
  }), (p) => `Perda registrada${p ? ` em "${p.name}"` : ''}.`);

  document.getElementById('movement-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    movementType = btn.dataset.type;
    setSegmented('movement-filter', btn);
    document.getElementById('movements-export').href = `/api/stock/movements/export?format=xlsx${movementType ? `&type=${movementType}` : ''}`;
    movementsPage = 1;
    loadMovements();
  });

  await Promise.all([fillSelects(), loadMovements()]);
}

function updateStockHint(prefix, sign) {
  const hint = document.getElementById(`${prefix}-hint`);
  if (!hint) return;
  hint.innerHTML = '';
  const product = stockProducts.find((p) => p.id === document.getElementById(`${prefix}-product`).value);
  if (!product) return;
  const qty = parseFloat(document.getElementById(`${prefix}-qty`).value);
  hint.appendChild(document.createTextNode('Em estoque: '));
  hint.appendChild(el('strong', {}, `${formatQuantity(product.currentStock)} ${product.unit}`));
  if (Number.isFinite(qty) && qty > 0) {
    const next = product.currentStock + sign * qty;
    hint.appendChild(el('span', { class: 'stock-arrow' }, icon('arrow-right')));
    hint.appendChild(el('strong', { class: `is-next${next < 0 ? ' neg' : ''}` }, `${formatQuantity(next)} ${product.unit}`));
  }
}

async function loadMovements() {
  const body = document.getElementById('movements-list');
  if (!body) return;
  if (!body.children.length) skeletonRows(body, 7, 6);
  const typeParam = movementType ? `&type=${movementType}` : '';
  const data = await api.get(`/stock/movements?page=${movementsPage}&pageSize=${LIST_PAGE_SIZE}${typeParam}`);
  if (!document.body.contains(body)) return;
  body.innerHTML = '';
  data.movements.forEach((m) => {
    const type = MOVEMENT_TYPES[m.type] || { label: m.type, badge: '', icon: 'info' };
    const delta = m.newStock - m.previousStock;
    body.appendChild(el('tr', {}, [
      el('td', { class: 'num' }, formatDateTime(m.createdAt)),
      el('td', {}, el('span', { class: 'cell-title' }, m.product)),
      el('td', {}, el('span', { class: `badge ${type.badge}` }, type.label)),
      el('td', { class: `num ${delta >= 0 ? 'qty-pos' : 'qty-neg'}` }, `${delta >= 0 ? '+' : '−'}${formatQuantity(Math.abs(delta))}`),
      el('td', { class: 'stock-flow' }, [formatQuantity(m.previousStock), ' → ', el('strong', {}, formatQuantity(m.newStock))]),
      el('td', {}, m.reason || el('span', { class: 'muted' }, '—')),
      el('td', {}, m.user),
    ]));
  });
  if (data.movements.length === 0) body.appendChild(emptyRow(7, 'Nenhuma movimentação registrada.'));
  revealRows(body);
  renderPager('movements-pager', data, (nextPage) => {
    movementsPage = nextPage;
    loadMovements();
  });
}

// ---------- Importar planilha ----------
// A grade lida do arquivo fica aqui no navegador para que trocar o mapeamento
// de colunas ou uma opção não exija reenviar o arquivo. Quem valida e decide
// o que gravar é sempre o servidor — a tela só mostra o plano que ele devolve.
let importState = null;

const IMPORT_STEPS = ['source', 'mapping', 'preview', 'result'];

function showImportStep(step) {
  const current = IMPORT_STEPS.indexOf(step);
  IMPORT_STEPS.forEach((name) => {
    document.getElementById(`imp-step-${name}`).hidden = name !== step;
  });
  document.querySelectorAll('#imp-steps .step').forEach((node) => {
    const index = IMPORT_STEPS.indexOf(node.dataset.step);
    // A última etapa já nasce "feita": chegar nela é a conclusão.
    node.classList.toggle('is-done', index < current || (step === 'result' && index === current));
    node.classList.toggle('is-current', index === current && step !== 'result');
  });
  document.querySelectorAll('#imp-steps .step-line').forEach((line, i) => line.classList.toggle('is-done', i < current));
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function setImportFile(file) {
  const zone = document.getElementById('imp-dropzone');
  const name = document.getElementById('imp-file-name');
  const hint = document.getElementById('imp-file-hint');
  zone.classList.toggle('has-file', Boolean(file));
  name.textContent = file ? file.name : 'Arraste a planilha para cá';
  hint.textContent = file ? `${(file.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB · clique para trocar` : 'ou clique para escolher o arquivo';
}

async function renderImportar() {
  activeTemplate('importar');
  importState = null;
  showImportStep('source');

  const fileInput = document.getElementById('imp-file');
  const zone = document.getElementById('imp-dropzone');
  fileInput.addEventListener('change', () => setImportFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((evt) => zone.addEventListener(evt, (e) => {
    e.preventDefault();
    zone.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, () => zone.classList.remove('is-over')));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length === 0) return;
    fileInput.files = e.dataTransfer.files;
    setImportFile(fileInput.files[0]);
  });

  document.getElementById('imp-read-btn').addEventListener('click', readSpreadsheet);
  document.getElementById('imp-back-btn').addEventListener('click', () => showImportStep('source'));
  document.getElementById('imp-adjust-btn').addEventListener('click', () => showImportStep('mapping'));
  document.getElementById('imp-preview-btn').addEventListener('click', previewImport);
  document.getElementById('imp-commit-btn').addEventListener('click', commitImport);
  document.getElementById('imp-restart-btn').addEventListener('click', renderImportar);
}

async function readSpreadsheet() {
  const msg = document.getElementById('imp-source-msg');
  const btn = document.getElementById('imp-read-btn');
  msg.hidden = true;

  const file = document.getElementById('imp-file').files[0];
  const pasted = document.getElementById('imp-paste').value.trim();
  if (!file && !pasted) {
    msg.textContent = 'Escolha um arquivo ou cole os dados da planilha.';
    msg.hidden = false;
    return;
  }

  setButtonLoading(btn, true);
  try {
    let body;
    if (file) {
      body = new FormData();
      body.append('file', file);
    } else {
      body = { text: pasted };
    }
    importState = await api.post('/imports/products/parse', body);
    renderColumnMapping();
    showImportStep('mapping');
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    setButtonLoading(btn, false);
  }
}

// Mostra, abaixo de cada seleção, o primeiro valor preenchido daquela coluna.
// É o que permite conferir o mapeamento sem abrir a planilha do lado.
function columnSample(columnIndex) {
  if (columnIndex === '') return '';
  const value = importState.rows.map((row) => row[Number(columnIndex)]).find((cell) => cell !== null && cell !== '');
  return value === undefined ? '(coluna vazia)' : `Ex: ${value}`;
}

function renderColumnMapping() {
  const { headers, rows, fields, mapping } = importState;
  document.getElementById('imp-grid-info').textContent =
    `${rows.length} linha(s) de dados e ${headers.length} coluna(s) lidas. Confira se cada campo aponta para a coluna certa.`;

  const grid = document.getElementById('imp-map-grid');
  grid.innerHTML = '';

  fields.forEach((field, i) => {
    const selectId = `imp-map-${field.key}`;
    const sample = el('span', { class: 'map-sample' });
    const select = el('select', {
      id: selectId,
      onchange: (e) => { sample.textContent = columnSample(e.target.value); },
    }, [el('option', { value: '' }, '— não importar —')]);

    headers.forEach((header, index) => select.appendChild(el('option', { value: String(index) }, header)));
    select.value = mapping[field.key] === undefined ? '' : String(mapping[field.key]);
    sample.textContent = columnSample(select.value);

    const cell = el('div', { class: 'reveal' }, [
      el('label', { for: selectId }, field.required ? `${field.label} (obrigatório)` : field.label),
      select,
      sample,
    ]);
    cell.style.setProperty('--i', String(i));
    grid.appendChild(cell);
  });
}

function buildImportPayload() {
  const mapping = {};
  importState.fields.forEach((field) => {
    const value = document.getElementById(`imp-map-${field.key}`).value;
    if (value !== '') mapping[field.key] = Number(value);
  });

  return {
    headers: importState.headers,
    rows: importState.rows,
    mapping,
    options: {
      mode: document.getElementById('imp-mode').value,
      matchBy: document.getElementById('imp-match-by').value,
      stockMode: document.getElementById('imp-stock-mode').value,
    },
  };
}

async function previewImport() {
  const msg = document.getElementById('imp-map-msg');
  const btn = document.getElementById('imp-preview-btn');
  msg.hidden = true;
  setButtonLoading(btn, true);

  try {
    // O mesmo payload conferido aqui é o que vai para a gravação — assim o
    // que o usuário aprovou na tela é literalmente o que o servidor executa.
    importState.payload = buildImportPayload();
    importState.plan = await api.post('/imports/products/preview', importState.payload);
    showImportStep('preview');
    renderImportPlan(importState.plan);
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    setButtonLoading(btn, false);
  }
}

const IMPORT_ACTIONS = {
  create: { label: 'Cadastrar', badge: 'ok' },
  update: { label: 'Atualizar', badge: 'warn' },
  skip: { label: 'Ignorar', badge: '' },
  error: { label: 'Erro', badge: 'bad' },
};

function formatQuantity(value) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function renderImportPlan(plan) {
  const summary = document.getElementById('imp-summary');
  summary.innerHTML = '';
  [
    ['Novos', plan.summary.create, 'plus', ''],
    ['Atualizações', plan.summary.update, 'pencil', 'accent'],
    ['Ignorados', plan.summary.skip, 'minus', 'muted'],
    ['Com erro', plan.summary.error, 'circle-alert', 'danger'],
  ].forEach(([label, value, iconName, tone], i) => {
    const number = el('strong', {}, '0');
    const card = el('div', { class: 'stat-card', 'data-tone': tone || null }, [
      el('span', { class: 'kpi-icon' }, icon(iconName)),
      el('div', {}, [number, el('span', { class: 'stat-name' }, label)]),
    ]);
    card.style.setProperty('--i', String(i));
    summary.appendChild(card);
    animateValue(number, value);
  });

  // Toda linha com erro ou aviso aparece — são as que exigem decisão. As
  // linhas limpas entram só como amostra: numa planilha de 1.000 itens, listar
  // todas trava a tela sem acrescentar informação.
  const notable = plan.items.filter((i) => i.errors.length > 0 || i.warnings.length > 0);
  const clean = plan.items.filter((i) => i.errors.length === 0 && i.warnings.length === 0);
  const shown = [...notable, ...clean.slice(0, 100)].sort((a, b) => a.line - b.line);

  const body = document.getElementById('imp-preview-body');
  body.innerHTML = '';

  shown.forEach((item) => {
    const action = IMPORT_ACTIONS[item.action];
    const notes = el('ul', { class: 'note-list' });
    item.errors.forEach((text) => notes.appendChild(el('li', { class: 'note-bad' }, text)));
    item.warnings.forEach((text) => notes.appendChild(el('li', { class: 'note-warn' }, text)));
    if (item.reason) notes.appendChild(el('li', {}, item.reason));

    let price = item.values.salePrice === undefined ? '—' : formatMoney(item.values.salePrice);
    if (item.before && item.values.salePrice !== undefined && item.before.salePrice !== item.values.salePrice) {
      price = `${formatMoney(item.before.salePrice)} → ${formatMoney(item.values.salePrice)}`;
    }

    let stock = '—';
    if (item.action === 'create') stock = formatQuantity(item.resultingStock);
    else if (item.stockDelta) stock = `${formatQuantity(item.before.currentStock)} → ${formatQuantity(item.resultingStock)}`;

    body.appendChild(el('tr', { class: item.action === 'error' ? 'row-error' : (item.action === 'skip' ? 'row-skip' : '') }, [
      el('td', { class: 'num' }, String(item.line)),
      el('td', {}, el('span', { class: `badge ${action.badge}` }, action.label)),
      el('td', {}, item.values.name || '—'),
      el('td', { class: 'num' }, price),
      el('td', { class: 'num' }, stock),
      el('td', {}, notes.childElementCount > 0 ? notes : el('span', { class: 'muted' }, '—')),
    ]));
  });

  const omitted = plan.items.length - shown.length;
  if (omitted > 0) {
    body.appendChild(emptyRow(6, `+ ${omitted} linha(s) sem observações não listadas aqui.`));
  }
  revealRows(body);

  document.getElementById('imp-commit-btn').disabled = plan.summary.create + plan.summary.update === 0;
}

async function commitImport() {
  const msg = document.getElementById('imp-preview-msg');
  const btn = document.getElementById('imp-commit-btn');
  msg.hidden = true;

  const { create, update } = importState.plan.summary;
  const ok = await confirmDialog({
    title: 'Confirmar a importação?',
    text: `${create} produto(s) serão cadastrados e ${update} atualizados, conforme a conferência.`,
    confirmLabel: 'Importar agora',
    tone: 'ok',
    iconName: 'file-up',
  });
  if (!ok) return;

  setButtonLoading(btn, true);
  try {
    const result = await api.post('/imports/products/commit', importState.payload);
    document.getElementById('imp-result-text').textContent =
      `${result.created} produto(s) cadastrado(s), ${result.updated} atualizado(s), ${result.skipped} ignorado(s).`;

    const failuresBox = document.getElementById('imp-failures');
    const failuresBody = document.getElementById('imp-failures-body');
    failuresBody.innerHTML = '';
    result.failures.forEach((failure) => {
      failuresBody.appendChild(el('tr', {}, [
        el('td', { class: 'num' }, String(failure.line)),
        el('td', {}, failure.name || '—'),
        el('td', {}, failure.error),
      ]));
    });
    failuresBox.hidden = result.failures.length === 0;

    showImportStep('result');
    toast('Importação concluída.');
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    setButtonLoading(btn, false);
  }
}

// ---------- Relatórios ----------
function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function applyReportPreset(preset) {
  const today = new Date();
  let from = '';
  let to = localDateKey(today);
  if (preset === 'today') from = to;
  else if (preset === '7' || preset === '30') from = localDateKey(new Date(Date.now() - (Number(preset) - 1) * 86400000));
  else if (preset === 'month') from = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  else { from = ''; to = ''; }
  document.getElementById('rep-from').value = from;
  document.getElementById('rep-to').value = to;
}

async function renderRelatorios() {
  activeTemplate('relatorios');
  applyReportPreset('30');

  document.getElementById('rep-presets').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-preset]');
    if (!btn) return;
    setSegmented('rep-presets', btn);
    applyReportPreset(btn.dataset.preset);
    loadReports();
  });
  ['rep-from', 'rep-to'].forEach((id) => document.getElementById(id).addEventListener('change', () => setSegmented('rep-presets', null)));
  document.getElementById('rep-apply-btn').addEventListener('click', loadReports);
  await loadReports();
}

// Dias do período, inclusive os sem venda (que entram como zero no gráfico).
function reportDays(from, to, byDay) {
  const keys = Object.keys(byDay).sort();
  const start = from || keys[0];
  const end = to || keys[keys.length - 1];
  if (!start || !end) return [];
  const days = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`) && days.length < 400; t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function formatDayKey(key, options = { day: '2-digit', month: '2-digit' }) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('pt-BR', options);
}

async function loadReports() {
  const from = document.getElementById('rep-from').value;
  const to = document.getElementById('rep-to').value;
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);

  document.getElementById('rep-export-summary').href = `/api/reports/sales-summary/export?${qs.toString()}&format=xlsx`;
  document.getElementById('rep-export-top').href = `/api/reports/top-products/export?${qs.toString()}&format=xlsx`;
  skeletonRows(document.getElementById('rep-top-products'), 4, 5);
  skeletonRows(document.getElementById('rep-by-day'), 2, 5);

  let summary;
  let topProducts;
  let slowMoving;
  try {
    [summary, topProducts, slowMoving] = await Promise.all([
      api.get(`/reports/sales-summary?${qs.toString()}`),
      api.get(`/reports/top-products?${qs.toString()}`),
      api.get('/reports/slow-moving'),
    ]);
  } catch (err) {
    console.error('Erro ao carregar relatórios:', err);
    toast(`Não foi possível carregar o relatório: ${err.message}`, 'error', 6000);
    return;
  }
  if (!document.getElementById('rep-kpis')) return;

  // Indicadores
  const days = reportDays(from, to, summary.byDay);
  const best = Object.entries(summary.byDay).sort((a, b) => b[1] - a[1])[0];
  const kpis = [
    { label: 'Total vendido', iconName: 'trending-up', value: summary.total, format: formatMoney, sub: from || to ? 'no período escolhido' : 'desde o início' },
    { label: 'Vendas', iconName: 'shopping-cart', tone: 'info', value: summary.count, format: (v) => String(Math.round(v)), sub: `em ${Object.keys(summary.byDay).length} dia(s) com movimento` },
    { label: 'Ticket médio', iconName: 'receipt', tone: 'accent', value: summary.count ? summary.total / summary.count : 0, format: formatMoney, sub: 'por venda' },
    { label: 'Melhor dia', iconName: 'sparkles', tone: 'accent', value: best ? best[1] : 0, format: formatMoney, sub: best ? formatDayKey(best[0], { weekday: 'long', day: '2-digit', month: '2-digit' }) : 'sem vendas' },
  ];
  const grid = document.getElementById('rep-kpis');
  grid.innerHTML = '';
  const built = kpis.map(kpiCard);
  built.forEach(({ card }) => grid.appendChild(card));
  stagger(grid.children);
  built.forEach(({ run }) => run());

  // Gráfico
  const chartBox = document.getElementById('rep-chart');
  chartBox.innerHTML = '';
  document.getElementById('rep-chart-caption').textContent = days.length
    ? `${formatDayKey(days[0], { day: '2-digit', month: '2-digit', year: 'numeric' })} a ${formatDayKey(days[days.length - 1], { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    : '';
  if (summary.count === 0 || days.length === 0) {
    chartBox.appendChild(emptyState('chart-column', 'Sem vendas no período', 'Escolha outro período acima.'));
  } else {
    areaChart(chartBox, days.map((key) => ({
      label: formatDayKey(key),
      fullLabel: formatDayKey(key, { weekday: 'short', day: '2-digit', month: '2-digit' }),
      value: summary.byDay[key] || 0,
    })));
  }

  // Resumo por dia
  animateValue(document.getElementById('rep-total'), summary.total, formatMoney);
  document.getElementById('rep-count').textContent = String(summary.count);
  const byDayBody = document.getElementById('rep-by-day');
  byDayBody.innerHTML = '';
  Object.entries(summary.byDay).sort().reverse().forEach(([day, total]) => {
    byDayBody.appendChild(el('tr', {}, [
      el('td', {}, formatDayKey(day, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })),
      el('td', { class: 'num' }, el('strong', {}, formatMoney(total))),
    ]));
  });
  if (Object.keys(summary.byDay).length === 0) byDayBody.appendChild(emptyRow(2, 'Sem vendas no período.'));
  revealRows(byDayBody);

  // Mais vendidos
  const topBody = document.getElementById('rep-top-products');
  topBody.innerHTML = '';
  const maxRevenue = Math.max(...topProducts.map((p) => p.revenue), 0) || 1;
  topProducts.forEach((p, i) => {
    const bar = el('span');
    bar.style.setProperty('--w', `${Math.max(3, (p.revenue / maxRevenue) * 100)}%`);
    bar.style.setProperty('--i', String(i));
    topBody.appendChild(el('tr', {}, [
      el('td', {}, el('span', { class: 'rank' }, String(i + 1))),
      el('td', {}, [el('span', { class: 'cell-title' }, p.name), el('div', { class: 'inline-bar' }, bar)]),
      el('td', { class: 'num' }, formatQuantity(p.quantitySold)),
      el('td', { class: 'num' }, el('strong', {}, formatMoney(p.revenue))),
    ]));
  });
  if (topProducts.length === 0) topBody.appendChild(emptyRow(4, 'Sem vendas no período.'));
  revealRows(topBody);

  // Capital parado
  const slowBody = document.getElementById('rep-slow-moving');
  slowBody.innerHTML = '';
  slowMoving.forEach((p) => {
    slowBody.appendChild(el('tr', {}, [
      el('td', {}, el('span', { class: 'cell-title' }, p.name)),
      el('td', { class: 'num' }, formatQuantity(p.currentStock)),
      el('td', { class: 'num' }, el('strong', {}, formatMoney(p.capitalParado))),
    ]));
  });
  if (slowMoving.length === 0) slowBody.appendChild(emptyRow(3, 'Nenhum produto parado. Tudo girando!'));
  revealRows(slowBody);
  const slowTotal = slowMoving.reduce((sum, p) => sum + p.capitalParado, 0);
  const slowChip = document.getElementById('rep-slow-total');
  slowChip.classList.toggle('has-items', slowMoving.length > 0);
  animateValue(slowChip, slowTotal, (v) => `${formatMoney(v)} parado`);
}

// ---------- Usuários ----------
let permCatalog = { permissions: {}, templates: {} }; // caixinhas e modelos vindos da API

// Nome do tipo de pessoa: o modelo cujas permissões batem exatamente, senão "Personalizado".
function profileLabel(user) {
  if (user.role === 'ADMIN') return 'Dono';
  const mine = [...user.permissions].sort().join();
  const match = Object.values(permCatalog.templates).find((t) => [...t.permissions].sort().join() === mine);
  return match ? match.label : 'Personalizado';
}

async function renderUsuarios() {
  activeTemplate('usuarios');
  document.getElementById('new-user-btn').addEventListener('click', () => openUserForm(null));
  permCatalog = await api.get('/users/permissions');
  await loadUsers();
}

async function loadUsers() {
  const body = document.getElementById('users-list');
  if (!body) return;
  if (!body.children.length) skeletonRows(body, 6, 4);
  const users = await api.get('/users');
  if (!document.body.contains(body)) return;
  const active = users.filter((u) => u.active).length;
  document.getElementById('users-caption').textContent = `${users.length} conta(s) · ${active} ativa(s)`;

  body.innerHTML = '';
  users.forEach((u) => {
    const isMe = u.id === currentUser.id;
    body.appendChild(el('tr', { class: u.active ? '' : 'is-inactive' }, [
      el('td', {}, el('div', { class: 'cell-main' }, [
        el('span', { class: `cell-avatar round${u.active ? '' : ' is-muted'}` }, u.name.trim().charAt(0).toUpperCase()),
        el('span', {}, [
          el('span', { class: 'cell-title' }, u.name),
          isMe ? el('span', { class: 'cell-sub' }, 'Você') : null,
        ]),
      ])),
      el('td', {}, el('span', { class: 'muted' }, `@${u.username}`)),
      el('td', {}, u.email),
      el('td', {}, el('span', { class: `badge ${u.role === 'ADMIN' ? 'info' : ''}` }, profileLabel(u))),
      el('td', {}, el('span', { class: `badge ${u.active ? 'ok' : 'bad'}` }, u.active ? 'Ativo' : 'Inativo')),
      el('td', { class: 'td-actions' }, el('button', {
        class: 'icon-btn', type: 'button', title: 'Editar usuário', 'aria-label': `Editar ${u.name}`, onclick: () => openUserForm(u),
      }, icon('pencil'))),
    ]));
  });
  if (users.length === 0) body.appendChild(emptyRow(6, 'Nenhum usuário cadastrado.'));
  revealRows(body);
}

function openUserForm(user) {
  const modal = openModal('tpl-user-form');
  const isEdit = Boolean(user);

  document.getElementById('user-form-title').textContent = isEdit ? 'Editar usuário' : 'Novo usuário';
  document.getElementById('user-form-sub').textContent = isEdit ? `@${user.username} · ${user.email}` : 'Escolha o tipo de pessoa e ajuste as permissões.';
  document.getElementById('u-email-field').hidden = isEdit;
  document.getElementById('u-email').required = !isEdit;
  document.getElementById('u-active-label').hidden = !isEdit;
  document.getElementById('u-password-label').textContent = isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha';
  document.getElementById('u-password').required = !isEdit;
  bindPasswordToggle(document.getElementById('u-password-toggle'), document.getElementById('u-password'));
  bindStrengthMeter(document.getElementById('u-password'), document.getElementById('u-strength'), document.getElementById('u-strength-label'));

  if (isEdit) {
    document.getElementById('u-id').value = user.id;
    document.getElementById('u-name').value = user.name;
    document.getElementById('u-active').checked = user.active;
  }

  // Dono tem tudo: não há o que marcar.
  const isOwner = isEdit && user.role === 'ADMIN';
  document.getElementById('u-perms-block').hidden = isOwner;
  const permBox = document.getElementById('u-perms');
  const boxes = Object.entries(permCatalog.permissions).map(([key, label]) => {
    const input = el('input', { type: 'checkbox', value: key });
    input.checked = isEdit ? user.permissions.includes(key) : false;
    permBox.appendChild(el('label', { class: 'switch' }, [input, label]));
    return input;
  });
  const templateBox = document.getElementById('u-template');
  const syncTemplate = () => {
    const label = profileLabel({ role: 'CASHIER', permissions: boxes.filter((b) => b.checked).map((b) => b.value) });
    templateBox.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.textContent === label));
  };
  Object.values(permCatalog.templates).forEach((t) => {
    templateBox.appendChild(el('button', {
      type: 'button',
      onclick: () => {
        boxes.forEach((b) => { b.checked = t.permissions.includes(b.value); });
        syncTemplate();
      },
    }, t.label));
  });
  boxes.forEach((b) => b.addEventListener('change', syncTemplate));
  if (!isEdit) templateBox.querySelector('button:last-child')?.click(); // conta nova começa como Caixa
  syncTemplate();
  const checkedPermissions = () => boxes.filter((b) => b.checked).map((b) => b.value);

  document.getElementById('user-cancel-btn').addEventListener('click', () => closeModal(modal));
  document.getElementById('user-close-btn').addEventListener('click', () => closeModal(modal));

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const msg = document.getElementById('user-form-msg');
    const saveBtn = document.getElementById('user-save-btn');
    msg.hidden = true;
    const password = document.getElementById('u-password').value;

    setButtonLoading(saveBtn, true);
    try {
      if (isEdit) {
        const payload = {
          name: document.getElementById('u-name').value,
          active: document.getElementById('u-active').checked,
        };
        if (password) payload.password = password;
        if (!isOwner) payload.permissions = checkedPermissions();
        await api.put(`/users/${user.id}`, payload);
      } else {
        await api.post('/users', {
          name: document.getElementById('u-name').value,
          email: document.getElementById('u-email').value,
          password,
          permissions: checkedPermissions(),
        });
      }
      closeModal(modal);
      toast(isEdit ? 'Usuário atualizado.' : 'Usuário criado.');
      await loadUsers();
    } catch (err) {
      setButtonLoading(saveBtn, false);
      msg.textContent = err.message;
      msg.hidden = false;
    }
  });
}

// ---------- Utils ----------
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
