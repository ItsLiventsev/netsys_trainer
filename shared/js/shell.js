/* ==========================================================================
   shell.js — общая «оболочка» тренажёра: шапка, степпер, чек-лист, теория,
   панель инструментов, режимы (тренировка/экзамен), сброс, переключение
   панелей на мобильных. Наполнение приходит из конфигурации тренажёра.

   Использование:
     Shell.init({
       steps, checklist, theory, tools,
       hintScheme(), toolArt(id),
       getState(), save(),
       actions: { go, reset, applyMode, stepDone, ready, checklistStates, score, endsLabel },
       modeNames: { training, exam },
       texts: { modeConfirm(next), resetConfirm }
     });
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.AppCore;
  const I = global.AppIcons;
  const $ = C.$;
  const $$ = C.$$;
  const esc = C.esc;

  let cfg = null;

  function state() {
    return cfg.getState();
  }

  /* ---------- Степпер ---------------------------------------------------- */
  function renderStepper() {
    const host = $('#stepper');
    if (!host) return;
    const s = state();
    const ready = cfg.actions.ready(s);
    host.innerHTML = cfg.steps
      .map((st) => {
        const done = cfg.actions.stepDone(s, st.id);
        const current = s.step === st.id;
        return (
          '<button type="button" class="step-pill' + (done ? ' is-done' : '') + '" data-goto="' + st.id + '"' +
          (current ? ' aria-current="step"' : '') +
          (ready[st.id] ? '' : ' aria-disabled="true" title="Шаг пока недоступен"') + '>' +
          '<span class="step-pill__num"><span>' + st.id + '</span></span>' +
          '<span class="step-pill__label">' + esc(st.short) + '</span>' +
          '</button>'
        );
      })
      .join('');

    $$('[data-goto]', host).forEach((b) => {
      b.addEventListener('click', () => {
        const n = Number(b.getAttribute('data-goto'));
        if (b.getAttribute('aria-disabled') === 'true') {
          C.toast('warn', 'Шаг пока закрыт', 'Сначала выполните предыдущие действия.');
          return;
        }
        cfg.actions.go(n);
      });
    });
  }

  /* ---------- Инструменты ------------------------------------------------ */
  function renderTools() {
    const host = $('#tool-grid');
    if (!host) return;
    host.innerHTML = cfg.tools
      .map(
        (t) =>
          '<button type="button" class="tool-card" data-tool="' + t.id + '" aria-haspopup="dialog">' +
          '<span class="tool-card__icon">' + I.icon(t.id) + '</span>' +
          '<span class="tool-card__name">' + esc(t.name) + '</span>' +
          '</button>'
      )
      .join('');

    $$('[data-tool]', host).forEach((b) => {
      b.addEventListener('click', () => openTool(b.getAttribute('data-tool')));
    });
  }

  function openTool(id) {
    const tool = cfg.tools.filter((t) => t.id === id)[0];
    if (!tool) return;
    const tip = $('#tool-tip');
    if (tip) {
      tip.innerHTML = '<span class="tool-tip__title">' + esc(tool.full) + '</span>' + esc(tool.purpose);
    }
    $$('.tool-card').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-tool') === id));
    const s = state();
    if (s.ui) s.ui.activeTool = id;
    cfg.save();

    const art = cfg.toolArt ? cfg.toolArt(tool.id) : I.icon(tool.id);

    C.openModal({
      html:
        '<div class="modal__head">' +
        '<span class="modal__icon">' + art + '</span>' +
        '<div><h2 class="modal__title" id="modal-title">' + esc(tool.full) + '</h2>' +
        '<p class="modal__sub">' + esc(tool.used) + '</p></div>' +
        '<button type="button" class="btn btn--sm btn--ghost modal__close" data-modal-close aria-label="Закрыть">' +
        I.icon('close') + '</button>' +
        '</div>' +
        '<div class="modal__body">' +
        '<p>' + esc(tool.purpose) + '</p>' +
        '<ul>' + tool.points.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>' +
        '</div>' +
        '<div class="modal__actions"><button type="button" class="btn btn--primary" data-modal-close>Понятно</button></div>'
    });
  }

  /* ---------- Схема-подсказка ------------------------------------------- */
  function renderHint() {
    const host = $('#hint-scheme');
    if (!host) return;
    host.innerHTML = cfg.hintScheme ? cfg.hintScheme() : I.schemeHTML('T568B');
  }

  function setHint(open) {
    const s = state();
    if (s.ui) s.ui.hintOpen = !!open;
    const panel = $('#hint-panel');
    const btn = $('#hint-btn');
    if (panel) panel.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    cfg.save();
    if (open) {
      C.announce('Показана схема стандарта.');
      if (global.matchMedia('(max-width: 900px)').matches) setMobilePane('tools');
    }
  }

  /* ---------- Чек-лист --------------------------------------------------- */
  function renderChecklist() {
    const host = $('#checklist');
    if (!host) return;
    const s = state();
    const states = cfg.actions.checklistStates(s) || {};

    host.innerHTML = cfg.checklist
      .map((item) => {
        const st = states[item.id];
        const attr = st && st !== 'todo' ? ' data-state="' + st + '"' : '';
        return (
          '<li class="checklist__item"' + attr + '>' +
          '<span class="checklist__icon" aria-hidden="true"></span>' +
          '<span class="checklist__text">' + esc(item.label) + (cfg.decorateChecklistItem ? cfg.decorateChecklistItem(item, s) : '') + '</span>' +
          '</li>'
        );
      })
      .join('');

    const endsLabel = $('#checklist-ends');
    if (endsLabel) endsLabel.textContent = cfg.actions.endsLabel ? cfg.actions.endsLabel(s) : '';
  }

  /* ---------- Счёт ------------------------------------------------------- */
  let lastScore = -1;

  function renderScore() {
    const s = state();
    const sc = cfg.actions.score(s);
    const chip = $('#score-chip-text');
    const inline = $('#score-inline');
    const bar = $('#score-bar');
    const counter = $('#step-counter');
    if (chip) chip.textContent = sc.total + ' / ' + sc.max;
    if (inline) inline.textContent = sc.total + ' / ' + sc.max;
    if (bar) bar.style.width = (sc.total / sc.max) * 100 + '%';
    if (counter) counter.textContent = s.step + '/' + cfg.steps.length;
    if (lastScore !== -1 && sc.total !== lastScore) {
      C.announce('Текущий результат: ' + sc.total + ' из ' + sc.max + '.');
    }
    lastScore = sc.total;
    return sc;
  }

  /* ---------- Теория ----------------------------------------------------- */
  function renderTheory() {
    const host = $('#theory');
    if (!host) return;
    host.innerHTML = cfg.theory
      .map((t, i) => {
        const body = (t.schemeHTML || '') + (t.html || '');
        return (
          '<div class="acc">' +
          '<button type="button" class="acc__head" aria-expanded="false" aria-controls="theory-body-' + i + '" id="theory-head-' + i + '">' +
          esc(t.title) +
          '</button>' +
          '<div class="acc__body" id="theory-body-' + i + '" role="region" aria-labelledby="theory-head-' + i + '" hidden>' +
          body +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    $$('.acc__head', host).forEach((btn) => {
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        const body = document.getElementById(btn.getAttribute('aria-controls'));
        if (body) body.hidden = open;
      });
    });
  }

  /* ---------- Мобильные панели ------------------------------------------ */
  function setMobilePane(pane) {
    const s = state();
    if (s.ui) s.ui.mobilePane = pane;
    ['tools', 'stage', 'info'].forEach((p) => {
      const node = p === 'stage' ? $('#stage-root') : $('#pane-' + p);
      if (node) node.classList.toggle('is-active', p === pane);
    });
    $$('#mobile-tabs [data-pane]').forEach((b) => {
      b.setAttribute('aria-selected', b.getAttribute('data-pane') === pane ? 'true' : 'false');
    });
    cfg.save();
  }

  /* ---------- Режимы ----------------------------------------------------- */
  function modeNames() {
    return cfg.modeNames || { training: 'Тренировка', exam: 'Экзамен' };
  }

  function renderMode() {
    const s = state();
    const names = modeNames();
    const label = $('#mode-label');
    const btn = $('#mode-btn');
    if (label) label.textContent = s.mode === 'training' ? names.training : names.exam;
    if (btn) {
      btn.setAttribute('aria-pressed', s.mode === 'exam' ? 'true' : 'false');
      btn.classList.toggle('btn--warn', s.mode === 'exam');
      btn.title =
        s.mode === 'training'
          ? 'Тренировка: ошибки подсвечиваются сразу. Нажмите, чтобы перейти в экзамен.'
          : 'Экзамен: без подсказок, проверка в конце. Нажмите, чтобы вернуться в тренировку.';
    }
  }

  async function toggleMode() {
    const s = state();
    const next = s.mode === 'training' ? 'exam' : 'training';
    const names = modeNames();
    const confirmText = cfg.texts && cfg.texts.modeConfirm
      ? cfg.texts.modeConfirm(next)
      : { title: 'Сменить режим?', text: 'Текущая работа начнётся заново.' };
    const ok = await C.confirmDialog({
      title: confirmText.title,
      text: confirmText.text,
      confirmText: 'Сменить режим'
    });
    if (!ok) return;
    cfg.actions.applyMode(next);
    C.toast(
      'info',
      'Режим: ' + (next === 'exam' ? names.exam.toLowerCase() : names.training.toLowerCase()),
      cfg.texts && cfg.texts.modeToast ? cfg.texts.modeToast(next) : ''
    );
  }

  /* ---------- Сброс ------------------------------------------------------ */
  async function resetWork() {
    const confirmText = cfg.texts && cfg.texts.resetConfirm
      ? cfg.texts.resetConfirm
      : { title: 'Сбросить работу?', text: 'Весь прогресс будет удалён.', confirmText: 'Сбросить' };
    const ok = await C.confirmDialog({
      title: confirmText.title,
      text: confirmText.text,
      confirmText: confirmText.confirmText || 'Сбросить'
    });
    if (!ok) return;
    cfg.actions.reset();
    C.toast('info', 'Работа сброшена', 'Можно начинать заново.');
  }

  /* ---------- Обновление ------------------------------------------------- */
  function refresh() {
    renderStepper();
    renderChecklist();
    renderScore();
    renderMode();
  }

  /* ---------- Инициализация --------------------------------------------- */
  function init(config) {
    cfg = config;
    renderTools();
    renderHint();
    renderTheory();
    renderMode();

    const hintBtn = $('#hint-btn');
    if (hintBtn) hintBtn.addEventListener('click', () => setHint(!state().ui || !state().ui.hintOpen));

    const modeBtn = $('#mode-btn');
    if (modeBtn) modeBtn.addEventListener('click', toggleMode);

    const resetBtn = $('#reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetWork);

    $$('#mobile-tabs [data-pane]').forEach((b) => {
      b.addEventListener('click', () => setMobilePane(b.getAttribute('data-pane')));
    });

    const brand = $('#brand-title');
    if (brand && cfg.title) brand.textContent = cfg.title;
    const sub = $('#brand-sub');
    if (sub && cfg.subtitle) sub.textContent = cfg.subtitle;
    if (cfg.title) document.title = cfg.title + ' — тренажёр';

    setHint(!!(state().ui && state().ui.hintOpen));
    setMobilePane((state().ui && state().ui.mobilePane) || 'stage');
    refresh();
  }

  global.Shell = {
    init,
    refresh,
    setHint,
    setMobilePane,
    openTool,
    renderStepper,
    renderChecklist,
    renderScore,
    renderMode,
    renderTheory,
    get config() {
      return cfg;
    }
  };
})(window);
