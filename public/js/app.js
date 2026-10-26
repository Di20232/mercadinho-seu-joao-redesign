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
  document.getElementById('user-role').textContent = `@${currentUser.username} · ${currentUser.role === 'ADMIN' ? 'admin' : 'caixa'}`;
  document.getElementById('user-avatar').textContent = currentUser.name.trim().charAt(0).toUpperCase();
  document.body.classList.toggle('role-admin', currentUser.role === 'ADMIN');
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
  const isAdmin = currentUser.role === 'ADMIN';

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
      results = products.slice(0, 8);
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
      if (products.length === 0) resultsBox.appendChild(el('div', { class: 'muted' }, 'Nenhum produto encontrado.'));
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

async function confirmSale() {
  if (saleInFlight || cart.length === 0) return;
  const msg = document.getElementById('sale-msg');
  msg.hidden = true;
  saleInFlight = true;
  setConfirmButton();
  try {
    const sale = await api.post('/sales', { items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })) });
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
    if (currentUser.role === 'ADMIN') {
      cells.push(el('td', { class: 'td-actions' }, el('button', {
        class: 'small ghost', type: 'button',
        onclick: async () => {
          if (!confirm('Cancelar esta venda? O estoque dos itens será devolvido.')) return;
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
async function renderProdutos() {
  activeTemplate('produtos');
  productsPage = 1;
  await loadProducts();

  document.getElementById('product-search').addEventListener('input', debounce(() => {
    productsPage = 1;
    loadProducts();
  }, 250));
  const newBtn = document.getElementById('new-product-btn');
  if (newBtn) newBtn.addEventListener('click', () => openProductForm(null));
}

function renderPager(containerId, { page, pageSize, totalCount }, onPage) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  box.innerHTML = '';
  if (totalCount === 0) {
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
  }, 'Anterior');
  prev.disabled = page <= 1;
  const next = el('button', {
    type: 'button',
    class: 'small secondary',
    onclick: () => { if (page < totalPages) onPage(page + 1); },
  }, 'Próxima');
  next.disabled = page >= totalPages;
  actions.appendChild(prev);
  actions.appendChild(next);
  box.appendChild(actions);
}

async function loadProducts() {
  const term = document.getElementById('product-search')?.value.trim() || '';
  const includeInactive = currentUser.role === 'ADMIN' ? '&includeInactive=true' : '';
  const data = await api.get(`/products?query=${encodeURIComponent(term)}${includeInactive}&page=${productsPage}&pageSize=${LIST_PAGE_SIZE}`);
  const products = data.products;
  const body = document.getElementById('products-list');
  body.innerHTML = '';

  products.forEach((p) => {
    const stockBadge = p.currentStock <= p.minStock
      ? el('span', { class: 'badge bad' }, `${p.currentStock} ${p.unit}`)
      : el('span', {}, `${p.currentStock} ${p.unit}`);

    const cells = [
      el('td', {}, p.name + (p.active ? '' : ' (inativo)')),
      el('td', {}, p.category || '—'),
      el('td', {}, stockBadge),
      el('td', {}, String(p.minStock)),
      el('td', {}, formatMoney(p.salePrice)),
    ];
    const costCell = el('td', {}, currentUser.role === 'ADMIN' ? formatMoney(p.costPrice) : '');
    costCell.setAttribute('data-admin-only', '');
    cells.push(costCell);
    cells.push(el('td', {}, formatDate(p.expiryDate)));

    if (currentUser.role === 'ADMIN') {
      cells.push(el('td', {}, el('button', { class: 'small secondary', type: 'button', onclick: () => openProductForm(p) }, 'Editar')));
    } else {
      cells.push(el('td', {}));
    }
    body.appendChild(el('tr', {}, cells));
  });

  if (products.length === 0) body.appendChild(el('tr', {}, el('td', { colspan: '8', class: 'muted' }, 'Nenhum produto encontrado.')));
  renderPager('products-pager', data, (nextPage) => {
    productsPage = nextPage;
    loadProducts();
  });
}

function openProductForm(product) {
  const modal = openModal('tpl-product-form');

  const isEdit = Boolean(product);
  document.getElementById('product-form-title').textContent = isEdit ? 'Editar produto' : 'Novo produto';
  document.getElementById('p-initial-stock-label').style.display = isEdit ? 'none' : '';
  document.getElementById('p-initial-stock').style.display = isEdit ? 'none' : '';

  if (isEdit) {
    document.getElementById('p-id').value = product.id;
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-category').value = product.category || '';
    document.getElementById('p-barcode').value = product.barcode || '';
    document.getElementById('p-unit').value = product.unit;
    document.getElementById('p-sale-price').value = product.salePrice;
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
        if (!confirm(`Desativar "${product.name}"? Ele deixará de aparecer em vendas novas.`)) return;
        await api.del(`/products/${product.id}`);
        closeModal(modal);
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
        await loadProducts();
      });
    }
  }

  document.getElementById('product-cancel-btn').addEventListener('click', () => closeModal(modal));

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('product-form-msg');
    msg.hidden = true;
    const payload = {
      name: document.getElementById('p-name').value,
      category: document.getElementById('p-category').value || null,
      barcode: document.getElementById('p-barcode').value || null,
      unit: document.getElementById('p-unit').value,
      salePrice: parseFloat(document.getElementById('p-sale-price').value),
      costPrice: parseFloat(document.getElementById('p-cost-price').value),
      minStock: parseFloat(document.getElementById('p-min-stock').value || '0'),
      expiryDate: document.getElementById('p-expiry').value || null,
    };
    if (!isEdit) payload.initialStock = parseFloat(document.getElementById('p-initial-stock').value || '0');

    try {
      if (isEdit) await api.put(`/products/${product.id}`, payload);
      else await api.post('/products', payload);
      closeModal(modal);
      await loadProducts();
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
    }
  });
}

