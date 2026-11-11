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
    roles: { picked: null, confirmed: false },
    charter: { c1: false, c2: false, c3: false },
    safety: { s1: false, s2: false, s3: false, s4: false, s5: false },
    kit: { picked: [], checked: false },
    theory: { answers: {}, checked: false },
    wires: { order: [], mistakes: 0, done: false },
    links: { answers: {}, done: false, attempts: 0 },
    ops: {},
    selfcheck: { k1: false, k2: false, k3: false, k4: false, k5: false },
    tester: { results: {}, attempts: 0 },
    teacher: { confirmed: false },
    journal: { rows: {}, defects: '' },
    questions: { q1: '', q2: '', q3: '', q4: '', q5: '' },
    questionsChecked: false,
    retro: { target: { was: 0, useful: 0, clear: 0 }, keep: '', fix: '', printed: false },
    report: { student: '', group: '', brigade: '', comment: '', printed: false, exported: false, copied: false },
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
  function blockOf(blockId) {
    for (let i = 0; i < D.EPISODES.length; i++) {
      const b = D.EPISODES[i].blocks.filter((x) => x.id === blockId)[0];
      if (b) return b;
    }
    return null;
  }

  function decision(id) {
    return get().decisions[id] || { answer: null, attempts: 0 };
  }

  function isCorrect(blockId, answerId) {
    const block = blockOf(blockId);
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
  function kitPerfect(s) {
    const block = blockOf('kit');
    if (!block) return false;
    return block.items.every((i) => (i.need ? s.kit.picked.indexOf(i.id) !== -1 : s.kit.picked.indexOf(i.id) === -1));
  }

  function kitScore(s) {
    if (!s.kit.checked) return 0;
    const block = blockOf('kit');
    const need = block.items.filter((i) => i.need).map((i) => i.id);
    const extra = block.items.filter((i) => !i.need).map((i) => i.id);
    const missed = need.filter((id) => s.kit.picked.indexOf(id) === -1).length;
    const wrong = extra.filter((id) => s.kit.picked.indexOf(id) !== -1).length;
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
    const block = blockOf('theory');
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

  function testedPorts(s) {
    s = s || get();
    return Object.keys(s.tester.results || {}).filter((k) => s.tester.results[k] === 'pass').length;
  }

  function workScore(s) {
    const passed = testedPorts(s);
    if (!passed) return 0;
    const base = Math.min(10, Math.round((passed / 8) * 10));
    return s.teacher.confirmed ? base + 10 : base;
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

  /** Заполнена ли журнальная строка порта: место + результат. */
  function journalFilled(s, port) {
    s = s || get();
    port = port == null ? 1 : port;
    port = port || 0;
    const row = (s.journal.rows || {})[port] || {};
    return (row.place || '').trim().length >= 3 && !!row.result;
  }

  function reportScore(s) {
    let v = 0;
    if (s.report.student.trim().length >= 3) v += 2;
    if (s.report.group.trim().length >= 1) v += 2;
    if (s.report.comment.trim().length >= 40) v += 4;
    if (s.report.exported || s.report.copied) v += 3;
    if (s.report.printed) v += 4;
    return Math.min(15, v);
  }

  function journalRowsFilled(s) {
    s = s || get();
    let n = 0;
    for (let p = 1; p <= 8; p += 1) if (journalFilled(s, p)) n += 1;
    return n;
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

  function safetyDone(s) {
    s = s || get();
    return !!(s.safety.s1 && s.safety.s2 && s.safety.s3 && s.safety.s4 && s.safety.s5);
  }

  function charterDone(s) {
    s = s || get();
    return !!(s.charter.c1 && s.charter.c2 && s.charter.c3);
  }

  function selfcheckDone(s) {
    s = s || get();
    return !!(s.selfcheck.k1 && s.selfcheck.k2 && s.selfcheck.k3 && s.selfcheck.k4 && s.selfcheck.k5);
  }

  function isDone(id, s) {
    s = s || get();
    switch (Number(id)) {
      case 1:
        return !!(s.decisions.start && s.decisions.start.ok) && !!s.intro.experience;
      case 2:
        return !!s.roles.picked && !!s.roles.confirmed && charterDone(s) && !!(s.decisions.plan && s.decisions.plan.ok);
      case 3:
        return safetyDone(s) && !!(s.decisions.case && s.decisions.case.ok) && s.kit.checked && kitPerfect(s);
      case 4:
        return !!(s.decisions.diag && s.decisions.diag.ok) && !!(s.decisions.escalate && s.decisions.escalate.ok);
      case 5:
        return s.theory.checked && s.wires.done && s.links.done;
      case 6:
        return opsDone(s) === D.OPS.length && selfcheckDone(s);
      case 7:
        return testedPorts(s) >= 8 && !!s.teacher.confirmed && journalRowsFilled(s) >= 8;
      case 8:
        return (
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
        if (!s.intro.experience) return 'отметьте уровень знакомства с панелью';
        return '';
      case 2:
        if (!s.roles.picked) return 'выберите роль в бригаде';
        if (!s.roles.confirmed) return 'подтвердите роль';
        if (!charterDone(s)) return 'заключите договор бригады — три пункта';
        if (!(s.decisions.plan && s.decisions.plan.ok)) return 'выберите, с чего начнёте на объекте';
        return '';
      case 3:
        if (!safetyDone(s)) return 'пройдите инструктаж — все пять пунктов';
        if (!(s.decisions.case && s.decisions.case.ok)) return 'разберите мини-кейс по безопасности';
        if (!s.kit.checked) return 'соберите инструмент и проверьте набор';
        if (!kitPerfect(s)) return 'в наборе есть лишнее или чего-то не хватает — поправьте и проверьте снова';
        return '';
      case 4:
        if (!(s.decisions.diag && s.decisions.diag.ok)) return 'поставьте диагноз линиям';
        if (!(s.decisions.escalate && s.decisions.escalate.ok)) return 'решите, как оформить чужой дефект';
        return '';
      case 5:
        if (!s.theory.checked) return 'ответьте на три вопроса о конструкции панели';
        if (!s.wires.done) return 'соберите порядок жил по B';
        if (!s.links.done) return 'заполните кросс-план по журналу';
        return '';
      case 6:
        if (opsDone(s) < D.OPS.length) return 'отметьте этапы карты: ' + opsDone(s) + ' из ' + D.OPS.length;
        if (!selfcheckDone(s)) return 'пройдите самоконтроль по чек-листу';
        return '';
      case 7:
        if (testedPorts(s) < 8) return 'отметьте результат теста по всем восьми портам: ' + testedPorts(s) + ' из 8';
        if (journalRowsFilled(s) < 8) return 'заполните журнал: ' + journalRowsFilled(s) + ' из 8 портов';
        if (!s.teacher.confirmed) return 'получите подтверждение мастера';
        return '';
      case 8:
        if (answersGiven(s) < D.QUESTIONS.length) return 'ответьте на контрольные вопросы';
        if (s.report.student.trim().length < 3 || s.report.group.trim().length < 1)
          return 'заполните ФИО и группу в акте';
        if (s.report.comment.trim().length < 40) return 'напишите вывод (не меньше 40 символов)';
        if (!s.retro.target.was) return 'поставьте оценки на рефлексивной мишени';
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

  function roleName(s) {
    s = s || get();
    const role = D.ROLES.filter((r) => r.id === s.roles.picked)[0];
    return role ? role.name : '—';
  }

  /* ---------- МЭШ --------------------------------------------------------- */
  function lmsPayload() {
    const s = get();
    const sc = computeScore(s);
    return {
      type: 'LMS_SCORE',
      score: sc.total,
      maxScore: 100,
      percent: sc.total,
      grade: sc.grade.mark,
      gradeText: sc.grade.text,
      work: 'Смена «Монтаж коммутационной панели» — ситуационная задача (T568B, Cat 6A)',
      standard: 'T568B',
      simulator: 'patch-panel',
      completed: !!s.finishedAt,
      parts: sc.parts,
      durationSec: elapsedSec(s),
      timestamp: new Date().toISOString()
    };
  }

  function sendToLMS() {
    const payload = lmsPayload();
    C.lms.send(payload);
    return payload;
  }

  /* ---------- Текст акта (структура по образцу ГОСТ) ---------------------- */
  function journalLines(s) {
    const out = [];
    for (let p = 1; p <= 8; p += 1) {
      const row = (s.journal.rows || {})[p] || {};
      out.push(
        '   ' +
          String(p).padStart(2, '0') +
          '  | ' +
          ((row.place || '—') + '').padEnd(22, ' ') +
          ' | ' +
          (row.result ? (row.result === 'pass' ? 'PASS  ' : 'FAIL  ') : '—     ')
      );
    }
    return out.join('\n');
  }

  function reportText() {
    const s = get();
    const sc = computeScore(s);
    const date = new Date().toLocaleString('ru-RU');
    const opsList = D.OPS.map((op) => '   [' + (s.ops[op.id] ? 'x' : ' ') + '] ' + op.title).join('\n');
    const t = s.retro.target;
    const target =
      '   Было интересно: ' + t.was + '/10 · Пригодится: ' + t.useful + '/10 · Понятность материала: ' + t.clear + '/10';
    return [
      'АКТ ВЫПОЛНЕННЫХ РАБОТ № ' + D.SHIFT.ticket,
      'Организация: ' + D.SHIFT.company + ', ' + D.SHIFT.unit,
      'Объект: ' + D.SHIFT.object,
      'Дата: ' + date,
      'Основание: заявка ' + D.SHIFT.ticket + ' («' + D.SHIFT.customer + '»)',
      'Исполнитель: ' + (s.report.student || '—') + ' · группа ' + (s.report.group || '—'),
      'Бригада: ' + (s.report.brigade || '—') + ' · роль: ' + roleName(s),
      '='.repeat(72),
      '1. СОСТАВ РАБОТ',
      '   1.1. Монтаж патч-панели ' + D.SHIFT.panel + ' в стойку ' + D.SHIFT.rack + ', позиция ' + D.SHIFT.position + '.',
      '   1.2. Заделка 8 портов по стандарту ' + D.SHIFT.standard + ', кабельный менеджмент, маркировка.',
      '   1.3. Тестирование линий, заполнение журнала кроссовой.',
      '',
      '2. ОПЕРАЦИОННАЯ КАРТА (отметки исполнителя)',
      opsList,
      '',
      '3. РЕЗУЛЬТАТЫ ИЗМЕРЕНИЙ ПО ПОРТАМ',
      '   Порт | Рабочее место         | Тест',
      journalLines(s),
      '',
      '4. ВЫЯВЛЕННЫЕ ДЕФЕКТЫ И ОТКЛОНЕНИЯ',
      '   ' + (s.journal.defects || '—'),
      '',
      '5. ОЦЕНКА ВЫПОЛНЕННЫХ РАБОТ',
      Object.keys(sc.parts)
        .map((k) => '   ' + sc.parts[k].label + ': ' + sc.parts[k].value + ' / ' + sc.parts[k].max)
        .join('\n'),
      '   ИТОГО: ' + sc.total + ' / 100 — ' + sc.grade.text + ' (оценка ' + sc.grade.mark + ')',
      '',
      '6. ВЫВОД',
      '   ' + (s.report.comment || '—'),
      '',
      '7. КОНТРОЛЬНЫЕ ВОПРОСЫ',
      D.QUESTIONS.map((q, i) => '   ' + (i + 1) + '. ' + q.text + '\n      Ответ: ' + (s.questions[q.id] || '—')).join('\n'),
      '',
      '8. РЕФЛЕКСИЯ (мишень)',
      target,
      '   Оставить: ' + (s.retro.keep || '—'),
      '   Изменить: ' + (s.retro.fix || '—'),
      '',
      'Исполнитель ______________________ / ' + (s.report.student || '') + ' /',
      'Мастер производственного обучения ______________________ / ' + D.CHARS.gusev.name + ' /',
      '',
      'Сформировано в тренажёре «Смена на узле связи».'
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
    answersGiven: answersGiven,
    safetyDone: safetyDone,
    selfcheckDone: selfcheckDone,
    journalFilled: journalFilled,
    journalRowsFilled: journalRowsFilled,
    testedPorts: testedPorts,
    roleName: roleName
  };
})(window);
