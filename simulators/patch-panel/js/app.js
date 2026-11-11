/* ==========================================================================
   app.js — сборка квеста «Смена на узле связи»: навигация по эпизодам,
   шапка и рельс, тема, таймер смены и тайм-бокс ротации, печать задания
   и акта, связь с МЭШ.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const C = global.AppCore;
  const S = global.AppState;
  const R = global.AppRender;

  let clockTimer = null;
  let rotateTimer = null;
  let rotateLeft = 20 * 60;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Тема -------------------------------------------------------- */
  function applyTheme(theme) {
    const value = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', value);
    const btn = $('#theme-btn');
    if (btn) {
      btn.textContent = value === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', value === 'dark' ? 'Светлая тема' : 'Тёмная тема');
    }
  }

  function toggleTheme() {
    const s = S.get();
    s.ui.theme = s.ui.theme === 'dark' ? 'light' : 'dark';
    S.saveNow();
    applyTheme(s.ui.theme);
  }

  /* ---------- Границы доступа -------------------------------------------- */
  function blockById(id) {
    for (let i = 0; i < D.EPISODES.length; i += 1) {
      const found = D.EPISODES[i].blocks.filter((b) => b.id === id)[0];
      if (found) return found;
    }
    return null;
  }

  function frontier(s) {
    const first = D.EPISODES.filter((e) => !S.isDone(e.id, s))[0];
    return first ? first.id : D.EPISODES.length;
  }

  function go(id) {
    const s = S.get();
    const target = Math.min(D.EPISODES.length, Math.max(1, Number(id) || 1));
    if (target > frontier(s)) {
      C.toast('warn', 'Эпизод пока закрыт', 'Сначала закончите текущий: ' + S.pending(s.episode, s));
      return;
    }
    s.episode = target;
    S.save();
    render({ enter: true, scrollTop: true });
  }

  /* ---------- Отрисовка --------------------------------------------------- */
  function safeScroll(args) {
    try {
      if (typeof global.scrollTo === 'function') global.scrollTo(args);
    } catch (e) {
      /* прокрутка — украшение, а не логика */
    }
  }

  const FOCUS_ATTRS = ['data-choice', 'data-opt', 'data-survey', 'data-kit', 'data-wire', 'data-tester', 'data-port', 'data-act', 'data-op', 'data-role', 'data-link', 'data-target'];

  function focusKey(node) {
    if (!node || !node.getAttribute) return '';
    const root = $('#episode-root');
    if (!root || !root.contains(node)) return '';
    return FOCUS_ATTRS.filter((a) => node.getAttribute(a) !== null)
      .map((a) => '[' + a + '="' + String(node.getAttribute(a)).replace(/"/g, '\\"') + '"]')
      .join('');
  }

  function restoreFocus(key) {
    if (!key) return;
    const root = $('#episode-root');
    let node = null;
    try {
      node = root.querySelector(key);
    } catch (e) {
      node = null;
    }
    if (node && !node.disabled) {
      node.focus({ preventScroll: true });
      return;
    }
    const block = node ? node.closest('.q-block') : root.querySelector('.q-block');
    if (block) {
      block.setAttribute('tabindex', '-1');
      block.focus({ preventScroll: true });
    }
  }

  function render(opts) {
    const o = opts || {};
    const s = S.get();
    const ep = D.EPISODES[s.episode - 1];
    const root = $('#episode-root');
    if (!root) return;

    const y = global.scrollY;
    const focus = focusKey(document.activeElement);
    const scrollPos = {};
    $$('textarea, input[type="text"]', root).forEach((n) => {
      scrollPos[(n.getAttribute('data-question') || n.getAttribute('data-report') || n.getAttribute('data-journal') || '') + ':' + (n.getAttribute('data-port') || '')] = n.scrollTop;
    });
    root.innerHTML = R.renderEpisode(ep, s);
    $$('textarea, input[type="text"]', root).forEach((n) => {
      const key = (n.getAttribute('data-question') || n.getAttribute('data-report') || n.getAttribute('data-journal') || '') + ':' + (n.getAttribute('data-port') || '');
      if (scrollPos[key]) n.scrollTop = scrollPos[key];
    });
    root.classList.toggle('is-quiet', !o.enter);
    renderRail(s);
    renderChrome(s);
    if (o.scrollTop) safeScroll({ top: 0, behavior: C.reducedMotion() ? 'auto' : 'smooth' });
    else safeScroll({ top: y });
    if (!o.enter) restoreFocus(focus);
    paintRotate();
  }

  function renderRail(s) {
    const rail = $('#rail-list');
    if (!rail) return;
    rail.innerHTML = D.EPISODES.map((ep) => {
      const done = S.isDone(ep.id, s);
      const current = ep.id === s.episode;
      const locked = ep.id > frontier(s);
      return (
        '<li>' +
        '<button type="button" class="rail-item' + (current ? ' is-current' : '') +
        (done ? ' is-done' : '') + (locked ? ' is-locked' : '') + '" data-ep="' + ep.id + '"' +
        (locked ? ' disabled' : '') + '>' +
        '<span class="rail-item__num">' + (done ? '✓' : ep.id) + '</span>' +
        '<span class="rail-item__label">' + C.esc(ep.label) + '</span>' +
        '</button></li>'
      );
    }).join('');

    $$('[data-ep]', rail).forEach((btn) => {
      btn.addEventListener('click', () => go(Number(btn.getAttribute('data-ep'))));
    });
  }

  function renderChrome(s) {
    const sc = S.computeScore(s);
    const total = $('#score-chip');
    if (total) total.textContent = sc.total + ' / 100';

    const roleChip = $('#role-chip');
    if (roleChip) roleChip.textContent = s.roles.picked ? S.roleName(s) : 'роль не выбрана';

    const doneCount = S.completedCount(s);
    const fill = $('#progress-fill');
    if (fill) fill.style.setProperty('--p', String(doneCount / D.EPISODES.length));
    const label = $('#progress-label');
    if (label) label.textContent = doneCount + ' из ' + D.EPISODES.length + ' эпизодов';

    const prev = $('#prev-btn');
    const next = $('#next-btn');
    const unlock = $('#unlock-btn');
    if (prev) prev.disabled = s.episode <= 1;
    if (next) {
      const done = S.isDone(s.episode, s);
      next.disabled = !done || s.episode >= D.EPISODES.length;
      next.textContent = s.episode >= D.EPISODES.length ? 'Смена закрыта' : done ? 'Дальше →' : 'Дальше';
    }
    if (unlock) {
      const pend = S.pending(s.episode, s);
      unlock.textContent = pend ? 'Чтобы дальше: ' + pend : '';
      unlock.hidden = !pend || S.isDone(s.episode, s);
    }
  }

  /* ---------- Тайм-бокс ротации ------------------------------------------- */
  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s2 = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s2 < 10 ? '0' + s2 : s2);
  }

  function paintRotate() {
    const left = $('#rotate-left');
    const big = $('#rotate-clock');
    const text = fmt(rotateLeft);
    if (left) left.textContent = text;
    if (big) big.textContent = text;
  }

  function startRotate() {
    const btn = $('#timer-toggle');
    if (rotateTimer) {
      global.clearInterval(rotateTimer);
      rotateTimer = null;
      if (btn) btn.textContent = 'Продолжить';
      return;
    }
    if (btn) btn.textContent = 'Пауза';
    rotateTimer = global.setInterval(() => {
      rotateLeft = Math.max(0, rotateLeft - 1);
      paintRotate();
      if (rotateLeft === 0) {
        global.clearInterval(rotateTimer);
        rotateTimer = null;
        C.toast('warn', 'Тайм-бокс вышел', 'Бригады меняются зонами: передайте инструмент, журнал и незакрытый этап.');
      }
    }, 1000);
  }

  function resetRotate() {
    if (rotateTimer) {
      global.clearInterval(rotateTimer);
      rotateTimer = null;
    }
    rotateLeft = 20 * 60;
    const btn = $('#timer-toggle');
    if (btn) btn.textContent = 'Старт';
    paintRotate();
  }

  /* ---------- Действия в эпизоде ----------------------------------------- */
  function onClick(ev) {
    const s = S.get();
    if (!ev.target || !ev.target.closest) return;
    const t = ev.target.closest(
      '[data-choice],[data-survey],[data-kit],[data-wire],[data-tester],[data-role],[data-link],[data-target],[data-print],button[data-act]'
    );
    if (!t || t.disabled) return;

    /* решения */
    if (t.hasAttribute('data-choice')) {
      const id = t.getAttribute('data-choice');
      const ok = S.answerChoice(id, t.getAttribute('data-opt'));
      render({});
      if (ok) C.toast('ok', 'Решение верное', 'Эпизод можно закрывать.');
      else C.toast('error', 'Не то', 'Прочитайте разбор и попробуйте снова.');
      return;
    }

    /* печать акта из блока рефлексии: не трогает остальные поля */
    if (t.hasAttribute('data-print')) {
      printDoc(t.getAttribute('data-print'));
      return;
    }

    /* результат теста по порту */
    if (t.hasAttribute('data-tester')) {
      const port = t.getAttribute('data-port');
      s.tester.results[port] = t.getAttribute('data-tester');
      s.tester.attempts += 1;
      S.log('Тест порта ' + port + ': ' + s.tester.results[port]);
      S.save();
      render({});
      if (s.tester.results[port] === 'pass') C.toast('ok', 'Порт ' + port + ' — PASS', 'Жилы по порядку, перекрёста нет.');
      else C.toast('error', 'Порт ' + port + ' — дефект', 'Внесите дефект в журнал и переделайте до приёмки.');
      return;
    }

    /* знакомство */
    if (t.hasAttribute('data-survey')) {
      s.intro.experience = t.getAttribute('data-opt');
      S.save();
      render({});
      return;
    }

    /* роль в бригаде */
    if (t.hasAttribute('data-role')) {
      s.roles.picked = t.getAttribute('data-role');
      s.roles.confirmed = false;
      S.save();
      render({});
      return;
    }

    /* кросс-план */
    if (t.hasAttribute('data-link')) {
      const id = t.getAttribute('data-link');
      const pair = D.LINKS.pairs.filter((p) => p.id === id)[0];
      if (!pair || s.links.answers[id] === pair.expect) return; // верный ответ уже зафиксирован
      const port = t.getAttribute('data-port');
      s.links.answers[id] = port;
      s.links.attempts += 1;
      const allOk = D.LINKS.pairs.every((p) => s.links.answers[p.id] === p.expect);
      s.links.done = allOk;
      S.log('Кросс-план ' + id + ': ' + port + (port === pair.expect ? ' верно' : ' ошибка'));
      S.save();
      render({});
      if (port === pair.expect) C.toast('ok', 'Сходится', 'Порт выбран верно.');
      else C.toast('error', 'Не сходится', 'Сверьтесь с журналом: нумерация не всегда идёт подряд.');
      return;
    }

    /* рефлексивная мишень */
    if (t.hasAttribute('data-target')) {
      s.retro.target[t.getAttribute('data-target')] = Number(t.getAttribute('data-val'));
      S.save();
      render({});
      return;
    }

    /* набор инструмента */
    if (t.hasAttribute('data-kit')) {
      const id = t.getAttribute('data-kit');
      const i = s.kit.picked.indexOf(id);
      if (i === -1) s.kit.picked.push(id);
      else s.kit.picked.splice(i, 1);
      S.save();
      render({});
      return;
    }

    /* жилы: порядок контактов */
    if (t.hasAttribute('data-wire')) {
      const id = t.getAttribute('data-wire');
      const expected = D.WIRE_ORDER[s.wires.order.length];
      if (id === expected) {
        s.wires.order.push(id);
        if (s.wires.order.length === 8) {
          s.wires.done = true;
          S.log('Раскладка по B собрана, ошибок: ' + s.wires.mistakes);
          S.save();
          render({});
          C.toast('ok', 'Линия собрана по B', s.wires.mistakes ? 'Ошибок: ' + s.wires.mistakes : 'Без ошибок.');
        } else {
          S.save();
          render({});
          C.announce('Контакт ' + s.wires.order.length + ' занят. Следующий — ' + (s.wires.order.length + 1) + '.');
        }
      } else {
        s.wires.mistakes += 1;
        S.save();
        render({});
        C.toast('error', 'Не по порядку', 'Контакт ' + (s.wires.order.length + 1) + ' ждёт другую жилу.');
      }
      return;
    }

    /* кнопки действий */
    const act = t.getAttribute('data-act');
    switch (act) {
      case 'role-confirm':
        s.roles.confirmed = true;
        S.save();
        render({});
        C.toast('info', 'Роль закреплена', S.roleName(s) + ' — зона ответственности на эту смену.');
        break;
      case 'kit-check':
        s.kit.checked = true;
        S.save();
        render({});
        C.toast('info', 'Набор проверен', 'Разбор — под карточками инструмента.');
        break;
      case 'theory-check': {
        const theory = blockById('theory');
        const answered = theory ? theory.questions.filter((q) => !!s.theory.answers[q.id]).length : 0;
        if (theory && answered < theory.questions.length) {
          C.toast('warn', 'Ответьте на все вопросы', 'Осталось: ' + (theory.questions.length - answered) + '.');
          break;
        }
        s.theory.checked = true;
        S.save();
        render({});
        break;
      }
      case 'wires-reset':
        s.wires = { order: [], mistakes: s.wires.mistakes + 1, done: false };
        S.save();
        render({});
        break;
      case 'questions-check':
        s.questionsChecked = true;
        S.save();
        render({});
        C.toast('info', 'Открыты модельные ответы', 'Сравните формулировки, а не буквы.');
        break;
      case 'timer-start':
        startRotate();
        break;
      case 'timer-reset':
        resetRotate();
        break;
      case 'export':
        exportReport();
        break;
      case 'copy':
        copyReport();
        break;
      case 'print-act':
        printDoc('act');
        break;
      case 'finish':
        finish();
        break;
      case 'lms':
        S.sendToLMS();
        C.toast('ok', 'Оценка отправлена', 'LMS_SCORE ушёл в родительское окно МЭШ.');
        break;
      case 'restart':
        restart();
        break;
      default:
        break;
    }
  }

  /** Обновляет карту операций на месте: без перерисовки всего эпизода. */
  function updateOps() {
    const s = S.get();
    const block = $('[data-block="ops"]');
    if (!block) return;
    const bar = $('.ops-progress__bar > span', block);
    const done = S.opsDone(s);
    if (bar) bar.style.setProperty('--p', String(done / D.OPS.length));
    const meta = $('.ops-progress .q-meta', block);
    if (meta) meta.textContent = done + ' из ' + D.OPS.length + ' этапов';
    $$('.op', block).forEach((li, i) => {
      const input = $('input[data-op]', li);
      const on = !!(input && input.checked);
      li.classList.toggle('is-done', on);
      const prevDone = i === 0 || !!(s.ops[D.OPS[i - 1].id]);
      const locked = !prevDone && !on;
      li.classList.toggle('is-locked', locked);
      if (input) input.disabled = locked;
    });
  }

  function onInput(ev) {
    const s = S.get();
    const t = ev.target;

    if (t.hasAttribute && t.hasAttribute('data-question')) {
      const id = t.getAttribute('data-question');
      s.questions[id] = t.value;
      S.save();
      const foot = t.parentElement.querySelector('.qa__foot .q-meta');
      if (foot) {
        const len = t.value.trim().length;
        foot.textContent = t.value.length + ' символов · ' + (len >= 60 ? '2 б.' : len >= 25 ? '1 б.' : '0 б.');
      }
      renderChrome(s);
      return;
    }

    if (t.hasAttribute && t.hasAttribute('data-journal')) {
      const port = t.getAttribute('data-port');
      const field = t.getAttribute('data-journal');
      s.journal.rows[port] = s.journal.rows[port] || {};
      s.journal.rows[port][field] = t.value;
      S.save();
      renderChrome(s);
      return;
    }

    if (t.hasAttribute && t.hasAttribute('data-report')) {
      const key = t.getAttribute('data-report');
      if (key === 'keep' || key === 'fix') s.retro[key] = t.value;
      else if (key === 'defects') s.journal.defects = t.value;
      else s.report[key] = t.value;
      S.save();
      if (key === 'comment') {
        const meta = t.parentElement.querySelector('.q-meta');
        if (meta) meta.textContent = t.value.trim().length + ' символов';
      }
      renderChrome(s);
    }
  }

  function onChange(ev) {
    const s = S.get();
    const t = ev.target;

    if (t.hasAttribute('data-safety')) {
      s.safety[t.getAttribute('data-safety')] = t.checked;
      S.save();
      const section = t.closest('[data-block="safety"]');
      if (section) {
        section.classList.toggle('is-complete', S.safetyDone(s));
        if (S.safetyDone(s)) C.announce('Допуск получен. Можно собирать инструмент.');
      }
      renderChrome(s);
      return;
    }

    if (t.hasAttribute('data-group')) {
      const group = t.getAttribute('data-group');
      const target = s[group];
      if (target) target[t.getAttribute('data-tick')] = t.checked;
      S.save();
      const section = t.closest('[data-block="' + group + '"]');
      const all =
        group === 'selfcheck' ? S.selfcheckDone(s) : group === 'charter'
          ? !!(s.charter.c1 && s.charter.c2 && s.charter.c3)
          : S.safetyDone(s);
      if (section) section.classList.toggle('is-complete', all);
      renderChrome(s);
      return;
    }

    if (t.hasAttribute('data-journal')) {
      const port = t.getAttribute('data-port');
      s.journal.rows[port] = s.journal.rows[port] || {};
      s.journal.rows[port][t.getAttribute('data-journal')] = t.value;
      S.save();
      S.log('Журнал, порт ' + port + ': ' + t.value);
      const block = t.closest('[data-block="journal"]');
      const hint = block ? $('.q-hint', block) : null;
      if (hint) hint.textContent = 'Одно и то же имя — на панели, на бирке кабеля и в этом журнале. Заполнено ' + S.journalRowsFilled(s) + ' из 8.';
      renderChrome(s);
      return;
    }

    if (t.hasAttribute('data-quiz')) {
      s.theory.answers[t.getAttribute('data-quiz')] = t.value;
      S.save();
      const block = t.closest('[data-block="theory"]');
      if (block) {
        const btn = $('[data-act="theory-check"]', block);
        const meta = $('.q-actions .q-meta', block);
        const theory = blockById('theory');
        const totalQ = theory ? theory.questions.length : 3;
        const answered = theory ? theory.questions.filter((q) => !!s.theory.answers[q.id]).length : 0;
        if (btn) btn.disabled = answered !== totalQ;
        if (meta) meta.textContent = 'отвечено ' + answered + ' из ' + totalQ;
      }
      return;
    }

    if (t.hasAttribute('data-op')) {
      s.ops[t.getAttribute('data-op')] = t.checked;
      S.log('Этап ' + t.getAttribute('data-op') + ': ' + (t.checked ? 'закрыт' : 'снят'));
      S.save();
      updateOps();
      renderChrome(s);
      if (S.opsDone(s) === D.OPS.length) {
        C.toast('ok', 'Карта закрыта', 'Все этапы отмечены. Пройдите самоконтроль и переходите к тесту линий.');
      }
      return;
    }

    if (t.getAttribute('data-act') === 'teacher-confirm') {
      s.teacher.confirmed = t.checked;
      S.save();
      render({});
    }
  }

  /* ---------- Завершение смены ------------------------------------------- */
  function finish() {
    const s = S.get();
    const pending = S.pending(8, s);
    if (pending) {
      C.toast('warn', 'Смена ещё не готова', 'Осталось: ' + pending + '.');
      return;
    }
    s.finishedAt = Date.now();
    S.saveNow();
    render({});
    const sc = S.computeScore(s);
    C.toast('ok', 'Смена закрыта', 'Итог: ' + sc.total + ' / 100 — ' + sc.grade.text + '.');
    S.sendToLMS();
  }

  function restart() {
    C.confirmDialog({
      title: 'Начать смену заново?',
      text: 'Все отметки, ответы и журнал будут удалены. Отменить это нельзя.',
      confirmText: 'Начать заново'
    }).then((ok) => {
      if (!ok) return;
      S.reset();
      resetRotate();
      applyTheme('light');
      render({ enter: true, scrollTop: true });
      C.toast('info', 'Новая смена', 'Заявка PP-314 всё ещё ждёт исполнителя.');
    });
  }

  /* ---------- Печать и выгрузка ------------------------------------------- */
  function download(name, text) {
    let url = null;
    try {
      const blob = new global.Blob([text], { type: 'text/plain;charset=utf-8' });
      if (global.URL && global.URL.createObjectURL) url = global.URL.createObjectURL(blob);
    } catch (e) {
      url = null;
    }
    if (!url) url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url.indexOf('blob:') === 0 && global.URL.revokeObjectURL) {
      global.setTimeout(() => global.URL.revokeObjectURL(url), 2000);
    }
  }

  function exportReport() {
    const s = S.get();
    download('akt-panel-PP-314.txt', S.reportText());
    s.report.exported = true;
    S.saveNow();
    render({});
    C.toast('ok', 'Акт выгружен', 'Файл akt-panel-PP-314.txt сохранён.');
  }

  function copyReport() {
    const s = S.get();
    const text = S.reportText();
    const done = () => {
      s.report.copied = true;
      S.saveNow();
      render({});
      C.toast('ok', 'Акт скопирован', 'Можно вставить в документ или чат.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch (e) {
      C.toast('error', 'Не удалось скопировать', 'Воспользуйтесь выгрузкой файла.');
    }
    area.remove();
  }

  function printDoc(kind) {
    const s = S.get();
    const area = $('#print-area');
    if (!area) return;
    area.innerHTML = kind === 'task' ? taskHTML() : actHTML(s);
    s.report.printed = kind === 'act' ? true : s.report.printed;
    S.saveNow();
    global.setTimeout(() => {
      global.print();
      render({});
    }, 60);
  }

  function taskHTML() {
    const b = D.BRIEF;
    return (
      '<div class="print-doc">' +
      '<div class="print-doc__brand">' + C.esc(D.SHIFT.company) + ' · ' + C.esc(D.SHIFT.unit) + '</div>' +
      '<h1>Практическая работа: монтаж коммутационной панели</h1>' +
      '<p class="print-doc__meta">' + C.esc(D.SHIFT.lesson) + ' · ' + C.esc(b.time) + '</p>' +
      '<h2>Цель</h2><p>' + C.esc(b.goal) + '</p>' +
      '<h2>Исходные данные</h2><ul>' + b.given.map((x) => '<li>' + C.esc(x) + '</li>').join('') + '</ul>' +
      '<h2>Ход работы</h2><ol>' + b.steps.map((x) => '<li>' + C.esc(x) + '</li>').join('') + '</ol>' +
      '<h2>Что проверить</h2><ul>' + b.tips.map((x) => '<li>' + C.esc(x) + '</li>').join('') + '</ul>' +
      '<h2>Критерии оценивания</h2><table><thead><tr><th>Критерий</th><th>Баллы</th></tr></thead><tbody>' +
      D.RUBRIC.map((r) => '<tr><td>' + C.esc(r.label) + '</td><td>' + r.max + '</td></tr>').join('') +
      '<tr><td><b>Итого</b></td><td><b>100</b></td></tr></tbody></table>' +
      '<p class="print-doc__foot">90–100 — отлично · 75–89 — хорошо · 60–74 — удовлетворительно · ниже 60 — неудовлетворительно.</p>' +
      '</div>'
    );
  }

  function actHTML(s) {
    const sc = S.computeScore(s);
    const row = (k, v) => '<tr><td>' + C.esc(k) + '</td><td>' + C.esc(v) + '</td></tr>';
    const ports = [];
    for (let p = 1; p <= 8; p += 1) {
      const r = (s.journal.rows || {})[p] || {};
      ports.push(row(String(p).padStart(2, '0') + ' · ' + (r.place || '—'), r.result ? r.result.toUpperCase() : '—'));
    }
    return (
      '<div class="print-doc">' +
      '<div class="print-doc__brand">' + C.esc(D.SHIFT.company) + ' · ' + C.esc(D.SHIFT.unit) + '</div>' +
      '<h1>Акт выполненных работ № ' + C.esc(D.SHIFT.ticket) + '</h1>' +
      '<table><tbody>' +
      row('Объект', D.SHIFT.object) +
      row('Основание', 'заявка ' + D.SHIFT.ticket + ' · ' + D.SHIFT.customer) +
      row('Исполнитель', s.report.student || '—') +
      row('Группа', s.report.group || '—') +
      row('Бригада / роль', (s.report.brigade || '—') + ' / ' + S.roleName(s)) +
      row('Дата', new Date().toLocaleString('ru-RU')) +
      row('Оборудование', D.SHIFT.panel) +
      row('Стандарт', D.SHIFT.standard) +
      row('Приёмка мастером', s.teacher.confirmed ? 'да' : 'ожидается') +
      '</tbody></table>' +
      '<h2>Результаты по портам</h2><table><tbody>' + ports.join('') + '</tbody></table>' +
      '<h2>Дефекты и отклонения</h2><p>' + C.esc(s.journal.defects || '—') + '</p>' +
      '<h2>Оценка</h2><table><tbody>' +
      Object.keys(sc.parts)
        .map((k) => row(sc.parts[k].label, sc.parts[k].value + ' / ' + sc.parts[k].max))
        .join('') +
      row('Итого', sc.total + ' / 100 — ' + sc.grade.text + ' (оценка ' + sc.grade.mark + ')') +
      '</tbody></table>' +
      '<h2>Вывод</h2><p>' + C.esc(s.report.comment || '—') + '</p>' +
      '<div class="print-doc__sign"><span>Мастер п/о ______________</span><span>Исполнитель ______________</span></div>' +
      '</div>'
    );
  }

  /* ---------- Часы смены --------------------------------------------------- */
  function startClock() {
    const tick = () => {
      const s = S.get();
      const node = $('#shift-clock');
      if (node) node.textContent = S.fmtDuration(S.elapsedSec(s));
      if (s.finishedAt && clockTimer) {
        global.clearInterval(clockTimer);
        clockTimer = null;
      }
    };
    tick();
    if (!clockTimer) clockTimer = global.setInterval(tick, 1000);
  }

  /* ---------- Старт -------------------------------------------------------- */
  function boot() {
    S.load();
    const s = S.get();
    if (!s.startedAt) {
      s.startedAt = Date.now();
      S.saveNow();
    }
    applyTheme(s.ui.theme);

    $('#episode-root').addEventListener('click', onClick);
    $('#episode-root').addEventListener('input', onInput);
    $('#episode-root').addEventListener('change', onChange);

    const prev = $('#prev-btn');
    const next = $('#next-btn');
    if (prev) prev.addEventListener('click', () => go(S.get().episode - 1));
    if (next) next.addEventListener('click', () => go(S.get().episode + 1));

    const theme = $('#theme-btn');
    if (theme) theme.addEventListener('click', toggleTheme);

    const reset = $('#reset-btn');
    if (reset) reset.addEventListener('click', restart);

    const printTask = $('#print-task');
    if (printTask) printTask.addEventListener('click', () => printDoc('task'));

    const brief = $('#brief-btn');
    if (brief) {
      brief.addEventListener('click', () => {
        C.openModal({
          html:
            '<div class="modal__head"><div><h2 class="modal__title" id="modal-title">Задание на смену</h2>' +
            '<p class="modal__sub">Практическая работа · ' + C.esc(D.SHIFT.norm) + '</p></div>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-modal-close>Закрыть</button></div>' +
            '<div class="modal__body">' + taskHTML().replace('print-doc', 'print-doc print-doc--modal') + '</div>'
        });
      });
    }

    render({ enter: true, scrollTop: true });
    startClock();
    C.lms.ready({
      work: 'Смена «Монтаж коммутационной панели» — ситуационная задача (T568B, Cat 6A)',
      maxScore: 100,
      simulator: 'patch-panel'
    });
    C.lms.listen({
      requestScore: () => S.sendToLMS(),
      reset: () => restart()
    });

    if (!S.canStore) {
      C.toast('warn', 'Прогресс не сохраняется', 'Браузер запретил localStorage. Смена пройдёт, но при перезагрузке начнётся заново.');
    } else if (s.episode > 1 || S.completedCount(s) > 0) {
      C.toast('info', 'Смена продолжается', 'Вы вернулись на эпизод ' + s.episode + '.');
    } else {
      C.toast('info', 'Смена началась', 'Заявка PP-314 ждёт исполнителя.');
    }

    if (s.episode === 2 && !s.ui.typedTicket) {
      global.setTimeout(() => {
        const st = S.get();
        st.ui.typedTicket = true;
        S.save();
      }, 1800);
    }
  }

  /* Небольшой API наружу: нужен тестам и внешним обёрткам МЭШ. */
  global.App = {
    render: render,
    go: go,
    finish: finish,
    restart: restart,
    printDoc: printDoc
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