// ---------- Estoque ----------
async function renderEstoque() {
  activeTemplate('estoque');
  movementsPage = 1;
  const products = await api.get('/products');

  const entrySelect = document.getElementById('entry-product');
  const adjSelect = document.getElementById('adjustment-product');
  products.forEach((p) => {
    entrySelect.appendChild(el('option', { value: p.id }, `${p.name} (${p.currentStock} ${p.unit})`));
    adjSelect.appendChild(el('option', { value: p.id }, `${p.name} (${p.currentStock} ${p.unit})`));
  });

  document.getElementById('entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('entry-msg');
    msg.hidden = true;
    try {
      await api.post('/stock/entries', {
        productId: entrySelect.value,
        quantity: parseFloat(document.getElementById('entry-qty').value),
        reason: document.getElementById('entry-reason').value || undefined,
      });
      document.getElementById('entry-form').reset();
      await renderEstoque();
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
    }
  });

  document.getElementById('adjustment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('adjustment-msg');
    msg.hidden = true;
    try {
      await api.post('/stock/adjustments', {
        productId: adjSelect.value,
        quantity: -Math.abs(parseFloat(document.getElementById('adjustment-qty').value)),
        reason: document.getElementById('adjustment-reason').value,
        type: 'LOSS',
      });
      document.getElementById('adjustment-form').reset();
      await renderEstoque();
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
    }
  });

  await loadMovements();
}

async function loadMovements() {
  const data = await api.get(`/stock/movements?page=${movementsPage}&pageSize=${LIST_PAGE_SIZE}`);
  const body = document.getElementById('movements-list');
  if (!body) return;
  body.innerHTML = '';
  data.movements.forEach((m) => {
    body.appendChild(el('tr', {}, [
      el('td', {}, formatDateTime(m.createdAt)),
      el('td', {}, m.product),
      el('td', {}, m.type),
      el('td', {}, String(m.quantity)),
      el('td', {}, String(m.newStock)),
      el('td', {}, m.reason || '—'),
      el('td', {}, m.user),
    ]));
  });
  if (data.movements.length === 0) body.appendChild(el('tr', {}, el('td', { colspan: '7', class: 'muted' }, 'Nenhuma movimentação registrada.')));
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
  IMPORT_STEPS.forEach((name) => {
    document.getElementById(`imp-step-${name}`).hidden = name !== step;
  });
}

