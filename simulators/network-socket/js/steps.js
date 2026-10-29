/* ==========================================================================
   steps.js — шаги 1–6 тренажёра «Монтаж сетевых розеток»:
   набор инструментов, подготовка кабеля, разделка, заделка, сборка, проверка.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const G = global.APP_GFX;
  const C = global.AppCore;
  const S = global.AppState;
  const $ = C.$;
  const $$ = C.$$;
  const esc = C.esc;
  const STD = D.STANDARDS.T568B;
  const MAX_STRIP_CM = D.SETTINGS.stripHardMaxCm;

  const fx = { bounceWire: null, bounceContact: null };
  let pickedWire = null;
  let pickedCable = false;

  /* ---------- Помощники -------------------------------------------------- */
  function fmtCm(v) {
    return Number(v || 0).toFixed(1).replace('.', ',') + ' см';
  }

  function prevBtn(step) {
    if (step <= 1) return '';
    return '<button type="button" class="btn btn--ghost btn--sm" data-act="prev" data-focus-key="prev">' +
      G.icon('arrowLeft') + 'Назад</button>';
  }

  function nextBtn(step, enabled, label) {
    return (
      '<button type="button" class="btn btn--primary" data-act="next" data-focus-key="next"' +
      (enabled ? '' : ' disabled') + '>' + esc(label || 'Далее') + G.icon('arrowRight') + '</button>'
    );
  }

  function hintBtn() {
    return '<button type="button" class="btn btn--sm" data-act="hint">' + G.icon('hint') + 'Схема B</button>';
  }

  function actionsHTML(hintText, buttons) {
    return '<span class="stage-actions__hint">' + (hintText || '') + '</span><div class="stage-actions__main">' + buttons + '</div>';
  }

  function progress(s, step) {
    switch (step) {
      case 1:
        return s.kit.checked ? 100 : Math.round((s.kit.selected.length / D.KIT.filter((k) => k.required).length) * 70);
      case 2:
        return s.prep.done ? 100 : s.prep.loaded ? 50 : 15;
      case 3:
        return Math.round((S.filledCount(s) / 8) * 100);
      case 4:
        return Math.round((S.punchedCount(s) / 8) * 100);
      case 5: {
        const parts = [s.mount.tie, s.mount.module, s.mount.screws[0] && s.mount.screws[1]];
        return Math.round((parts.filter(Boolean).length / parts.length) * 100);
      }
      case 6:
        return s.tester.tested ? 100 : s.tester.plugged.main ? 45 : 10;
      default:
        return s.quiz.checked ? 60 : 20;
    }
  }

  function stageCard(step, o) {
    const s = S.get();
    const st = D.STEPS[step - 1];
    const p = progress(s, step);
    return (
      '<div class="step-panel" id="step-' + step + '" data-step="' + step + '">' +
      '<div class="stage__card">' +
      '<header class="stage__head">' +
      '<span class="stage__badge" aria-hidden="true">' + step + '</span>' +
      '<div class="stage__titles">' +
      '<h2 class="stage__title">' + esc(o.title || st.title) + '</h2>' +
      '<p class="stage__sub">' + esc(o.sub || st.sub) + '</p>' +
      '</div>' +
      '<div class="stage__head-right">' + (o.chip || '') +
      '<div class="step-progress" title="Выполнение шага">' +
      '<div class="step-progress__bar"><div class="step-progress__fill" style="width:' + p + '%"></div></div>' +
      '<span class="step-progress__label">' + p + '% шага</span>' +
      '</div></div></header>' +
      o.body +
      (o.caption ? '<div class="bench__caption">' + G.icon('info') + '<span>' + o.caption + '</span></div>' : '') +
      '<div class="stage-actions">' + (o.actions || '') + '</div>' +
      '</div></div>'
    );
  }

  function canAdvance(s) {
    switch (s.step) {
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
        return false;
    }
  }

  function bindCommon(root, s) {
    $$('[data-act="next"]', root).forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (!canAdvance(s)) {
          C.toast('warn', 'Шаг не завершён', 'Сначала выполните действие на верстаке.');
          return;
        }
        global.App.go(s.step + 1);
      });
    });
    $$('[data-act="prev"]', root).forEach((b) => {
      b.addEventListener('click', () => global.App.go(s.step - 1));
    });
    $$('[data-act="hint"]', root).forEach((b) => {
      b.addEventListener('click', () => global.Shell.setHint(true));
    });
  }

  /* ---------- Жилы-чипы -------------------------------------------------- */
  function chipHTML(id) {
    const w = D.WIRES[id];
    const bounce = fx.bounceWire === id ? ' is-bounce' : '';
    return (
      '<button type="button" class="chip-wire chip-wire--' + w.color + (w.striped ? '' : ' chip-wire--solid') + bounce + '"' +
      ' data-wire-id="' + id + '" data-focus-key="wire-' + id + '" aria-pressed="false"' +
      ' aria-label="Жила ' + w.abbr + ', ' + w.name + '">' +
      '<span class="chip-wire__abbr">' + w.abbr + '</span></button>'
    );
  }

  function wireSpan(id) {
    const w = D.WIRES[id];
    return '<span class="chip-wire chip-wire--' + w.color + (w.striped ? '' : ' chip-wire--solid') + '" data-wire-id="' + id + '">' +
      '<span class="chip-wire__abbr">' + w.abbr + '</span></span>';
  }

  function rulerHTML() {
    let out = '<span class="ruler__ok" style="right:' + ((2 / MAX_STRIP_CM) * 100).toFixed(2) + '%;width:' +
      ((0.5 / MAX_STRIP_CM) * 100).toFixed(2) + '%"></span>';
    for (let i = 0; i <= MAX_STRIP_CM * 2; i++) {
      const cm = i * 0.5;
      const major = i % 2 === 0;
      out += '<span class="ruler__tick' + (major ? ' ruler__tick--major' : '') + '" style="right:' +
        ((cm / MAX_STRIP_CM) * 100).toFixed(2) + '%">' + (major ? '<span>' + cm.toFixed(0) + '</span>' : '') + '</span>';
    }
    return out;
  }

  /* ======================================================================
     ШАГ 1 — набор инструментов
     ====================================================================== */
  function kitView(s) {
    const selected = s.kit.selected;
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Верстак · подготовка</span>' +
      '<div class="kit" id="kit-grid" role="group" aria-label="Инструменты и материалы">' +
      D.KIT.map((item) => G.kitHTML(item, selected.indexOf(item.id) !== -1)).join('') +
      '</div>' +
      '<div class="kit__footer">' +
      '<span class="chip" id="kit-count">выбрано ' + selected.length + '</span>' +
      '<span class="muted" style="font-size:0.78rem">Отметьте всё, что понадобится для монтажа розетки. Лишнее — тоже ошибка.</span>' +
      '</div>' +
      '</div>';

    return stageCard(1, {
      body: body,
      caption:
        'Для розетки нужны: стриппер, заделочный нож, бокорезы, модуль keystone, корпус розетки, стяжка и отвёртка. ' +
        'Кримпер и коннектор RJ-45 при монтаже розетки не используются.',
      actions:
        hintBtn() +
        '<button type="button" class="btn btn--sm" data-act="kit-clear">Сбросить выбор</button>' +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn" data-act="kit-check" data-focus-key="kit-check">Проверить набор</button>' +
        nextBtn(1, canAdvance(s)) +
        '</div>'
    });
  }

  function mountKit(root, s) {
    function paintStates(states) {
      $$('.kit-card', root).forEach((card) => {
        const id = card.getAttribute('data-kit');
        card.classList.remove('is-right', 'is-wrong', 'is-missed');
        const st = states && states[id];
        if (st) card.classList.add('is-' + st);
      });
    }

    $$('.kit-card', root).forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-kit');
        const i = s.kit.selected.indexOf(id);
        if (i === -1) s.kit.selected.push(id);
        else s.kit.selected.splice(i, 1);
        const on = i === -1;
        card.classList.toggle('is-selected', on);
        card.setAttribute('aria-pressed', on ? 'true' : 'false');
        const counter = $('#kit-count', root);
        if (counter) counter.textContent = 'выбрано ' + s.kit.selected.length;
        paintStates(null);
        S.save();
      });
    });

    const clear = $('[data-act="kit-clear"]', root);
    if (clear) {
      clear.addEventListener('click', () => {
        s.kit.selected = [];
        S.save();
        global.App.render();
      });
    }

    const check = $('[data-act="kit-check"]', root);
    if (check) {
      check.addEventListener('click', () => {
        const states = {};
        let missed = 0;
        let extra = 0;
        D.KIT.forEach((item) => {
          const picked = s.kit.selected.indexOf(item.id) !== -1;
          if (item.required && picked) states[item.id] = 'right';
          else if (item.required && !picked) {
            states[item.id] = 'missed';
            missed += 1;
          } else if (!item.required && picked) {
            states[item.id] = 'wrong';
            extra += 1;
          }
        });
        paintStates(states);

        if (!missed && !extra) {
          s.kit.checked = true;
          s.kit.checkedOnce = true;
          S.logEntry('Набор инструментов собран верно');
          S.save();
          C.toast('ok', 'Набор собран', 'Всё необходимое на месте, лишнего нет.');
          global.App.render();
          return;
        }

        s.kit.mistakes += 1;
        S.save();
        if (extra && !missed) {
          C.toast('error', 'Есть лишние инструменты', 'Кримпер и коннектор RJ-45 для монтажа розетки не нужны: они для обжима кабеля.');
        } else if (missed && !extra) {
          C.toast('warn', 'Не всё собрано', 'Не хватает ' + missed + ' инструмент(ов) — отмечены пунктиром.');
        } else {
          C.toast('error', 'Набор неверный', 'Не хватает ' + missed + ', лишних ' + extra + '. Поправьте выбор и проверьте снова.');
        }
        C.announce('Набор неверный: не хватает ' + missed + ', лишних ' + extra);
      });
    }
  }

  /* ======================================================================
     ШАГ 2 — подготовка кабеля
     ====================================================================== */
  function prepIntroView(s) {
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Верстак · подготовка кабеля</span>' +
      '<div class="bench-intro">' +
      '<button type="button" class="cable-piece draggable" id="cable-piece" data-focus-key="cable"' +
      (pickedCable ? ' aria-pressed="true"' : ' aria-pressed="false"') +
      ' aria-label="Кабель UTP. Перетащите в стриппер или нажмите Enter">' +
      '<span class="cable-piece__art" aria-hidden="true">' +
      '<span class="cable-piece__jacket"></span>' +
      '<span class="cable-piece__wires">' + STD.order.map((id) => G.wireHTML(id)).join('') + '</span>' +
      '</span>' +
      '<span class="cable-piece__label">Кабель UTP</span>' +
      '<span class="cable-piece__hint">перетащите в стриппер<br>или нажмите Enter</span>' +
      '</button>' +
      '<span class="bench-intro__arrow" aria-hidden="true">→</span>' +
      '<div class="dropzone bench-tool" id="strip-zone" data-drop="strip" tabindex="0" role="button"' +
      ' aria-label="Стриппер. Перетащите сюда кабель или нажмите Enter">' +
      '<div class="stripper" aria-hidden="true">' + G.stripperArt() + '</div>' +
      '<span class="bench-tool__label">Стриппер — сюда</span>' +
      '</div>' +
      '</div></div>';

    return stageCard(2, {
      body: body,
      caption:
        'Стриппер снимает внешнюю оболочку. Возьмите кабель и перенесите его в губки инструмента. ' +
        'С клавиатуры: Enter на кабеле, затем Tab до стриппера и Enter.',
      actions: actionsHTML('Шаг 2 из 7', prevBtn(2) + hintBtn() + nextBtn(2, false))
    });
  }

  function prepWorkView(s) {
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Стриппер · зачистка оболочки</span>' +
      '<div class="strip-work">' +
      '<div class="strip-readout" id="strip-readout">' +
      '<span class="strip-readout__value" id="strip-value">0,0 см</span>' +
      '<span>норма 2,0–2,5 см</span>' +
      '</div>' +
      '<div class="strip-work__grid">' +
      '<div class="strip-work__fixed"></div>' +
      '<div class="strip-work__zone" id="strip-zone-art">' +
      '<div class="strip-work__clip">' +
      '<div class="strip-work__exposed" id="strip-exposed" style="width:0%">' +
      STD.order.map((id) => G.wireHTML(id)).join('') + '</div>' +
      '<div class="strip-work__jacket" id="strip-jacket" style="width:100%"></div>' +
      '</div>' +
      '<button type="button" class="strip-grip" id="strip-grip" role="slider" data-focus-key="strip-grip"' +
      ' aria-label="Протянуть оболочку" aria-valuemin="0" aria-valuemax="' + MAX_STRIP_CM * 10 + '"' +
      ' aria-valuenow="0" aria-valuetext="0 сантиметров" aria-orientation="horizontal"></button>' +
      '</div></div>' +
      '<div class="strip-work__rules"><div></div>' +
      '<div class="ruler ruler--strip" aria-hidden="true">' + rulerHTML() + '</div>' +
      '</div></div></div>';

    return stageCard(2, {
      sub: 'Потяните жёлтую рукоятку влево и снимите 2–2,5 см оболочки.',
      body: body,
      caption:
        'Тяните рукоятку влево — оболочка сходит с жил. Ориентир — зелёная зона на линейке. ' +
        'Изоляцию с самих жил не снимают: контакты IDC прорежут её при заделке.',
      actions:
        prevBtn(2) + hintBtn() +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn" data-act="strip-apply" data-focus-key="strip-apply">Снять изоляцию</button>' +
        nextBtn(2, false) +
        '</div>'
    });
  }

  function prepDoneView(s) {
    const len = s.prep.lengthCm;
    const pct = Math.min(100, (len / MAX_STRIP_CM) * 100);
    const inRange = len >= D.SETTINGS.stripMinCm && len <= D.SETTINGS.stripMaxCm;
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Готово · подготовка</span>' +
      '<div class="strip-work">' +
      '<div class="strip-readout ' + (inRange ? 'is-ok' : 'is-bad') + '">' +
      '<span class="strip-readout__value">' + fmtCm(len) + '</span>' +
      '<span>' + (inRange ? 'в пределах нормы 2,0–2,5 см' : 'вне нормы — оболочка не попадёт под зажим') + '</span>' +
      '</div>' +
      '<div class="strip-work__grid">' +
      '<div class="strip-work__fixed"></div>' +
      '<div class="strip-work__zone"><div class="strip-work__clip">' +
      '<div class="strip-work__exposed" style="width:' + pct.toFixed(2) + '%">' + STD.order.map((id) => G.wireHTML(id)).join('') + '</div>' +
      '<div class="strip-work__jacket" style="width:' + (100 - pct).toFixed(2) + '%"></div>' +
      '</div></div></div>' +
      '<div class="strip-work__rules"><div></div><div class="ruler ruler--strip" aria-hidden="true">' + rulerHTML() + '</div></div>' +
      '</div>' +
      '<div class="prep-note ' + (s.prep.wiresStripped ? 'is-bad' : 'is-ok') + '" id="prep-note">' +
      '<div class="prep-note__row">' +
      '<span class="prep-note__state" aria-hidden="true">' + (s.prep.wiresStripped ? '!' : '✓') + '</span>' +
      '<span>' + (s.prep.wiresStripped
        ? 'Жилы зачищены от изоляции — так делать нельзя: медь окисляется, контакт пропадает.'
        : 'Жилы не зачищены — правильно: контакты IDC сами прорежут изоляцию.') + '</span>' +
      '</div>' +
      '<div class="row" style="margin-top:8px">' +
      (s.prep.wiresStripped
        ? '<button type="button" class="btn btn--sm" data-act="wires-restore">Вернуть изоляцию</button>'
        : '<button type="button" class="btn btn--sm" data-act="wires-strip">Снять изоляцию с жил</button>') +
      '</div>' +
      '</div></div>';

    return stageCard(2, {
      title: 'Оболочка снята',
      sub: 'Шаг выполнен: ' + fmtCm(len) + '. Проверьте, что жилы остались в изоляции.',
      body: body,
      caption: 'Дальше — развести пары по цветной маркировке B на модуле розетки.',
      actions:
        prevBtn(2) +
        '<button type="button" class="btn btn--sm" data-act="strip-redo">Переделать</button>' +
        hintBtn() +
        '<div class="stage-actions__main">' + nextBtn(2, canAdvance(s)) + '</div>'
    });
  }

  function mountPrep(root, s) {
    if (s.prep.done) {
      const stripBtn = $('[data-act="wires-strip"]', root);
      if (stripBtn) {
        stripBtn.addEventListener('click', () => {
          s.prep.wiresStripped = true;
          S.logEntry('Ошибка: снята изоляция с жил');
          S.save();
          C.toast('error', 'Жилы зачищать нельзя', 'Контакт IDC прорезает изоляцию сам. Зачищенная медь окисляется — тестер покажет обрыв по синей паре.');
          global.App.render();
        });
      }
      const restore = $('[data-act="wires-restore"]', root);
      if (restore) {
        restore.addEventListener('click', () => {
          s.prep.wiresStripped = false;
          S.save();
          C.toast('ok', 'Жилы снова в изоляции', 'Дальше работаем как положено: заделка без зачистки.');
          global.App.render();
        });
      }
      const redo = $('[data-act="strip-redo"]', root);
      if (redo) {
        redo.addEventListener('click', () => {
          s.prep.done = false;
          s.prep.loaded = true;
          s.prep.lengthCm = 0;
          S.save();
          global.App.render();
        });
      }
      return;
    }

    if (!s.prep.loaded) {
      const cable = $('#cable-piece', root);
      const zone = $('#strip-zone', root);
      const load = () => {
        pickedCable = false;
        s.prep.loaded = true;
        S.save();
        C.toast('info', 'Кабель зажат в стриппере', 'Потяните жёлтую рукоятку влево на 2–2,5 см.');
        global.App.render();
      };
      if (cable) {
        C.enableDrag(cable, {
          targetSelector: '[data-drop="strip"]',
          onEnd: (info) => {
            if (info.target) load();
          }
        });
        cable.addEventListener('click', () => {
          pickedCable = !pickedCable;
          cable.classList.toggle('is-picked', pickedCable);
          cable.setAttribute('aria-pressed', pickedCable ? 'true' : 'false');
          C.announce(pickedCable ? 'Кабель взят. Перейдите к стрипперу и нажмите Enter.' : 'Кабель отпущен.');
          if (pickedCable && zone) zone.focus();
        });
        cable.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            cable.click();
          }
        });
      }
      if (zone) {
        const place = () => {
          if (!pickedCable) {
            C.toast('warn', 'Сначала возьмите кабель', 'Нажмите на кабель, затем — на стриппер.');
            return;
          }
          zone.classList.add('is-hit');
          load();
        };
        zone.addEventListener('click', place);
        zone.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            place();
          }
        });
      }
      return;
    }

    const grip = $('#strip-grip', root);
    const zoneArt = $('#strip-zone-art', root);
    const jacket = $('#strip-jacket', root);
    const exposed = $('#strip-exposed', root);
    const readout = $('#strip-readout', root);
    const valueEl = $('#strip-value', root);
    const applyBtn = $('[data-act="strip-apply"]', root);
    let value = 0;

    function paint(v) {
      value = Math.max(0, Math.min(MAX_STRIP_CM, Math.round(v * 10) / 10));
      const pct = (value / MAX_STRIP_CM) * 100;
      if (jacket) jacket.style.width = (100 - pct).toFixed(2) + '%';
      if (exposed) exposed.style.width = pct.toFixed(2) + '%';
      if (grip) {
        grip.style.left = (100 - pct).toFixed(2) + '%';
        grip.setAttribute('aria-valuenow', String(Math.round(value * 10)));
        grip.setAttribute('aria-valuetext', fmtCm(value));
      }
      if (valueEl) valueEl.textContent = fmtCm(value);
      if (readout) {
        const ok = value >= D.SETTINGS.stripMinCm && value <= D.SETTINGS.stripMaxCm;
        const bad = value > D.SETTINGS.stripMaxCm || (value > 0 && value < D.SETTINGS.stripMinCm);
        readout.classList.toggle('is-ok', ok);
        readout.classList.toggle('is-bad', bad);
      }
    }

    function finishStripAnimation() {
      const nextButton = root.querySelector('[data-act="next"]');
      if (nextButton) nextButton.disabled = false;
      const work = root.querySelector('.strip-work');
      if (work && !C.reducedMotion()) {
        work.classList.add('is-done-anim');
        global.setTimeout(() => global.App.render(), 330);
      } else {
        global.App.render();
      }
    }

    function evaluate() {
      const len = Math.round(value * 10) / 10;
      const min = D.SETTINGS.stripMinCm;
      const max = D.SETTINGS.stripMaxCm;
      if (len === 0) {
        C.toast('warn', 'Оболочка не снята', 'Потяните рукоятку влево хотя бы на 2 см.');
        return;
      }
      if (len >= min && len <= max) {
        s.prep.done = true;
        s.prep.lengthCm = len;
        S.logEntry('Снята оболочка ' + fmtCm(len));
        S.save();
        C.toast('ok', 'Оболочка снята: ' + fmtCm(len), 'Жилы целы. Оболочка нужного размера — зажим её удержит.');
        finishStripAnimation();
        return;
      }

      s.prep.attempts += 1;
      s.stats.stripRetries += 1;
      S.save();

      if (s.mode === 'exam') {
        s.prep.done = true;
        s.prep.lengthCm = len;
        S.logEntry('Снята оболочка ' + fmtCm(len) + ' (вне нормы)');
        S.save();
        C.toast('warn', 'Зачистка ' + fmtCm(len) + ' — вне нормы', len < min
          ? 'Короткая зачистка: оболочка не попадёт под зажим.'
          : 'Длинная зачистка: оболочку не за что зацепить, кабель будет выдёргиваться.');
        finishStripAnimation();
        return;
      }

      paint(value);
      if (readout) {
        readout.classList.add('is-shake');
        global.setTimeout(() => readout.classList.remove('is-shake'), 480);
      }
      C.toast('error', len < min ? 'Слишком мало изоляции' : 'Слишком много изоляции', len < min
        ? 'Нужно 2–2,5 см: иначе оболочка не зайдёт под зажим. Попробуйте ещё раз.'
        : 'Слишком длинная зачистка: зажим останется без оболочки. Норма — 2–2,5 см.');
      C.announce('Ошибка зачистки: ' + fmtCm(len));
    }

    if (grip && zoneArt) {
      let startValue = 0;
      C.enableDrag(grip, {
        lift: false,
        targetSelector: '.no-drop-target',
        onStart: () => {
          startValue = value;
          grip.classList.add('is-dragging');
        },
        onMove: (pt, dx) => {
          const width = zoneArt.getBoundingClientRect().width || 1;
          paint(startValue - (dx / width) * MAX_STRIP_CM);
        },
        onEnd: () => {
          grip.classList.remove('is-dragging');
          evaluate();
        }
      });

      grip.addEventListener('keydown', (ev) => {
        const stepCm = ev.shiftKey ? 0.5 : 0.1;
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          paint(value + stepCm);
        } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          paint(value - stepCm);
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          paint(0);
        } else if (ev.key === 'End') {
          ev.preventDefault();
          paint(MAX_STRIP_CM);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          evaluate();
        }
      });
    }

    if (applyBtn) applyBtn.addEventListener('click', evaluate);
  }

  /* ======================================================================
     ШАГ 3 — разделка жил по маркировке
     ====================================================================== */
  function bundleHTML(s) {
    const left = D.WIRE_IDS.filter((id) => s.contacts.indexOf(id) === -1);
    return (
      '<div class="bundle bundle--socket">' +
      '<span class="bundle__label">Пучок</span>' +
      '<div class="bundle__wires" id="bundle">' + left.map(chipHTML).join('') + '</div>' +
      '</div>'
    );
  }

  function wiringView(s) {
    const assigned = {};
    s.contacts.forEach((w, i) => {
      if (w) assigned[i] = w;
    });
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Модуль · разделка</span>' +
      '<div class="wire-scene">' +
      bundleHTML(s) +
      '<span class="insert-arrow" aria-hidden="true">→</span>' +
      G.keystoneHTML({ assigned: assigned, punched: {} }) +
      '</div></div>';

    return stageCard(3, {
      body: body,
      caption:
        'Сопоставляйте цвет жилы с цветной меткой на модуле: порядок контактов у разных моделей отличается, ' +
        'ориентир — маркировка B. Нажатие на заполненный контакт возвращает жилу в пучок.',
      actions:
        prevBtn(3) + hintBtn() +
        '<button type="button" class="btn btn--sm' + (S.filledCount(s) ? '' : ' hidden') + '" data-act="clear-wires">Очистить модуль</button>' +
        '<div class="stage-actions__main">' +
        '<span class="chip">' + S.filledCount(s) + ' / 8</span>' +
        nextBtn(3, canAdvance(s)) + '</div>'
    });
  }

  function tryPlace(root, s, wireId, idx) {
    const contact = D.MODULE_CONTACTS[idx];
    const current = s.contacts.indexOf(wireId);
    if (current === idx) return;

    if (s.mode === 'training' && contact.wire !== wireId) {
      s.wrongDrops += 1;
      fx.bounceWire = wireId;
      fx.bounceContact = idx;
      S.logEntry('Ошибка разделки: ' + D.WIRES[wireId].abbr + ' → контакт ' + contact.pin);
      S.save();
      C.toast(
        'error',
        'Не та маркировка',
        'На контакте ' + contact.pin + ' отмечен ' + D.WIRES[contact.wire].name +
          ' (' + D.WIRES[contact.wire].abbr + '), а вы ставите ' + D.WIRES[wireId].abbr + '. Жила возвращается в пучок.'
      );
      C.announce('Неверный контакт ' + contact.pin);
      pickedWire = null;
      global.App.render();
      return;
    }

    const occupant = s.contacts[idx];
    if (current >= 0) s.contacts[current] = null;
    if (occupant && occupant !== wireId && current >= 0) s.contacts[current] = occupant;
    s.contacts[idx] = wireId;
    s.punched[idx] = false;
    pickedWire = null;

    if (S.filledCount(s) === 8) {
      S.logEntry('Все жилы разведены по модулю');
      C.toast('ok', 'Все 8 жил разведены', 'Теперь заделайте их заделочным ножом.');
    } else {
      C.announce('Жила ' + D.WIRES[wireId].abbr + ' на контакте ' + contact.pin);
    }
    S.save();
    global.App.render();
  }

  function mountWiring(root, s) {
    $$('#bundle [data-wire-id]', root).forEach((chip) => {
      const wireId = chip.getAttribute('data-wire-id');
      C.enableDrag(chip, {
        targetSelector: '[data-drop="contact"]',
        onEnd: (info) => {
          if (!info.target) return;
          tryPlace(root, s, wireId, Number(info.target.getAttribute('data-contact')));
        }
      });
      chip.addEventListener('click', () => {
        pickedWire = pickedWire === wireId ? null : wireId;
        $$('.chip-wire', root).forEach((c) => {
          const on = c.getAttribute('data-wire-id') === pickedWire;
          c.classList.toggle('is-picked', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (pickedWire) {
          const empty = $$('.kterm', root).filter((t) => !s.contacts[Number(t.getAttribute('data-contact'))])[0] || $('.kterm', root);
          if (empty) empty.focus();
          C.announce('Жила ' + D.WIRES[wireId].abbr + ' взята. Выберите контакт стрелками и нажмите Enter.');
        }
      });
      chip.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          chip.click();
        }
      });
    });

    $$('.kterm [data-wire-id]', root).forEach((chip) => {
      const wireId = chip.getAttribute('data-wire-id');
      C.enableDrag(chip, {
        targetSelector: '[data-drop="contact"]',
        onEnd: (info) => {
          if (!info.target) return;
          tryPlace(root, s, wireId, Number(info.target.getAttribute('data-contact')));
        }
      });
    });

    const terms = $$('.kterm', root);
    terms.forEach((term, i) => {
      const idx = Number(term.getAttribute('data-contact'));
      const activate = () => {
        if (pickedWire) {
          tryPlace(root, s, pickedWire, idx);
          return;
        }
        const occupant = s.contacts[idx];
        if (occupant) {
          s.contacts[idx] = null;
          s.punched[idx] = false;
          S.save();
          C.announce('Жила ' + D.WIRES[occupant].abbr + ' возвращена в пучок.');
          global.App.render();
          return;
        }
        const nextWire = D.WIRE_IDS.filter((id) => s.contacts.indexOf(id) === -1)[0];
        if (nextWire) {
          pickedWire = nextWire;
          const chip = $('#bundle [data-wire-id="' + nextWire + '"]', root);
          if (chip) chip.classList.add('is-picked');
          C.announce('Взята жила ' + D.WIRES[nextWire].abbr + '. Нажмите Enter, чтобы завести её в контакт ' +
            D.MODULE_CONTACTS[idx].pin + '.');
        }
      };

      term.addEventListener('click', activate);
      term.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          activate();
        } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          (terms[i + 1] || terms[0]).focus();
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          (terms[i - 1] || terms[terms.length - 1]).focus();
        } else if (ev.key === 'Escape') {
          pickedWire = null;
          $$('.chip-wire', root).forEach((c) => c.classList.remove('is-picked'));
          C.announce('Выбор снят.');
        }
      });
    });

    const clear = $('[data-act="clear-wires"]', root);
    if (clear) {
      clear.addEventListener('click', () => {
        s.contacts = new Array(8).fill(null);
        s.punched = new Array(8).fill(false);
        pickedWire = null;
        S.save();
        global.App.render();
        C.announce('Модуль очищен.');
      });
    }
  }

  /* ======================================================================
     ШАГ 4 — заделка punch-down
     ====================================================================== */
  function punchView(s) {
    const assigned = {};
    const punched = {};
    s.contacts.forEach((w, i) => {
      if (w) assigned[i] = w;
      if (s.punched[i]) punched[i] = true;
    });

    const body =
      '<div class="bench">' +
      '<span class="bench__label">Модуль · заделка IDC</span>' +
      '<div class="wire-scene">' +
      '<div class="punch-tool" id="punch-art" aria-hidden="true">' + G.punchToolArt() + '</div>' +
      G.keystoneHTML({ assigned: assigned, punched: punched }) +
      '</div>' +
      '<div class="punch-bar">' +
      '<span class="chip ' + (S.allPunched(s) ? 'chip--green' : 'chip--blue') + '">заделано ' + S.punchedCount(s) + ' / 8</span>' +
      '<span class="muted" style="font-size:0.78rem">Нажмите на контакт, чтобы заделать жилу. Нож срежет излишек.</span>' +
      '</div></div>';

    return stageCard(4, {
      body: body,
      caption:
        'Заделочный нож вдавливает жилу в прорезь контакта IDC — она прорезает изоляцию и срезает излишек. ' +
        'С клавиатуры: Tab до контакта, Enter. Кримпер для розетки не подходит.',
      actions:
        prevBtn(4) + hintBtn() +
        '<button type="button" class="btn btn--sm" data-act="use-crimper">Попробовать кримпером</button>' +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn" data-act="punch-all" data-focus-key="punch-all">Заделать все</button>' +
        nextBtn(4, canAdvance(s)) + '</div>'
    });
  }

  function mountPunch(root, s) {
    const tool = $('#punch-art', root);
    const terms = $$('.kterm', root);

    function punch(idx, silent) {
      const wire = s.contacts[idx];
      const term = terms.filter((t) => Number(t.getAttribute('data-contact')) === idx)[0];
      if (!wire) {
        C.toast('warn', 'Контакт пуст', 'Сначала заведите в него жилу на шаге разделки.');
        return false;
      }
      if (s.punched[idx]) {
        if (!silent) C.toast('info', 'Жила уже заделана', 'Повторно давить контакт не нужно — можно повредить пружину IDC.');
        return false;
      }
      s.punched[idx] = true;
      S.logEntry('Заделана жила ' + D.WIRES[wire].abbr + ' (контакт ' + D.MODULE_CONTACTS[idx].pin + ')');
      S.save();

      if (term) {
        term.classList.add('is-punched', 'is-hit');
        global.setTimeout(() => term.classList.remove('is-hit'), 420);
      }
      if (tool) {
        tool.classList.add('is-pressing');
        global.setTimeout(() => tool.classList.remove('is-pressing'), 240);
      }
      if (global.navigator && global.navigator.vibrate) {
        try { global.navigator.vibrate(15); } catch (e) { /* noop */ }
      }
      return true;
    }

    terms.forEach((term) => {
      const idx = Number(term.getAttribute('data-contact'));
      const act = () => {
        const ok = punch(idx, false);
        if (ok) {
          if (S.allPunched(s)) {
            C.toast('ok', 'Все 8 жил заделаны', 'Можно собирать розетку.');
            global.App.render();
          } else {
            // обновляем только метку прогресса и кнопку, чтобы не терять фокус
            const bar = $('.punch-bar .chip', root);
            if (bar) bar.textContent = 'заделано ' + S.punchedCount(s) + ' / 8';
            const nextButton = $('[data-act="next"]', root);
            if (nextButton) nextButton.disabled = !S.allPunched(s);
            term.setAttribute('aria-label', 'Контакт ' + D.MODULE_CONTACTS[idx].pin + ', жила заделана');
          }
        }
      };
      term.addEventListener('click', act);
      term.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          act();
        }
      });
    });

    const all = $('[data-act="punch-all"]', root);
    if (all) {
      all.addEventListener('click', () => {
        let n = 0;
        for (let i = 0; i < 8; i++) {
          if (s.contacts[i] && !s.punched[i]) {
            punch(i, true);
            n += 1;
          }
        }
        if (n) {
          C.toast('ok', 'Заделано жил: ' + n, 'Излишки срезаны, можно собирать розетку.');
          global.App.render();
        } else {
          C.toast('info', 'Нечего заделывать', 'Все контакты уже заделаны.');
        }
      });
    }

    const crimper = $('[data-act="use-crimper"]', root);
    if (crimper) {
      crimper.addEventListener('click', () => {
        s.usedCrimper = true;
        S.save();
        C.toast(
          'error',
          'Кримпер здесь не работает',
          'Он обжимает коннекторы RJ-45 на кабеле. Контакты розетки заделывают только заделочным ножом (punch-down).'
        );
      });
    }
  }

  /* ======================================================================
     ШАГ 5 — сборка розетки
     ====================================================================== */
  function mountView(s) {
    const m = s.mount;
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Сборка · корпус розетки</span>' +
      '<div class="mount-scene">' +
      G.housingHTML({ tie: m.tie, module: m.module, screws: m.screws }) +
      '<div class="mount-steps">' +
      stepRow(1, 'Зафиксировать кабель стяжкой', m.tie, 'data-act="tie"') +
      stepRow(2, 'Поставить модуль в корпус', m.module, 'data-act="module"') +
      stepRow(3, 'Затянуть винты рамки', m.screws[0] && m.screws[1], 'data-act="screws"') +
      '</div>' +
      '</div></div>';

    return stageCard(5, {
      body: body,
      caption:
        'Кабель фиксируют стяжкой на оболочке, модуль защёлкивают в корпусе ключом вверх, рамку прикручивают винтами ' +
        'до упора — перетягивать нельзя, пластик трескается.',
      actions:
        prevBtn(5) + hintBtn() +
        '<div class="stage-actions__main">' + nextBtn(5, canAdvance(s)) + '</div>'
    });
  }

  function stepRow(n, text, done, act) {
    return (
      '<div class="mount-step' + (done ? ' is-done' : '') + '">' +
      '<span class="mount-step__num" aria-hidden="true">' + (done ? '✓' : n) + '</span>' +
      '<span class="mount-step__text">' + esc(text) + '</span>' +
      '<button type="button" class="btn btn--sm" ' + act + ' ' + (done ? 'disabled' : '') + '>' +
      (done ? 'готово' : 'выполнить') + '</button>' +
      '</div>'
    );
  }

  function mountMount(root, s) {
    const tie = $('[data-act="tie"]', root);
    if (tie)
      tie.addEventListener('click', () => {
        s.mount.tie = true;
        S.logEntry('Кабель зафиксирован стяжкой');
        S.save();
        C.toast('ok', 'Кабель зафиксирован', 'Стяжка стоит на оболочке — жилы не вырвутся.');
        global.App.render();
      });

    const mod = $('[data-act="module"]', root);
    if (mod)
      mod.addEventListener('click', () => {
        if (!S.allPunched(s)) {
          C.toast('warn', 'Жилы не заделаны', 'Сначала заделайте все 8 контактов заделочным ножом.');
          return;
        }
        if (!s.mount.tie && s.mode === 'training') {
          C.toast('warn', 'Сначала стяжка', 'Без фиксации кабеля модуль ставить рано: жилы можно вырвать из контактов.');
          return;
        }
        s.mount.module = true;
        S.logEntry('Модуль установлен в корпус');
        S.save();
        C.toast('ok', 'Модуль в корпусе', 'Защёлки зафиксировали модуль. Осталось прикрутить рамку.');
        global.App.render();
      });

    const screwsBtn = $('[data-act="screws"]', root);
    if (screwsBtn)
      screwsBtn.addEventListener('click', () => {
        if (!s.mount.module) {
          C.toast('warn', 'Модуль не установлен', 'Сначала защёлкните модуль в корпусе.');
          return;
        }
        global.App.render();
        const screw = $('[data-screw="0"]');
        if (screw) screw.focus();
        C.toast('info', 'Затяните винты', 'Нажмите на каждый винт рамки. Перетягивать не нужно.');
      });

    $$('[data-screw]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-screw'));
        if (!s.mount.module) {
          C.toast('warn', 'Рамка пока не нужна', 'Сначала поставьте модуль в корпус.');
          return;
        }
        if (s.mount.screws[i]) {
          s.mount.overtight += 1;
          S.save();
          C.toast('warn', 'Винт уже затянут', 'Перетягивать нельзя: треснет рамка или сорвётся резьба.');
          return;
        }
        s.mount.screws[i] = true;
        S.save();
        btn.classList.add('is-tight');
        if (s.mount.screws[0] && s.mount.screws[1]) {
          S.logEntry('Рамка прикручена');
          C.toast('ok', 'Розетка собрана', 'Рамка закреплена. Пора проверить линию тестером.');
          global.App.render();
        } else {
          C.toast('info', 'Винт затянут', 'Остался второй винт рамки.');
          global.App.render();
        }
      });
    });
  }

  /* ======================================================================
     ШАГ 6 — проверка тестером
     ====================================================================== */
  function ledStates(s) {
    const main = new Array(8).fill('');
    const remote = new Array(8).fill('');
    const res = s.tester.result;
    if (!s.tester.tested || !res) return { main: main, remote: remote };
    res.pairs.forEach((p) => {
      if (p.b) {
        const cls = p.b === p.a ? 'is-on' : 'is-on--warn';
        main[p.a - 1] = cls;
        remote[p.b - 1] = cls;
      } else {
        main[p.a - 1] = 'is-open';
      }
    });
    return { main: main, remote: remote };
  }

  function ledsHTML(prefix, states) {
    let out = '';
    for (let i = 1; i <= 8; i++) {
      const cls = states && states[i - 1] ? ' ' + states[i - 1] : '';
      out +=
        '<div class="led' + cls + '" data-led="' + prefix + '-' + i + '">' +
        '<span class="led__lamp" aria-hidden="true"></span>' +
        '<span class="led__num">' + i + '</span>' +
        '</div>';
    }
    return out;
  }

  function pairsText(list) {
    return list.map((p) => p.a + '-' + (p.b === null ? '×' : p.b)).join(', ');
  }

  function testView(s) {
    const plugged = s.tester.plugged.main && s.tester.plugged.remote;
    const res = s.tester.result;
    const ls = ledStates(s);

    const body =
      '<div class="bench">' +
      '<span class="bench__label">Проверка · розетка и линия</span>' +
      '<div class="tester">' +
      '<div class="tester__row">' +
      '<div class="tester__unit">' +
      '<div class="tester__unit-title"><span>Основной блок</span><span>MAIN</span></div>' +
      '<div class="tester__socket' + (s.tester.plugged.main ? ' is-plugged' : '') + '">' + G.socketArt() +
      '<span>' + (s.tester.plugged.main ? 'Патч-корд в розетке' : 'Гнездо свободно') + '</span></div>' +
      '<div class="leds" id="leds-main" aria-hidden="true">' + ledsHTML('main', ls.main) + '</div>' +
      '<div class="tester__pair" id="pair-main">' + (res ? (res.ok ? 'все пары в порядке' : 'проверьте пары: ' + pairsText(res.pairs)) : '') + '</div>' +
      '</div>' +
      '<div class="tester__unit">' +
      '<div class="tester__unit-title"><span>Удалённый блок</span><span>REMOTE</span></div>' +
      '<div class="tester__socket' + (s.tester.plugged.remote ? ' is-plugged' : '') + '">' + G.socketArt() +
      '<span>' + (s.tester.plugged.remote ? 'Второй конец линии' : 'Гнездо свободно') + '</span></div>' +
      '<div class="leds" id="leds-remote" aria-hidden="true">' + ledsHTML('remote', ls.remote) + '</div>' +
      '<div class="tester__pair" id="pair-remote">' + (res ? (res.ok ? 'все пары в порядке' : res.crossover.length ? 'перекрёст: ' + pairsText(res.crossover) : 'обрыв: ' + pairsText(res.opens)) : '') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="tester__result' + (res ? (res.ok ? ' tester__result--ok' : ' tester__result--bad') : '') + '" id="test-result">' +
      (res
        ? (res.ok
          ? G.icon('check') + '<span>Розетка исправна: все 8 жил заделаны по маркировке B.</span>'
          : G.icon('warn') + '<span>' + (res.crossover.length
            ? 'Обнаружен перекрёст: ' + pairsText(res.crossover) + '.'
            : s.prep.wiresStripped
              ? 'Нет связи по жилам: ' + pairsText(res.opens) + ' — зачищенные жилы не держатся в контакте IDC.'
              : 'Нет связи по жилам: ' + pairsText(res.opens) + '.') + '</span>')
        : G.icon('info') + '<span>Подключите патч-корды и запустите проверку.</span>') +
      '</div>' +
      '</div>' +
      '<div class="tester__row" style="margin-top:12px">' +
      '<div class="inspect" style="flex:1 1 300px">' +
      '<div class="row row--between"><b>Осмотр контактов</b>' +
      '<button type="button" class="btn btn--sm" data-act="inspect">' + G.icon('eye') + 'Осмотреть</button></div>' +
      '<div id="inspect-result"' + (s.tester.inspected ? '' : ' hidden') + '>' +
      (s.tester.inspected
        ? '<div class="inspect-list">' +
          D.MODULE_CONTACTS.map((c) => {
            const w = s.contacts[c.idx];
            const punched = s.punched[c.idx];
            const state = !w ? 'bad' : punched ? 'ok' : 'warn';
            const text = !w ? 'нет жилы' : punched ? 'заделана' : 'не заделана';
            return '<div class="inspect__row">' +
              '<span class="inspect__icon inspect__icon--' + state + '">' + (state === 'ok' ? '✓' : state === 'warn' ? '!' : '×') + '</span>' +
              '<span>Контакт ' + c.pin + ' (' + D.WIRES[c.wire].abbr + '): ' + text + '</span></div>';
          }).join('') +
          '</div>'
        : '') +
      '</div>' +
      '</div>' +
      '<div class="inspect" style="flex:1 1 300px">' +
      '<div class="row row--between"><b>Без тестера</b>' +
      '<button type="button" class="btn btn--sm" data-act="link">' + G.icon('plug') + 'Подключить к ПК</button></div>' +
      '<div class="link-check" style="border:0;background:transparent;padding:8px 0">' +
      '<div class="device">' + G.deviceArt('pc') + '<span>Компьютер</span><span class="device__port' +
      (s.tester.link && res && res.ok ? ' is-on' : '') + '" id="port-pc"></span></div>' +
      '<span class="link-line' + (s.tester.link && res && res.ok ? ' is-on' : '') + '" id="link-line"></span>' +
      '<div class="device">' + G.deviceArt('router') + '<span>Коммутатор</span><span class="device__port' +
      (s.tester.link && res && res.ok ? ' is-on' : '') + '" id="port-router"></span></div>' +
      '</div>' +
      '<p class="muted" style="font-size:0.78rem;margin:0">' +
      (s.tester.link
        ? (res && res.ok ? 'Индикаторы линка горят — линия рабочая.' : 'Индикаторы не горят: линия нерабочая.')
        : 'Можно подключить патч-корд от розетки к ПК, а второй конец линии — к коммутатору и посмотреть на индикатор линка.') +
      '</p>' +
      '</div>' +
      '</div>' +
      '</div>';

    return stageCard(6, {
      sub: plugged ? 'Патч-корды подключены — запустите проверку.' : 'Подключите патч-корды к тестеру.',
      body: body,
      caption:
        'Индикаторы 1–8 должны загораться по порядку и одновременно на двух блоках. Перекрёст выглядит как 1-3, 2-6, 3-1, 6-2. ' +
        'Если индикатор не горит — обрыв или незаделанный контакт.',
      actions:
        prevBtn(6) +
        '<button type="button" class="btn btn--sm" data-act="plug" ' + (plugged ? 'disabled' : '') + '>' +
        G.icon('plug') + 'Подключить патч-корды</button>' +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn" data-act="run-test" ' + (plugged ? '' : 'disabled') + '>' +
        G.icon('tester') + 'Запустить тест</button>' +
        nextBtn(6, canAdvance(s), 'К отчёту') +
        '</div>'
    });
  }

  function runTest(root, s, btn) {
    const res = S.computeContinuity(s);
    btn.disabled = true;
    btn.textContent = 'Тест идёт…';

    const mainLeds = $$('#leds-main .led', root);
    const remoteLeds = $$('#leds-remote .led', root);
    const pairMain = $('#pair-main', root);
    const pairRemote = $('#pair-remote', root);
    const delay = C.reducedMotion() ? 40 : 240;

    const clear = () => mainLeds.concat(remoteLeds).forEach((l) => l.classList.remove('is-on', 'is-on--warn', 'is-on--bad'));
    let i = 0;

    function stepThrough() {
      clear();
      if (i >= 8) {
        finishTest();
        return;
      }
      const p = res.pairs[i];
      const main = mainLeds[i];
      if (main) main.classList.add(p.b ? 'is-on' : 'is-on--bad');
      if (p.b) {
        const remote = remoteLeds[p.b - 1];
        if (remote) remote.classList.add(p.b === p.a ? 'is-on' : 'is-on--warn');
      }
      if (pairMain) pairMain.textContent = 'пара ' + p.a + ' → ' + (p.b === null ? 'обрыв' : p.b);
      if (pairRemote) pairRemote.textContent = p.b === null ? 'нет сигнала' : 'принято на ' + p.b;
      i += 1;
      global.setTimeout(stepThrough, delay);
    }

    function finishTest() {
      clear();
      res.pairs.forEach((p) => {
        if (!p.b) return;
        const m = mainLeds[p.a - 1];
        const r = remoteLeds[p.b - 1];
        if (m) m.classList.add('is-on');
        if (r) r.classList.add(p.b === p.a ? 'is-on' : 'is-on--warn');
      });
      if (pairMain) pairMain.textContent = res.ok ? 'все пары в порядке' : 'есть проблемы';
      if (pairRemote) pairRemote.textContent = res.ok ? 'все пары в порядке' : 'проверьте заделку';

      s.tester.tested = true;
      s.tester.result = res;
      S.logEntry('Тест: ' + (res.ok ? 'линия исправна' : res.crossover.length ? 'перекрёст ' + pairsText(res.crossover) : 'обрывы ' + pairsText(res.opens)));
      S.save();
      global.App.render();

      if (res.ok) {
        C.toast('ok', 'Розетка исправна', 'Все 8 жил заделаны, линия прямая, перекрёста нет.');
      } else if (res.crossover.length) {
        C.toast('error', 'Перекрёст', 'Тестер показал ' + pairsText(res.crossover) + ': жилы заделаны не по маркировке B.');
      } else if (s.prep.wiresStripped) {
        C.toast('error', 'Обрыв по синей паре', 'Зачищенные жилы дали плохой контакт в IDC. Переделайте: изоляцию снимать нельзя.');
      } else {
        C.toast('error', 'Есть обрывы', 'Не звонятся: ' + pairsText(res.opens) + '. Проверьте заделку контактов.');
      }
    }

    global.setTimeout(stepThrough, 120);
  }

  function mountTest(root, s) {
    const plug = $('[data-act="plug"]', root);
    if (plug)
      plug.addEventListener('click', () => {
        s.tester.plugged.main = true;
        s.tester.plugged.remote = true;
        S.save();
        C.toast('info', 'Патч-корды подключены', 'Запустите тест — индикаторы пойдут по жилам.');
        global.App.render();
      });

    const inspect = $('[data-act="inspect"]', root);
    if (inspect)
      inspect.addEventListener('click', () => {
        s.tester.inspected = true;
        S.save();
        const bad = D.MODULE_CONTACTS.filter((c) => !s.contacts[c.idx] || !s.punched[c.idx]).length;
        if (!bad) C.toast('ok', 'Контакты в норме', 'Все 8 жил заделаны, излишков нет.');
        else C.toast('warn', 'Есть проблемы', 'Контактов без жилы или без заделки: ' + bad + '.');
        global.App.render();
      });

    const link = $('[data-act="link"]', root);
    if (link)
      link.addEventListener('click', () => {
        const res = S.computeContinuity(s);
        s.tester.link = true;
        s.tester.result = res;
        s.tester.tested = true;
        S.save();
        C.toast(res.ok ? 'ok' : 'error', res.ok ? 'Линк есть' : 'Линка нет', res.ok
          ? 'Порты загорелись: линия рабочая, все 8 жил в порядке.'
          : 'Порты не загорелись — проверьте заделку и маркировку.');
        global.App.render();
      });

    const run = $('[data-act="run-test"]', root);
    if (run)
      run.addEventListener('click', () => {
        if (!s.tester.plugged.main) {
          C.toast('warn', 'Тестер не подключён', 'Сначала подключите патч-корды.');
          return;
        }
        runTest(root, s, run);
      });
  }

  /* ======================================================================
     Состояния чек-листа и рендер
     ====================================================================== */
  function checklistStates(s) {
    const mounted = S.mountDone(s);
    const res = s.tester.result;
    return {
      kit: s.kit.checked ? 'done' : 'active',
      strip: s.prep.done ? 'done' : s.kit.checked ? 'active' : 'todo',
      wire: S.filledCount(s) === 8 ? 'done' : s.prep.done ? 'active' : 'todo',
      punch: S.allPunched(s) ? 'done' : S.filledCount(s) === 8 ? 'active' : 'todo',
      mount: mounted ? 'done' : S.allPunched(s) ? 'active' : 'todo',
      test: s.tester.tested ? (res && res.ok ? 'done' : 'error') : 'todo'
    };
  }

  /* ---------- Рендер шага ---------------------------------------------- */
  function render(s) {
    switch (s.step) {
      case 1:
        return kitView(s);
      case 2:
        if (s.prep.done) return prepDoneView(s);
        return s.prep.loaded ? prepWorkView(s) : prepIntroView(s);
      case 3:
        return wiringView(s);
      case 4:
        return punchView(s);
      case 5:
        return mountView(s);
      case 6:
        return testView(s);
      default:
        return global.AppReport.render(s);
    }
  }

  function mount(root, s) {
    bindCommon(root, s);
    switch (s.step) {
      case 1:
        mountKit(root, s);
        break;
      case 2:
        mountPrep(root, s);
        break;
      case 3:
        mountWiring(root, s);
        break;
      case 4:
        mountPunch(root, s);
        break;
      case 5:
        mountMount(root, s);
        break;
      case 6:
        mountTest(root, s);
        break;
      default:
        global.AppReport.mount(root, s);
    }
    fx.bounceWire = null;
    fx.bounceContact = null;
  }

  global.AppSteps = {
    render,
    mount,
    canAdvance,
    checklistStates,
    progress,
    pairsText
  };
})(window);
