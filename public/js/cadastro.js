const form = document.getElementById('register-form');
const msg = document.getElementById('register-msg');
const submitBtn = document.getElementById('register-submit');
const passwordInput = document.getElementById('password');

stagger(document.querySelectorAll('.reveal'), 1);
document.getElementById('theme-toggle').addEventListener('click', () => window.mjTheme.toggle());
bindPasswordToggle(document.getElementById('toggle-password'), passwordInput);
bindStrengthMeter(passwordInput, document.getElementById('strength'), document.getElementById('strength-label'));
document.getElementById('name').focus();

function showError(text) {
  msg.className = 'error';
  msg.textContent = text;
  // Reexibe do zero para a animação de "balançar" rodar a cada erro.
  msg.hidden = true;
  void msg.offsetWidth;
  msg.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.hidden = true;

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
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
    // O cadastro já abre a sessão (cookie definido na resposta), então vai
    // direto para o sistema, como depois de um login.
    await api.post('/auth/register', { name, email, password });
    location.href = '/app.html';
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showError(err.message);
  }
});
