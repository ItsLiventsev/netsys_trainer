/* ==========================================================================
   ui.js — общие элементы интерфейса: тосты, модальные окна, степпер,
   чек-лист, панель инструментов, теория, переключение режимов.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const G = global.APP_GFX;
  const S = global.AppState;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ---------- Объявления для скринридера --------------------------------- */
  function announce(text) {
    const el = $('#sr-status');
    if (!el) return;
    el.textContent = '';
    global.setTimeout(() => {
      el.textContent = text;
    }, 40);
  }

  /* ---------- Тосты ------------------------------------------------------ */
  const TOAST_ICONS = {
    info: G.icon('info'),
    ok: G.icon('check'),
    warn: G.icon('warn'),
    error: G.icon('close')
  };

  function toast(kind, title, text, opts) {
    const host = $('#toasts');
    if (!host) return;
    const o = opts || {};
    const el = document.createElement('div');
    el.className = 'toast toast--' + (kind || 'info');
    el.innerHTML =
      '<span class="toast__icon">' + (TOAST_ICONS[kind] || TOAST_ICONS.info) + '</span>' +
      '<div><div class="toast__title">' + G.esc(title) + '</div>' +
      (text ? '<div class="toast__text">' + G.esc(text) + '</div>' : '') + '</div>';
    host.appendChild(el);
    if (!o.silent) announce((title || '') + '. ' + (text || ''));

    while (host.children.length > 3) host.removeChild(host.firstElementChild);

    const life = o.duration || 4600;
    const timer = global.setTimeout(() => {
      el.classList.add('is-leaving');
      global.setTimeout(() => el.remove(), 220);
    }, life);
    el.addEventListener('click', () => {
      global.clearTimeout(timer);
      el.remove();
    });
  }

  /* ---------- Модальные окна -------------------------------------------- */
  let modalState = null;

  function closeModal() {
    const root = $('#modal-root');
    if (!root || !root.firstChild) return;
    if (modalState && modalState.keyHandler) {
      document.removeEventListener('keydown', modalState.keyHandler, true);
    }
    if (modalState && modalState.onClose) modalState.onClose();
    root.innerHTML = '';
    document.body.style.removeProperty('overflow');
    const last = modalState && modalState.lastFocus;
    modalState = null;
    if (last && last.focus) last.focus();
  }

  function openModal(opts) {
    const root = $('#modal-root');
    if (!root) return;
    const o = opts || {};
    closeModal();

    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.setAttribute('role', 'presentation');
    wrap.innerHTML =
      '<div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">' + o.html + '</div>';
    root.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    modalState = { lastFocus: document.activeElement, onClose: o.onClose };

    const close = () => closeModal();
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) close();
    });
    $$('[data-modal-close]', wrap).forEach((b) => b.addEventListener('click', close));
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', wrap).filter(
        (el) => !el.disabled && el.offsetParent !== null
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!wrap.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    if (modalState) modalState.keyHandler = onKey;

    const focusable = $('button, [href], input, textarea', wrap);
    if (focusable) focusable.focus();
    return wrap;
  }

  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        closeModal();
        resolve(v);
      };
      openModal({
        html:
          '<div class="modal__head"><div><h2 class="modal__title" id="modal-title">' + G.esc(o.title || 'Подтвердите действие') + '</h2>' +
          (o.text ? '<p class="modal__sub">' + G.esc(o.text) + '</p>' : '') + '</div></div>' +
          '<div class="modal__actions">' +
          '<button type="button" class="btn" data-modal-close>' + G.esc(o.cancelText || 'Отмена') + '</button>' +
          '<button type="button" class="btn btn--primary" data-confirm>' + G.esc(o.confirmText || 'Продолжить') + '</button>' +
          '</div>',
        onClose: () => done(false)
      });
      const btn = $('[data-confirm]');
      if (btn) {
        btn.focus();
        btn.addEventListener('click', () => done(true));
      }
    });
  }

  /* ---------- Степпер ---------------------------------------------------- */
  function renderStepper() {
    const host = $('#stepper');
    if (!host) return;
    const s = S.get();
    const ready = S.readiness(s);
    host.innerHTML = D.STEPS.map((st) => {
      const done =
        (st.id === 1 && s.ends.A.strip.done) ||
        (st.id === 2 && s.ends.A.order.every(Boolean)) ||
        (st.id === 3 && s.ends.A.trimmed && s.ends.A.inserted) ||
        (st.id === 4 && s.ends.A.crimped) ||
        (st.id === 5 && S.endReadyForNext(s.ends.B)) ||
        (st.id === 6 && s.tester.tested) ||
        (st.id === 7 && s.quiz.checked);
      const current = s.step === st.id;
      return (
        '<button type="button" class="step-pill' + (done ? ' is-done' : '') + '" data-goto="' + st.id + '"' +
        (current ? ' aria-current="step"' : '') +
        (ready[st.id] ? '' : ' aria-disabled="true" title="Шаг пока недоступен"') + '>' +
        '<span class="step-pill__num"><span>' + st.id + '</span></span>' +
        '<span class="step-pill__label">' + G.esc(st.short) + '</span>' +
        '</button>'
      );
    }).join('');

    $$('[data-goto]', host).forEach((b) => {
      b.addEventListener('click', () => {
        const n = Number(b.getAttribute('data-goto'));
        if (b.getAttribute('aria-disabled') === 'true') {
          toast('warn', 'Шаг пока закрыт', 'Сначала выполните предыдущие действия.');
          return;
        }
        global.App.go(n);
      });
    });
  }

  /* ---------- Инструменты ------------------------------------------------ */
  function renderTools() {
    const host = $('#tool-grid');
    if (!host) return;
    host.innerHTML = D.TOOLS.map(
      (t) =>
        '<button type="button" class="tool-card" data-tool="' + t.id + '" aria-haspopup="dialog">' +
        '<span class="tool-card__icon">' + G.icon(t.id) + '</span>' +
        '<span class="tool-card__name">' + G.esc(t.name) + '</span>' +
        '</button>'
    ).join('');

    $$('[data-tool]', host).forEach((b) => {
      b.addEventListener('click', () => openTool(b.getAttribute('data-tool')));
    });
  }

  function openTool(id) {
    const tool = D.TOOLS.filter((t) => t.id === id)[0];
    if (!tool) return;
    const tip = $('#tool-tip');
    if (tip) {
      tip.innerHTML = '<span class="tool-tip__title">' + G.esc(tool.full) + '</span>' + G.esc(tool.purpose);
    }
    $$('.tool-card').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-tool') === id));
    S.get().ui.activeTool = id;
    S.save();

    const art = tool.id === 'stripper' ? G.stripperArt() : tool.id === 'crimper' ? G.crimperArt() : G.icon(tool.id);

    openModal({
      html:
        '<div class="modal__head">' +
        '<span class="modal__icon">' + art + '</span>' +
        '<div><h2 class="modal__title" id="modal-title">' + G.esc(tool.full) + '</h2>' +
        '<p class="modal__sub">' + G.esc(tool.used) + '</p></div>' +
        '<button type="button" class="btn btn--sm btn--ghost modal__close" data-modal-close aria-label="Закрыть">' +
        G.icon('close') + '</button>' +
        '</div>' +
        '<div class="modal__body">' +
        '<p>' + G.esc(tool.purpose) + '</p>' +
        '<ul>' + tool.points.map((p) => '<li>' + G.esc(p) + '</li>').join('') + '</ul>' +
        '</div>' +
        '<div class="modal__actions"><button type="button" class="btn btn--primary" data-modal-close>Понятно</button></div>'
    });
  }

  /* ---------- Схема-подсказка ------------------------------------------- */
  function renderHint() {
    const host = $('#hint-scheme');
    if (!host) return;
    host.innerHTML = G.schemeHTML('T568B', { caption: 'обжим по заданию' });
  }

  function setHint(open) {
    const s = S.get();
    s.ui.hintOpen = !!open;
    const panel = $('#hint-panel');
    const btn = $('#hint-btn');
    if (panel) panel.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    S.save();
    if (open) {
      announce('Показана схема T568B.');
      if (global.matchMedia('(max-width: 900px)').matches) setMobilePane('tools');
    }
  }

  /* ---------- Чек-лист --------------------------------------------------- */
  function itemStates(s, which) {
    const e = s.ends[which];
    const sorted = e.order.every(Boolean);
    const tested = s.tester.tested;
    const res = s.tester.result;
    return {
      strip: e.strip.done ? 'done' : 'active',
      sort: sorted ? 'done' : e.strip.done ? 'active' : 'todo',
      trim: e.trimmed ? 'done' : sorted ? 'active' : 'todo',
      insert: e.inserted && e.depth >= D.SETTINGS.depthGood ? 'done' : e.inserted ? 'active' : 'todo',
      clamp: e.checks.jacketClamp ? 'done' : e.inserted ? 'active' : 'todo',
      crimp: e.crimped && e.force >= D.SETTINGS.crimpWarn ? 'done' : e.crimped ? 'active' : 'todo',
      test: tested ? (res && res.ok ? 'done' : 'error') : 'todo'
    };
  }

  function endDot(which, state) {
    const cls = state === 'done' ? 'chip--green' : state === 'error' ? 'chip--red' : state === 'active' ? 'chip--blue' : '';
    return '<span class="chip ' + cls + '" style="padding:1px 7px;font-size:0.68rem;margin-left:6px" title="Конец ' + which + '">' + which + '</span>';
  }

  function renderChecklist() {
    const host = $('#checklist');
    if (!host) return;
    const s = S.get();
    const a = itemStates(s, 'A');
    const b = itemStates(s, 'B');
    const currentEndStates = itemStates(s, s.activeEnd);

    host.innerHTML = D.CHECKLIST.map((item) => {
      let state = currentEndStates[item.id];
      if (item.id === 'test') state = a.test === 'done' || b.test === 'done' ? (s.tester.result && s.tester.result.ok ? 'done' : s.tester.tested ? 'error' : 'todo') : 'todo';
      const attr = state && state !== 'todo' ? ' data-state="' + state + '"' : '';
      const ends = item.id === 'test' ? '' : endDot('A', a[item.id]) + endDot('B', b[item.id]);
      return (
        '<li class="checklist__item"' + attr + '>' +
        '<span class="checklist__icon" aria-hidden="true"></span>' +
        '<span class="checklist__text">' + G.esc(item.label) + ends + '</span>' +
        '</li>'
      );
    }).join('');

    const endsLabel = $('#checklist-ends');
    if (endsLabel) endsLabel.textContent = 'активный конец: ' + s.activeEnd;
  }

  /* ---------- Счёт ------------------------------------------------------- */
  let lastScore = -1;

  function renderScore() {
    const s = S.get();
    const sc = S.computeScore(s);
    const chip = $('#score-chip-text');
    const inline = $('#score-inline');
    const bar = $('#score-bar');
    const counter = $('#step-counter');
    if (chip) chip.textContent = sc.total + ' / 100';
    if (inline) inline.textContent = sc.total + ' / 100';
    if (bar) bar.style.width = sc.total + '%';
    if (counter) counter.textContent = s.step + '/7';
    if (lastScore !== -1 && sc.total !== lastScore) {
      announce('Текущий результат: ' + sc.total + ' из 100.');
    }
    lastScore = sc.total;
    return sc;
  }

  /* ---------- Теория ----------------------------------------------------- */
  function theoryBody(item) {
    let html = '';
    if (item.scheme === 'B') html += G.schemeHTML('T568B', { caption: 'стандарт задания' });
    if (item.scheme === 'cross') html += G.schemeHTML('T568B', { caption: 'конец A' }) + G.schemeHTML('T568A', { caption: 'конец B — кроссовер' });
    html += item.html;
    return html;
  }

  function renderTheory() {
    const host = $('#theory');
    if (!host) return;
    host.innerHTML = D.THEORY.map(
      (t, i) =>
        '<div class="acc">' +
        '<button type="button" class="acc__head" aria-expanded="false" aria-controls="theory-body-' + i + '" id="theory-head-' + i + '">' +
        G.esc(t.title) +
        '</button>' +
        '<div class="acc__body" id="theory-body-' + i + '" role="region" aria-labelledby="theory-head-' + i + '" hidden>' +
        theoryBody(t) +
        '</div>' +
        '</div>'
    ).join('');

    $$('.acc__head', host).forEach((btn) => {
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        const body = document.getElementById(btn.getAttribute('aria-controls'));
        if (body) body.hidden = open;
      });
    });
  }

  /* ---------- Мобильные табы -------------------------------------------- */
  function setMobilePane(pane) {
    const s = S.get();
    s.ui.mobilePane = pane;
    ['tools', 'stage', 'info'].forEach((p) => {
      const el = p === 'stage' ? $('#stage-root') : $('#pane-' + p);
      if (el) el.classList.toggle('is-active', p === pane);
    });
    $$('#mobile-tabs [data-pane]').forEach((b) => {
      b.setAttribute('aria-selected', b.getAttribute('data-pane') === pane ? 'true' : 'false');
    });
    S.save();
  }

  /* ---------- Режим ------------------------------------------------------ */
  function renderMode() {
    const s = S.get();
    const label = $('#mode-label');
    const btn = $('#mode-btn');
    if (label) label.textContent = s.mode === 'training' ? 'Тренировка' : 'Экзамен';
    if (btn) {
      btn.setAttribute('aria-pressed', s.mode === 'exam' ? 'true' : 'false');
      btn.classList.toggle('btn--warn', s.mode === 'exam');
      btn.title =
        s.mode === 'training'
          ? 'Тренировка: ошибки сразу подсвечиваются, жила возвращается. Нажмите, чтобы перейти в экзамен.'
          : 'Экзамен: без подсказок, проверка в конце. Нажмите, чтобы вернуться в тренировку.';
    }
  }

  async function toggleMode() {
    const s = S.get();
    const next = s.mode === 'training' ? 'exam' : 'training';
    const ok = await confirmDialog({
      title: next === 'exam' ? 'Перейти в режим экзамена?' : 'Вернуться в тренировку?',
      text:
        next === 'exam'
          ? 'В экзамене жилы не возвращаются на место: ошибки в порядке станут видны только на тестере. Текущая работа начнётся заново.'
          : 'В тренировке каждая неверная жила сразу возвращается. Текущая работа начнётся заново.',
      confirmText: 'Сменить режим'
    });
    if (!ok) return;
    S.reset();
    S.get().mode = next;
    S.saveNow();
    global.App.renderAll();
    global.App.go(1);
    toast('info', 'Режим: ' + (next === 'exam' ? 'экзамен' : 'тренировка'), next === 'exam'
      ? 'Порядок жил проверяется тестером в конце.'
      : 'Неверная жила подсвечивается и возвращается в пучок.');
  }

  /* ---------- Сброс ------------------------------------------------------ */
  async function resetWork() {
    const ok = await confirmDialog({
      title: 'Сбросить работу?',
      text: 'Весь прогресс, собранный кабель и ответы будут удалены. Отменить это действие нельзя.',
      confirmText: 'Сбросить'
    });
    if (!ok) return;
    S.reset();
    global.App.renderAll();
    global.App.go(1);
    toast('info', 'Работа сброшена', 'Можно начинать заново.');
  }

  /* ---------- Инициализация --------------------------------------------- */
  function init() {
    renderTools();
    renderHint();
    renderTheory();
    renderStepper();
    renderMode();

    const hintBtn = $('#hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => setHint(!S.get().ui.hintOpen));
    }
    const modeBtn = $('#mode-btn');
    if (modeBtn) modeBtn.addEventListener('click', toggleMode);
    const resetBtn = $('#reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetWork);

    $$('#mobile-tabs [data-pane]').forEach((b) => {
      b.addEventListener('click', () => setMobilePane(b.getAttribute('data-pane')));
    });

    setHint(!!S.get().ui.hintOpen);
    setMobilePane(S.get().ui.mobilePane || 'stage');
  }

  global.AppUI = {
    $,
    $$,
    announce,
    toast,
    openModal,
    closeModal,
    confirmDialog,
    renderStepper,
    renderChecklist,
    renderScore,
    renderMode,
    renderTools,
    renderTheory,
    renderHint,
    setHint,
    setMobilePane,
    openTool,
    itemStates,
    init
  };
})(window);
