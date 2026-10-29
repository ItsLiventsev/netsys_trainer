/* ==========================================================================
   state.js — модель тренажёра «Монтаж сетевых розеток»: состояние,
   сохранение прогресса, подсчёт баллов и payload для МЭШ.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const C = global.AppCore;

  const STORAGE_KEY = 'netsys.socket.state.v1';
  const VERSION = 1;

  function emptyContacts() {
    return new Array(8).fill(null);
  }

  function emptyPunched() {
    return new Array(8).fill(false);
  }

  /* ---------- Начальное состояние ---------------------------------------- */
  function defaults() {
    return {
      version: VERSION,
      mode: 'training',
      step: 1,
      kit: { selected: [], checked: false, mistakes: 0, checkedOnce: false },
      prep: { loaded: false, done: false, lengthCm: 0, attempts: 0, wiresStripped: false },
      contacts: emptyContacts(),
      punched: emptyPunched(),
      wrongDrops: 0,
      usedCrimper: false,
      mount: { tie: false, module: false, screws: [false, false], overtight: 0 },
      tester: { plugged: { main: false, remote: false }, tested: false, result: null, inspected: false, link: false },
      quiz: { answers: {}, checked: false },
      report: { student: '', group: '', comment: '', exported: false, copied: false },
      ui: { activeTool: null, hintOpen: false, mobilePane: 'stage' },
      stats: { startedAt: Date.now(), finishedAt: null, stripRetries: 0 },
      log: []
    };
  }

  const store = C.createStore({ key: STORAGE_KEY, version: VERSION, defaults: defaults() });
  const canStore = store.canStore;

  function get() {
    return store.get();
  }

  /* ---------- Вспомогательные выборки ------------------------------------ */
  function contactByIdx(i) {
    return D.MODULE_CONTACTS[i];
  }

  function pinOfWire(wireId) {
    const c = D.MODULE_CONTACTS.filter((x) => x.wire === wireId)[0];
    return c ? c.pin : null;
  }

  function filledCount(s) {
    return s.contacts.filter(Boolean).length;
  }

  function punchedCount(s) {
    return s.punched.filter(Boolean).length;
  }

  function allPunched(s) {
    return punchedCount(s) === 8;
  }

  function kitCorrect(s) {
    const required = D.KIT.filter((k) => k.required).map((k) => k.id);
    const selected = s.kit.selected.slice();
    if (selected.length !== required.length) return false;
    return required.every((id) => selected.indexOf(id) !== -1);
  }

  function mountDone(s) {
    return s.mount.tie && s.mount.module && s.mount.screws[0] && s.mount.screws[1];
  }

  function allWiresCorrect(s) {
    let n = 0;
    D.MODULE_CONTACTS.forEach((c, i) => {
      if (s.contacts[i] === c.wire) n += 1;
    });
    return n;
  }

  /* ---------- Готовность шагов ------------------------------------------ */
  function readiness(s) {
    s = s || get();
    const r = { 1: true, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false };
    r[2] = s.kit.checked;
    r[3] = r[2] && s.prep.done;
    r[4] = r[3] && filledCount(s) === 8;
    r[5] = r[4] && allPunched(s);
    r[6] = r[5] && mountDone(s);
    r[7] = r[6] && s.tester.tested;
    return r;
  }

  /* ---------- Проверка линии -------------------------------------------- */
  function computeContinuity(s) {
    s = s || get();
    const pairs = [];

    for (let pin = 1; pin <= 8; pin++) {
      const contact = D.MODULE_CONTACTS.filter((c) => c.pin === pin)[0];
      const wire = contact ? s.contacts[contact.idx] : null;
      const punched = contact ? !!s.punched[contact.idx] : false;
      if (!wire || !punched) {
        pairs.push({ a: pin, b: null, wire: wire });
        continue;
      }
      const b = pinOfWire(wire);
      pairs.push({ a: pin, b: b, wire: wire });
    }

    // зачищенные жилы дают ненадёжный контакт в IDC: синяя пара «отваливается»
    if (s.prep.wiresStripped) {
      pairs.forEach((p, i) => {
        if (p.b && (p.wire === 'S' || p.wire === 'BS')) {
          pairs[i] = { a: p.a, b: null, wire: p.wire };
        }
      });
    }

    const crossover = pairs.filter((p) => p.b && p.b !== p.a);
    const opens = pairs.filter((p) => !p.b);
    const connectedNow = pairs.filter((p) => p.b).length;
    const straightNow = pairs.filter((p) => p.b && p.b === p.a).length;
    const straight = straightNow === 8;
    const qualityOk =
      allPunched(s) &&
      s.prep.done &&
      s.prep.lengthCm >= D.SETTINGS.stripMinCm &&
      s.prep.lengthCm <= D.SETTINGS.stripMaxCm &&
      mountDone(s);

    return {
      pairs: pairs,
      connected: connectedNow,
      straightPins: straightNow,
      straight: straight,
      crossover: crossover,
      opens: opens,
      ok: straight && connectedNow === 8 && qualityOk
    };
  }

  /* ---------- Баллы ------------------------------------------------------ */
  function wiringScore(s) {
    const correct = allWiresCorrect(s);
    const base = (30 * correct) / 8;
    if (s.mode === 'training') return Math.max(0, base - s.wrongDrops * 3);
    return base;
  }

  function stripPoints(s) {
    if (!s.prep.done) return 0;
    const len = s.prep.lengthCm;
    if (len >= D.SETTINGS.stripMinCm && len <= D.SETTINGS.stripMaxCm) return 4;
    if (len >= D.SETTINGS.stripMinCm - 0.2 && len <= D.SETTINGS.stripMaxCm + 0.2) return 2.5;
    return 0.5;
  }

  function qualityScore(s) {
    let v = 0;
    if (s.kit.checked) v += s.kit.mistakes === 0 ? 3 : 1.5;
    v += stripPoints(s);
    v += (8 * punchedCount(s)) / 8;
    if (s.mount.tie) v += 3;
    if (s.mount.module) v += 4;
    if (s.mount.screws[0] && s.mount.screws[1]) v += 3;
    return Math.min(25, v);
  }

  function workScore(s) {
    const r = s.tester.result;
    if (!s.tester.tested || !r) return 0;
    if (r.ok) return 20;
    if (r.straight) return Math.max(6, (20 * r.connected) / 8);
    return Math.max(4, (12 * r.straightPins) / 8);
  }

  function reportScore(s) {
    let v = 0;
    if (s.report.student.trim().length >= 3) v += 3;
    if (s.report.group.trim().length >= 1) v += 1;
    if (s.report.comment.trim().length >= 40) v += 4;
    if (s.report.exported || s.report.copied) v += 3;
    if (s.tester.tested && mountDone(s)) v += 4;
    return v;
  }

  function quizScore(s) {
    if (!s.quiz.checked) return 0;
    return D.QUIZ.reduce((sum, q) => sum + (s.quiz.answers[q.id] === q.correct ? 2 : 0), 0);
  }

  function gradeFor(score) {
    if (score >= 90) return { mark: 5, text: 'Отлично', tone: 'ok' };
    if (score >= 75) return { mark: 4, text: 'Хорошо', tone: 'ok' };
    if (score >= 60) return { mark: 3, text: 'Удовлетворительно', tone: 'warn' };
    return { mark: 2, text: 'Неудовлетворительно', tone: 'bad' };
  }

  function computeScore(s) {
    s = s || get();
    const parts = {
      wiring: { label: 'Разделка по маркировке B', max: 30, value: wiringScore(s) },
      quality: { label: 'Качество монтажа', max: 25, value: qualityScore(s) },
      work: { label: 'Работоспособность', max: 20, value: workScore(s) },
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
    return { total: Math.min(100, Math.max(0, total)), max: 100, parts: parts, grade: gradeFor(total) };
  }

  /* ---------- Payload для МЭШ ------------------------------------------- */
  function lmsPayload(s) {
    s = s || get();
    const sc = computeScore(s);
    return {
      type: 'LMS_SCORE',
      score: sc.total,
      maxScore: 100,
      percent: sc.total,
      grade: sc.grade.mark,
      gradeText: sc.grade.text,
      work: 'Монтаж сетевой розетки RJ-45 (T568B)',
      standard: 'T568B',
      simulator: 'network-socket',
      completed: !!(s.tester.tested && mountDone(s) && allPunched(s)),
      parts: Object.keys(sc.parts).reduce((acc, k) => {
        acc[k] = { value: sc.parts[k].value, max: sc.parts[k].max };
        return acc;
      }, {}),
      durationSec: Math.max(0, Math.round(((s.stats.finishedAt || Date.now()) - s.stats.startedAt) / 1000)),
      timestamp: new Date().toISOString()
    };
  }

  /* ---------- Сброс ------------------------------------------------------ */
  function reset() {
    return store.reset();
  }

  global.AppState = {
    STORAGE_KEY,
    canStore,
    defaults,
    get,
    load: store.load,
    save: store.save,
    saveNow: store.saveNow,
    reset,
    logEntry: (text) => {
      store.logEntry(text);
    },
    contactByIdx,
    pinOfWire,
    filledCount,
    punchedCount,
    allPunched,
    allWiresCorrect,
    kitCorrect,
    mountDone,
    readiness,
    computeContinuity,
    computeScore,
    gradeFor,
    lmsPayload
  };
})(window);
