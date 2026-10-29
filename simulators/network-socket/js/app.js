/* ==========================================================================
   app.js — сборка тренажёра «Монтаж сетевых розеток»: конфигурация оболочки,
   навигация по шагам, hash-роутинг, восстановление прогресса, связь с МЭШ.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const C = global.AppCore;
  const S = global.AppState;
  const Steps = global.AppSteps;
  const Report = global.AppReport;

  let lastRenderedStep = 0;
  let firstPaint = true;

  /* ---------- Роутинг (GitHub Pages: только hash) ------------------------ */
  function parseHash() {
    const m = /^#\/?step[-/]?(\d)$/.exec(global.location.hash || '');
    if (m) return Math.min(D.STEPS.length, Math.max(1, Number(m[1])));
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
    const n = Math.min(D.STEPS.length, Math.max(1, Number(step) || 1));
    const ready = S.readiness(s);
    if (!ready[n] && n > s.step) {
      C.toast('warn', 'Шаг пока закрыт', 'Сначала завершите текущий этап.');
      return;
    }
    s.step = n;
    S.save();
    setHash(n);
    render();
    global.scrollTo({
      top: 0,
      behavior: C.reducedMotion() ? 'auto' : 'smooth'
    });
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
    global.Shell.refresh();

    if (!firstPaint && s.step !== lastRenderedStep) {
      const title = stage.querySelector('.stage__title');
      if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
      }
    } else if (focusKey) {
      const node = stage.querySelector('[data-focus-key="' + focusKey + '"]');
      if (node && typeof node.focus === 'function') node.focus({ preventScroll: true });
    }
    lastRenderedStep = s.step;
    firstPaint = false;
  }

  function renderAll() {
    render();
  }

  /* ---------- Сброс и режимы -------------------------------------------- */
  function applyMode(mode) {
    S.reset();
    S.get().mode = mode;
    S.saveNow();
    renderAll();
    go(1);
  }

  function resetWork() {
    S.reset();
    lastRenderedStep = 0;
    renderAll();
    go(1);
  }

  /* ---------- Признак выполнения шага ----------------------------------- */
  function stepDone(s, id) {
    switch (id) {
      case 1:
        return s.kit.checked;
      case 2:
        return s.prep.done;
      case 3:
        return S.filledCount(s) === 8;
      case 4:
        return S.allPunched(s);
      case 5:
        return S.mountDone(s);
      case 6:
        return s.tester.tested;
      default:
        return s.quiz.checked;
    }
  }

  /* ---------- Конфигурация оболочки ------------------------------------- */
  function shellConfig() {
    return {
      title: 'Монтаж сетевых розеток',
      subtitle: 'Розетка RJ-45 · модуль keystone · T568B',
      steps: D.STEPS,
      checklist: D.CHECKLIST,
      theory: D.THEORY.map((t) => ({
        title: t.title,
        html: t.html,
        schemeHTML: t.scheme === 'B' ? global.AppIcons.schemeHTML('T568B', { caption: 'маркировка B на модуле' }) : ''
      })),
      tools: D.TOOLS,
      hintScheme: () => global.AppIcons.schemeHTML('T568B', { caption: 'заделка по маркировке B' }),
      toolArt: (id) =>
        id === 'punchdown' ? global.APP_GFX.punchToolArt() : global.AppIcons.icon(id),
      getState: S.get,
      save: S.save,
      actions: {
        go: go,
        reset: resetWork,
        applyMode: applyMode,
        stepDone: stepDone,
        ready: S.readiness,
        checklistStates: Steps.checklistStates,
        score: S.computeScore,
        endsLabel: () => 'розетка RJ-45'
      },
      modeNames: { training: 'Тренировка', exam: 'Экзамен' },
      texts: {
        modeConfirm: (next) =>
          next === 'exam'
            ? {
                title: 'Перейти в режим экзамена?',
                text: 'В экзамене жилы можно ставить в любой контакт: ошибки в маркировке станут видны только на тестере. Текущая работа начнётся заново.'
              }
            : {
                title: 'Вернуться в тренировку?',
                text: 'В тренировке жила, поставленная не по маркировке, сразу возвращается в пучок. Текущая работа начнётся заново.'
              },
        modeToast: (next) =>
          next === 'exam'
            ? 'Маркировка контактов проверяется тестером в конце.'
            : 'Неверный контакт подсвечивается, жила возвращается в пучок.',
        resetConfirm: {
          title: 'Сбросить работу?',
          text: 'Весь прогресс, собранная розетка и ответы будут удалены. Отменить это действие нельзя.',
          confirmText: 'Сбросить'
        }
      }
    };
  }

  /* ---------- Старт ------------------------------------------------------ */
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

    if (C.reducedMotion()) document.body.classList.add('reduce-motion');

    global.Shell.init(shellConfig());
    render();

    if (!S.canStore) {
      C.toast('warn', 'Прогресс не сохраняется', 'Браузер блокирует localStorage (возможно, режим инкогнито).');
    } else if (s.kit.checked || s.prep.done || s.quiz.checked) {
      C.toast('info', 'Работа восстановлена', 'Продолжаем с шага ' + s.step + '.');
    } else {
      C.toast('info', 'Начало работы', 'Соберите инструменты, снимите оболочку и заделайте жилы в модуль розетки.');
    }

    C.lms.ready({
      work: 'Монтаж сетевой розетки RJ-45 (T568B)',
      maxScore: 100,
      simulator: 'network-socket'
    });

    C.lms.listen({
      requestScore: () => S.lmsPayload(),
      reset: () => {
        S.reset();
        renderAll();
        go(1);
      },
      setMode: (mode) => {
        S.get().mode = mode;
        S.saveNow();
        global.Shell.renderMode();
      }
    });

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
    sendScore: () => Report.sendToLMS(S.get(), false)
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
