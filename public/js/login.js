(async () => {
  // Se já existe sessão válida, pula direto para o app.
  try {
    await api.get('/auth/me');
    location.href = '/app.html';
    return;
  } catch {
    // não autenticado — segue para o formulário de login
  }
})();

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const loginInput = document.getElementById('login');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('login-submit');
const togglePassword = document.getElementById('toggle-password');

stagger(document.querySelectorAll('.reveal'), 1);
document.getElementById('theme-toggle').addEventListener('click', () => window.mjTheme.toggle());
loginInput.focus();

togglePassword.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePassword.setAttribute('aria-pressed', String(show));
  togglePassword.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  passwordInput.focus();
});

function showLoginError(message) {
  errorEl.textContent = message;
  // Reexibe do zero para a animação de "balançar" rodar a cada erro.
  errorEl.hidden = true;
  void errorEl.offsetWidth;
  errorEl.hidden = false;
}

// O campo aceita e-mail ou nome de usuário (ex: diego1239), então não há
// formato a checar aqui — quem decide qual dos dois é o servidor.
function validateLoginFields(login, password) {
  if (!login) return 'E-mail ou usuário: informe o e-mail ou o usuário.';
  if (!password) return 'Senha: informe a senha.';
  return '';
}

function friendlyLoginError(err) {
  const message = err && err.message ? err.message : '';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'Servidor indisponível. Verifique se o sistema está aberto e tente novamente.';
  }
  if (message === 'Erro interno do servidor.') {
    return 'Não foi possível concluir o login. Verifique se o banco de dados/servidor está rodando e tente novamente.';
  }
  return message || 'Não foi possível concluir o login. Verifique os dados e tente novamente.';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const login = loginInput.value.trim();
  const password = passwordInput.value;
  const fieldError = validateLoginFields(login, password);
  if (fieldError) {
    showLoginError(fieldError);
    return;
  }

  setButtonLoading(submitBtn, true);
  try {
    await api.post('/auth/login', { login, password });
    location.href = '/app.html';
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showLoginError(friendlyLoginError(err));
  }
});
