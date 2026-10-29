/* ==========================================================================
   app.js — сборка приложения: навигация по шагам, hash-роутинг,
   восстановление прогресса, связь с МЭШ и общая отрисовка.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const S = global.AppState;
  const U = global.AppUI;
  const Steps = global.AppSteps;

  let lastRenderedStep = 0;
  let booted = false;

  /* ---------- Роутинг (GitHub Pages: только hash) ------------------------ */
  function parseHash() {
    const m = /^#\/?step[-/]?(\d)$/.exec(global.location.hash || '');
    if (m) return Math.min(7, Math.max(1, Number(m[1])));
    return null;
  }

  function setHash(step) {
    const target = '#/step/' + step;
    if (global.location.hash === target) return;
    try {
      global.history.replaceState(null, '', target);
    } catch (e) {
      global.location.hash = target;
    }
  }

  /* ---------- Навигация -------------------------------------------------- */
  function go(step) {
    const s = S.get();
    const n = Math.min(7, Math.max(1, Number(step) || 1));
    const ready = S.readiness(s);
    if (!ready[n] && n > s.step) {
      U.toast('warn', 'Шаг пока закрыт', 'Сначала завершите текущий этап.');
      return;
    }
    s.step = n;
    S.save();
    setHash(n);
    render();
    window.scrollTo({ top: 0, behavior: global.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /* ---------- Отрисовка -------------------------------------------------- */
  function render() {
    const s = S.get();
    const stage = document.getElementById('stage-root');
    if (!stage) return;

    const active = document.activeElement;
    const focusKey = active && active.getAttribute ? active.getAttribute('data-focus-key') : null;

    stage.innerHTML = Steps.render(s);
    Steps.mount(stage, s);

    U.renderStepper();
    U.renderChecklist();
    U.renderScore();
    U.renderMode();

    if (lastRenderedStep !== 0 && s.step !== lastRenderedStep) {
      lastRenderedStep = s.step;
      const title = stage.querySelector('.stage__title');
      if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
      }
    } else if (focusKey) {
      const el = stage.querySelector('[data-focus-key="' + focusKey + '"]');
      if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
    }
    if (lastRenderedStep === 0) lastRenderedStep = s.step;
  }

  function renderAll() {
    render();
  }

  /* ---------- Связь с МЭШ ------------------------------------------------- */
  function announceReady() {
    if (global.parent && global.parent !== global) {
      try {
        global.parent.postMessage(
          {
            type: 'LMS_READY',
            work: 'Обжим витой пары (Straight-Through, T568B)',
            maxScore: 100,
            version: 1
          },
          '*'
        );
      } catch (e) {
        /* noop */
      }
    }
  }

  function listenLMS() {
    global.addEventListener('message', (ev) => {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'LMS_REQUEST_SCORE') {
        const payload = S.lmsPayload();
        if (ev.source && ev.source.postMessage) {
          try {
            ev.source.postMessage(payload, '*');
          } catch (e) {
            /* noop */
          }
        }
      } else if (data.type === 'LMS_RESET') {
        S.reset();
        render();
        go(1);
      } else if (data.type === 'LMS_SET_MODE' && (data.mode === 'training' || data.mode === 'exam')) {
        S.get().mode = data.mode;
        S.saveNow();
        U.renderMode();
      }
    });
  }

  /* ---------- Старт ------------------------------------------------------- */
  function boot() {
    S.load();
    const s = S.get();

    // если сохранённый шаг недоступен — откатываемся к первому доступному
    const ready = S.readiness(s);
    if (!ready[s.step]) {
      let step = s.step;
      while (step > 1 && !ready[step]) step -= 1;
      s.step = step;
    }

    const hashStep = parseHash();
    if (hashStep && ready[hashStep]) s.step = hashStep;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.add('reduce-motion');
    }

    U.init();
    render();
    lastRenderedStep = s.step;
    setHash(s.step);

    if (!S.canStore) {
      U.toast('warn', 'Прогресс не сохраняется', 'Браузер блокирует localStorage (возможно, режим инкогнито).');
    } else if (s.ends.A.strip.done || s.ends.A.crimped || s.quiz.checked) {
      U.toast('info', 'Работа восстановлена', 'Продолжаем с шага ' + s.step + '.');
    } else if (booted === false) {
      U.toast('info', 'Начало работы', 'Снимите оболочку кабеля, разложите жилы по T568B и обожмите коннектор.');
    }
    booted = true;

    announceReady();
    listenLMS();

    global.addEventListener('hashchange', () => {
      const n = parseHash();
      if (n && n !== S.get().step) go(n);
    });

    global.addEventListener('beforeunload', () => S.saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') S.saveNow();
    });
  }

  global.App = {
    boot,
    go,
    render,
    renderAll,
    sendScore: () => global.AppReport.sendToLMS(S.get(), false)
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
