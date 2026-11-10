/* ==========================================================================
   render.js — отрисовка эпизодов и интерактивных блоков квеста.
   Полная перерисовка эпизода после каждого действия: так проще держать
   состояние и не расходиться с моделью. Анимации включаются только при
   входе в эпизод (класс is-enter), а не на каждый клик.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const C = global.AppCore;
  const S = global.AppState;
  const G = global.AppIcons;

  const esc = (t) => C.esc(t);

  /* ---------- Общие кирпичи ---------------------------------------------- */
  function kicker(text) {
    return '<div class="q-kicker">' + esc(text) + '</div>';
  }

  function pointsBadge(value, max) {
    return '<span class="q-points">' + value + ' / ' + max + '</span>';
  }

  function avatar(who) {
    const ch = D.CHARS[who] || D.CHARS.me;
    return (
      '<span class="msg__ava msg__ava--' + ch.tone + '" aria-hidden="true">' + ch.emoji + '</span>'
    );
  }

  function dialogue(lines) {
    return (
      '<div class="dlg">' +
      lines
        .map(
          (line, i) =>
            '<div class="msg' + (line.who === 'me' ? ' msg--me' : '') + '" style="--i:' + i + '">' +
            avatar(line.who) +
            '<div class="msg__body">' +
            '<div class="msg__who">' + esc(D.CHARS[line.who].name) +
            (line.who === 'me' ? '' : ' <span>· ' + esc(D.CHARS[line.who].role) + '</span>') +
            '</div>' +
            '<div class="msg__text">' + esc(line.text) + '</div>' +
            '</div></div>'
        )
        .join('') +
      '</div>'
    );
  }

  function note(b) {
    return (
      '<div class="q-note q-note--' + (b.kind || 'info') + '">' +
      '<div class="q-note__title">' + esc(b.title) + '</div>' +
      '<div class="q-note__body">' + b.html + '</div>' +
      '</div>'
    );
  }

  /* ---------- Блоки ------------------------------------------------------- */

  function blockProse(b) {
    return '<div class="q-prose">' + b.html + '</div>';
  }

  function blockTicket(s) {
    const typed = s.ui && s.ui.typedTicket;
    const rows = D.TICKET_LINES.map(
      ([k, v], i) =>
        '<div class="ticket__row" style="--r:' + i + '">' +
        '<span class="ticket__k">' + esc(k) + '</span>' +
        '<span class="ticket__v">' + esc(v) + '</span>' +
        '</div>'
    ).join('');
    return (
      '<div class="ticket' + (typed ? '' : ' is-typing') + '" data-ticket>' +
      '<div class="ticket__head">' +
      '<span class="ticket__stamp">⚡ ' + esc(D.SHIFT.ticket) + '</span>' +
      '<span class="ticket__sla">SLA · ' + esc(D.SHIFT.sla) + '</span>' +
      '</div>' +
      '<div class="ticket__body">' + rows + '</div>' +
      '<div class="ticket__foot">' + esc(D.SHIFT.company) + ' · служба эксплуатации</div>' +
      '</div>'
    );
  }

  function blockDialogue(b) {
    return dialogue(b.lines);
  }

  function blockInterlude(b) {
    return (
      '<div class="q-interlude">' +
      '<span class="q-interlude__emoji" aria-hidden="true">' + D.CHARS[b.who].emoji + '</span>' +
      '<p>' + esc(b.text) + '</p>' +
      '</div>'
    );
  }

  function blockChoice(b, s) {
    const dec = S.decision(b.id);
    const last = dec.last ? b.options.filter((o) => o.id === dec.last)[0] : null;
    const solved = !!dec.ok;
    const opts = b.options
      .map((o) => {
        const chosen = dec.last === o.id;
        const cls = ['opt'];
        if (chosen && o.ok) cls.push('is-right');
        if (chosen && !o.ok) cls.push('is-wrong');
        if (solved && o.ok) cls.push('is-right');
        return (
          '<button type="button" class="' + cls.join(' ') + '" data-choice="' + b.id + '" data-opt="' + o.id + '"' +
          (solved ? ' disabled' : '') + '>' +
          '<span class="opt__mark" aria-hidden="true">' + (chosen && o.ok ? '✓' : chosen ? '×' : o.ok && solved ? '✓' : '') + '</span>' +
          '<span class="opt__text">' + esc(o.text) + '</span>' +
          '</button>'
        );
      })
      .join('');

    let feedback = '';
    if (last) {
      feedback =
        '<div class="feedback feedback--' + (last.ok ? 'ok' : 'bad') + '" role="status">' +
        '<span class="feedback__icon" aria-hidden="true">' + (last.ok ? '✓' : '✕') + '</span>' +
        '<div>' +
        '<div class="feedback__title">' + (last.ok ? 'Верно' : 'Не то') + '</div>' +
        '<p>' + esc(last.feedback) + '</p>' +
        (!last.ok && !solved ? '<p class="feedback__retry">Попробуйте другой вариант — попытки считаются.</p>' : '') +
        '</div></div>';
    }

    return (
      '<section class="q-block q-choice" data-block="' + b.id + '">' +
      kicker(b.scored ? 'Решение · ' + b.max + ' баллов' : 'Решение') +
      '<h3 class="q-ask">' + esc(b.question) + '</h3>' +
      '<div class="opt-list">' + opts + '</div>' +
      feedback +
      '</section>'
    );
  }

  function blockSurvey(b, s) {
    const picked = s.intro.experience;
    const reply = picked ? b.options.filter((o) => o.id === picked)[0].reply : '';
    return (
      '<section class="q-block" data-block="survey">' +
      kicker('Знакомство') +
      '<h3 class="q-ask">' + esc(b.question) + '</h3>' +
      '<div class="pill-row">' +
      b.options
        .map(
          (o) =>
            '<button type="button" class="pill-choice' + (picked === o.id ? ' is-on' : '') + '"' +
            ' data-survey="' + b.id + '" data-opt="' + o.id + '" aria-pressed="' + (picked === o.id) + '">' +
            esc(o.label) + '</button>'
        )
        .join('') +
      '</div>' +
      (reply
        ? '<div class="q-reply"><span aria-hidden="true">🧑‍💻</span><p>' + esc(reply) + '</p></div>'
        : '') +
      '</section>'
    );
  }

  function blockChecklist(b, s) {
    const all = b.items.every((i) => s.safety[i.id]);
    return (
      '<section class="q-block' + (all ? ' is-complete' : '') + '" data-block="' + b.id + '">' +
      kicker('Допуск') +
      '<h3 class="q-ask">' + esc(b.title) + '</h3>' +
      '<ul class="tick-list">' +
      b.items
        .map(
          (i) =>
            '<li><label class="tick">' +
            '<input type="checkbox" data-safety="' + i.id + '"' + (s.safety[i.id] ? ' checked' : '') + '>' +
            '<span class="tick__box" aria-hidden="true"></span>' +
            '<span class="tick__text">' + esc(i.label) + '</span>' +
            '</label></li>'
        )
        .join('') +
      '</ul>' +
      '<div class="q-reply q-reply--ok js-on-complete"><span aria-hidden="true">🧔</span><p>Допуск есть. Не подведи.</p></div>' +
      '</section>'
    );
  }

  function blockKit(b, s) {
    const kit = s.kit;
    const checked = kit.checked;
    return (
      '<section class="q-block" data-block="kit">' +
      kicker('Инструмент · 6 баллов') +
      '<h3 class="q-ask">' + esc(b.question) + '</h3>' +
      '<p class="q-hint">' + esc(b.hint) + '</p>' +
      '<div class="kit-grid">' +
      b.items
        .map((i) => {
          const on = kit.picked.indexOf(i.id) !== -1;
          const cls = ['kit-item'];
          if (on) cls.push('is-on');
          if (checked) cls.push(i.need ? (on ? 'is-right' : 'is-missed') : on ? 'is-wrong' : '');
          return (
            '<button type="button" class="' + cls.filter(Boolean).join(' ') + '" data-kit="' + i.id + '"' +
            ' aria-pressed="' + on + '">' +
            '<span class="kit-item__emoji" aria-hidden="true">' + i.emoji + '</span>' +
            '<span class="kit-item__label">' + esc(i.label) + '</span>' +
            (checked ? '<span class="kit-item__why">' + esc(i.why) + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      (checked && kitPerfect(b, s) ? '<div class="q-reply q-reply--ok"><span aria-hidden="true">🧔</span><p>' +
          esc(kitVerdict(b, s)) + '</p></div>' : '') +
      (checked && !kitPerfect(b, s) ? '<div class="q-reply q-reply--warn"><span aria-hidden="true">🧔</span><p>' +
          esc(kitVerdict(b, s)) + '</p></div>' : '') +
      '<div class="q-actions">' +
      '<button type="button" class="btn btn--ink" data-act="kit-check">' +
      (checked ? 'Проверить снова' : 'Проверить набор') + '</button>' +
      '<span class="q-meta">выбрано ' + kit.picked.length + ' из ' + b.items.length + '</span></div>' +
      '</section>'
    );
  }

  function kitPerfect(b, s) {
    const need = b.items.filter((i) => i.need).map((i) => i.id);
    const extra = b.items.filter((i) => !i.need).map((i) => i.id);
    const missed = need.filter((id) => s.kit.picked.indexOf(id) === -1).length;
    const wrong = extra.filter((id) => s.kit.picked.indexOf(id) !== -1).length;
    return missed === 0 && wrong === 0;
  }

  function kitVerdict(b, s) {
    if (kitPerfect(b, s)) return 'Набор собран верно. Кримпер оставили в шкафу — и правильно.';
    return 'В наборе есть лишнее или чего-то не хватает. Пересмотрите: кримпер и коннектор тут не работают.';
  }

  function blockEvidence(b) {
    return (
      '<div class="evidence">' +
      b.items
        .map(
          (i) =>
            '<figure class="evidence__card">' +
            '<span class="evidence__icon" aria-hidden="true">' + i.icon + '</span>' +
            '<figcaption>' + esc(i.caption) + '</figcaption>' +
            '<p>' + esc(i.body) + '</p>' +
            '</figure>'
        )
        .join('') +
      '</div>'
    );
  }

  function blockTerms(b) {
    return (
      '<section class="q-block" data-block="terms">' +
      kicker('Справка') +
      '<h3 class="q-ask">' + esc(b.title) + '</h3>' +
      '<div class="terms">' +
      b.items
        .map(
          (t) =>
            '<details class="term">' +
            '<summary><span>' + esc(t.term) + '</span><span class="term__plus" aria-hidden="true">+</span></summary>' +
            '<p>' + esc(t.def) + '</p>' +
            '</details>'
        )
        .join('') +
      '</div>' +
      '</section>'
    );
  }

  function blockScheme(b) {
    return (
      '<div class="q-scheme">' +
      G.schemeHTML(b.std, { caption: b.caption }) +
      '</div>'
    );
  }

  function blockQuiz(b, s) {
    const th = s.theory;
    const rightCount = b.questions.filter((q) => th.answers[q.id] === q.correct).length;
    const answered = b.questions.filter((q) => !!th.answers[q.id]).length;
    const ready = answered === b.questions.length;
    const qs = b.questions
      .map((q, idx) => {
        const chosen = th.answers[q.id];
        const opts = q.options
          .map(
            (o) =>
              '<label class="radio' +
              (th.checked ? (o.id === q.correct ? ' is-right' : o.id === chosen ? ' is-wrong' : '') : '') +
              (chosen === o.id ? ' is-chosen' : '') + '">' +
              '<input type="radio" name="' + q.id + '" value="' + o.id + '" data-quiz="' + q.id + '"' +
              (chosen === o.id ? ' checked' : '') + (th.checked ? ' disabled' : '') + '>' +
              '<span class="radio__dot" aria-hidden="true"></span>' +
              '<span>' + esc(o.text) + '</span>' +
              '</label>'
          )
          .join('');
        return (
          '<div class="quiz-q">' +
          '<div class="quiz-q__num" aria-hidden="true">' + (idx + 1) + '</div>' +
          '<div class="quiz-q__body">' +
          '<div class="quiz-q__text">' + esc(q.text) + '</div>' +
          '<div class="radio-list">' + opts + '</div>' +
          (th.checked
            ? '<div class="quiz-q__why ' + (chosen === q.correct ? 'is-ok' : 'is-bad') + '">' + esc(q.explain) + '</div>'
            : '') +
          '</div></div>'
        );
      })
      .join('');

    return (
      '<section class="q-block" data-block="theory">' +
      kicker('Понимание · 6 баллов') +
      '<h3 class="q-ask">' + esc(b.title) + '</h3>' +
      '<div class="quiz">' + qs + '</div>' +
      (th.checked
        ? '<div class="q-reply ' + (rightCount === b.questions.length ? 'q-reply--ok' : 'q-reply--warn') + '">' +
          '<span aria-hidden="true">🧑‍💻</span><p>Верно ' + rightCount + ' из ' + b.questions.length +
          '. Баллы: ' + rightCount * b.perQuestion + ' из ' + b.questions.length * b.perQuestion + '.</p></div>'
        : '<div class="q-actions"><button type="button" class="btn btn--ink" data-act="theory-check"' +
          (ready ? '' : ' disabled') + '>Проверить ответы</button>' +
          '<span class="q-meta">отвечено ' + answered + ' из ' + b.questions.length + '</span></div>') +
      '</section>'
    );
  }

  function blockOrder(b, s) {
    const w = s.wires;
    const done = w.done;
    const nextPin = w.order.length + 1;
    const tray = D.WIRE_ORDER.map((id) => {
      const used = w.order.indexOf(id) !== -1;
      const wire = D.WIRES[id];
      return (
        '<button type="button" class="wire-chip' + (used ? ' is-used' : '') + '" data-wire="' + id + '"' +
        (used || done ? ' disabled' : '') + ' aria-label="Жила ' + esc(wire.name) + '">' +
        '<span class="wire-chip__wire wire wire--' + wire.color + (wire.striped ? '' : ' wire--solid') + '"></span>' +
        '<span class="wire-chip__abbr">' + esc(wire.abbr) + '</span>' +
        '</button>'
      );
    }).join('');

    const slots = new Array(8)
      .fill(null)
      .map((_, i) => {
        const id = w.order[i];
        const wire = id ? D.WIRES[id] : null;
        return (
          '<div class="wslot' + (id ? ' is-filled' : '') + (i + 1 === nextPin && !done ? ' is-next' : '') + '">' +
          '<span class="wslot__num">' + (i + 1) + '</span>' +
          (wire
            ? '<span class="wire wire--' + wire.color + (wire.striped ? '' : ' wire--solid') + ' wslot__wire"></span>' +
              '<span class="wslot__abbr">' + esc(wire.abbr) + '</span>'
            : '<span class="wslot__empty" aria-hidden="true">·</span>') +
          '</div>'
        );
      })
      .join('');

    return (
      '<section class="q-block" data-block="wires">' +
      kicker('Порядок жил · 10 баллов') +
      '<h3 class="q-ask">' + esc(b.title) + '</h3>' +
      '<p class="q-hint">' + esc(b.hint) + '</p>' +
      '<div class="wslots">' + slots + '</div>' +
      '<div class="wtray" id="wtray">' + tray + '</div>' +
      '<div class="q-actions">' +
      (done
        ? '<span class="badge badge--ok">✓ линия собрана по B' + (w.mistakes ? ' · ошибок: ' + w.mistakes : ' · без ошибок') + '</span>'
        : '<span class="q-meta">контакт ' + nextPin + ' из 8</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="wires-reset">Сбросить</button>') +
      '</div>' +
      '</section>'
    );
  }

  function blockOps(b, s) {
    const doneCount = S.opsDone(s);
    const list = D.OPS.map((op, i) => {
      const on = !!s.ops[op.id];
      const prevDone = i === 0 || !!s.ops[D.OPS[i - 1].id];
      const locked = !prevDone && !on;
      return (
        '<li class="op' + (on ? ' is-done' : '') + (locked ? ' is-locked' : '') + '">' +
        '<label class="op__head">' +
        '<input type="checkbox" data-op="' + op.id + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
        '<span class="op__box" aria-hidden="true"></span>' +
        '<span class="op__title">' + esc(op.title) + '</span>' +
        '<span class="op__meta">' + esc(op.time) + ' · ' + op.points + ' б.</span>' +
        '</label>' +
        '<div class="op__body">' +
        '<p class="op__control"><b>Контроль:</b> ' + esc(op.control) + '</p>' +
        '<p class="op__mistake"><b>Типичная ошибка:</b> ' + esc(op.mistake) + '</p>' +
        '</div>' +
        '</li>'
      );
    }).join('');

    return (
      '<section class="q-block" data-block="ops">' +
      kicker('Операционная карта · 25 баллов') +
      '<div class="ops-progress"><span class="ops-progress__bar"><span style="--p:' +
      (doneCount / D.OPS.length).toFixed(3) + '"></span></span>' +
      '<span class="q-meta">' + doneCount + ' из ' + D.OPS.length + ' этапов</span></div>' +
      '<ol class="ops">' + list + '</ol>' +
      '<p class="q-hint">Этап закрывается только после проверки по строке «контроль». Отметки сохраняются: можно вернуться к карте позже.</p>' +
      '</section>'
    );
  }

  function blockTester(b, s) {
    const t = s.tester;
    const opt = (id, label, hint) =>
      '<button type="button" class="test-opt' + (t.result === id ? ' is-on' : '') +
      (id === 'pass' ? ' test-opt--pass' : '') + '" data-tester="' + id + '">' +
      '<span class="test-opt__dot" aria-hidden="true"></span>' +
      '<span><b>' + esc(label) + '</b><br><span class="test-opt__hint">' + esc(hint) + '</span></span>' +
      '</button>';

    let verdict = '';
    if (t.result === 'pass') {
      verdict =
        '<div class="q-reply q-reply--ok"><span aria-hidden="true">📶</span><p>' +
        'PASS: все восемь жил по порядку, перекрёста нет. Линия держит гигабит — если, конечно, мастер подтвердит приёмку.</p></div>';
    } else if (t.result) {
      verdict =
        '<div class="q-reply q-reply--bad"><span aria-hidden="true">⚠️</span><p>' +
        'FAIL. Пока линия не сдана: вернитесь к карте операций, проверьте раскладку по строке B и заделку до щелчка, затем измерьте снова.</p></div>';
    }

    return (
      '<section class="q-block" data-block="tester">' +
      kicker('Тест линии · 20 баллов') +
      '<h3 class="q-ask">Что показал тестер?</h3>' +
      '<div class="test-grid">' +
      opt('pass', 'Все 8 жил по порядку', '1-1, 2-2, 3-3 … 8-8, одновременно на двух блоках') +
      opt('cross', 'Перекрёст 1-3, 2-6', 'жилы «поехали» между парами') +
      opt('open', 'Не горят 4-5', 'обрыв или незаделанный контакт') +
      opt('dead', 'Не горит ничего', 'нет контакта вообще / не тот порт') +
      '</div>' +
      verdict +
      '<div class="master-check">' +
      '<label class="tick"><input type="checkbox" data-act="teacher-confirm"' + (s.teacher.confirmed ? ' checked' : '') + '>' +
      '<span class="tick__box" aria-hidden="true"></span>' +
      '<span class="tick__text">Результат проверен мастером на месте</span></label>' +
      '<p class="q-meta">Без подтверждения засчитывается 10 из 20 баллов: линию принимает человек, а не страница.</p>' +
      '</div>' +
      '</section>'
    );
  }

  function blockQuestions(b, s) {
    const given = S.answersGiven(s);
    const list = D.QUESTIONS.map((q) => {
      const val = s.questions[q.id] || '';
      return (
        '<div class="qa">' +
        '<label class="qa__label" for="ans-' + q.id + '">' + esc(q.text) + '</label>' +
        '<p class="qa__hint">' + esc(q.hint) + '</p>' +
        '<textarea id="ans-' + q.id + '" data-question="' + q.id + '" rows="3" placeholder="Ответьте своими словами…">' +
        esc(val) + '</textarea>' +
        '<div class="qa__foot">' +
        '<span class="q-meta">' + val.trim().length + ' символов · ' +
        (val.trim().length >= 60 ? '2 б.' : val.trim().length >= 25 ? '1 б.' : '0 б.') + '</span>' +
        (s.report.exported ? '' : '') +
        '</div>' +
        (s.questionsChecked
          ? '<div class="qa__model"><b>Модельный ответ:</b> ' + esc(q.model) + '</div>'
          : '') +
        '</div>'
      );
    }).join('');

    return (
      '<section class="q-block" data-block="questions">' +
      kicker('Контрольные вопросы · 10 баллов') +
      '<h3 class="q-ask">Пять вопросов на понимание</h3>' +
      '<p class="q-hint">Короткий ответ — 1 балл, развёрнутый (от 60 символов) — 2. Проверка откроет модельные ответы: сравните со своими, это часть работы.</p>' +
      '<div class="qa-list">' + list + '</div>' +
      '<div class="q-actions">' +
      '<button type="button" class="btn btn--ink" data-act="questions-check">Сверить с модельными ответами</button>' +
      '<span class="q-meta">отвечено ' + given + ' из ' + D.QUESTIONS.length + '</span>' +
      '</div>' +
      '</section>'
    );
  }

  function blockReport(b, s) {
    const r = s.report;
    const sc = S.computeScore(s);
    const field = (key, label, ph, wide) =>
      '<label class="field' + (wide ? ' field--wide' : '') + '">' +
      '<span class="field__label">' + esc(label) + '</span>' +
      '<input type="text" data-report="' + key + '" value="' + esc(r[key] || '') + '" placeholder="' + esc(ph) + '">' +
      '</label>';

    return (
      '<section class="q-block" data-block="report">' +
      kicker('Отчёт о смене · 15 баллов') +
      '<h3 class="q-ask">Акт выполненных работ</h3>' +
      '<div class="fields">' +
      field('student', 'Исполнитель', 'Иванов Иван') +
      field('group', 'Группа', 'ЭК-21') +
      field('object', 'Объект', D.SHIFT.object, true) +
      '</div>' +
      '<label class="field field--wide">' +
      '<span class="field__label">Вывод по смене (не меньше 40 символов)</span>' +
      '<textarea data-report="comment" rows="3" placeholder="Что было сломано, что сделали, чем проверили и какой результат получили.">' +
      esc(r.comment) + '</textarea>' +
      '<span class="q-meta">' + r.comment.trim().length + ' символов</span>' +
      '</label>' +
      '<div class="q-actions q-actions--wrap">' +
      '<button type="button" class="btn" data-act="export">Выгрузить .txt</button>' +
      '<button type="button" class="btn" data-act="copy">Скопировать</button>' +
      '<button type="button" class="btn" data-act="print-act">Печать акта</button>' +
      '<span class="q-points">' + sc.parts.report.value + ' / 15</span>' +
      '</div>' +
      '</section>'
    );
  }

  function blockFinal(b, s) {
    const sc = S.computeScore(s);
    const finished = !!s.finishedAt;
    const bars = Object.keys(sc.parts)
      .map((k) => {
        const p = sc.parts[k];
        return (
          '<li class="bar-row">' +
          '<span class="bar-row__label">' + esc(p.label) + '</span>' +
          '<span class="bar-row__track"><span class="bar-row__fill" style="--p:' + (p.value / p.max).toFixed(3) + '"></span></span>' +
          '<span class="bar-row__value">' + p.value + '<span>/' + p.max + '</span></span>' +
          '</li>'
        );
      })
      .join('');

    return (
      '<section class="q-block q-final" data-block="final">' +
      kicker('Итог смены') +
      '<div class="final-grid">' +
      '<div class="final-score">' +
      '<div class="final-score__num">' + sc.total + '<span>/100</span></div>' +
      '<div class="final-score__grade">' + esc(sc.grade.text) + ' · оценка ' + sc.grade.mark + '</div>' +
      '<div class="final-score__time">в смене ' + S.fmtDuration(S.elapsedSec(s)) + '</div>' +
      '</div>' +
      '<ul class="bars">' + bars + '</ul>' +
      '</div>' +
      (finished
        ? '<div class="done-banner"><span aria-hidden="true">✅</span><div><b>Смена закрыта.</b> ' +
          'Акт можно распечатать, оценку — отправить в МЭШ.</div></div>' +
          dialogue([
            { who: 'gusev', text: 'Смена принята. Розетку посмотрел: заделано ровно, кабель зажат, рамка на месте. Хорошая работа.' },
            { who: 'gusev', text: 'Завтра придёшь — будет четыре розетки в 310-м. Так что нож не убирай далеко.' },
            { who: 'alisa', text: 'И приходи на пять минут раньше: покажу, как кроссировать панель. Это следующий уровень.' },
            { who: 'bayt', text: 'Мяу. (Перевод: неплохо для первого дня.)' }
          ])
        : '<div class="q-actions q-actions--wrap">' +
          '<button type="button" class="btn btn--primary btn--lg" data-act="finish">Завершить смену</button>' +
          '<button type="button" class="btn" data-act="print-act">Печать акта</button>' +
          (S.pending(7, s) ? '<span class="q-meta">до завершения: ' + esc(S.pending(7, s)) + '</span>' : '') +
          '</div>') +
      (finished
        ? '<div class="q-actions q-actions--wrap">' +
          '<button type="button" class="btn btn--primary" data-act="lms">Отправить оценку в МЭШ</button>' +
          '<button type="button" class="btn" data-act="print-act">Печать акта</button>' +
          '<button type="button" class="btn btn--ghost" data-act="restart">Начать смену заново</button>' +
          '</div>'
        : '') +
      '</section>'
    );
  }

  /* ---------- Сборка эпизода --------------------------------------------- */
  const RENDERERS = {
    prose: blockProse,
    note: note,
    ticket: blockTicket,
    dialogue: blockDialogue,
    interlude: blockInterlude,
    choice: blockChoice,
    survey: blockSurvey,
    checklist: blockChecklist,
    kit: blockKit,
    evidence: blockEvidence,
    terms: blockTerms,
    scheme: blockScheme,
    quiz: blockQuiz,
    order: blockOrder,
    ops: blockOps,
    tester: blockTester,
    questions: blockQuestions,
    report: blockReport,
    final: blockFinal
  };

  function renderEpisode(ep, s) {
    const body = ep.blocks
      .map((b) => {
        const fn = RENDERERS[b.type];
        return fn ? fn(b, s) : '';
      })
      .join('');

    return (
      '<article class="episode" data-episode="' + ep.id + '">' +
      '<header class="episode__head">' +
      '<div class="episode__meta">' +
      '<span class="episode__time mono">' + esc(ep.time) + '</span>' +
      '<span class="episode__step">эпизод ' + ep.id + ' из ' + D.EPISODES.length + '</span>' +
      '</div>' +
      '<h2 class="episode__title">' + esc(ep.title) + '</h2>' +
      '<p class="episode__sub">' + esc(ep.sub) + '</p>' +
      '</header>' +
      '<div class="episode__body">' + body + '</div>' +
      '</article>'
    );
  }

  global.AppRender = { renderEpisode: renderEpisode, kicker: kicker };
})(window);
