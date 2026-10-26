// Lê o token da query string, depois remove-o da URL com history.replaceState
// para reduzir o risco de vazamento (histórico do navegador, Referer, logs de
// proxy). O token fica só em memória (nesta variável) e é enviado no corpo
// do POST, não na URL.
const params = new URLSearchParams(location.search);
const token = params.get('token');
if (token) {
  history.replaceState(null, '', '/reset-password.html');
}

const form = document.getElementById('reset-form');
const msg = document.getElementById('reset-msg');
const submitBtn = document.getElementById('reset-submit');
const passwordInput = document.getElementById('password');

stagger(document.querySelectorAll('.reveal'), 1);
document.getElementById('theme-toggle').addEventListener('click', () => window.mjTheme.toggle());
bindPasswordToggle(document.getElementById('toggle-password'), passwordInput);
bindStrengthMeter(passwordInput, document.getElementById('strength'), document.getElementById('strength-label'));
passwordInput.focus();

function showError(text) {
  msg.className = 'error';
  msg.textContent = text;
  msg.hidden = true;
  void msg.offsetWidth;
  msg.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.hidden = true;

  if (!token) {
    showError('Link inválido: token ausente.');
    return;
  }

  const password = passwordInput.value;
  const confirm = document.getElementById('confirm').value;

  if (password !== confirm) {
    showError('As senhas não conferem.');
    return;
  }
  if (password.length < 8) {
    showError('A senha precisa ter ao menos 8 caracteres.');
    return;
  }

  setButtonLoading(submitBtn, true);
  try {
    const data = await api.post('/auth/reset-password', { token, password });
    document.getElementById('reset-done-text').textContent =
      `${(data && data.message) || 'Senha redefinida com sucesso.'} Levando você ao login…`;
    form.hidden = true;
    document.getElementById('reset-done').hidden = false;
    // Redireciona para o login depois de alguns segundos.
    setTimeout(() => { location.href = '/index.html'; }, 3000);
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showError(err.message);
  }
});
