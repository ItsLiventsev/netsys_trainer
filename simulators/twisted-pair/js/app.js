/* ==========================================================================
   app.js — сборка тренажёра «Обжим витой пары»: конфигурация оболочки,
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

  /* ---------- Состояние чек-листа --------------------------------------- */
  function endBadge(which, stateStr) {
    const cls = stateStr === 'done' ? 'chip--green' : stateStr === 'error' ? 'chip--red' : stateStr === 'active' ? 'chip--blue' : '';
    return '<span class="chip ' + cls + '" style="padding:1px 7px;font-size:0.68rem;margin-left:6px" title="Конец ' + which + '">' + which + '</span>';
  }

  function checklistStates(s) {
    const current = Steps.itemStates(s, s.activeEnd);
    const a = Steps.itemStates(s, 'A');
    const b = Steps.itemStates(s, 'B');
    const out = {};
    D.CHECKLIST.forEach((item) => {
      if (item.id === 'test') {
        out[item.id] = s.tester.tested ? (s.tester.result && s.tester.result.ok ? 'done' : 'error') : 'todo';
      } else {
        out[item.id] = current[item.id];
      }
    });
    return out;
  }

  function decorateChecklistItem(item) {
    const s = S.get();
    if (item.id === 'test') return '';
    const a = Steps.itemStates(s, 'A')[item.id];
    const b = Steps.itemStates(s, 'B')[item.id];
    return endBadge('A', a) + endBadge('B', b);
  }

  function stepDone(s, id) {
    const A = s.ends.A;
    const B = s.ends.B;
    switch (id) {
      case 1:
        return A.strip.done;
      case 2:
        return A.order.every(Boolean);
      case 3:
        return A.trimmed && A.inserted;
      case 4:
        return A.crimped;
      case 5:
        return S.endReadyForNext(B);
      case 6:
        return s.tester.tested;
      default:
        return s.quiz.checked;
    }
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

  /* ---------- Конфигурация оболочки ------------------------------------- */
  function shellConfig() {
    return {
      title: 'Обжим витой пары',
      subtitle: 'Прямой обжим · T568B · сетевые технологии',
      steps: D.STEPS,
      checklist: D.CHECKLIST,
      theory: D.THEORY.map((t) => ({
        title: t.title,
        html: t.html,
        schemeHTML: t.scheme === 'B'
          ? global.AppIcons.schemeHTML('T568B', { caption: 'стандарт задания' })
          : t.scheme === 'cross'
            ? global.AppIcons.schemeHTML('T568B', { caption: 'конец A' }) +
              global.AppIcons.schemeHTML('T568A', { caption: 'конец B — кроссовер' })
            : ''
      })),
      tools: D.TOOLS,
      hintScheme: () => global.AppIcons.schemeHTML('T568B', { caption: 'обжим по заданию' }),
      toolArt: (id) => (id === 'stripper' ? global.APP_GFX.stripperArt() : id === 'crimper' ? global.APP_GFX.crimperArt() : global.AppIcons.icon(id)),
      getState: S.get,
      save: S.save,
      actions: {
        go: go,
        reset: resetWork,
        applyMode: applyMode,
        stepDone: stepDone,
        ready: S.readiness,
        checklistStates: checklistStates,
        score: S.computeScore,
        endsLabel: (s) => 'активный конец: ' + s.activeEnd
      },
      decorateChecklistItem: decorateChecklistItem,
      modeNames: { training: 'Тренировка', exam: 'Экзамен' },
      texts: {
        modeConfirm: (next) =>
          next === 'exam'
            ? {
                title: 'Перейти в режим экзамена?',
                text: 'В экзамене жилы не возвращаются на место: ошибки в порядке станут видны только на тестере. Текущая работа начнётся заново.'
              }
            : {
                title: 'Вернуться в тренировку?',
                text: 'В тренировке каждая неверная жила сразу возвращается. Текущая работа начнётся заново.'
              },
        modeToast: (next) =>
          next === 'exam'
            ? 'Порядок жил проверяется тестером в конце.'
            : 'Неверная жила подсвечивается и возвращается в пучок.',
        resetConfirm: {
          title: 'Сбросить работу?',
          text: 'Весь прогресс, собранный кабель и ответы будут удалены. Отменить это действие нельзя.',
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
    } else if (s.ends.A.strip.done || s.ends.A.crimped || s.quiz.checked) {
      C.toast('info', 'Работа восстановлена', 'Продолжаем с шага ' + s.step + '.');
    } else {
      C.toast('info', 'Начало работы', 'Снимите оболочку кабеля, разложите жилы по T568B и обожмите коннектор.');
    }

    C.lms.ready({
      work: 'Обжим витой пары (Straight-Through, T568B)',
      maxScore: 100,
      simulator: 'twisted-pair'
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
