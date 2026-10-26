// Peças de interface reaproveitadas pelas telas: toasts, números animados,
// estados vazios, esqueletos de carregamento, gráficos em SVG e a animação do
// item "voando" para o carrinho. Tudo criado com el()/createElementNS, sem
// innerHTML com dados do servidor e sem estilos inline (a CSP bloqueia).

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Toasts ----------
function toast(message, type = 'success', life = 3800) {
  let stack = document.getElementById('toasts');
  if (!stack) {
    stack = el('div', { id: 'toasts', class: 'toast-stack', 'aria-live': 'polite' });
    document.body.appendChild(stack);
  }
  const iconName = { success: 'circle-check', error: 'circle-alert', info: 'info' }[type] || 'info';
  const node = el('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, [
    el('span', { class: 'toast-icon' }, icon(iconName)),
    el('span', {}, message),
  ]);
  node.style.setProperty('--toast-life', `${life}ms`);
  stack.appendChild(node);

  const dismiss = () => {
    if (node.classList.contains('is-leaving')) return;
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };
  node.addEventListener('click', dismiss);
  setTimeout(dismiss, life);
}

// ---------- Números que "contam" até o valor ----------
function animateValue(node, to, format = (v) => String(Math.round(v)), duration = 900) {
  if (!node) return;
  const from = Number(node.dataset.value || 0);
  node.dataset.value = String(to);
  if (reducedMotion.matches || from === to) {
    node.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Atraso escalonado: cada filho entra um pouco depois do anterior.
function stagger(nodes, startAt = 0) {
  Array.from(nodes).forEach((node, i) => node.style.setProperty('--i', String(i + startAt)));
}

function setButtonLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
}

// ---------- Estados vazios e esqueletos ----------
function emptyState(iconName, title, text, { good = false } = {}) {
  return el('div', { class: `empty${good ? ' is-good' : ''}` }, [
    el('span', { class: 'empty-icon' }, icon(iconName)),
    el('strong', {}, title),
    text ? el('span', {}, text) : null,
  ]);
}

function emptyRow(colspan, text) {
  return el('tr', {}, el('td', { colspan: String(colspan), class: 'muted' }, text));
}

function skeletonLines(count = 3) {
  const widths = ['w-80', 'w-60', 'w-40'];
  return Array.from({ length: count }, (_, i) => el('div', { class: `skeleton skeleton-line ${widths[i % widths.length]}` }));
}

function skeletonRows(tbody, cols, rows = 5) {
  if (!tbody) return;
  tbody.innerHTML = '';
  for (let r = 0; r < rows; r += 1) {
    const cells = [];
    for (let c = 0; c < cols; c += 1) cells.push(el('td', {}, el('div', { class: `skeleton skeleton-line ${c === 0 ? 'w-80' : 'w-60'}` })));
    tbody.appendChild(el('tr', {}, cells));
  }
}

function revealRows(tbody) {
  Array.from(tbody.children).forEach((tr, i) => {
    tr.classList.add('reveal-row');
    tr.style.setProperty('--i', String(Math.min(i, 20)));
  });
}

// ---------- Formatação curta para eixos ----------
function formatMoneyShort(value) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
}