async function renderImportar() {
  activeTemplate('importar');
  importState = null;

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

  btn.disabled = true;
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
    btn.disabled = false;
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

  fields.forEach((field) => {
    const selectId = `imp-map-${field.key}`;
    const sample = el('span', { class: 'map-sample' });
    const select = el('select', {
      id: selectId,
      onchange: (e) => { sample.textContent = columnSample(e.target.value); },
    }, [el('option', { value: '' }, '— não importar —')]);

    headers.forEach((header, index) => select.appendChild(el('option', { value: String(index) }, header)));
    select.value = mapping[field.key] === undefined ? '' : String(mapping[field.key]);
    sample.textContent = columnSample(select.value);

    grid.appendChild(el('div', {}, [
      el('label', { for: selectId }, field.required ? `${field.label} (obrigatório)` : field.label),
      select,
      sample,
    ]));
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
  btn.disabled = true;

  try {
    // O mesmo payload conferido aqui é o que vai para a gravação — assim o
    // que o usuário aprovou na tela é literalmente o que o servidor executa.
    importState.payload = buildImportPayload();
    renderImportPlan(await api.post('/imports/products/preview', importState.payload));
    showImportStep('preview');
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    btn.disabled = false;
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
    ['Novos', plan.summary.create],
    ['Atualizações', plan.summary.update],
    ['Ignorados', plan.summary.skip],
    ['Com erro', plan.summary.error],
  ].forEach(([label, value]) => {
    summary.appendChild(el('div', { class: 'card stat' }, [
      el('span', { class: 'stat-label' }, label),
      el('span', { class: 'stat-value' }, String(value)),
    ]));
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
      el('td', {}, String(item.line)),
      el('td', {}, el('span', { class: `badge ${action.badge}` }, action.label)),
      el('td', {}, item.values.name || '—'),
      el('td', {}, price),
      el('td', {}, stock),
      el('td', {}, notes.childElementCount > 0 ? notes : el('span', { class: 'muted' }, '—')),
    ]));
  });

  const omitted = plan.items.length - shown.length;
  if (omitted > 0) {
    body.appendChild(el('tr', {}, el('td', { colspan: '6', class: 'muted' }, `+ ${omitted} linha(s) sem observações não listadas aqui.`)));
  }

  document.getElementById('imp-commit-btn').disabled = plan.summary.create + plan.summary.update === 0;
}

