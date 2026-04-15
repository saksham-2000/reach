// storage.js — persistence for a single player across days.
// Everything keyed by email. localStorage only; no server.

(function (global) {
  'use strict';

  const SESSION_KEY = 'reach.session';
  const USER_PREFIX = 'reach.user.';
  const DIRECTORY_KEY = 'reach.directory';
  const COOLDOWN_DAYS = 3;

  function sessionEmail() {
    return localStorage.getItem(SESSION_KEY);
  }
  function setSession(email) {
    localStorage.setItem(SESSION_KEY, email);
    addToDirectory(email);
  }

  function loadDirectory() {
    try { return JSON.parse(localStorage.getItem(DIRECTORY_KEY)) || []; }
    catch (_) { return []; }
  }
  function addToDirectory(email) {
    const dir = loadDirectory();
    if (!dir.includes(email)) {
      dir.push(email);
      localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir));
    }
  }

  // Day arithmetic on local-date keys.
  function daysBetween(earlier, later) {
    const [y1, m1, d1] = earlier.split('-').map(Number);
    const [y2, m2, d2] = later.split('-').map(Number);
    const a = new Date(y1, m1 - 1, d1);
    const b = new Date(y2, m2 - 1, d2);
    return Math.round((b - a) / 86400000);
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function userKey(email) {
    return USER_PREFIX + email;
  }

  function loadUser(email) {
    const raw = localStorage.getItem(userKey(email));
    const base = {
      email,
      streak: 0,
      lastPlayedDate: null,
      lastTargetAchieved: null,
      asksByPin: {}, // { "3-7-9-2": "2026-04-14" } — last date this pin was asked.
      today: null,
    };
    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      return Object.assign(base, parsed);
    } catch (_) {
      return base;
    }
  }

  function saveUser(user) {
    localStorage.setItem(userKey(user.email), JSON.stringify(user));
  }

  // Rollover logic: given an identity for today, ensure user.today matches today.
  // - streak continues only if user played yesterday AND won.
  // - otherwise, streak resets; startScore = 0; target = baseTarget.
  // - on streak continue: startScore = lastTargetAchieved; target = start + boost.
  function ensureToday(user, identity) {
    if (user.today && user.today.dateKey === identity.dateKey) return user;

    // Determine streak survival based on previous day's state.
    const yesterday = previousDayKey(identity.dateKey);
    const playedYesterday = user.lastPlayedDate === yesterday;
    const streakAlive = playedYesterday && user.streak > 0 && user.lastTargetAchieved != null;

    if (!streakAlive) {
      // Broken streak or brand new player.
      user.streak = 0;
      user.lastTargetAchieved = null;
      user.today = {
        dateKey: identity.dateKey,
        startScore: 0,
        target: identity.baseTarget,
        score: 0,
        usedPins: [],
        history: [],
        resolved: null,
      };
    } else {
      // Streak survives — climb higher from yesterday's summit.
      const start = user.lastTargetAchieved;
      // Boost derived from baseTarget so same email+date gives same boost.
      const boost = 3 + (identity.baseTarget % 6); // 3..8
      user.today = {
        dateKey: identity.dateKey,
        startScore: start,
        target: start + boost,
        score: start,
        usedPins: [],
        history: [],
        resolved: null,
      };
    }
    saveUser(user);
    return user;
  }

  function previousDayKey(dateKey) {
    // dateKey = 'YYYY-MM-DD' local. Subtract 1 day.
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  // Record an application of someone-else's value. Returns {ok, reason, state}.
  function applyMove(user, identity, theirValue, theirPin, op) {
    const today = user.today;
    if (!today) return { ok: false, reason: 'no active day' };
    if (today.resolved) return { ok: false, reason: 'day already resolved' };

    if (!Number.isInteger(theirValue) || theirValue < 1 || theirValue > 9) {
      return { ok: false, reason: 'value must be 1–9' };
    }
    if (!theirPin || theirPin.length !== 4 || theirPin.some((n) => n < 1 || n > 9)) {
      return { ok: false, reason: 'pin must be four digits, each 1–9' };
    }
    if (op !== 'add' && op !== 'sub') {
      return { ok: false, reason: 'choose add or subtract' };
    }

    // Block using your own pin for the day.
    if (Identity.pinsEqual(theirPin, identity.pin)) {
      return { ok: false, reason: "that's your own pin. growth doesn't come from yourself." };
    }

    const pinStr = theirPin.join('-');

    // 3-day cooldown: can't ask the same person again within 3 days.
    const lastAsked = user.asksByPin && user.asksByPin[pinStr];
    if (lastAsked) {
      const gap = daysBetween(lastAsked, today.dateKey);
      if (gap < COOLDOWN_DAYS) {
        const wait = COOLDOWN_DAYS - gap;
        return { ok: false, reason: `you asked this person ${gap} day${gap === 1 ? '' : 's'} ago. wait ${wait} more.` };
      }
    }

    // Pair must match some real registered player's assignment for today.
    if (!verifyPair(identity, theirValue, theirPin)) {
      return { ok: false, reason: "that value and pin don't match anyone today. did you hear them right?" };
    }

    if (today.usedPins.includes(pinStr)) {
      return { ok: false, reason: 'that pin has already been used today' };
    }

    const delta = op === 'add' ? theirValue : -theirValue;
    today.score += delta;
    today.usedPins.push(pinStr);
    if (!user.asksByPin) user.asksByPin = {};
    user.asksByPin[pinStr] = today.dateKey;
    today.history.push({ value: theirValue, op, delta, newScore: today.score, at: Date.now() });

    // Resolution check: reaching the target exactly wins the day.
    if (today.score === today.target) {
      today.resolved = 'won';
      user.streak += 1;
      user.lastTargetAchieved = today.target;
      user.lastPlayedDate = today.dateKey;
    } else {
      // Just mark they played — streak resolves only on win (or on next day rollover).
      user.lastPlayedDate = today.dateKey;
    }

    saveUser(user);
    return { ok: true, state: user };
  }

  // Called when the player explicitly gives up / day ends.
  function concedeDay(user) {
    if (!user.today || user.today.resolved) return user;
    user.today.resolved = 'lost';
    user.streak = 0;
    user.lastTargetAchieved = null;
    saveUser(user);
    return user;
  }

  global.Storage = {
    sessionEmail,
    setSession,
    clearSession,
    loadUser,
    saveUser,
    ensureToday,
    applyMove,
    concedeDay,
  };
})(window);
