import { authService } from './spsm.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleBtn = document.getElementById('btn-google-login');
  const loginForm = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('password');
  const submitBtn = document.getElementById('btn-submit-login');

  // Check URL params for errors
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('error') && alertBox) {
    const err = urlParams.get('error');
    alertBox.innerText =
      err === 'oauth_failed'
        ? 'Autentikasi Google dibatalkan atau gagal. Silakan coba kembali.'
        : `Gagal masuk: ${err}`;
    alertBox.classList.remove('hidden');
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const originalHtml = googleBtn.innerHTML;
      googleBtn.disabled = true;
      googleBtn.innerHTML = `
        <span class="inline-block size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
        <span class="font-bold text-sm text-default">Mengarahkan ke Google Sign In...</span>
      `;
      try {
        await authService.loginWithGoogle();
      } catch (err) {
        if (alertBox) {
          alertBox.innerText = err.message || 'Autentikasi Google gagal.';
          alertBox.classList.remove('hidden');
        }
        googleBtn.disabled = false;
        googleBtn.innerHTML = originalHtml;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput ? emailInput.value.trim() : '';
      const pass = passInput ? passInput.value : '';

      if (!email || !pass) {
        if (alertBox) {
          alertBox.innerText = 'Mohon isi email dan kata sandi Administrator.';
          alertBox.classList.remove('hidden');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Memverifikasi Kredensial...';
      }

      try {
        await authService.loginWithEmail(email, pass);
        window.location.href = 'index.html';
      } catch (err) {
        if (alertBox) {
          alertBox.innerText = err.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.';
          alertBox.classList.remove('hidden');
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Masuk Portal Administrator';
        }
      }
    });
  }
});
