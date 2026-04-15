(function () {
  'use strict';

  const email = Storage.sessionEmail();
  if (!email) {
    window.location.replace('index.html');
    return;
  }

  const identity = Identity.identityFor(email, new Date());
  let user = Storage.loadUser(email);
  user = Storage.ensureToday(user, identity);

  // --- DOM refs ---
  const $ = (id) => document.getElementById(id);
  const whoEl = $('who');
  const scoreEl = $('score');
  const targetEl = $('target');
  const streakEl = $('streak-label');
  const statusEl = $('status');
  const myValueEl = $('my-value');
  const myPinEl = $('my-pin');
  const useForm = $('use-form');
  const theirValueInput = $('their-value');
  const theirPinInput = $('their-pin');
  const useError = $('use-error');
  const historySection = $('history');
  const historyList = $('history-list');
  const flavorEl = $('flavor');
  const signoutBtn = $('signout');
  const concedeBtn = $('concede');
  let lastFlavorState = null;

  // --- Render ---
  function render() {
    whoEl.textContent = email;
    scoreEl.textContent = String(user.today.score);
    targetEl.textContent = String(user.today.target);
    streakEl.textContent = `streak: ${user.streak}`;
    myValueEl.textContent = String(identity.value);
    myPinEl.textContent = Identity.formatPin(identity.pin);

    // Status + flavor per state
    document.body.classList.remove('won', 'lost');
    statusEl.classList.remove('good', 'bad');

    if (user.today.resolved === 'won') {
      setFlavor('won', 'tomorrow, a little higher. today, well done.');
      statusEl.textContent = 'target reached. streak alive.';
      statusEl.classList.add('good');
      document.body.classList.add('won');
      disableForm(true);
      if (concedeBtn) concedeBtn.hidden = true;
    } else if (user.today.resolved === 'lost') {
      setFlavor('lost', 'there will be more strangers tomorrow.');
      statusEl.textContent = 'day conceded. streak broken.';
      statusEl.classList.add('bad');
      document.body.classList.add('lost');
      disableForm(true);
      if (concedeBtn) concedeBtn.hidden = true;
    } else {
      const diff = user.today.target - user.today.score;
      statusEl.textContent = diff > 0 ? `need ${diff} more` : `over by ${-diff}`;
      if (diff < 0) statusEl.classList.add('bad');
      setFlavor(diff > 0 ? 'under' : 'over',
        diff > 0 ? 'the only way forward is to ask.'
                 : 'too far. someone has to pull you back.');
      disableForm(false);
      if (concedeBtn) concedeBtn.hidden = false;
    }

    // History
    if (user.today.history.length > 0) {
      historySection.hidden = false;
      historyList.innerHTML = '';
      user.today.history.slice().reverse().forEach((h) => {
        const li = document.createElement('li');
        const sign = h.op === 'add' ? '+' : '−';
        const opSpan = document.createElement('span');
        opSpan.className = 'op';
        opSpan.textContent = `${sign}${h.value}`;
        const scoreSpan = document.createElement('span');
        scoreSpan.textContent = `→ ${h.newScore}`;
        li.appendChild(opSpan);
        li.appendChild(scoreSpan);
        historyList.appendChild(li);
      });
    } else {
      historySection.hidden = true;
    }
  }

  function disableForm(disabled) {
    Array.from(useForm.querySelectorAll('input, button')).forEach((el) => {
      el.disabled = disabled;
    });
  }

  function setFlavor(state, text) {
    if (lastFlavorState === state) return;
    lastFlavorState = state;
    flavorEl.textContent = text;
  }

  function showUseError(msg) {
    useError.textContent = msg;
    useError.hidden = false;
  }
  function clearUseError() {
    useError.hidden = true;
    useError.textContent = '';
  }

  // --- Submit: add / subtract ---
  // Buttons are type="submit" with data-op; handle via click only.
  useForm.addEventListener('submit', (e) => e.preventDefault());

  Array.from(useForm.querySelectorAll('button[data-op]')).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      clearUseError();
      const op = btn.dataset.op === 'add' ? 'add' : 'sub';
      const theirValue = Number(theirValueInput.value);
      const theirPin = Identity.parsePin(theirPinInput.value);

      if (!Number.isInteger(theirValue) || theirValue < 1 || theirValue > 10) {
        showUseError('their value must be a whole number 1–10.');
        return;
      }
      if (!theirPin) {
        showUseError('pin must be four numbers 1–10, separated by spaces, commas, or dashes.');
        return;
      }

      const result = Storage.applyMove(user, identity, theirValue, theirPin, op);
      if (!result.ok) {
        showUseError(result.reason);
        return;
      }
      user = result.state;
      theirValueInput.value = '';
      theirPinInput.value = '';
      render();
    });
  });

  // Sign out.
  signoutBtn.addEventListener('click', () => {
    Storage.clearSession();
    window.location.href = 'index.html';
  });

  // Concede — explicitly lose the day, break the streak.
  concedeBtn.addEventListener('click', () => {
    if (user.today && user.today.resolved) return;
    const ok = window.confirm('give up today? this will break your streak.');
    if (!ok) return;
    user = Storage.concedeDay(user);
    render();
  });

  render();
})();
