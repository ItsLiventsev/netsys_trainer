/* ==========================================================================
   state.js — состояние смены, правила завершения эпизодов, 100-балльная оценка
   и payload для МЭШ. Никакой отрисовки: только данные и арифметика.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const C = global.AppCore;

  const DEFAULTS = {
    version: 1,
    episode: 1,
    startedAt: 0,
    finishedAt: 0,
    decisions: {}, // id → { answer, attempts }
    intro: { experience: null },
    safety: { s1: false, s2: false, s3: false },
    kit: { picked: [], checked: false },
    theory: { answers: {}, checked: false },
    wires: { order: [], mistakes: 0, done: false },
    ops: {},
    tester: { result: null, attempts: 0 },
    teacher: { confirmed: false, name: '', comment: '' },
    questions: { q1: '', q2: '', q3: '', q4: '', q5: '' },
    questionsChecked: false,
    report: { student: '', group: '', object: '', comment: '', printed: false, exported: false, copied: false },
    ui: { theme: 'light', typedTicket: false }
  };

  const store = C.createStore({
    key: D.STORAGE_KEY,
    version: 1,
    defaults: DEFAULTS
  });

  const get = () => store.get();
  const save = () => store.save();
  const saveNow = () => store.saveNow();
  const reset = () => {
    store.reset();
    store.get().startedAt = Date.now();
    saveNow();
  };
  const log = (text) => {
    store.logEntry(text);
    save();
  };

  /* ---------- Мелкие помощники ------------------------------------------- */
  const optionOf = (blockId) => {
    for (let i = 0; i < D.EPISODES.length; i++) {
      const b = D.EPISODES[i].blocks.filter((x) => x.id === blockId)[0];
      if (b) return b;
    }
    return null;
  };

  function decision(id) {
    const s = get();
    return s.decisions[id] || { answer: null, attempts: 0 };
  }

  function isCorrect(blockId, answerId) {
    const block = optionOf(blockId);
    if (!block || !block.options) return false;
    const opt = block.options.filter((o) => o.id === answerId)[0];
    return !!(opt && opt.ok);
  }

  function answerChoice(blockId, answerId) {
    const s = get();
    const prev = decision(blockId);
    const ok = isCorrect(blockId, answerId);
    s.decisions[blockId] = {
      answer: ok ? answerId : prev.answer,
      last: answerId,
      attempts: prev.attempts + 1,
      ok: ok || prev.ok
    };
    save();
    log('Решение «' + blockId + '»: ' + (ok ? 'верно' : 'ошибка'));
    return ok;
  }

  /* ---------- Баллы ------------------------------------------------------- */
  /** Набор собран без лишнего и без пропусков. */
  function kitPerfect(s) {
    const block = optionOf('kit');
    return block.items.every((i) => (i.need ? s.kit.picked.indexOf(i.id) !== -1 : s.kit.picked.indexOf(i.id) === -1));
  }

  function kitScore(s) {
    if (!s.kit.checked || !kitPerfect(s)) return 0;
    const block = optionOf('kit');
    const picked = s.kit.picked;
    const need = block.items.filter((i) => i.need).map((i) => i.id);
    const extra = block.items.filter((i) => !i.need).map((i) => i.id);
    const missed = need.filter((id) => picked.indexOf(id) === -1).length;
    const wrong = extra.filter((id) => picked.indexOf(id) !== -1).length;
    return Math.max(0, 6 - missed * 2 - wrong * 3);
  }

  function diagScore(s) {
    const dec = s.decisions.diag;
    if (!dec || !dec.ok) return 0;
    if (dec.attempts <= 1) return 8;
    if (dec.attempts === 2) return 5;
    return 2;
  }

  function theoryScore(s) {
    if (!s.theory.checked) return 0;
    const block = optionOf('theory');
    return block.questions.reduce((sum, q) => {
      return sum + (s.theory.answers[q.id] === q.correct ? block.perQuestion : 0);
    }, 0);
  }

  function wiresScore(s) {
    if (!s.wires.done) return 0;
    return Math.max(0, 10 - s.wires.mistakes * 2);
  }

  function qualityScore(s) {
    return D.OPS.reduce((sum, op) => sum + (s.ops[op.id] ? op.points : 0), 0);
  }

  function workScore(s) {
    if (s.tester.result !== 'pass') return 0;
    return s.teacher.confirmed ? 20 : 10;
  }

  function questionScore(text) {
    const t = (text || '').trim();
    if (t.length >= 60) return 2;
    if (t.length >= 25) return 1;
    return 0;
  }

  function quizScore(s) {
    return D.QUESTIONS.reduce((sum, q) => sum + questionScore(s.questions[q.id]), 0);
  }

  function reportScore(s) {
    let v = 0;
    if (s.report.student.trim().length >= 3) v += 2;
    if (s.report.group.trim().length >= 1) v += 2;
    if (s.report.comment.trim().length >= 40) v += 4;
    if (s.report.exported || s.report.copied) v += 3;
    if (s.report.printed) v += 4;
    return v;
  }

  function gradeOf(total) {
    if (total >= 90) return { text: 'Отлично', mark: 5 };
    if (total >= 75) return { text: 'Хорошо', mark: 4 };
    if (total >= 60) return { text: 'Удовлетворительно', mark: 3 };
    return { text: 'Неудовлетворительно', mark: 2 };
  }

  function computeScore(s) {
    s = s || get();
    const parts = {
      wiring: { label: D.RUBRIC[0].label, max: 30, value: kitScore(s) + diagScore(s) + wiresScore(s) + theoryScore(s) },
      quality: { label: D.RUBRIC[1].label, max: 25, value: qualityScore(s) },
      work: { label: D.RUBRIC[2].label, max: 20, value: workScore(s) },
      report: { label: D.RUBRIC[3].label, max: 15, value: reportScore(s) },
      quiz: { label: D.RUBRIC[4].label, max: 10, value: quizScore(s) }
    };
    const total = Object.keys(parts).reduce((sum, k) => sum + parts[k].value, 0);
    return { parts: parts, total: Math.round(total), grade: gradeOf(total) };
  }

  /* ---------- Прогресс по эпизодам --------------------------------------- */
  function opsDone(s) {
    return D.OPS.filter((op) => s.ops[op.id]).length;
  }

  function answersGiven(s) {
    return D.QUESTIONS.filter((q) => (s.questions[q.id] || '').trim().length >= 25).length;
  }

  function isDone(id, s) {
    s = s || get();
    switch (Number(id)) {
      case 1:
        return !!(s.decisions.start && s.decisions.start.ok) && !!s.intro.experience;
      case 2:
        return !!(s.decisions.plan && s.decisions.plan.ok);
      case 3:
        return s.safety.s1 && s.safety.s2 && s.safety.s3 && s.kit.checked && kitPerfect(s);
      case 4:
        return !!(s.decisions.diag && s.decisions.diag.ok);
      case 5:
        return s.theory.checked && s.wires.done;
      case 6:
        return opsDone(s) === D.OPS.length;
      case 7:
        return (
          !!s.tester.result &&
          s.report.student.trim().length >= 3 &&
          s.report.group.trim().length >= 1 &&
          s.report.comment.trim().length >= 40 &&
          answersGiven(s) === D.QUESTIONS.length &&
          !!s.finishedAt
        );
      default:
        return false;
    }
  }

  /** Что осталось сделать в эпизоде — короткая подсказка для кнопки «дальше». */
  function pending(id, s) {
    s = s || get();
    switch (Number(id)) {
      case 1:
        if (!(s.decisions.start && s.decisions.start.ok)) return 'ответьте, с чего начинается смена';
        if (!s.intro.experience) return 'отметьте свой уровень знакомства с розеткой';
        return '';
      case 2:
        return 'выберите, с чего начнёте на объекте';
      case 3:
        if (!(s.safety.s1 && s.safety.s2 && s.safety.s3)) return 'пройдите инструктаж — все три пункта';
        if (!s.kit.checked) return 'соберите инструмент и проверьте набор';
        if (!kitPerfect(s)) return 'в наборе есть лишнее или чего-то не хватает — поправьте и проверьте снова';
        return '';
      case 4:
        return 'поставьте диагноз линии';
      case 5:
        if (!s.theory.checked) return 'ответьте на три вопроса о IDC и свивке';
        if (!s.wires.done) return 'соберите порядок жил по B';
        return '';
      case 6:
        return 'отметьте этапы: ' + opsDone(s) + ' из ' + D.OPS.length;
      case 7:
        if (!s.tester.result) return 'запишите результат теста линии';
        if (answersGiven(s) < D.QUESTIONS.length) return 'ответьте на контрольные вопросы';
        if (s.report.student.trim().length < 3 || s.report.group.trim().length < 1)
          return 'заполните ФИО и группу';
        if (s.report.comment.trim().length < 40) return 'напишите вывод (не меньше 40 символов)';
        return '';
    }
    return '';
  }

  function completedCount(s) {
    s = s || get();
    return D.EPISODES.filter((e) => isDone(e.id, s)).length;
  }

  function elapsedSec(s) {
    s = s || get();
    const start = s.startedAt || Date.now();
    const end = s.finishedAt || Date.now();
    return Math.max(0, Math.round((end - start) / 1000));
  }

  function fmtDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s2 = sec % 60;
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    return h ? h + ':' + pad(m) + ':' + pad(s2) : pad(m) + ':' + pad(s2);
  }

  /* ---------- МЭШ --------------------------------------------------------- */
  function lmsPayload() {
    const s = get();
    const sc = computeScore(s);
    const dur = elapsedSec(s);
    return {
      type: 'LMS_SCORE',
      score: sc.total,
      maxScore: 100,
      percent: sc.total,
      grade: sc.grade.mark,
      gradeText: sc.grade.text,
      work: 'Смена «Монтаж сетевых розеток» — ситуационная задача (T568B)',
      standard: 'T568B',
      simulator: 'socket-quest',
      completed: !!s.finishedAt,
      parts: sc.parts,
      durationSec: dur,
      timestamp: new Date().toISOString()
    };
  }

  function sendToLMS() {
    const payload = lmsPayload();
    C.lms.send(payload);
    return payload;
  }

  /* ---------- Текст отчёта для выгрузки ---------------------------------- */
  function reportText() {
    const s = get();
    const sc = computeScore(s);
    const date = new Date().toLocaleString('ru-RU');
    const opsList = D.OPS.map((op) => '   ' + (s.ops[op.id] ? '[x]' : '[ ]') + ' ' + op.title).join('\n');
    return [
      'АКТ ВЫПОЛНЕННЫХ РАБОТ · ' + D.SHIFT.company,
      'Смена: ' + D.SHIFT.unit,
      'Объект: ' + (s.report.object || D.SHIFT.object),
      'Заявка: ' + D.SHIFT.ticket,
      '='.repeat(60),
      'Исполнитель: ' + (s.report.student || '—'),
      'Группа: ' + (s.report.group || '—'),
      'Дата: ' + date,
      '',
      '1. РЕЗУЛЬТАТ ПО ЗАЯВКЕ',
      '   Р-3: диагностика — ' + (s.decisions.diag && s.decisions.diag.ok ? 'перекрёст A/B (1-3, 2-6)' : 'не определена'),
      '   Р-4: смонтирована по T568B',
      '   Тест линии: ' + (s.tester.result === 'pass' ? 'PASS — 8 жил по порядку' : s.tester.result ? 'FAIL — ' + s.tester.result : 'нет данных'),
      '   Подтверждение мастера: ' + (s.teacher.confirmed ? 'да' : 'ожидается'),
      '',
      '2. ОПЕРАЦИОННАЯ КАРТА',
      opsList,
      '',
      '3. ОЦЕНКА',
      Object.keys(sc.parts)
        .map((k) => '   ' + sc.parts[k].label + ': ' + sc.parts[k].value + ' / ' + sc.parts[k].max)
        .join('\n'),
      '   ИТОГО: ' + sc.total + ' / 100 — ' + sc.grade.text + ' (оценка ' + sc.grade.mark + ')',
      '',
      '4. ВЫВОД',
      '   ' + (s.report.comment || '—'),
      '',
      '5. КОНТРОЛЬНЫЕ ВОПРОСЫ',
      D.QUESTIONS.map((q, i) => '   ' + (i + 1) + '. ' + q.text + '\n      Ответ: ' + (s.questions[q.id] || '—')).join('\n'),
      '',
      'Сформировано в квесте «Смена в СетьПолисе».'
    ].join('\n');
  }

  global.AppState = {
    get: get,
    load: () => store.load(),
    save: save,
    saveNow: saveNow,
    reset: reset,
    subscribe: store.subscribe,
    log: log,
    canStore: store.canStore,
    STORAGE_KEY: D.STORAGE_KEY,
    decision: decision,
    answerChoice: answerChoice,
    isCorrect: isCorrect,
    computeScore: computeScore,
    isDone: isDone,
    pending: pending,
    kitPerfect: kitPerfect,
    completedCount: completedCount,
    gradeOf: gradeOf,
    elapsedSec: elapsedSec,
    fmtDuration: fmtDuration,
    lmsPayload: lmsPayload,
    sendToLMS: sendToLMS,
    reportText: reportText,
    opsDone: opsDone,
    answersGiven: answersGiven
  };
})(window);