// ---------- Gráfico de área (vendas por dia) ----------
// points: [{ label: '21/10', fullLabel: 'ter, 21/10', value: 123.4 }]
function areaChart(container, points, { formatValue = formatMoney, formatAxis = formatMoneyShort } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  const draw = () => {
    container.innerHTML = '';
    const width = Math.max(280, container.clientWidth);
    const height = container.clientHeight || 260;
    const pad = { top: 16, right: 12, bottom: 28, left: 64 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const max = Math.max(...points.map((p) => p.value), 0);
    const ticks = 4;
    const niceMax = niceStep((max || 1) / ticks) * ticks;
    const x = (i) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v) => pad.top + innerH - (v / niceMax) * innerH;

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Gráfico de vendas por dia' });
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: 'chart-area-grad', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0%', class: 'chart-grad-top' }));
    grad.appendChild(svgEl('stop', { offset: '100%', class: 'chart-grad-bottom' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    for (let t = 0; t <= ticks; t += 1) {
      const v = (niceMax / ticks) * t;
      const ty = y(v);
      svg.appendChild(svgEl('line', { x1: pad.left, x2: width - pad.right, y1: ty, y2: ty, class: 'chart-grid-line' }));
      const label = svgEl('text', { x: pad.left - 10, y: ty + 4, 'text-anchor': 'end', class: 'chart-axis-label' });
      label.textContent = formatAxis(v);
      svg.appendChild(label);
    }

    const every = Math.ceil(points.length / Math.max(2, Math.floor(innerW / 64)));
    points.forEach((p, i) => {
      if (i % every !== 0 && i !== points.length - 1) return;
      const label = svgEl('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', class: 'chart-axis-label' });
      label.textContent = p.label;
      svg.appendChild(label);
    });

    const coords = points.map((p, i) => [x(i), y(p.value)]);
    const linePath = smoothPath(coords);
    const baseY = y(0);
    const areaPath = `${linePath} L ${coords[coords.length - 1][0]} ${baseY} L ${coords[0][0]} ${baseY} Z`;

    svg.appendChild(svgEl('path', { d: areaPath, class: 'chart-area' }));
    const line = svgEl('path', { d: linePath, class: 'chart-line' });
    svg.appendChild(line);

    coords.forEach(([cx, cy], i) => {
      const dot = svgEl('circle', { cx, cy, r: 3.5, class: 'chart-dot' });
      dot.style.animationDelay = `${0.35 + (i / coords.length) * 1.0}s`;
      svg.appendChild(dot);
    });

    const cursor = svgEl('line', { x1: 0, x2: 0, y1: pad.top, y2: baseY, class: 'chart-cursor' });
    const focus = svgEl('circle', { cx: 0, cy: 0, r: 6, class: 'chart-focus' });
    svg.appendChild(cursor);
    svg.appendChild(focus);

    const hit = svgEl('rect', { x: pad.left, y: pad.top, width: innerW, height: innerH, fill: 'transparent' });
    svg.appendChild(hit);
    container.appendChild(svg);

    const length = line.getTotalLength();
    line.style.setProperty('--len', String(Math.ceil(length)));

    const tip = el('div', { class: 'chart-tooltip' }, [el('span', {}), el('strong', {})]);
    container.appendChild(tip);

    const onMove = (evt) => {
      const rect = svg.getBoundingClientRect();
      const scale = width / rect.width;
      const px = (evt.clientX - rect.left) * scale;
      let nearest = 0;
      coords.forEach(([cx], i) => { if (Math.abs(cx - px) < Math.abs(coords[nearest][0] - px)) nearest = i; });
      const [cx, cy] = coords[nearest];
      cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx);
      focus.setAttribute('cx', cx); focus.setAttribute('cy', cy);
      tip.firstChild.textContent = points[nearest].fullLabel || points[nearest].label;
      tip.lastChild.textContent = formatValue(points[nearest].value);
      tip.style.left = `${cx / scale}px`;
      tip.style.top = `${cy / scale}px`;
      container.classList.add('is-hover');
    };
    hit.addEventListener('mousemove', onMove);
    hit.addEventListener('mouseleave', () => container.classList.remove('is-hover'));
  };

  draw();
  // Redesenha ao mudar a largura (ex.: recolher a barra lateral), sem repetir
  // a animação de entrada a cada pixel: só quando o tamanho estabiliza.
  let lastWidth = container.clientWidth;
  let timer = null;
  const observer = new ResizeObserver(() => {
    if (!container.isConnected) { observer.disconnect(); return; }
    if (Math.abs(container.clientWidth - lastWidth) < 4) return;
    lastWidth = container.clientWidth;
    clearTimeout(timer);
    timer = setTimeout(draw, 180);
  });
  observer.observe(container);
}

// Passo "redondo" do eixo (1, 2 ou 5 vezes uma potência de 10), para as
// marcações saírem como R$ 10, 20, 30 — e não R$ 12,5 ou R$ 38.
function niceStep(value) {
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * exp;
}

// Curva monotônica (Fritsch–Carlson): suaviza sem passar acima do pico nem
// abaixo de zero entre dois pontos — um dia com vendas seguido de um dia sem
// vendas não pode desenhar um "vale" negativo.
function smoothPath(coords) {
  const n = coords.length;
  if (n < 2) return `M ${coords[0][0]} ${coords[0][1]}`;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(coords[i + 1][0] - coords[i][0]);
    slope.push((coords[i + 1][1] - coords[i][1]) / dx[i]);
  }
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const h = dx[i] / 3;
    d += ` C ${x0 + h} ${y0 + tangent[i] * h}, ${x1 - h} ${y1 - tangent[i + 1] * h}, ${x1} ${y1}`;
  }
  return d;
}

