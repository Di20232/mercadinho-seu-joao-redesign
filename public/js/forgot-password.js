const form = document.getElementById('forgot-form');
const msg = document.getElementById('forgot-msg');
const submitBtn = document.getElementById('forgot-submit');

stagger(document.querySelectorAll('.reveal'), 1);
document.getElementById('theme-toggle').addEventListener('click', () => window.mjTheme.toggle());
document.getElementById('email').focus();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.hidden = true;

  const email = document.getElementById('email').value.trim();
  setButtonLoading(submitBtn, true);
  try {
    const data = await api.post('/auth/forgot-password', { email });
    // O servidor nunca devolve token ou link na resposta — em qualquer ambiente.
    // O usuário vê a mensagem genérica e receberá o link por e-mail (quando
    // SMTP estiver configurado) ou o administrador obtém o link pelo log do servidor.
    document.getElementById('forgot-done-text').textContent =
      data.message || 'Se o e-mail estiver cadastrado, as instruções foram enviadas.';
    form.hidden = true;
    document.getElementById('forgot-done').hidden = false;
  } catch (err) {
    setButtonLoading(submitBtn, false);
    msg.className = 'error';
    msg.textContent = err.message;
    msg.hidden = false;
  }
});
