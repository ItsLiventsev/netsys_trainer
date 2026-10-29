/* ==========================================================================
   steps.js — шаги 1–6: зачистка, раскладка жил, установка коннектора,
   обжим, второй конец и проверка тестером. Шаг 7 живёт в report.js.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const G = global.APP_GFX;
  const S = global.AppState;
  const U = global.AppCore;
  const Drag = global.AppDrag;
  const $ = U.$;
  const $$ = U.$$;
  const esc = G.esc;
  const STD = D.STANDARDS.T568B;
  const MAX_STRIP_CM = D.SETTINGS.stripHardMaxCm;

  // «эффекты» между перерисовками (анимация отскока и т.п.)
  const fx = { bounceWire: null, bounceSlot: null };

  // клавиатурное «взятие» жилы / кабеля
  let pickedWire = null;
  let pickedCable = false;

  /* ---------- Мелкие помощники ------------------------------------------ */
  function fmtCm(v) {
    return v.toFixed(1).replace('.', ',') + ' см';
  }

  function nextBtn(step, enabled, label) {
    return (
      '<button type="button" class="btn btn--primary" data-act="next" data-focus-key="next"' +
      (enabled ? '' : ' disabled') +
      '>' + esc(label || 'Далее') + G.icon('arrowRight') + '</button>'
    );
  }

  function prevBtn(step) {
    if (step <= 1) return '';
    return '<button type="button" class="btn btn--ghost btn--sm" data-act="prev" data-focus-key="prev">' + G.icon('arrowLeft') + 'Назад</button>';
  }

  function hintBtn() {
    return '<button type="button" class="btn btn--sm" data-act="hint">' + G.icon('hint') + 'Схема T568B</button>';
  }

  function actionsHTML(hintText, buttons) {
    return (
      '<span class="stage-actions__hint">' + (hintText || '') + '</span>' +
      '<div class="stage-actions__main">' + buttons + '</div>'
    );
  }

  function stepProgress(s, step) {
    const A = s.ends.A;
    const B = s.ends.B;
    if (step === 1) return A.strip.done ? 100 : A.strip.loaded ? 45 : 12;
    if (step === 2) return Math.round((A.order.filter(Boolean).length / 8) * 100);
    if (step === 3) return (A.trimmed ? 40 : 0) + (A.inserted ? Math.min(60, Math.round(A.depth * 0.6)) : 0);
    if (step === 4) return A.crimped ? 100 : Math.min(90, Math.round(A.force));
    if (step === 5) {
      const parts = [B.strip.done, B.order.every(Boolean), B.trimmed, B.inserted, B.crimped];
      return Math.round((parts.filter(Boolean).length / parts.length) * 100);
    }
    if (step === 6) return s.tester.tested ? 100 : s.tester.plugged.main ? 45 : 10;
    if (step === 7) return s.quiz.checked ? 60 : 20;
    return 0;
  }

  function stageCard(step, opts) {
    const s = S.get();
    const o = opts || {};
    const st = D.STEPS[step - 1];
    const progress = stepProgress(s, step);
    const endChip = o.end ? '<span class="chip chip--blue">Конец ' + o.end + '</span>' : '';
    return (
      '<div class="step-panel" id="step-' + step + '" data-step="' + step + '">' +
      '<div class="stage__card">' +
      '<header class="stage__head">' +
      '<span class="stage__badge" aria-hidden="true">' + step + '</span>' +
      '<div class="stage__titles">' +
      '<h2 class="stage__title">' + esc(o.title || st.title) + '</h2>' +
      '<p class="stage__sub">' + esc(o.sub || st.sub) + '</p>' +
      '</div>' +
      '<div class="stage__head-right">' + endChip +
      '<div class="step-progress" title="Выполнение шага">' +
      '<div class="step-progress__bar"><div class="step-progress__fill" style="width:' + progress + '%"></div></div>' +
      '<span class="step-progress__label">' + progress + '% шага</span>' +
      '</div></div></header>' +
      o.body +
      (o.caption ? '<div class="bench__caption">' + G.icon('info') + '<span>' + o.caption + '</span></div>' : '') +
      '<div class="stage-actions">' + (o.actions || '') + '</div>' +
      '</div></div>'
    );
  }

  /* ---------- Общие действия шага --------------------------------------- */
  function canAdvance(s) {
    const A = s.ends.A;
    const B = s.ends.B;
    switch (s.step) {
      case 1:
        return A.strip.done;
      case 2:
        return A.order.every(Boolean);
      case 3:
        return A.trimmed && A.inserted && (s.mode === 'exam' || A.depth >= D.SETTINGS.depthGood);
      case 4:
        return A.crimped;
      case 5:
        return (
          B.strip.done &&
          B.order.every(Boolean) &&
          B.trimmed &&
          B.inserted &&
          (s.mode === 'exam' || B.depth >= D.SETTINGS.depthGood) &&
          B.crimped
        );
      case 6:
        return s.tester.tested;
      default:
        return false;
    }
  }

  function canAdvanceStage(s) {
    if (s.step !== 5) return canAdvance(s);
    const B = s.ends.B;
    switch (s.bStage) {
      case 'sort':
        return B.order.every(Boolean);
      case 'insert':
        return B.trimmed && B.inserted && (s.mode === 'exam' || B.depth >= D.SETTINGS.depthGood);
      case 'crimp':
        return B.crimped;
      case 'done':
        return canAdvance(s);
      default:
        return false;
    }
  }

  const SUB_STAGES = ['strip', 'sort', 'insert', 'crimp', 'done'];

  function bindCommon(root, s) {
    $$('[data-act="next"]', root).forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (!canAdvanceStage(s)) {
          U.toast('warn', 'Шаг не завершён', 'Сначала выполните действие на верстаке.');
          return;
        }
        if (s.step === 5) {
          const idx = SUB_STAGES.indexOf(s.bStage);
          if (s.bStage === 'done') {
            global.App.go(6);
            return;
          }
          s.bStage = SUB_STAGES[Math.min(SUB_STAGES.length - 1, idx + 1)];
          S.save();
          global.App.render();
          return;
        }
        global.App.go(Math.min(7, s.step + 1));
      });
    });
    $$('[data-act="prev"]', root).forEach((b) => {
      b.addEventListener('click', () => global.App.go(Math.max(1, s.step - 1)));
    });
    $$('[data-act="hint"]', root).forEach((b) => {
      b.addEventListener('click', () => global.Shell.setHint(true));
    });
  }

  /* ---------- Вспомогательные данные жил -------------------------------- */
  function chipsHTML(ids, opts) {
    const o = opts || {};
    return ids
      .map((id) => {
        const w = D.WIRES[id];
        const bounce = fx.bounceWire === id ? ' is-bounce' : '';
        return (
          '<button type="button" class="chip-wire chip-wire--' + w.color + (w.striped ? '' : ' chip-wire--solid') + bounce + '"' +
          ' data-wire-id="' + id + '" data-focus-key="wire-' + id + '" aria-pressed="false"' +
          ' aria-label="Жила ' + w.abbr + ', ' + w.name + '">' +
          '<span class="chip-wire__abbr">' + w.abbr + '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  function wireSpan(id) {
    const w = D.WIRES[id];
    return (
      '<span class="chip-wire chip-wire--' + w.color + (w.striped ? '' : ' chip-wire--solid') + '" data-wire-id="' + id + '">' +
      '<span class="chip-wire__abbr">' + w.abbr + '</span></span>'
    );
  }

  function bareWires(ids, extraClass) {
    return ids.map((id) => G.wireHTML(id, extraClass)).join('');
  }

  /* ======================================================================
     ШАГ 1 — зачистка
     ====================================================================== */
  function stripIntroView(s, key, step) {
    const wires = STD.order;
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Верстак · конец ' + key + '</span>' +
      '<div class="bench-intro">' +
      '<button type="button" class="cable-piece draggable" id="cable-piece" data-focus-key="cable"' +
      (pickedCable ? ' aria-pressed="true"' : ' aria-pressed="false"') +
      ' aria-label="Кабель UTP. Перетащите в стриппер или нажмите Enter, чтобы взять">' +
      '<span class="cable-piece__art" aria-hidden="true">' +
      '<span class="cable-piece__jacket"></span>' +
      '<span class="cable-piece__wires">' + bareWires(wires) + '</span>' +
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

    return stageCard(step, {
      end: key,
      title: step === 5 ? 'Второй конец: зачистка оболочки' : D.STEPS[0].title,
      sub: step === 5 ? 'Повторите операцию для конца B — стандарт тот же, T568B.' : D.STEPS[0].sub,
      body: body,
      caption:
        'Стриппер снимает внешнюю оболочку, не задевая жилы. Возьмите кабель и перенесите его в губки инструмента. ' +
        'С клавиатуры: Enter на кабеле, затем Tab до стриппера и Enter.',
      actions: actionsHTML('Шаг ' + step + ' из 7', prevBtn(step) + hintBtn() + nextBtn(step, false))
    });
  }

  function rulerHTML() {
    let out = '<span class="ruler__ok" style="right:' + ((2 / MAX_STRIP_CM) * 100).toFixed(2) + '%;width:' + ((0.5 / MAX_STRIP_CM) * 100).toFixed(2) + '%"></span>';
    for (let i = 0; i <= MAX_STRIP_CM * 2; i++) {
      const cm = i * 0.5;
      const major = i % 2 === 0;
      out +=
        '<span class="ruler__tick' + (major ? ' ruler__tick--major' : '') + '" style="right:' +
        ((cm / MAX_STRIP_CM) * 100).toFixed(2) + '%">' +
        (major ? '<span>' + cm.toFixed(0) + '</span>' : '') +
        '</span>';
    }
    return out;
  }

  function stripWorkView(s, key, step) {
    const wires = STD.order;
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
      '<div class="strip-work__exposed" id="strip-exposed" style="width:0%">' + bareWires(wires) + '</div>' +
      '<div class="strip-work__jacket" id="strip-jacket" style="width:100%"></div>' +
      '</div>' +
      '<button type="button" class="strip-grip" id="strip-grip" role="slider" data-focus-key="strip-grip"' +
      ' aria-label="Протянуть оболочку" aria-valuemin="0" aria-valuemax="' + MAX_STRIP_CM * 10 + '"' +
      ' aria-valuenow="0" aria-valuetext="0 сантиметров" aria-orientation="horizontal"></button>' +
      '</div>' +
      '</div>' +
      '<div class="strip-work__rules"><div></div>' +
      '<div class="ruler ruler--strip" id="strip-ruler" aria-hidden="true">' + rulerHTML() + '</div>' +
      '</div>' +
      '</div></div>';

    return stageCard(step, {
      end: key,
      title: step === 5 ? 'Второй конец: зачистка оболочки' : D.STEPS[0].title,
      sub: 'Потяните жёлтую рукоятку влево и снимите 2–2,5 см оболочки.',
      body: body,
      caption:
        'Тяните рукоятку влево — оболочка сходит с жил. Ориентир — зелёная зона на линейке (2–2,5 см). ' +
        'Проверить: жилы должны остаться целыми, а оболочка — длиной 2–2,5 см.',
      actions:
        prevBtn(step) +
        hintBtn() +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn" data-act="strip-apply" data-focus-key="strip-apply">Снять изоляцию</button>' +
        nextBtn(step, false) +
        '</div>'
    });
  }

  function stripDoneView(s, key, step) {
    const e = s.ends[key];
    const pct = Math.min(100, (e.strip.lengthCm / MAX_STRIP_CM) * 100);
    const inRange = e.strip.lengthCm >= D.SETTINGS.stripMinCm && e.strip.lengthCm <= D.SETTINGS.stripMaxCm;
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Готово · конец ' + key + '</span>' +
      '<div class="strip-work">' +
      '<div class="strip-readout ' + (inRange ? 'is-ok' : 'is-bad') + '">' +
      '<span class="strip-readout__value">' + fmtCm(e.strip.lengthCm) + '</span>' +
      '<span>' + (inRange ? 'в пределах нормы 2,0–2,5 см' : 'вне нормы 2,0–2,5 см — будет проблема с зажимом') + '</span>' +
      '</div>' +
      '<div class="strip-work__grid">' +
      '<div class="strip-work__fixed"></div>' +
      '<div class="strip-work__zone">' +
      '<div class="strip-work__clip">' +
      '<div class="strip-work__exposed" style="width:' + pct.toFixed(2) + '%">' + bareWires(STD.order) + '</div>' +
      '<div class="strip-work__jacket" style="width:' + (100 - pct).toFixed(2) + '%"></div>' +
      '</div></div></div>' +
      '<div class="strip-work__rules"><div></div>' +
      '<div class="ruler ruler--strip" aria-hidden="true">' + rulerHTML() + '</div></div>' +
      '</div></div>';

    const caption = inRange
      ? 'Оболочка снята, жилы целы. Дальше — разложить жилы по стандарту T568B.'
      : 'Оболочка снята не по норме: зажим коннектора не удержит кабель. В экзамене это фиксируется как есть, в тренировке можно переделать.';

    return stageCard(step, {
      end: key,
      title: step === 5 ? 'Второй конец: зачистка выполнена' : 'Оболочка снята',
      sub: 'Шаг выполнен: ' + fmtCm(e.strip.lengthCm) + '.',
      body: body,
      caption: caption,
      actions:
        prevBtn(step) +
        '<button type="button" class="btn btn--sm" data-act="strip-redo">Переделать</button>' +
        hintBtn() +
        '<div class="stage-actions__main">' +
        nextBtn(step, canAdvanceStage(s)) +
        '</div>'
    });
  }

  function mountStrip(root, s, key) {
    const e = s.ends[key];
    const step = s.step;

    if (e.strip.done) {
      const redo = $('[data-act="strip-redo"]', root);
      if (redo) {
        redo.addEventListener('click', () => {
          e.strip.done = false;
          e.strip.loaded = true;
          e.strip.lengthCm = 0;
          S.save();
          global.App.render();
        });
      }
      return;
    }

    if (!e.strip.loaded) {
      const cable = $('#cable-piece', root);
      const zone = $('#strip-zone', root);

      const load = () => {
        pickedCable = false;
        e.strip.loaded = true;
        S.logEntry('Кабель заведён в стриппер (конец ' + key + ')');
        S.save();
        U.toast('info', 'Кабель зажат в стриппере', 'Теперь потяните жёлтую рукоятку влево.');
        global.App.render();
      };

      if (cable) {
        Drag.enableDrag(cable, {
          targetSelector: '[data-drop="strip"]',
          onEnd: (info) => {
            if (info.target) load();
          }
        });
        cable.addEventListener('click', () => {
          pickedCable = !pickedCable;
          cable.classList.toggle('is-picked', pickedCable);
          cable.setAttribute('aria-pressed', pickedCable ? 'true' : 'false');
          U.announce(pickedCable ? 'Кабель взят. Перейдите к стрипперу и нажмите Enter.' : 'Кабель отпущен.');
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
            U.toast('warn', 'Сначала возьмите кабель', 'Нажмите на кабель, затем — на стриппер.');
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

    /* ---- интерактивная протяжка ---- */
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
      // кнопку «Далее» включаем сразу, чтобы быстрый клик не терялся
      const nextButton = root.querySelector('[data-act="next"]');
      if (nextButton) nextButton.disabled = false;
      const work = root.querySelector('.strip-work');
      if (work && !Drag.reducedMotion()) {
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
        U.toast('warn', 'Оболочка не снята', 'Потяните рукоятку влево хотя бы на 2 см.');
        return;
      }
      if (len >= min && len <= max) {
        e.strip.done = true;
        e.strip.lengthCm = len;
        if (key === 'B') s.bStage = 'sort';
        S.logEntry('Снята оболочка ' + fmtCm(len) + ' (конец ' + key + ')');
        S.save();
        U.toast('ok', 'Изоляция снята: ' + fmtCm(len), 'Жилы целы. Оболочка нужной длины — зажим коннектора её удержит.');
        finishStripAnimation();
        return;
      }

      e.strip.attempts += 1;
      s.stats.stripRetries += 1;
      S.save();

      if (s.mode === 'exam') {
        e.strip.done = true;
        e.strip.lengthCm = len;
        if (key === 'B') s.bStage = 'sort';
        S.logEntry('Снята оболочка ' + fmtCm(len) + ' (вне нормы, экзамен)');
        S.save();
        U.toast('warn', 'Зачистка ' + fmtCm(len) + ' — вне нормы', len < min
          ? 'Оболочка слишком короткая: она не попадёт под зажим, коннектор будет держаться только на жилах.'
          : 'Оболочка слишком длинная: зажим не зажмёт кабель, коннектор легко оторвётся.');
        finishStripAnimation();
        return;
      }

      paint(value);
      if (readout) {
        readout.classList.add('is-shake');
        global.setTimeout(() => readout.classList.remove('is-shake'), 480);
      }
      U.toast('error', len < min ? 'Слишком мало изоляции' : 'Слишком много изоляции', len < min
        ? 'Нужно 2–2,5 см: иначе оболочка не зайдёт под фиксирующий зажим. Попробуйте ещё раз.'
        : (len > 3.2 ? 'Вы повредили жилы: оболочка снята почти до экрана. Возьмите новый кабель и повторите.' : 'Норма — 2–2,5 см. Слишком длинная зачистка оставит зажим без оболочки.'));
      U.announce('Ошибка зачистки: ' + fmtCm(len));
    }

    if (grip && zoneArt) {
      let startValue = 0;
      Drag.enableDrag(grip, {
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
     ШАГ 2 — раскладка жил
     ====================================================================== */
  function sortView(s, key, step) {
    const e = s.ends[key];
    const bundle = D.WIRE_IDS.filter((id) => e.order.indexOf(id) === -1);
    const placedCount = e.order.filter(Boolean).length;

    const slots = e.order
      .map((id, i) => {
        const occupied = !!id;
        const bounce = fx.bounceSlot === i ? ' is-bounce' : '';
        return (
          '<div class="slot' + (occupied ? ' has-wire' : '') + (occupied && s.mode === 'training' ? ' is-correct' : '') + bounce + '" data-slot="' + i + '"' +
          ' data-drop="slot" data-focus-key="slot-' + i + '" role="button" tabindex="0"' +
          ' aria-label="Позиция ' + (i + 1) + ': ' + (id ? D.WIRES[id].name + ' (' + D.WIRES[id].abbr + ')' : 'пусто') + '">' +
          '<div class="slot__wire">' + (occupied ? wireSpan(id) : '<span class="slot__dry" aria-hidden="true">—</span>') + '</div>' +
          '<span class="slot__num">' + (i + 1) + '</span>' +
          '</div>'
        );
      })
      .join('');

    const body =
      '<div class="bench">' +
      '<span class="bench__label">Раскладка · конец ' + key + '</span>' +
      '<div class="sort-area">' +
      '<div class="bundle">' +
      '<span class="bundle__label">Пучок</span>' +
      '<div class="bundle__wires" id="bundle">' + chipsHTML(bundle) + '</div>' +
      '</div>' +
      '<div class="tray" id="tray" role="group" aria-label="Лоток, 8 позиций по стандарту T568B">' + slots + '</div>' +
      '</div></div>';

    const hint =
      s.mode === 'training'
        ? 'Перетащите жилы в позиции 1–8. Неверная жила вернётся в пучок.'
        : 'Экзамен: жилы можно ставить в любые позиции. Правильность проверит тестер.';

    return stageCard(step, {
      end: key,
      title: step === 5 ? 'Второй конец: раскладка жил' : D.STEPS[1].title,
      sub: step === 5 ? 'Разложите жилы конца B по тому же стандарту T568B.' : D.STEPS[1].sub,
      body: body,
      caption:
        'Цвета жил: <b>БО</b> — бело-оранжевый, <b>О</b> — оранжевый, <b>БЗ</b> — бело-зелёный, <b>С</b> — синий, ' +
        '<b>БС</b> — бело-синий, <b>З</b> — зелёный, <b>БК</b> — бело-коричневый, <b>К</b> — коричневый. ' +
        'Нажатие на жилу в лотке возвращает её в пучок.',
      actions:
        prevBtn(step) +
        hintBtn() +
        '<button type="button" class="btn btn--sm' + (placedCount ? '' : ' hidden') + '" data-act="clear-tray">Очистить лоток</button>' +
        '<div class="stage-actions__main">' +
        '<span class="chip">' + placedCount + ' / 8</span>' +
        nextBtn(step, canAdvanceStage(s)) +
        '</div>'
    });
  }

  function tryPlace(root, s, key, wireId, slotIdx) {
    const e = s.ends[key];
    const currentIdx = e.order.indexOf(wireId);
    if (currentIdx === slotIdx) return;

    if (s.mode === 'training' && STD.order[slotIdx] !== wireId) {
      e.sortMistakes += 1;
      s.stats.wrongDrops += 1;
      fx.bounceWire = wireId;
      fx.bounceSlot = slotIdx;
      S.logEntry('Ошибка раскладки: ' + D.WIRES[wireId].abbr + ' → позиция ' + (slotIdx + 1));
      S.save();
      U.toast(
        'error',
        'Неверная позиция',
        'Жила ' + D.WIRES[wireId].abbr + ' не может быть на ' + (slotIdx + 1) + '-м месте по T568B — она возвращается в пучок.'
      );
      U.announce('Неверная позиция ' + (slotIdx + 1));
      pickedWire = null;
      global.App.render();
      return;
    }

    const occupant = e.order[slotIdx];
    if (currentIdx >= 0) e.order[currentIdx] = null;
    if (occupant && occupant !== wireId && currentIdx >= 0) e.order[currentIdx] = occupant;
    e.order[slotIdx] = wireId;
    pickedWire = null;

    if (e.order.every(Boolean)) {
      if (key === 'B' && s.step === 5) s.bStage = 'insert';
      U.toast('ok', 'Все 8 жил разложены', s.mode === 'training'
        ? 'Порядок верный — переходите к обрезке жил.'
        : 'Порядок зафиксирован. Проверим его тестером в конце.');
      S.logEntry('Раскладка жил завершена (конец ' + key + ')');
    } else {
      U.announce('Жила ' + D.WIRES[wireId].abbr + ' на позиции ' + (slotIdx + 1));
    }
    S.save();
    global.App.render();
  }

  function mountSort(root, s, key) {
    const e = s.ends[key];

    // перетаскивание из пучка
    $$('#bundle [data-wire-id]', root).forEach((chip) => {
      const wireId = chip.getAttribute('data-wire-id');
      Drag.enableDrag(chip, {
        targetSelector: '[data-drop="slot"]',
        onEnd: (info) => {
          if (!info.target) return;
          const slotIdx = Number(info.target.getAttribute('data-slot'));
          if (Number.isNaN(slotIdx)) return;
          tryPlace(root, s, key, wireId, slotIdx);
        }
      });
      chip.addEventListener('click', () => {
        pickedWire = pickedWire === wireId ? null : wireId;
        $$('.chip-wire', root).forEach((c) => {
          c.classList.toggle('is-picked', c.getAttribute('data-wire-id') === pickedWire);
          c.setAttribute('aria-pressed', c.getAttribute('data-wire-id') === pickedWire ? 'true' : 'false');
        });
        if (pickedWire) {
          const empty = $$('.slot', root).filter((sl) => !e.order[Number(sl.getAttribute('data-slot'))])[0] || $('.slot', root);
          if (empty) empty.focus();
          U.announce('Жила ' + D.WIRES[wireId].abbr + ' взята. Выберите позицию стрелками и нажмите Enter.');
        }
      });
      chip.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          chip.click();
        }
      });
    });

    // перетаскивание из лотка
    $$('.slot [data-wire-id]', root).forEach((chip) => {
      const wireId = chip.getAttribute('data-wire-id');
      Drag.enableDrag(chip, {
        targetSelector: '[data-drop="slot"]',
        onEnd: (info) => {
          if (!info.target) return;
          const slotIdx = Number(info.target.getAttribute('data-slot'));
          if (Number.isNaN(slotIdx)) return;
          tryPlace(root, s, key, wireId, slotIdx);
        }
      });
    });

    // клики и клавиатура по слотам
    const slots = $$('.slot', root);
    slots.forEach((slot, i) => {
      const idx = Number(slot.getAttribute('data-slot'));

      const activate = () => {
        if (pickedWire) {
          tryPlace(root, s, key, pickedWire, idx);
          return;
        }
        const occupant = e.order[idx];
        if (occupant) {
          e.order[idx] = null;
          S.save();
          U.announce('Жила ' + D.WIRES[occupant].abbr + ' возвращена в пучок.');
          global.App.render();
          return;
        }
        // взять жилу с клавиатуры
        const nextWire = D.WIRE_IDS.filter((id) => e.order.indexOf(id) === -1)[0];
        if (nextWire) {
          pickedWire = nextWire;
          const chip = $('#bundle [data-wire-id="' + nextWire + '"]', root);
          if (chip) chip.classList.add('is-picked');
          U.announce('Взята жила ' + D.WIRES[nextWire].abbr + '. Нажмите Enter, чтобы поставить её на позицию ' + (idx + 1) + '.');
        }
      };

      slot.addEventListener('click', activate);
      slot.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          activate();
        } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          (slots[i + 1] || slots[0]).focus();
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          (slots[i - 1] || slots[slots.length - 1]).focus();
        } else if (ev.key === 'Escape') {
          pickedWire = null;
          $$('.chip-wire', root).forEach((c) => c.classList.remove('is-picked'));
          U.announce('Выбор снят.');
        }
      });
      slot.addEventListener('focus', () => slot.classList.add('is-focusable'));
      slot.addEventListener('blur', () => slot.classList.remove('is-focusable'));
    });

    const clear = $('[data-act="clear-tray"]', root);
    if (clear) {
      clear.addEventListener('click', () => {
        e.order = [null, null, null, null, null, null, null, null];
        pickedWire = null;
        S.save();
        global.App.render();
        U.announce('Лоток очищен.');
      });
    }
  }

  /* ======================================================================
     ШАГ 3 — обрезка и установка коннектора
     ====================================================================== */
  function recalcChecks(e) {
    e.checks.fullInsert = !!(e.inserted && e.depth >= D.SETTINGS.depthGood);
    e.checks.jacketClamp = !!(
      e.strip.done &&
      e.strip.lengthCm >= 1.8 &&
      e.strip.lengthCm <= 2.6 &&
      e.inserted &&
      e.depth >= D.SETTINGS.depthWarn
    );
  }

  function insertView(s, key, step) {
    const e = s.ends[key];
    const order = e.order.slice();
    const depths = e.trimmed ? [0, 0, 0, 0, 0, 0, 0, 0] : [6, 2, 9, 3, 7, 1, 8, 4];


    const bundleHTML =
      '<div class="insert-bundle' + (e.trimmed ? ' draggable' : '') + '" id="insert-bundle" data-focus-key="insert-bundle"' +
      (e.trimmed ? ' tabindex="0" role="button" aria-label="Пучок из 8 жил. Перетащите в коннектор или нажмите Enter"' : '') + '>' +
      '<span class="insert-bundle__jacket" aria-hidden="true"></span>' +
      '<span class="insert-bundle__wires" aria-hidden="true">' +
      order
        .map((id, i) =>
          id
            ? '<span class="wire wire--' + D.WIRES[id].color + (D.WIRES[id].striped ? '' : ' wire--solid') + '" ' +
              'style="height:' + (e.trimmed ? 100 : 62 + depths[i] * 4) + '%"></span>'
            : ''
        )
        .join('') +
      '</span>' +
      '<span class="insert-bundle__label">' + (e.trimmed ? '8 жил · ровный торец' : '8 жил · разной длины') + '</span>' +
      '</div>';

    const body =
      '<div class="bench">' +
      '<span class="bench__label">Коннектор RJ-45 · конец ' + key + '</span>' +
      '<div class="insert-scene">' +
      bundleHTML +
      '<span class="insert-arrow" aria-hidden="true">→</span>' +
      '<div class="rj-drop" id="rj-drop">' +
      '<div class="rj" id="rj-wrap"><div id="rj-visual">' +
      G.rjSVG({ order: e.inserted ? order : order, depth: e.inserted ? e.depth : 0, crimped: false, jacketClamped: e.inserted && e.depth >= D.SETTINGS.depthWarn }) +
      '</div></div>' +
      '</div>' +
      '</div>' +
      (e.inserted
        ? '<div class="insert-tools">' +
          '<div class="depth' + (e.depth >= D.SETTINGS.depthGood ? ' is-good' : '') + '">' +
          '<div class="depth__head"><label for="depth-range">Глубина вставки</label>' +
          '<span class="depth__value" id="depth-value">' + Math.round(e.depth) + '%</span></div>' +
          '<input type="range" id="depth-range" min="0" max="100" step="1" value="' + Math.round(e.depth) + '"' +
          ' aria-describedby="depth-help">' +
          '<div class="depth__scale"><span>0%</span><span id="depth-help">конец каналов — 100%</span><span>100%</span></div>' +
          '</div>' +
          '</div>'
        : '') +
      '</div>' +
      '<div class="insert-tools">' +
      (!e.trimmed
        ? '<button type="button" class="btn" data-act="trim" data-focus-key="trim">' + G.icon('scissors') + 'Выровнять и обрезать</button>'
        : !e.inserted
          ? '<button type="button" class="btn btn--primary" data-act="insert" data-focus-key="insert">' + G.icon('rj45') + 'Вставить жилы в коннектор</button>'
          : '<span class="chip ' + (e.depth >= D.SETTINGS.depthGood ? 'chip--green' : 'chip--amber') + '">' +
            (e.depth >= D.SETTINGS.depthGood ? 'жилы дошли до конца каналов' : 'жилы не дошли до конца') + '</span>') +
      '</div>';

    const caption = !e.trimmed
      ? 'Жилы торчат на разной длине — их нельзя вставлять в коннектор. Обрежьте одним движением, чтобы торцы были в одной плоскости (10–12 мм от оболочки).'
      : !e.inserted
        ? 'Держите коннектор контактами вверх, защёлкой от себя. Вставляйте жилы до упора, а оболочку заведите под фиксирующий зажим.'
        : 'Глубину можно подправить ползунком: жилы должны дойти до конца каналов. Если оболочка не зашла под зажим, коннектор не защёлкнется.';

    return stageCard(step, {
      end: key,
      title: step === 5 ? 'Второй конец: установка коннектора' : D.STEPS[2].title,
      sub: e.trimmed ? 'Вставьте жилы в коннектор до конца каналов.' : 'Сначала выровняйте и обрежьте жилы.',
      body: body,
      caption: caption,
      actions:
        prevBtn(step) +
        hintBtn() +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn btn--sm" data-act="inspect-insert">Проверить посадку</button>' +
        nextBtn(step, canAdvanceStage(s)) +
        '</div>'
    });
  }

  function mountInsert(root, s, key) {
    const e = s.ends[key];
    const step = s.step;

    const trimBtn = $('[data-act="trim"]', root);
    if (trimBtn) {
      trimBtn.addEventListener('click', () => {
        e.trimmed = true;
        S.logEntry('Жилы выровнены и обрезаны (конец ' + key + ')');
        S.save();
        U.toast('ok', 'Жилы обрезаны ровно', 'Теперь вставьте их в коннектор до конца каналов.');
        global.App.render();
      });
    }

    const bundle = $('#insert-bundle', root);
    const drop = $('#rj-drop', root);

    const beginInsert = () => {
      if (!e.trimmed || e.inserted) return;
      e.inserted = true;
      e.depth = 62;
      recalcChecks(e);
      S.logEntry('Жилы вставлены в коннектор (конец ' + key + ')');
      S.save();
      U.toast('info', 'Жилы вошли в коннектор', 'Ползунком продвиньте их до конца каналов — 100%.');
      global.App.render();
    };

    if (bundle && e.trimmed && !e.inserted) {
      Drag.enableDrag(bundle, {
        targetSelector: '.rj-drop',
        lift: false,
        onEnd: (info) => {
          if (info.target) beginInsert();
          else U.toast('warn', 'Жилы не попали в коннектор', 'Перетащите пучок точно на коннектор RJ-45.');
        }
      });
      bundle.addEventListener('click', beginInsert);
      bundle.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          beginInsert();
        }
      });
    }

    const insertBtn = $('[data-act="insert"]', root);
    if (insertBtn) insertBtn.addEventListener('click', beginInsert);

    const range = $('#depth-range', root);
    if (range) {
      const visual = $('#rj-visual', root);
      const val = $('#depth-value', root);
      range.addEventListener('input', () => {
        e.depth = Number(range.value);
        recalcChecks(e);
        if (val) val.textContent = Math.round(e.depth) + '%';
        if (visual) {
          visual.innerHTML = G.rjSVG({
            order: e.order,
            depth: e.depth,
            crimped: false,
            jacketClamped: e.depth >= D.SETTINGS.depthWarn && e.strip.lengthCm >= 1.8 && e.strip.lengthCm <= 2.6
          });
        }
        const box = $('.depth', root);
        if (box) box.classList.toggle('is-good', e.depth >= D.SETTINGS.depthGood);
        S.save();
        if (e.depth >= D.SETTINGS.depthGood && !e._depthToast) {
          e._depthToast = true;
          U.toast('ok', 'Жилы дошли до конца каналов', 'Можно обжимать коннектор.');
        }
      });
      range.addEventListener('change', () => {
        if (e.depth < D.SETTINGS.depthGood) {
          U.toast('warn', 'Жилы не до конца', 'Контакт получится ненадёжным — тестер покажет обрыв. Продвиньте до 100%.');
        }
        global.App.render();
      });
    }

    const check = $('[data-act="inspect-insert"]', root);
    if (check) {
      check.addEventListener('click', () => {
        if (!e.inserted) {
          U.toast('warn', 'Жилы ещё не в коннекторе', 'Сначала вставьте их в коннектор.');
          return;
        }
        recalcChecks(e);
        const full = e.checks.fullInsert;
        const clamp = e.checks.jacketClamp;
        U.toast(
          full && clamp ? 'ok' : 'warn',
          full && clamp ? 'Посадка правильная' : 'Посадка неполная',
          (full ? 'Жилы дошли до конца каналов. ' : 'Жилы не дошли до конца каналов. ') +
            (clamp ? 'Оболочка под зажимом.' : 'Оболочка не заведена под зажим.')
        );
        U.announce('Проверка посадки: ' + (full && clamp ? 'правильно' : 'неполная посадка'));
        S.save();
      });
    }
  }

  /* ======================================================================
     ШАГ 4 — обжим
     ====================================================================== */
  function crimpView(s, key, step) {
    const e = s.ends[key];
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Обжим · конец ' + key + '</span>' +
      '<div class="crimp-scene">' +
      '<div class="rj' + (e.crimped ? ' is-crimped' : '') + '" id="rj-wrap"><div id="rj-visual">' +
      G.rjSVG({ order: e.order, depth: e.depth, crimped: e.crimped }) +
      '</div></div>' +
      '<button type="button" class="crimp-hold" id="crimp-hold" data-focus-key="crimp-hold"' +
      ' aria-label="Кримпер. Зажмите и удерживайте, чтобы обжать коннектор">' +
      '<span class="crimper' + (e.crimped ? ' is-done' : '') + '" id="crimper-art">' + G.crimperArt() + '</span>' +
      '<span class="crimp-hint">' + (e.crimped ? 'Коннектор обжат' : 'Зажмите и удерживайте<br>(или Space / Enter)') + '</span>' +
      '</button>' +
      '</div>' +
      '<div class="insert-tools">' +
      '<div class="force' + (e.crimped && e.force < D.SETTINGS.crimpGood ? ' is-over' : '') + '" id="force-box">' +
      '<div class="force__bar"><div class="force__fill" id="force-fill" style="width:' + (e.crimped ? Math.round(e.force) : 0) + '%"></div></div>' +
      '<div class="force__label"><span>усилие обжима</span><span class="mono" id="force-value">' +
      (e.crimped ? Math.round(e.force) + '%' : '0%') + '</span></div>' +
      '</div>' +
      '</div></div>';

    const caption = e.crimped
      ? (e.force >= D.SETTINGS.crimpGood
        ? 'Контакты прожаты до конца: они утоплены в жилы, а зажим держит оболочку.'
        : 'Обжим неполный: контакты могли не прожать жилы. В тестере такие жилы могут не «загореться».')
      : 'Сожмите рукоятки до щелчка. Держите до 100% усилия — если отпустить раньше, контакты не сядут в жилы.';

    return stageCard(step, {
      end: key,
      title: step === 5 ? 'Второй конец: обжим' : D.STEPS[3].title,
      sub: e.crimped ? 'Коннектор зафиксирован.' : 'Зажмите кримпер и удерживайте до полного усилия.',
      body: body,
      caption: caption,
      actions:
        prevBtn(step) +
        hintBtn() +
        '<div class="stage-actions__main">' +
        nextBtn(step, canAdvanceStage(s)) +
        '</div>'
    });
  }

  function mountCrimp(root, s, key) {
    const e = s.ends[key];
    if (e.crimped) return;

    const hold = $('#crimp-hold', root);
    const art = $('#crimper-art', root);
    const fill = $('#force-fill', root);
    const valueEl = $('#force-value', root);
    const box = $('#force-box', root);
    const visual = $('#rj-visual', root);

    if (!hold) return;

    let force = 0;
    let raf = null;
    let running = false;
    let lastT = 0;

    function paint() {
      if (fill) fill.style.width = Math.min(100, force).toFixed(1) + '%';
      if (valueEl) valueEl.textContent = Math.round(force) + '%';
    }

    function tick(t) {
      if (!running) return;
      if (!lastT) lastT = t;
      const dt = Math.min(60, t - lastT);
      lastT = t;
      force = Math.min(100, force + dt * 0.11);
      paint();
      if (force >= 100) {
        stop();
        finish();
        return;
      }
      raf = global.requestAnimationFrame(tick);
    }

    function start() {
      if (running || e.crimped) return;
      running = true;
      lastT = 0;
      if (art) art.classList.add('is-squeezing');
      U.announce('Обжим начат. Удерживайте.');
      raf = global.requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      raf = null;
      if (art) art.classList.remove('is-squeezing');
    }

    function finish() {
      if (e.crimped) return;
      const f = Math.round(force);
      e.crimpAttempts += 1;
      if (f >= D.SETTINGS.crimpWarn) {
        e.crimped = true;
        e.force = f;
        recalcChecks(e);
        S.logEntry('Коннектор обжат, усилие ' + f + '% (конец ' + key + ')');
        S.save();
        if (f >= D.SETTINGS.crimpGood) {
          U.toast('ok', 'Коннектор обжат', 'Контакты утоплены в жилы, зажим держит оболочку.');
        } else {
          U.toast('warn', 'Обжим неполный (' + f + '%)', 'Дожмите до 100% в следующий раз: часть контактов может не прожать жилы.');
        }
        if (global.navigator && global.navigator.vibrate) {
          try { global.navigator.vibrate(30); } catch (err) { /* noop */ }
        }
        const nextButton = root.querySelector('[data-act="next"]');
        if (nextButton) nextButton.disabled = false;
        if (!Drag.reducedMotion()) {
          global.setTimeout(() => global.App.render(), 300);
        } else {
          global.App.render();
        }
        return;
      }

      force = 0;
      paint();
      if (box) box.classList.add('is-over');
      S.save();
      U.toast('error', 'Контакты не прожаты', 'Отпустили слишком рано (' + f + '%). Удерживайте кримпер до 100% — иначе коннектор придётся переделывать.');
      U.announce('Обжим не выполнен, усилие ' + f + ' процентов');
    }

    hold.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      hold.setPointerCapture && hold.setPointerCapture(ev.pointerId);
      start();
    });
    hold.addEventListener('pointerup', () => {
      if (!running) return;
      stop();
      finish();
    });
    hold.addEventListener('pointercancel', () => {
      stop();
      finish();
    });
    hold.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        start();
      }
    });
    hold.addEventListener('keyup', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        stop();
        finish();
      }
    });
    hold.addEventListener('blur', () => {
      if (running) {
        stop();
        finish();
      }
    });

    // если коннектор ещё не обжат, а усилие нулевое — подсказка про 100%
    if (visual) {
      visual.innerHTML = G.rjSVG({ order: e.order, depth: e.depth, crimped: false });
    }
    paint();
  }

  /* ======================================================================
     ШАГ 5 — второй конец: сводка
     ====================================================================== */
  function endBDoneView(s, step) {
    const B = s.ends.B;
    const A = s.ends.A;
    const row = (ok, text) => '<div class="summary__row"><span class="summary__chip' + (ok ? '' : ' summary__chip--warn') + '">' + (ok ? '✓' : '!') + '</span><span>' + text + '</span></div>';
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Готово · оба конца</span>' +
      '<div class="crimp-scene">' +
      '<div class="rj" id="rj-wrap"><div id="rj-visual">' + G.rjSVG({ order: A.order, depth: A.depth, crimped: true }) + '</div></div>' +
      '<div class="summary">' +
      row(A.strip.lengthCm >= 2 && A.strip.lengthCm <= 2.5, 'Конец A: зачистка ' + fmtCm(A.strip.lengthCm) + ', порядок T568B, обжим ' + Math.round(A.force) + '%') +
      row(B.strip.lengthCm >= 2 && B.strip.lengthCm <= 2.5, 'Конец B: зачистка ' + fmtCm(B.strip.lengthCm) + ', порядок T568B, обжим ' + Math.round(B.force) + '%') +
      row(true, 'Оба конца по одному стандарту — кабель прямой (straight-through)') +
      '</div>' +
      '</div></div>';

    return stageCard(step, {
      title: D.STEPS[4].title,
      sub: 'Оба коннектора установлены. Осталось проверить кабель.',
      body: body,
      caption: 'Оба конца собраны по T568B. Нажмите «Далее», чтобы перейти к проверке: осмотр коннекторов и тестер.',
      actions: prevBtn(step) + hintBtn() + '<div class="stage-actions__main">' + nextBtn(step, canAdvanceStage(s), 'К проверке') + '</div>'
    });
  }

  /* ======================================================================
     ШАГ 6 — проверка тестером
     ====================================================================== */
  function computeTest(s) {
    const A = s.ends.A;
    const B = s.ends.B;
    const condA = A.inserted && A.depth >= D.SETTINGS.depthWarn && A.crimped && A.force >= D.SETTINGS.crimpWarn;
    const condB = B.inserted && B.depth >= D.SETTINGS.depthWarn && B.crimped && B.force >= D.SETTINGS.crimpWarn;
    const pairs = [];
    let connected = 0;
    let straightPins = 0;

    for (let i = 0; i < 8; i++) {
      const wire = A.order[i];
      if (!wire) {
        pairs.push({ a: i + 1, b: null, wire: null });
        continue;
      }
      const j = B.order.indexOf(wire);
      if (j === -1 || !condA || !condB) {
        pairs.push({ a: i + 1, b: null, wire: wire });
        continue;
      }
      pairs.push({ a: i + 1, b: j + 1, wire: wire });
      connected += 1;
      if (j === i) straightPins += 1;
    }

    const crossover = pairs.filter((p) => p.b && p.b !== p.a);
    const opens = pairs.filter((p) => !p.b);
    const straight = straightPins === 8;
    const qualityOk =
      A.depth >= D.SETTINGS.depthGood &&
      B.depth >= D.SETTINGS.depthGood &&
      A.force >= D.SETTINGS.crimpGood &&
      B.force >= D.SETTINGS.crimpGood &&
      A.checks.jacketClamp &&
      B.checks.jacketClamp;

    return {
      pairs: pairs,
      connected: connected,
      straightPins: straightPins,
      straight: straight,
      crossover: crossover,
      opens: opens,
      ok: straight && connected === 8 && qualityOk
    };
  }

  function pairsText(list) {
    return list.map((p) => p.a + '-' + (p.b === null ? '×' : p.b)).join(', ');
  }

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
    let s = '';
    for (let i = 1; i <= 8; i++) {
      const cls = states && states[i - 1] ? ' ' + states[i - 1] : '';
      s +=
        '<div class="led' + cls + '" data-led="' + prefix + '-' + i + '">' +
        '<span class="led__lamp" aria-hidden="true"></span>' +
        '<span class="led__num">' + i + '</span>' +
        '</div>';
    }
    return s;
  }

  function contactStatus(e) {
    const out = [];
    for (let i = 0; i < 8; i++) {
      if (!e.order[i]) out.push('bad');
      else if (e.force >= D.SETTINGS.crimpGood && e.depth >= D.SETTINGS.depthGood) out.push('ok');
      else if (e.crimped && e.force >= D.SETTINGS.crimpWarn) out.push('warn');
      else out.push('bad');
    }
    return out;
  }

  function testView(s, step) {
    const plugged = s.tester.plugged.main && s.tester.plugged.remote;
    const res = s.tester.result;
    const body =
      '<div class="bench">' +
      '<span class="bench__label">Проверка · кабель в сборе</span>' +
      '<div class="tester">' +
      '<div class="tester__row">' +
      '<div class="tester__unit">' +
      '<div class="tester__unit-title"><span>Основной блок</span><span>MAIN</span></div>' +
      '<div class="tester__socket' + (s.tester.plugged.main ? ' is-plugged' : '') + '">' + G.socketArt() +
      '<span>' + (s.tester.plugged.main ? 'Конец A подключён' : 'Гнездо конца A свободно') + '</span></div>' +
      '<div class="leds" id="leds-main" aria-hidden="true">' + ledsHTML('main', ledStates(s).main) + '</div>' +
      '<div class="tester__pair" id="pair-main">' + (res ? (res.ok ? 'все пары в порядке' : 'проверьте пары: ' + pairsText(res.pairs)) : '') + '</div>' +
      '</div>' +
      '<div class="tester__unit">' +
      '<div class="tester__unit-title"><span>Удалённый блок</span><span>REMOTE</span></div>' +
      '<div class="tester__socket' + (s.tester.plugged.remote ? ' is-plugged' : '') + '">' + G.socketArt() +
      '<span>' + (s.tester.plugged.remote ? 'Конец B подключён' : 'Гнездо конца B свободно') + '</span></div>' +
      '<div class="leds" id="leds-remote" aria-hidden="true">' + ledsHTML('remote', ledStates(s).remote) + '</div>' +
      '<div class="tester__pair" id="pair-remote">' + (res ? (res.ok ? 'все пары в порядке' : res.crossover.length ? 'перекрёст: ' + pairsText(res.crossover) : 'обрыв: ' + pairsText(res.opens)) : '') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="tester__result' + (res ? (res.ok ? ' tester__result--ok' : ' tester__result--bad') : '') + '" id="test-result">' +
      (res
        ? (res.ok ? G.icon('check') + '<span>Кабель исправен: прямой обжим, все 8 жил.</span>'
          : G.icon('warn') + '<span>' + (res.crossover.length
            ? 'Обнаружен перекрёст: ' + pairsText(res.crossover) + '.'
            : 'Нет связи по жилам: ' + pairsText(res.opens) + '.') + '</span>')
        : G.icon('info') + '<span>Подключите кабель к тестеру и запустите проверку.</span>') +
      '</div>' +
      '</div>' +
      '<div class="tester__row" style="margin-top:12px">' +
      '<div class="inspect" style="flex:1 1 300px">' +
      '<div class="row row--between"><b>Визуальный осмотр</b>' +
      '<button type="button" class="btn btn--sm" data-act="inspect">' + G.icon('eye') + 'Осмотреть</button></div>' +
      '<div id="inspect-result"' + (s.tester.inspected ? '' : ' hidden') + '>' +
      (s.tester.inspected
        ? '<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:wrap">' +
          '<div style="flex:1 1 130px"><div style="font-size:0.72rem;color:var(--ink-3);margin-bottom:2px">Конец A</div>' +
          G.rjFrontSVG(contactStatus(s.ends.A)) + '</div>' +
          '<div style="flex:1 1 130px"><div style="font-size:0.72rem;color:var(--ink-3);margin-bottom:2px">Конец B</div>' +
          G.rjFrontSVG(contactStatus(s.ends.B)) + '</div>' +
          '</div>' +
          '<p class="muted" style="font-size:0.78rem;margin:8px 0 0">' +
          (s.ends.A.force >= D.SETTINGS.crimpGood && s.ends.B.force >= D.SETTINGS.crimpGood
            ? 'Контакты утоплены равномерно, защёлка цела, оболочка под зажимом.'
            : 'Часть контактов «просела»: кримпер недожат, контакт с жилой ненадёжный.') +
          '</p>'
        : '') +
      '</div>' +
      '</div>' +
      '<div class="inspect" style="flex:1 1 300px">' +
      '<div class="row row--between"><b>Без тестера</b>' +
      '<button type="button" class="btn btn--sm" data-act="link">' + G.icon('plug') + 'Подключить к ПК</button></div>' +
      '<div class="link-check" style="border:0;background:transparent;padding:8px 0">' +
      '<div class="device">' + G.deviceArt('pc') + '<span>Компьютер</span><span class="device__port' + (s.tester.link && res && res.ok ? ' is-on' : '') + '" id="port-pc"></span></div>' +
      '<span class="link-line' + (s.tester.link && res && res.ok ? ' is-on' : '') + '" id="link-line"></span>' +
      '<div class="device">' + G.deviceArt('router') + '<span>Маршрутизатор</span><span class="device__port' + (s.tester.link && res && res.ok ? ' is-on' : '') + '" id="port-router"></span></div>' +
      '</div>' +
      '<p class="muted" style="font-size:0.78rem;margin:0" id="link-note">' +
      (s.tester.link
        ? (res && res.ok ? 'Индикаторы линка горят на обоих портах — кабель рабочий.' : 'Индикаторы линка не горят: кабель нерабочий или перекрёстный.')
        : 'Если тестера нет, кабель можно проверить в работе: подключите его между ПК и маршрутизатором.') +
      '</p>' +
      '</div>' +
      '</div>' +
      '</div>';

    return stageCard(step, {
      title: D.STEPS[5].title,
      sub: plugged ? 'Кабель подключён — запустите проверку.' : 'Подключите оба конца к тестеру.',
      body: body,
      caption:
        'Индикаторы 1–8 должны загораться по порядку и одновременно на двух блоках. Перекрёст выглядит как 1-3, 2-6, 3-1, 6-2. ' +
        'Если индикатор не горит — обрыв или непрожатый контакт.',
      actions:
        prevBtn(step) +
        '<button type="button" class="btn btn--sm" data-act="plug" ' + (plugged ? 'disabled' : '') + '>' + G.icon('plug') + 'Подключить к тестеру</button>' +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn" data-act="run-test" ' + (plugged ? '' : 'disabled') + '>' + G.icon('tester') + 'Запустить тест</button>' +
        nextBtn(step, canAdvanceStage(s), 'К отчёту') +
        '</div>'
    });
  }

  function mountTest(root, s) {
    const e = s.ends;

    const plug = $('[data-act="plug"]', root);
    if (plug) {
      plug.addEventListener('click', () => {
        s.tester.plugged.main = true;
        s.tester.plugged.remote = true;
        S.save();
        U.toast('info', 'Кабель подключён', 'Запустите тест — индикаторы пойдут по жилам.');
        global.App.render();
      });
    }

    const inspect = $('[data-act="inspect"]', root);
    if (inspect) {
      inspect.addEventListener('click', () => {
        s.tester.inspected = true;
        S.save();
        const aBad = contactStatus(e.A).filter((x) => x !== 'ok').length;
        const bBad = contactStatus(e.B).filter((x) => x !== 'ok').length;
        if (!aBad && !bBad) {
          U.toast('ok', 'Контакты в норме', 'Все 8 контактов утоплены, защёлка цела.');
        } else {
          U.toast('warn', 'Дефекты обжима', 'Конец A: проблемных контактов ' + aBad + ', конец B: ' + bBad + '.');
        }
        global.App.render();
      });
    }

    const link = $('[data-act="link"]', root);
    if (link) {
      link.addEventListener('click', () => {
        const res = computeTest(s);
        s.tester.link = true;
        s.tester.result = res;
        s.tester.tested = true;
        S.save();
        U.toast(res.ok ? 'ok' : 'error', res.ok ? 'Линк есть' : 'Линка нет', res.ok
          ? 'Порты загорелись: кабель прямой, все 8 жил в порядке.'
          : 'Порты не загорелись — проверьте обжим и порядок жил.');
        global.App.render();
      });
    }

    const run = $('[data-act="run-test"]', root);
    if (run) {
      run.addEventListener('click', () => {
        if (!s.tester.plugged.main) {
          U.toast('warn', 'Кабель не подключён', 'Сначала подключите оба конца к тестеру.');
          return;
        }
        runTest(root, s, run);
      });
    }
  }

  function runTest(root, s, btn) {
    const res = computeTest(s);
    btn.disabled = true;
    btn.textContent = 'Тест идёт…';

    const mainLeds = $$('#leds-main .led', root);
    const remoteLeds = $$('#leds-remote .led', root);
    const pairMain = $('#pair-main', root);
    const pairRemote = $('#pair-remote', root);
    const reduced = Drag.reducedMotion();
    const delay = reduced ? 40 : 240;

    const clear = () => {
      mainLeds.concat(remoteLeds).forEach((l) => l.classList.remove('is-on', 'is-on--warn', 'is-on--bad'));
    };

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
      // финальное состояние: все исправные пары горят одновременно
      res.pairs.forEach((p) => {
        if (!p.b) return;
        const m = mainLeds[p.a - 1];
        const r = remoteLeds[p.b - 1];
        if (m) m.classList.add('is-on');
        if (r) r.classList.add(p.b === p.a ? 'is-on' : 'is-on--warn');
      });
      if (pairMain) pairMain.textContent = res.ok ? 'все пары в порядке' : 'есть проблемы';
      if (pairRemote) pairRemote.textContent = res.ok ? 'все пары в порядке' : 'проверьте обжим';

      s.tester.tested = true;
      s.tester.result = res;
      S.logEntry('Тест: ' + (res.ok ? 'исправен' : res.crossover.length ? 'перекрёст ' + pairsText(res.crossover) : 'обрывы ' + pairsText(res.opens)));
      S.save();
      global.App.render();
      if (res.ok) {
        U.toast('ok', 'Кабель исправен', 'Все 8 жил, прямой обжим, контакты прожаты.');
      } else if (res.crossover.length) {
        U.toast('error', 'Перекрёст', 'Тестер показал ' + pairsText(res.crossover) + '. Для прямого кабеля оба конца должны быть по одному стандарту.');
      } else {
        U.toast('error', 'Есть обрывы', 'Не звонятся: ' + pairsText(res.opens) + '. Проверьте глубину вставки и обжим.');
      }
    }

    global.setTimeout(stepThrough, 120);
  }

  /* ======================================================================
     Рендер / монтирование
     ====================================================================== */
  function render(s) {
    const step = s.step;
    const A = s.ends.A;

    // Шаги 1–4 жёстко закреплены за своим этапом.
    if (step === 1) {
      if (A.strip.done) return stripDoneView(s, 'A', 1);
      return A.strip.loaded ? stripWorkView(s, 'A', 1) : stripIntroView(s, 'A', 1);
    }
    if (step === 2) return sortView(s, 'A', 2);
    if (step === 3) return insertView(s, 'A', 3);
    if (step === 4) return crimpView(s, 'A', 4);

    // Шаг 5 — тот же конвейер для второго конца, подэтап хранится в state.bStage.
    if (step === 5) {
      const B = s.ends.B;
      let stage = s.bStage || 'strip';
      if (!B.strip.done) stage = 'strip';
      else if (!B.order.every(Boolean)) stage = stage === 'strip' ? 'sort' : stage;
      if (stage !== 'strip' && !B.inserted && (stage === 'crimp' || stage === 'done')) stage = 'insert';
      if (stage === 'done' && !B.crimped) stage = 'crimp';
      s.bStage = stage;

      if (stage === 'strip') return B.strip.loaded ? stripWorkView(s, 'B', 5) : stripIntroView(s, 'B', 5);
      if (stage === 'sort') return sortView(s, 'B', 5);
      if (stage === 'insert') return insertView(s, 'B', 5);
      if (stage === 'crimp') return crimpView(s, 'B', 5);
      return endBDoneView(s, 5);
    }

    if (step === 6) return testView(s, 6);
    return global.AppReport.render(s);
  }

  function mount(root, s) {
    bindCommon(root, s);
    const step = s.step;
    if (step === 1) {
      mountStrip(root, s, 'A');
    } else if (step === 2) {
      mountSort(root, s, 'A');
    } else if (step === 3) {
      mountInsert(root, s, 'A');
    } else if (step === 4) {
      mountCrimp(root, s, 'A');
    } else if (step === 5) {
      const stage = s.bStage || 'strip';
      if (stage === 'strip') mountStrip(root, s, 'B');
      else if (stage === 'sort') mountSort(root, s, 'B');
      else if (stage === 'insert') mountInsert(root, s, 'B');
      else if (stage === 'crimp') mountCrimp(root, s, 'B');
    } else if (step === 6) {
      mountTest(root, s);
    } else {
      global.AppReport.mount(root, s);
    }

    // сбрасываем эффекты после отрисовки
    fx.bounceWire = null;
    fx.bounceSlot = null;
  }

  /* ---------- Состояния чек-листа для каждого конца ---------------------- */
  function itemStates(s, which) {
    const e = s.ends[which];
    const sorted = e.order.every(Boolean);
    const res = s.tester.result;
    return {
      strip: e.strip.done ? 'done' : 'active',
      sort: sorted ? 'done' : e.strip.done ? 'active' : 'todo',
      trim: e.trimmed ? 'done' : sorted ? 'active' : 'todo',
      insert: e.inserted && e.depth >= D.SETTINGS.depthGood ? 'done' : e.inserted ? 'active' : 'todo',
      clamp: e.checks.jacketClamp ? 'done' : e.inserted ? 'active' : 'todo',
      crimp: e.crimped && e.force >= D.SETTINGS.crimpWarn ? 'done' : e.crimped ? 'active' : 'todo',
      test: s.tester.tested ? (res && res.ok ? 'done' : 'error') : 'todo'
    };
  }

  global.AppSteps = {
    render,
    mount,
    canAdvance,
    canAdvanceStage,
    computeTest,
    contactStatus,
    itemStates
  };
})(window);