// ---------- Barras horizontais (mais vendidos) ----------
function barList(container, items, { formatValue = formatMoney } = {}) {
  container.innerHTML = '';
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  items.forEach((item, i) => {
    const fill = el('div', { class: 'bar-fill' });
    fill.style.setProperty('--w', `${Math.max(4, (item.value / max) * 100)}%`);
    const row = el('div', { class: 'bar-row' }, [
      el('div', { class: 'bar-label' }, [el('span', {}, item.label), el('span', {}, formatValue(item.value))]),
      el('div', { class: 'bar-track' }, fill),
    ]);
    row.style.setProperty('--i', String(i));
    fill.style.setProperty('--i', String(i));
    container.appendChild(row);
  });
}

// ---------- Item "voando" até o carrinho ----------
function flyTo(fromNode, toNode) {
  if (!fromNode || !toNode || reducedMotion.matches || !fromNode.animate) return Promise.resolve();
  const a = fromNode.getBoundingClientRect();
  const b = toNode.getBoundingClientRect();
  const dot = el('div', { class: 'fly-dot' }, icon('shopping-basket'));
  document.body.appendChild(dot);
  const sx = a.left + Math.min(40, a.width / 2) - 17;
  const sy = a.top + a.height / 2 - 17;
  const ex = b.left + Math.min(60, b.width / 2) - 17;
  const ey = b.top + b.height / 2 - 17;
  const midX = (sx + ex) / 2;
  const midY = Math.min(sy, ey) - 80;
  const anim = dot.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(0.6)`, opacity: 0 },
    { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1, offset: 0.12 },
    { transform: `translate(${midX}px, ${midY}px) scale(1.1)`, offset: 0.55 },
    { transform: `translate(${ex}px, ${ey}px) scale(0.5)`, opacity: 0.4 },
  ], { duration: 650, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' });
  return anim.finished.then(() => dot.remove(), () => dot.remove());
}

function bump(node) {
  if (!node) return;
  node.classList.remove('bump');
  void node.offsetWidth; // reinicia a animação
  node.classList.add('bump');
}

// ---------- Diálogo de confirmação ----------
// Substitui o confirm() do navegador por um cartão no mesmo visual do
// sistema. Devolve uma Promise<boolean>: true só quando a pessoa confirma.
function confirmDialog({ title, text, confirmLabel = 'Confirmar', cancelLabel = 'Voltar', tone = 'warn', iconName = 'triangle-alert' }) {
  return new Promise((resolve) => {
    const confirmBtn = el('button', { type: 'button', class: tone === 'danger' ? 'danger' : '' }, confirmLabel);
    const cancelBtn = el('button', { type: 'button', class: 'secondary' }, cancelLabel);
    const card = el('div', { class: 'card confirm-card', 'data-tone': tone, role: 'alertdialog', 'aria-modal': 'true' }, [
      el('div', { class: 'confirm-icon' }, icon(iconName)),
      el('h3', {}, title),
      text ? el('p', {}, text) : null,
      el('div', { class: 'form-actions' }, [cancelBtn, confirmBtn]),
    ]);
    const backdrop = el('div', { class: 'modal-backdrop' }, card);
    document.body.appendChild(backdrop);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const finish = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        backdrop.remove();
        document.body.style.overflow = previousOverflow;
      }, reducedMotion.matches ? 0 : 200);
      resolve(answer);
    };
    // Na fase de captura e parando a propagação: um Esc aqui fecha só a
    // confirmação, não o formulário que estiver aberto por baixo dela.
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); finish(false); }
    };
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(false); });
    cancelBtn.addEventListener('click', () => finish(false));
    confirmBtn.addEventListener('click', () => finish(true));
    setTimeout(() => (tone === 'danger' ? cancelBtn : confirmBtn).focus(), 50);
  });
}

// ---------- Força da senha ----------
// Só orienta quem está escolhendo a senha; a regra que vale (mínimo de 8
// caracteres) continua sendo a do servidor.
function passwordStrength(value) {
  if (!value) return { level: 0, label: '' };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length < 8) score = Math.min(score, 1) || 1;
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  const level = Math.max(1, Math.min(4, score));
  return { level, label: value.length < 8 ? 'Muito curta: use ao menos 8 caracteres' : labels[level] };
}

function bindStrengthMeter(input, meter, label) {
  if (!input || !meter) return;
  input.addEventListener('input', () => {
    const { level, label: text } = passwordStrength(input.value);
    meter.dataset.level = String(level);
    if (label) label.textContent = text;
  });
}

// Botão de olho que mostra/oculta a senha do campo vizinho.
function bindPasswordToggle(button, input) {
  if (!button || !input) return;
  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    input.focus();
  });
}

// ---------- Saudação ----------
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
