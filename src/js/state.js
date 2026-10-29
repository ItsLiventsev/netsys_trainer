/* ==========================================================================
   state.js — модель данных, сохранение в localStorage, подсчёт баллов,
   формирование сообщения для МЭШ (LMS).
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const STORAGE_KEY = 'netsys.tp.state.v1';
  const VERSION = 1;

  /* ---------- Начальное состояние ---------------------------------------- */
  function freshEnd() {
    return {
      strip: { done: false, lengthCm: 0, attempts: 0 },
      order: [null, null, null, null, null, null, null, null],
      sortMistakes: 0,
      trimmed: false,
      inserted: false,
      depth: 0,
      crimped: false,
      force: 0,
      crimpAttempts: 0,
      // проверки, зафиксированные при обжиме
      checks: { fullInsert: false, jacketClamp: false, wiresIntact: true }
    };
  }

  function freshState() {
    return {
      version: VERSION,
      mode: 'training', // training | exam
      step: 1,
      activeEnd: 'A',
      // подэтап для второго конца (шаг 5): strip → sort → insert → crimp → done
      bStage: 'strip',
      ends: { A: freshEnd(), B: freshEnd() },
      tester: { plugged: { main: false, remote: false }, tested: false, result: null, inspected: false, link: false },
      quiz: { answers: {}, checked: false },
      report: { student: '', group: '', comment: '', exported: false, copied: false },
      ui: { activeTool: null, hintOpen: false, mobilePane: 'stage', modal: null },
      stats: { stripRetries: 0, wrongDrops: 0, startedAt: Date.now(), finishedAt: null },
      log: []
    };
  }

  /* ---------- Глубокое слияние с дефолтами (мягкая миграция) ------------ */
  function merge(base, incoming) {
    if (Array.isArray(base)) {
      return Array.isArray(incoming) && incoming.length === base.length ? incoming.slice() : base.slice();
    }
    if (base && typeof base === 'object') {
      if (!incoming || typeof incoming !== 'object') return merge(base, {});
      const out = {};
      const keys = Object.keys(base);
      Object.keys(incoming).forEach((k) => {
        if (keys.indexOf(k) === -1) keys.push(k);
      });
      keys.forEach((k) => {
        out[k] = k in base ? merge(base[k], incoming[k]) : incoming[k];
      });
      return out;
    }
    if (incoming === undefined || incoming === null) return base;
    return typeof incoming === typeof base ? incoming : base;
  }

  /* ---------- Сохранение / загрузка -------------------------------------- */
  let state = freshState();
  let saveTimer = null;
  const listeners = [];

  function storageAvailable() {
    try {
      const k = STORAGE_KEY + '.probe';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  const canStore = storageAvailable();

  function load() {
    if (!canStore) return state;
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return state;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return state;
      state = merge(freshState(), parsed);
      return state;
    } catch (e) {
      return state;
    }
  }

  function saveNow() {
    if (!canStore) return;
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* переполнение хранилища не должно ломать работу */
    }
  }

  function save() {
    if (saveTimer) global.clearTimeout(saveTimer);
    saveTimer = global.setTimeout(() => {
      saveTimer = null;
      saveNow();
    }, 200);
  }

  function reset() {
    const fresh = freshState();
    const keepMode = state.mode;
    state = fresh;
    state.mode = keepMode;
    if (canStore) {
      try {
        global.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        /* noop */
      }
    }
    emit('reset');
    saveNow();
    return state;
  }

  function get() {
    return state;
  }

  function end(which) {
    return state.ends[which || state.activeEnd];
  }

  function logEntry(text) {
    state.log.push({ t: Date.now(), text: text });
    if (state.log.length > 60) state.log.shift();
  }

  function emit(type) {
    listeners.forEach((fn) => fn(state, type));
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ---------- Проверки готовности шагов ---------------------------------- */
  function endReadyForNext(e) {
    return e.strip.done && e.order.every(Boolean) && e.trimmed && e.inserted && e.crimped;
  }

  function readiness(s) {
    const A = s.ends.A;
    const B = s.ends.B;
    const r = { 1: true, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false };
    r[1] = true;
    r[2] = A.strip.done;
    r[3] = r[2] && A.order.every(Boolean);
    r[4] = r[3] && A.trimmed && A.inserted;
    r[5] = r[4] && A.crimped;
    r[6] = r[5] && endReadyForNext(B);
    r[7] = r[6] && s.tester.tested;
    return r;
  }

  /* ---------- Подсчёт баллов -------------------------------------------- */
  function orderMatches(e, stdId) {
    const std = D.STANDARDS[stdId] || D.STANDARDS.T568B;
    let n = 0;
    for (let i = 0; i < 8; i++) if (e.order[i] === std.order[i]) n++;
    return n;
  }

  function orderScore(s) {
    let total = 0;
    ['A', 'B'].forEach((k) => {
      const e = s.ends[k];
      const matches = orderMatches(e, 'T568B');
      const placed = e.order.filter(Boolean).length;
      if (s.mode === 'training') {
        // в тренировке неверная жила сразу возвращается: считаем прогресс и попытки
        total += Math.max(0, (15 * placed) / 8 - e.sortMistakes * 3);
      } else {
        total += (15 * matches) / 8;
      }
    });
    return Math.max(0, Math.min(30, total));
  }

  function clampScore(e) {
    const len = e.strip.lengthCm;
    if (!e.strip.done) return 0;
    if (len >= D.SETTINGS.stripMinCm && len <= D.SETTINGS.stripMaxCm) return 2.5;
    if (len >= D.SETTINGS.stripMinCm - 0.2 && len <= D.SETTINGS.stripMaxCm + 0.2) return 1.5;
    return 0;
  }

  function insertScore(e) {
    if (!e.inserted) return 0;
    if (e.depth >= D.SETTINGS.depthGood) return 5;
    if (e.depth >= D.SETTINGS.depthWarn) return 3;
    return 1;
  }

  function crimpScore(e) {
    if (!e.crimped) return 0;
    if (e.force >= D.SETTINGS.crimpGood) return 5;
    if (e.force >= D.SETTINGS.crimpWarn) return 2.5;
    return 1;
  }

  function qualityScore(s) {
    return ['A', 'B'].reduce((sum, k) => {
      const e = s.ends[k];
      return sum + clampScore(e) + insertScore(e) + crimpScore(e);
    }, 0);
  }

  function functionScore(s) {
    const r = s.tester.result;
    if (!s.tester.tested || !r) return 0;
    if (r.ok) return 20;
    // прямой кабель, но есть обрывы
    if (r.straight) return Math.max(6, (20 * r.connected) / 8);
    // перекрёст/перепутанные жилы
    return Math.max(4, (12 * r.straightPins) / 8);
  }

  function reportScore(s) {
    let v = 0;
    if (s.report.student.trim().length >= 3) v += 3;
    if (s.report.group.trim().length >= 1) v += 1;
    if (s.report.comment.trim().length >= 40) v += 4;
    if (s.report.exported || s.report.copied) v += 3;
    if (s.tester.tested && s.ends.A.crimped && s.ends.B.crimped) v += 4;
    return v;
  }

  function quizScore(s) {
    if (!s.quiz.checked) return 0;
    return D.QUIZ.reduce((sum, q) => {
      return sum + (s.quiz.answers[q.id] === q.correct ? 2 : 0);
    }, 0);
  }

  function gradeFor(score) {
    if (score >= 90) return { mark: 5, text: 'Отлично', tone: 'ok' };
    if (score >= 75) return { mark: 4, text: 'Хорошо', tone: 'ok' };
    if (score >= 60) return { mark: 3, text: 'Удовлетворительно', tone: 'warn' };
    return { mark: 2, text: 'Неудовлетворительно', tone: 'bad' };
  }

  function computeScore(s) {
    s = s || state;
    const parts = {
      order: { label: 'Правильность порядка жил', max: 30, value: orderScore(s) },
      quality: { label: 'Качество обжима', max: 25, value: qualityScore(s) },
      work: { label: 'Работоспособность', max: 20, value: functionScore(s) },
      report: { label: 'Оформление отчёта', max: 15, value: reportScore(s) },
      quiz: { label: 'Ответы на вопросы', max: 10, value: quizScore(s) }
    };
    let total = 0;
    Object.keys(parts).forEach((k) => {
      parts[k].value = Math.round(parts[k].value * 10) / 10;
      parts[k].percent = Math.round((parts[k].value / parts[k].max) * 100);
      total += parts[k].value;
    });
    total = Math.round(total);
    return { total: Math.min(100, Math.max(0, total)), parts: parts, grade: gradeFor(total) };
  }

  /* ---------- Сообщение для МЭШ ------------------------------------------ */
  function lmsPayload(s) {
    s = s || state;
    const sc = computeScore(s);
    return {
      type: 'LMS_SCORE',
      score: sc.total,
      maxScore: 100,
      percent: sc.total,
      grade: sc.grade.mark,
      gradeText: sc.grade.text,
      work: 'Обжим витой пары (Straight-Through, T568B)',
      standard: 'T568B',
      completed: !!(s.tester.tested && s.ends.A.crimped && s.ends.B.crimped),
      parts: Object.keys(sc.parts).reduce((acc, k) => {
        acc[k] = { value: sc.parts[k].value, max: sc.parts[k].max };
        return acc;
      }, {}),
      durationSec: Math.max(0, Math.round(((s.stats.finishedAt || Date.now()) - s.stats.startedAt) / 1000)),
      timestamp: new Date().toISOString()
    };
  }

  /* ---------- Экспорт ---------------------------------------------------- */
  global.AppState = {
    STORAGE_KEY,
    canStore,
    get,
    end,
    load,
    save,
    saveNow,
    reset,
    subscribe,
    emit,
    logEntry,
    readiness,
    endReadyForNext,
    computeScore,
    gradeFor,
    orderMatches,
    lmsPayload,
    freshState
  };
})(window);
