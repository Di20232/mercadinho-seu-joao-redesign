// Wrapper de fetch: sempre envia cookies (sessão), sempre inclui o cabeçalho
// que nossa defesa anti-CSRF exige em requisições que alteram estado, e
// padroniza o tratamento de erros da API.
async function apiRequest(path, { method = 'GET', body, headers: extraHeaders } = {}) {
  const headers = { 'X-Requested-With': 'fetch', ...extraHeaders };
  // Upload de planilha: o Content-Type do multipart precisa carregar o
  // "boundary" que o próprio navegador gera — defini-lo à mão quebraria a
  // leitura do arquivo no servidor.
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (res.status === 401) {
    if (!location.pathname.endsWith('/index.html') && location.pathname !== '/') {
      location.href = '/index.html';
    }
    // Repassa a mensagem do servidor — no login é ela que diz se foi o
    // e-mail ou a senha que errou.
    throw new Error((data && data.error) || 'Não autenticado.');
  }

  if (!res.ok) {
    const message = (data && data.error) || `Erro (${res.status}).`;
    throw new Error(message);
  }

  return data;
}

const api = {
  get: (path) => apiRequest(path),
  post: (path, body, headers) => apiRequest(path, { method: 'POST', body, headers }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
};

function formatMoney(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

// Cria elementos de forma segura (sem innerHTML), evitando XSS ao exibir
// dados vindos do servidor (nomes de produtos, motivos de ajuste etc.).
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}
