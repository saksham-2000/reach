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
  const pinBoxes = Array.from(document.querySelectorAll('#their-pin .pin-box'));
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
      const pinDigits = pinBoxes.map((b) => Number(b.value));
      const theirPin = pinDigits.every((n) => Number.isInteger(n) && n >= 1 && n <= 9)
        ? pinDigits : null;

      if (!Number.isInteger(theirValue) || theirValue < 1 || theirValue > 9) {
        showUseError('their value must be a whole number 1–9.');
        return;
      }
      if (!theirPin) {
        showUseError('pin must be four digits, each 1–9.');
        pinBoxes.find((b) => !/^[1-9]$/.test(b.value))?.focus();
        return;
      }

      const result = Storage.applyMove(user, identity, theirValue, theirPin, op);
      if (!result.ok) {
        showUseError(result.reason);
        return;
      }
      user = result.state;
      theirValueInput.value = '';
      pinBoxes.forEach((b) => { b.value = ''; b.classList.remove('filled'); });
      render();
      maybeCelebrate();
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

  // PIN box auto-advance / backspace navigation.
  pinBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      // Filter: only 1–9 single digit. 0 rejected.
      const v = box.value.replace(/[^1-9]/g, '').slice(-1);
      box.value = v;
      box.classList.toggle('filled', !!v);
      if (v && i < pinBoxes.length - 1) pinBoxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        pinBoxes[i - 1].focus();
        pinBoxes[i - 1].value = '';
        pinBoxes[i - 1].classList.remove('filled');
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        pinBoxes[i - 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && i < pinBoxes.length - 1) {
        pinBoxes[i + 1].focus();
        e.preventDefault();
      }
    });
    box.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      const digits = text.replace(/[^1-9]/g, '').slice(0, pinBoxes.length - i).split('');
      if (digits.length === 0) return;
      e.preventDefault();
      digits.forEach((d, k) => {
        const target = pinBoxes[i + k];
        if (!target) return;
        target.value = d;
        target.classList.add('filled');
      });
      const nextIdx = Math.min(i + digits.length, pinBoxes.length - 1);
      pinBoxes[nextIdx].focus();
    });
  });

  // --- Celebration ---
  const CELEBRATED_KEY = 'reach.celebrated';
  function maybeCelebrate() {
    if (user.today.resolved !== 'won') return;
    const key = email + '|' + user.today.dateKey;
    if (localStorage.getItem(CELEBRATED_KEY) === key) return;
    localStorage.setItem(CELEBRATED_KEY, key);
    confettiBurst();
    showCelebration();
  }

  function showCelebration() {
    const overlay = document.createElement('div');
    overlay.className = 'celebration';
    overlay.innerHTML = `
      <div class="celebration-card" role="dialog" aria-live="assertive">
        <div class="kicker">target reached</div>
        <h2>you made it.</h2>
        <p>someone said yes. the day counts.</p>
        <div class="stats">
          <div class="stat"><span class="num">${user.today.target}</span><span class="lbl">score</span></div>
          <div class="stat"><span class="num">${user.streak}</span><span class="lbl">streak</span></div>
        </div>
        <button type="button" class="close-celebration">keep going</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.close-celebration').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  function confettiBurst() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#c4502b', '#3f7d3f', '#1c1b1a', '#d4a94a', '#7a7570'];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 40;
    const pieces = Array.from({ length: 180 }, () => ({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 16 - 4,
      g: 0.36,
      drag: 0.995,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      size: 5 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    const MAX = 260;
    function tick() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.vy += p.g;
        p.vx *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.2, p.size, p.size * 0.4);
        ctx.restore();
      }
      if (frame < MAX) {
        requestAnimationFrame(tick);
      } else {
        window.removeEventListener('resize', resize);
        canvas.remove();
      }
    }
    tick();
  }

  render();
  // If the page was reloaded on a won state, still celebrate (once).
  maybeCelebrate();
})();