async function commitImport() {
  const msg = document.getElementById('imp-preview-msg');
  const btn = document.getElementById('imp-commit-btn');
  msg.hidden = true;

  if (!confirm('Confirmar a importação? Os produtos serão cadastrados e atualizados conforme a conferência acima.')) return;

  btn.disabled = true;
  try {
    const result = await api.post('/imports/products/commit', importState.payload);
    document.getElementById('imp-result-text').textContent =
      `${result.created} produto(s) cadastrado(s), ${result.updated} atualizado(s), ${result.skipped} ignorado(s).`;

    const failuresBox = document.getElementById('imp-failures');
    const failuresBody = document.getElementById('imp-failures-body');
    failuresBody.innerHTML = '';
    result.failures.forEach((failure) => {
      failuresBody.appendChild(el('tr', {}, [
        el('td', {}, String(failure.line)),
        el('td', {}, failure.name || '—'),
        el('td', {}, failure.error),
      ]));
    });
    failuresBox.hidden = result.failures.length === 0;

    showImportStep('result');
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

// ---------- Relatórios ----------
async function renderRelatorios() {
  activeTemplate('relatorios');
  document.getElementById('rep-apply-btn').addEventListener('click', loadReports);
  await loadReports();
}

async function loadReports() {
  try {
    const from = document.getElementById('rep-from').value;
    const to = document.getElementById('rep-to').value;
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);

    const [summary, topProducts, slowMoving] = await Promise.all([
      api.get(`/reports/sales-summary?${qs.toString()}`),
      api.get(`/reports/top-products?${qs.toString()}`),
      api.get('/reports/slow-moving'),
    ]);

    document.getElementById('rep-total').textContent = formatMoney(summary.total);
    document.getElementById('rep-count').textContent = String(summary.count);

    const byDayBody = document.getElementById('rep-by-day');
    byDayBody.innerHTML = '';
    Object.entries(summary.byDay).sort().reverse().forEach(([day, total]) => {
      byDayBody.appendChild(el('tr', {}, [el('td', {}, day), el('td', {}, formatMoney(total))]));
    });
    if (Object.keys(summary.byDay).length === 0) byDayBody.appendChild(el('tr', {}, el('td', { colspan: '2', class: 'muted' }, 'Sem vendas no período.')));

    const topBody = document.getElementById('rep-top-products');
    topBody.innerHTML = '';
    topProducts.forEach((p) => {
      topBody.appendChild(el('tr', {}, [el('td', {}, p.name), el('td', {}, String(p.quantitySold)), el('td', {}, formatMoney(p.revenue))]));
    });
    if (topProducts.length === 0) topBody.appendChild(el('tr', {}, el('td', { colspan: '3', class: 'muted' }, 'Sem vendas no período.')));

    const slowBody = document.getElementById('rep-slow-moving');
    slowBody.innerHTML = '';
    slowMoving.forEach((p) => {
      slowBody.appendChild(el('tr', {}, [el('td', {}, p.name), el('td', {}, String(p.currentStock)), el('td', {}, formatMoney(p.capitalParado))]));
    });
    if (slowMoving.length === 0) slowBody.appendChild(el('tr', {}, el('td', { colspan: '3', class: 'muted' }, 'Nenhum produto parado.')));
  } catch (err) {
    console.error('Erro ao carregar relatórios:', err);
    // Mostrar erro ao usuário de forma amigável
    const totalEl = document.getElementById('rep-total');
    if (totalEl && totalEl.parentElement) {
      const card = totalEl.closest('.card');
      if (card) {
        const errorMsg = el('p', { class: 'error notice' }, `❌ Erro ao carregar relatório: ${err.message}`);
        card.insertBefore(errorMsg, card.firstChild);
      }
    }
  }
}

// ---------- Usuários ----------
async function renderUsuarios() {
  activeTemplate('usuarios');
  document.getElementById('new-user-btn').addEventListener('click', () => openUserForm(null));
  await loadUsers();
}

async function loadUsers() {
  const users = await api.get('/users');
  const body = document.getElementById('users-list');
  body.innerHTML = '';
  users.forEach((u) => {
    body.appendChild(el('tr', {}, [
      el('td', {}, u.name),
      el('td', {}, u.username),
      el('td', {}, u.email),
      el('td', {}, u.role === 'ADMIN' ? 'Administrador' : 'Funcionário'),
      el('td', {}, u.active ? 'Sim' : 'Não'),
      el('td', {}, el('button', { class: 'small secondary', type: 'button', onclick: () => openUserForm(u) }, 'Editar')),
    ]));
  });
}

function openUserForm(user) {
  const modal = openModal('tpl-user-form');
  const isEdit = Boolean(user);

  document.getElementById('user-form-title').textContent = isEdit ? 'Editar usuário' : 'Novo usuário';
  document.getElementById('u-email-label').style.display = isEdit ? 'none' : '';
  document.getElementById('u-email').style.display = isEdit ? 'none' : '';
  document.getElementById('u-email').required = !isEdit;
  document.getElementById('u-active-label').style.display = isEdit ? '' : 'none';
  document.getElementById('u-active').style.display = isEdit ? '' : 'none';
  document.getElementById('u-password-label').textContent = isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha';
  document.getElementById('u-password').required = !isEdit;

  if (isEdit) {
    document.getElementById('u-id').value = user.id;
    document.getElementById('u-name').value = user.name;
    document.getElementById('u-active').checked = user.active;
  }

  document.getElementById('user-cancel-btn').addEventListener('click', () => closeModal(modal));

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('user-form-msg');
    msg.hidden = true;
    const password = document.getElementById('u-password').value;

    try {
      if (isEdit) {
        const payload = {
          name: document.getElementById('u-name').value,
          active: document.getElementById('u-active').checked,
        };
        if (password) payload.password = password;
        await api.put(`/users/${user.id}`, payload);
      } else {
        await api.post('/users', {
          name: document.getElementById('u-name').value,
          email: document.getElementById('u-email').value,
          password,
        });
      }
      closeModal(modal);
      await loadUsers();
    } catch (err) {
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
