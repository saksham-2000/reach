(function () {
  'use strict';

  // If already signed in, skip to play.
  const existing = Storage.sessionEmail();
  if (existing) {
    window.location.replace('play.html');
    return;
  }

  const form = document.getElementById('signin');
  const input = document.getElementById('email');
  const err = document.getElementById('error');

  function showError(msg) {
    err.textContent = msg;
    err.hidden = false;
  }
  function clearError() {
    err.hidden = true;
    err.textContent = '';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    const email = input.value.trim().toLowerCase();
    if (!Identity.isCollegeEmail(email)) {
      showError("that doesn't look like a college email. try one ending in .edu");
      return;
    }
    Storage.setSession(email);
    window.location.href = 'play.html';
  });
})();
