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

    // Demo roster
    renderRoster();

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

  function renderRoster() {
    const list = document.getElementById('roster-list');
    if (!list) return;
    list.innerHTML = '';
    const today = identity.dateKey;
    Identity.DEMO_EMAILS.forEach((e) => {
      if (e === email) return; // can't use own
      const id = Identity.identityFor(e, new Date());
      const pinStr = id.pin.join('-');
      const lastAsked = user.asksByPin && user.asksByPin[pinStr];
      const li = document.createElement('li');
      const emailSpan = document.createElement('span');
      emailSpan.className = 'email';
      emailSpan.textContent = e;
      const valSpan = document.createElement('span');
      valSpan.className = 'val';
      valSpan.textContent = id.value;
      const pinSpan = document.createElement('span');
      pinSpan.className = 'pn';
      pinSpan.textContent = Identity.formatPin(id.pin);
      li.appendChild(emailSpan);
      li.appendChild(valSpan);
      li.appendChild(pinSpan);
      if (lastAsked) {
        const daysAgo = Math.max(0, daysBetween(lastAsked, today));
        if (daysAgo < 3) {
          const note = document.createElement('span');
          note.className = 'cooldown';
          note.style.gridColumn = '1 / -1';
          note.textContent = `asked ${daysAgo === 0 ? 'today' : daysAgo + 'd ago'} — wait ${3 - daysAgo} more`;
          li.appendChild(note);
        }
      }
      list.appendChild(li);
    });
  }

  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
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

      if (!Number.isInteger(theirValue) || theirValue < 1 || theirValue > 9) {
        showUseError('their value must be a whole number 1–9.');
        return;
      }
      if (!theirPin) {
        showUseError('pin must be four numbers 1–9, separated by spaces, commas, or dashes.');
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
