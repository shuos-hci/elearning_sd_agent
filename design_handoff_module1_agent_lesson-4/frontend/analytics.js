/* analytics.js — anonymous learning analytics (Round 2, Part B).
   - Random anonymous session id (UUID) in localStorage. No names, emails, or IP addresses are sent.
   - Events are batched (fetch) and flushed with navigator.sendBeacon on page hide / unload.
   - If the backend is unreachable or not configured, events stay queued in localStorage and are retried silently.
   - Tracking must never break the lesson: every call is wrapped in try/catch.
   Event types: session_start, lesson_complete, scene_enter, scene_exit, button_click, input,
                click_anywhere, quiz_attempt, quiz_complete. */
(function () {
  var Q_KEY = 'bya-analytics-queue';
  var SID_KEY = 'bya-analytics-sid';
  var START_KEY = 'bya-analytics-start';
  var MAX_QUEUE = 2000;
  var base = function () { try { return ((window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '').replace(/\/+$/, ''); } catch (e) { return ''; } };

  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var sid = load(SID_KEY, null);
  if (!sid) { sid = uuid(); store(SID_KEY, sid); }
  var queue = load(Q_KEY, []);
  var scene = 0;
  var sending = false;
  var backoff = 4000;

  function push(ev) {
    try {
      ev.session_id = sid;
      ev.timestamp = new Date().toISOString();
      if (ev.scene == null) ev.scene = scene;
      queue.push(ev);
      if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
      store(Q_KEY, queue);
      if (queue.length >= 20) flush();
    } catch (e) {}
  }

  function flush() {
    var b = base();
    if (!b || sending || !queue.length) return;
    sending = true;
    var batch = queue.slice(0, 200);
    try {
      fetch(b + '/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch), keepalive: true })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          queue = queue.slice(batch.length); store(Q_KEY, queue); backoff = 4000;
        })
        .catch(function () { backoff = Math.min(backoff * 2, 120000); })
        .then(function () { sending = false; });
    } catch (e) { sending = false; }
  }
  function beacon() {
    var b = base();
    if (!b || !queue.length || !navigator.sendBeacon) return;
    try {
      var batch = queue.slice(0, 200);
      var ok = navigator.sendBeacon(b + '/api/events', new Blob([JSON.stringify(batch)], { type: 'text/plain' }));
      if (ok) { queue = queue.slice(batch.length); store(Q_KEY, queue); }
    } catch (e) {}
  }
  (function loop() { flush(); setTimeout(loop, backoff); })();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') beacon(); });
  window.addEventListener('pagehide', beacon);

  /* ---- helpers ---- */
  function labelOf(el) {
    if (!el) return '';
    var t = el.closest('[data-track]');
    if (t) return t.getAttribute('data-track');
    if (el.id) return '#' + el.id;
    var a = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'));
    if (a) return a.slice(0, 80);
    var txt = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (txt) return txt.slice(0, 80);
    return el.tagName ? el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') : '';
  }
  function isInteractive(el) {
    return !!(el && el.closest && el.closest('button, a, input, textarea, select, label, [role="button"], [role="radio"], [role="checkbox"], .tap'));
  }

  /* ---- automatic capture: clicks anywhere + button clicks (event delegation on document) ---- */
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      var interactive = isInteractive(t);
      push({ event_type: 'click_anywhere', target: labelOf(t), value: interactive ? 'interactive' : 'non-interactive', x: Math.round(e.clientX), y: Math.round(e.clientY) });
      var btn = t.closest && t.closest('button, [role="button"], [role="radio"], [role="checkbox"]');
      if (btn) {
        var lab = (btn.getAttribute('aria-label') || btn.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120);
        push({ event_type: 'button_click', target: labelOf(btn), value: lab });
      }
    } catch (err) {}
  }, true);

  /* ---- typed answers: only inside input fields (no keystroke logging elsewhere) ---- */
  document.addEventListener('change', function (e) {
    try {
      var t = e.target;
      if (!t || !/^(TEXTAREA|INPUT)$/.test(t.tagName)) return;
      if (t.type === 'password') return;
      push({ event_type: 'input', target: t.id || t.name || labelOf(t), value: String(t.value || '').slice(0, 2000) });
    } catch (err) {}
  }, true);

  /* ---- public API used by the lesson ---- */
  var quizN = {};
  window.Track = {
    sessionId: sid,
    event: function (type, data) {
      try {
        data = data || {};
        if (type === 'scene_enter' && data.scene) scene = data.scene;
        if (type === 'session_start') { if (!load(START_KEY, null)) store(START_KEY, Date.now()); }
        if (type === 'lesson_complete') {
          var st = load(START_KEY, Date.now());
          data.value = String(Math.round((Date.now() - st) / 1000));
        }
        push({ event_type: type, scene: data.scene, target: data.target || null, value: data.value != null ? String(data.value) : null });
        if (type === 'lesson_complete' || type === 'scene_exit') flush();
      } catch (e) {}
    },
    quiz: function (qid, correct, attemptNo, answer, seconds) {
      try {
        push({ event_type: 'quiz_attempt', target: qid, value: (answer || '').slice(0, 300) + ' | ' + seconds + 's', attempt_no: attemptNo, correct: !!correct });
        if (correct && !quizN[qid]) {
          quizN[qid] = true;
          push({ event_type: 'quiz_complete', target: qid, value: String(seconds), attempt_no: attemptNo, correct: true });
        }
      } catch (e) {}
    },
    flush: flush,
    pending: function () { return queue.length; },
  };
})();
