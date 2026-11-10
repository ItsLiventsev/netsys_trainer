/* ==========================================================================
   app.js — сборка квеста: навигация по эпизодам, общая шапка и рельс,
   тема, таймер смены, печать задания и акта, связь с МЭШ.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const C = global.AppCore;
  const S = global.AppState;
  const R = global.AppRender;

  let clockTimer = null;

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
  /** Блок эпизода по id — нужен для точечного обновления интерфейса. */
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

  function go(id, opts) {
    const s = S.get();
    const target = Math.min(D.EPISODES.length, Math.max(1, Number(id) || 1));
    if (target > frontier(s)) {
      C.toast('warn', 'Эпизод пока закрыт', 'Сначала закончите текущий: ' + S.pending(s.episode, s));
      return;
    }
    s.episode = target;
    S.save();
    render({ enter: true, scrollTop: true, force: !!(opts && opts.force) });
  }

  /* ---------- Отрисовка --------------------------------------------------- */

  /** Прокрутка, которая не падает в окружениях без window.scrollTo. */
  function safeScroll(args) {
    try {
      if (typeof global.scrollTo === 'function') global.scrollTo(args);
    } catch (e) {
      /* молча: прокрутка — украшение, а не логика */
    }
  }

  /** Ключ фокуса: по каким data-атрибутам найти тот же элемент после перерисовки. */
  const FOCUS_ATTRS = ['data-choice', 'data-opt', 'data-survey', 'data-kit', 'data-wire', 'data-tester', 'data-act', 'data-op'];

  function focusKey(node) {
    if (!node || !node.getAttribute || !$('#episode-root') || !$('#episode-root').contains(node)) return '';
    return FOCUS_ATTRS.filter((a) => node.getAttribute(a) !== null)
      .map((a) => '[' + a + '="' + String(node.getAttribute(a)).replace(/"/g, '\\"') + '"]')
      .join('');
  }

  /** Возвращает фокус на перерисованный элемент (или на его блок). */
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
    root.innerHTML = R.renderEpisode(ep, s);
    root.classList.toggle('is-quiet', !o.enter);
    renderRail(s);
    renderChrome(s);
    if (o.scrollTop) safeScroll({ top: 0, behavior: C.reducedMotion() ? 'auto' : 'smooth' });
    else safeScroll({ top: y });
    if (!o.enter) restoreFocus(focus);
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

  /* ---------- Действия в эпизоде ----------------------------------------- */
  function onClick(ev) {
    const s = S.get();
    if (!ev.target || !ev.target.closest) return;
    const t = ev.target.closest('[data-choice],[data-survey],[data-kit],[data-wire],[data-tester],button[data-act]');
    if (!t) return;

    /* решения */
    if (t.hasAttribute('data-choice')) {
      const id = t.getAttribute('data-choice');
      const opt = t.getAttribute('data-opt');
      const ok = S.answerChoice(id, opt);
      render({});
      if (ok) C.toast('ok', 'Решение верное', 'Эпизод можно закрывать.');
      else C.toast('error', 'Не то', 'Прочитайте разбор и попробуйте снова.');
      return;
    }

    /* результат теста линии */
    if (t.hasAttribute('data-tester')) {
      s.tester.result = t.getAttribute('data-tester');
      s.tester.attempts += 1;
      S.log('Тест линии: ' + s.tester.result);
      S.save();
      render({});
      if (s.tester.result === 'pass') C.toast('ok', 'Тест пройден', 'Восемь жил по порядку. Осталось подтверждение мастера.');
      else C.toast('error', 'Тест не пройден', 'Проверьте раскладку по строке B и заделку контактов.');
      return;
    }

    /* знакомство */
    if (t.hasAttribute('data-survey')) {
      s.intro.experience = t.getAttribute('data-opt');
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

    if (t.hasAttribute && t.hasAttribute('data-report')) {
      const key = t.getAttribute('data-report');
      s.report[key] = t.value;
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
        const all = s.safety.s1 && s.safety.s2 && s.safety.s3;
        section.classList.toggle('is-complete', all);
        if (all) C.announce('Допуск получен. Можно собирать инструмент.');
      }
      renderChrome(s);
      return;
    }
    if (t.hasAttribute('data-quiz')) {
      s.theory.answers[t.getAttribute('data-quiz')] = t.value;
      S.save();
      // пока ответов не хватает, кнопка проверки заблокирована — перерисовываем блок
      const block = t.closest('[data-block="theory"]');
      if (block) {
        const btn = $('[data-act="theory-check"]', block);
        const meta = $('.q-actions .q-meta', block);
        const theory = blockById('theory');
        const total = theory ? theory.questions.length : 3;
        const answered = theory ? theory.questions.filter((q) => !!s.theory.answers[q.id]).length : 0;
        if (btn) btn.disabled = answered !== total;
        if (meta) meta.textContent = 'отвечено ' + answered + ' из ' + total;
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
        C.toast('ok', 'Карта закрыта', 'Все этапы отмечены. Покажите работу мастеру и переходите к тесту линии.');
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
    const pending = S.pending(7, s);
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
      text: 'Все отметки, ответы и история прохождения будут удалены. Отменить это нельзя.',
      confirmText: 'Начать заново'
    }).then((ok) => {
      if (!ok) return;
      S.reset();
      applyTheme('light');
      render({ enter: true, scrollTop: true });
      C.toast('info', 'Новая смена', 'Заявка INC-2147 всё ещё ждёт исполнителя.');
    });
  }

  /* ---------- Отчёт ------------------------------------------------------- */
  function download(name, text) {
    let url = null;
    try {
      const blob = new global.Blob([text], { type: 'text/plain;charset=utf-8' });
      if (global.URL && global.URL.createObjectURL) url = global.URL.createObjectURL(blob);
    } catch (e) {
      url = null;
    }
    // запасной путь для старых браузеров и окружений без Blob URL
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
    download('akt-smena-INC-2147.txt', S.reportText());
    s.report.exported = true;
    S.saveNow();
    render({});
    C.toast('ok', 'Акт выгружен', 'Файл akt-smena-INC-2147.txt сохранён.');
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

  /* ---------- Печать ------------------------------------------------------ */
  function printDoc(kind) {
    const s = S.get();
    const area = $('#print-area');
    if (!area) return;
    area.innerHTML = kind === 'task' ? taskHTML() : actHTML(s);
    s.report.printed = true;
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
      '<h1>Практическая работа: монтаж сетевых розеток</h1>' +
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
    return (
      '<div class="print-doc">' +
      '<div class="print-doc__brand">' + C.esc(D.SHIFT.company) + ' · ' + C.esc(D.SHIFT.unit) + '</div>' +
      '<h1>Акт выполненных работ · ' + C.esc(D.SHIFT.ticket) + '</h1>' +
      '<table><tbody>' +
      row('Объект', s.report.object || D.SHIFT.object) +
      row('Исполнитель', s.report.student || '—') +
      row('Группа', s.report.group || '—') +
      row('Дата', new Date().toLocaleString('ru-RU')) +
      row('Диагностика Р-3', s.decisions.diag && s.decisions.diag.ok ? 'перекрёст A/B (1-3, 2-6)' : 'не определена') +
      row('Тест линии', s.tester.result === 'pass' ? 'PASS, 8 жил по порядку' : s.tester.result ? 'FAIL: ' + s.tester.result : 'нет данных') +
      row('Подтверждение мастера', s.teacher.confirmed ? 'да' : 'ожидается') +
      '</tbody></table>' +
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
    if (brief)
      brief.addEventListener('click', () => {
        C.openModal({
          html:
            '<div class="modal__head"><div><h2 class="modal__title" id="modal-title">Задание на смену</h2>' +
            '<p class="modal__sub">Практическая работа · ' + C.esc(D.SHIFT.norm) + '</p></div>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-modal-close>Закрыть</button></div>' +
            '<div class="modal__body">' + taskHTML().replace('print-doc', 'print-doc print-doc--modal') + '</div>'
        });
      });

    render({ enter: true, scrollTop: true });
    startClock();
    C.lms.ready({
      work: 'Смена «Монтаж сетевых розеток» — ситуационная задача (T568B)',
      maxScore: 100,
      simulator: 'socket-quest'
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
      C.toast('info', 'Смена началась', 'Заявка INC-2147 ждёт исполнителя.');
    }

    // подсветка «печатающейся» заявки только при первом показе
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
