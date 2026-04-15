// identity.js — deterministic daily assignment from (email, date).
// Same email + same date = same value, pin, target. Different day = fresh draw.

(function (global) {
  'use strict';

  function hash32(str) {
    // FNV-1a 32-bit. Stable, tiny, no crypto needed.
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // YYYY-MM-DD in local time so "today" matches the player's day.
  function todayKey(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function randBetween(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  // Public: identityFor(email, date) -> { value, pin[4], baseTarget, dateKey }
  // baseTarget is what today's target would be if no streak.
  // The actual target (streak-adjusted) is computed in storage.
  function identityFor(email, date) {
    const key = todayKey(date);
    const normEmail = String(email || '').trim().toLowerCase();
    const seed = hash32(normEmail + '|' + key);
    const rng = mulberry32(seed);

    const value = randBetween(rng, 1, 9);
    const pin = [
      randBetween(rng, 1, 9),
      randBetween(rng, 1, 9),
      randBetween(rng, 1, 9),
      randBetween(rng, 1, 9),
    ];
    // Baseline target for a fresh (no-streak) day: 7–14, reachable with 1–2 adds.
    const baseTarget = randBetween(rng, 7, 14);

    return { email: normEmail, dateKey: key, value, pin, baseTarget };
  }

  // Very light email check. Prototype, not production.
  function isCollegeEmail(email) {
    const s = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false;
    // Accept .edu and common academic TLDs. Don't over-police.
    return /\.(edu|ac\.[a-z]{2,}|edu\.[a-z]{2,})$/.test(s);
  }

  function formatPin(pin) {
    return pin.map((n) => String(n)).join(' ');
  }

  // Parse "3 7 10 2", "3,7,10,2", "3-7-10-2" -> [3,7,10,2] or null.
  function parsePin(raw) {
    if (raw == null) return null;
    const parts = String(raw).trim().split(/[\s,\-]+/).filter(Boolean);
    if (parts.length !== 4) return null;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 9)) return null;
    return nums;
  }

  function pinsEqual(a, b) {
    if (!a || !b || a.length !== 4 || b.length !== 4) return false;
    for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  global.Identity = {
    identityFor,
    isCollegeEmail,
    formatPin,
    parsePin,
    pinsEqual,
    todayKey,
  };
})(window);
