/* ==========================================================================
   report.js — шаг 7: мини-тест, автоматический отчёт, баллы, выгрузка
   и отправка оценки в МЭШ через postMessage.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const G = global.APP_GFX;
  const S = global.AppState;
  const U = global.AppUI;
  const $ = U.$;
  const $$ = U.$$;
  const esc = G.esc;
  const STD = D.STANDARDS.T568B;

  /* ---------- Помощники -------------------------------------------------- */
  function fmtCm(v) {
    return Number(v || 0).toFixed(1).replace('.', ',') + ' см';
  }

  function orderText(order) {
    if (!order || order.some((x) => !x)) return 'не все жилы расставлены';
    return order.map((id) => D.WIRES[id].abbr).join('–');
  }

  function crossNote(s) {
    const a = s.ends.A.order;
    const b = s.ends.B.order;
    if (a.some((x) => !x) || b.some((x) => !x)) return '';
    const same = a.every((id, i) => b[i] === id);
    return same ? '' : ' (концы собраны по-разному — это перекрёстный кабель)';
  }

  function miniLanes(stdId) {
    return (
      '<span class="mini-scheme__end" aria-hidden="true">' +
      '<span class="mini-scheme__wires">' +
      D.STANDARDS[stdId].order.map((id) => '<span class="' + G.wireClass(id) + '"></span>').join('') +
      '</span></span>'
    );
  }

  function miniScheme(pair) {
    return (
      '<span class="mini-scheme">' + miniLanes(pair[0]) +
      '<span class="mini-scheme__link" aria-hidden="true">↔</span>' +
      miniLanes(pair[1]) + '</span>'
    );
  }

  /* ---------- Мини-тест -------------------------------------------------- */
  function quizHTML(s) {
    const checked = s.quiz.checked;
    const items = D.QUIZ.map((q, qi) => {
      const picked = s.quiz.answers[q.id];
      const options = q.options
        .map((opt) => {
          let cls = 'quiz__opt';
          if (!checked && picked === opt.id) cls += ' is-picked';
          if (checked && opt.id === q.correct) cls += ' is-correct';
          if (checked && picked === opt.id && opt.id !== q.correct) cls += ' is-incorrect';
          return (
            '<label class="' + cls + '">' +
            '<input type="radio" name="' + q.id + '" value="' + opt.id + '"' +
            (picked === opt.id ? ' checked' : '') + (checked ? ' disabled' : '') + '>' +
            '<span>' + esc(opt.text) + (opt.scheme ? miniScheme(opt.scheme) : '') + '</span>' +
            '</label>'
          );
        })
        .join('');

      const correct = checked && s.quiz.answers[q.id] === q.correct;
      let qCls = 'quiz__q';
      if (checked) qCls += correct ? ' is-right' : ' is-wrong';

      return (
        '<div class="' + qCls + '" data-q="' + q.id + '">' +
        '<div class="quiz__text">' + (qi + 1) + '. ' + esc(q.text) + '</div>' +
        '<div class="quiz__options" role="radiogroup" aria-label="' + esc(q.text) + '">' + options + '</div>' +
        (checked
          ? '<div class="quiz__feedback"><b>' + (correct ? 'Верно (+2)' : 'Неверно (0)') + '.</b> ' + esc(q.explain) + '</div>'
          : '') +
        '</div>'
      );
    }).join('');

    const answered = Object.keys(s.quiz.answers).length;
    return (
      '<div class="quiz" id="quiz">' + items + '</div>' +
      '<div class="row" style="margin-top:10px">' +
      '<span class="chip' + (answered === D.QUIZ.length ? ' chip--blue' : '') + '" id="quiz-counter">отвечено ' + answered + ' / ' + D.QUIZ.length + '</span>' +
      '<span class="muted" style="font-size:0.78rem">2 балла за верный ответ, всего 10</span>' +
      '</div>'
    );
  }

  /* ---------- Таблица отчёта --------------------------------------------- */
  function qualityWord(e) {
    if (!e.crimped) return 'не обжат';
    if (e.force >= D.SETTINGS.crimpGood && e.depth >= D.SETTINGS.depthGood) return 'хорошо';
    if (e.force >= D.SETTINGS.crimpWarn) return 'удовлетворительно (недожат)';
    return 'плохо';
  }

  function testerText(s) {
    const r = s.tester.result;
    if (!s.tester.tested || !r) return 'не проводилась';
    if (r.ok) return 'исправен: 8 жил, прямой обжим';
    if (r.crossover.length) return 'перекрёст: ' + r.crossover.map((p) => p.a + '-' + p.b).join(', ');
    return 'обрыв: ' + r.opens.map((p) => p.a + '-×').join(', ');
  }

  function tableHTML(s) {
    const A = s.ends.A;
    const B = s.ends.B;
    const sc = S.computeScore(s);
    const rows = [
      ['Тип кабеля', 'Прямой (straight-through)'],
      ['Стандарт обжима', 'T568B / T568B'],
      ['Порядок жил, конец A', orderText(A.order)],
      ['Порядок жил, конец B', orderText(B.order) + crossNote(s)],
      ['Зачистка оболочки', 'A — ' + fmtCm(A.strip.lengthCm) + ', B — ' + fmtCm(B.strip.lengthCm) + ' (норма 2,0–2,5 см)'],
      ['Глубина вставки', 'A — ' + Math.round(A.depth) + '%, B — ' + Math.round(B.depth) + '%'],
      ['Качество обжима', 'A — ' + qualityWord(A) + ' (' + Math.round(A.force) + '%), B — ' + qualityWord(B) + ' (' + Math.round(B.force) + '%)'],
      ['Проверка тестером', testerText(s)],
      ['Результат', sc.total + ' / 100 — ' + sc.grade.text + ' (оценка ' + sc.grade.mark + ')']
    ];
    return (
      '<table class="report__table"><tbody>' +
      rows.map((r) => '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') +
      '</tbody></table>'
    );
  }

  /* ---------- Панель баллов ---------------------------------------------- */
  function scorePanelHTML(s) {
    const sc = S.computeScore(s);
    const rows = Object.keys(sc.parts)
      .map((k) => {
        const p = sc.parts[k];
        return (
          '<div class="score-row">' +
          '<span>' + esc(p.label) + '</span>' +
          '<span class="score-row__val">' + p.value + ' / ' + p.max + '</span>' +
          '<span class="score-row__bar"><span class="score-row__fill" style="width:' + p.percent + '%"></span></span>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="report__score" id="score-panel">' +
      G.ringSVG(sc.total) +
      '<div>' +
      '<div class="report__grade">' + esc(sc.grade.text) + ' <span>· оценка ' + sc.grade.mark + '</span></div>' +
      '<p class="muted" style="font-size:0.8rem;margin:2px 0 10px">' +
      (s.quiz.checked ? 'Баллы начислены по всем разделам.' : 'Ответы на вопросы не проверены — 10 баллов пока не начислены.') +
      '</p>' +
      '<div class="score-list">' + rows + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function paintRing(root) {
    const ring = $('.ring__value', root);
    const num = $('[data-ring-num]', root);
    if (!ring) return;
    const target = Number(ring.getAttribute('data-dashoffset'));
    const total = S.computeScore(S.get()).total;
    global.requestAnimationFrame(() => {
      ring.style.strokeDashoffset = String(target);
    });
    if (num) {
      let cur = 0;
      const tick = () => {
        cur += Math.max(1, Math.round(total / 22));
        if (cur >= total) {
          num.textContent = String(total);
          return;
        }
        num.textContent = String(cur);
        global.setTimeout(tick, 28);
      };
      num.textContent = '0';
      if (typeof global.requestAnimationFrame === 'function') tick();
      else num.textContent = String(total);
    }
  }

  function refreshScore(root) {
    const host = $('#score-panel', root);
    if (!host) return;
    const s = S.get();
    host.outerHTML = scorePanelHTML(s);
    paintRing(root);
    U.renderScore();
    U.renderStepper();
    U.renderChecklist();
    const table = $('.report__table', root);
    if (table) table.outerHTML = tableHTML(s);
  }

  /* ---------- Текст отчёта для скачивания -------------------------------- */
  function reportText(s) {
    const A = s.ends.A;
    const B = s.ends.B;
    const sc = S.computeScore(s);
    const date = new Date().toLocaleString('ru-RU');
    const lines = [
      'ОТЧЁТ О ЛАБОРАТОРНОЙ РАБОТЕ',
      '«Обжим витой пары. Прямой обжим (Straight-Through, T568B)»',
      '='.repeat(58),
      'ФИО: ' + (s.report.student || '—'),
      'Группа / класс: ' + (s.report.group || '—'),
      'Дата: ' + date,
      '',
      '1. ИСХОДНЫЕ ДАННЫЕ',
      '   Кабель: UTP, 4 пары, 8P8C (RJ-45)',
      '   Стандарт обжима: T568B на обоих концах',
      '   Допуск зачистки оболочки: 2,0–2,5 см',
      '',
      '2. РЕЗУЛЬТАТЫ',
      '   Порядок жил, конец A: ' + orderText(A.order),
      '   Порядок жил, конец B: ' + orderText(B.order) + crossNote(s),
      '   Зачистка: A — ' + fmtCm(A.strip.lengthCm) + ', B — ' + fmtCm(B.strip.lengthCm),
      '   Глубина вставки: A — ' + Math.round(A.depth) + '%, B — ' + Math.round(B.depth) + '%',
      '   Обжим: A — ' + Math.round(A.force) + '%, B — ' + Math.round(B.force) + '%',
      '   Тестер: ' + testerText(s),
      '',
      '3. ОЦЕНИВАНИЕ',
      Object.keys(sc.parts).map((k) => '   ' + sc.parts[k].label + ': ' + sc.parts[k].value + ' / ' + sc.parts[k].max).join('\n'),
      '   ИТОГО: ' + sc.total + ' / 100 — ' + sc.grade.text + ' (оценка ' + sc.grade.mark + ')',
      '',
      '4. ВЫВОД',
      '   ' + (s.report.comment || '—'),
      '',
      'Сформировано в интерактивном тренажёре netsys_trainer.'
    ];
    return lines.join('\n');
  }

  /* ---------- Скачивание / копирование / печать -------------------------- */
  function downloadReport(s) {
    const text = reportText(s);
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lab-twisted-pair-report.txt';
      document.body.appendChild(a);
      a.click();
      global.setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 800);
      s.report.exported = true;
      S.saveNow();
      U.toast('ok', 'Отчёт скачан', 'Файл lab-twisted-pair-report.txt сохранён.');
    } catch (e) {
      U.toast('error', 'Не удалось сохранить файл', 'Скопируйте отчёт кнопкой «Копировать».');
    }
  }

  function copyReport(s) {
    const text = reportText(s);
    const done = () => {
      s.report.copied = true;
      S.saveNow();
      U.toast('ok', 'Отчёт скопирован', 'Вставьте его в документ или чат.');
    };
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) {
      U.toast('error', 'Копирование недоступно', 'Выделите текст отчёта вручную.');
    }
  }

  /* ---------- Отправка в МЭШ --------------------------------------------- */
  function sendToLMS(s, silent) {
    s.stats.finishedAt = Date.now();
    S.saveNow();
    const payload = S.lmsPayload(s);
    let delivered = false;
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage(payload, '*');
        delivered = true;
      }
      if (global.top && global.top !== global && global.top !== global.parent) {
        global.top.postMessage(payload, '*');
      }
    } catch (e) {
      delivered = false;
    }
    if (!silent) {
      if (delivered) {
        U.toast('ok', 'Оценка отправлена в МЭШ', payload.score + ' из ' + payload.maxScore + ' · ' + payload.gradeText);
      } else {
        U.toast('info', 'Оценка сформирована', 'Страница открыта вне iframe — отправлять некуда. Внутри МЭШ оценка уйдёт автоматически.');
      }
    }
    return payload;
  }

  /* ---------- Рендер шага ------------------------------------------------ */
  function render(s) {
    const sc = S.computeScore(s);
    const checked = s.quiz.checked;

    const body =
      '<div class="report">' +
      '<section>' +
      '<div class="row row--between" style="margin-bottom:8px">' +
      '<h3 style="margin:0">Мини-тест по теории</h3>' +
      '<span class="chip chip--blue">10 баллов</span>' +
      '</div>' +
      quizHTML(s) +
      '<div class="row" style="margin-top:10px">' +
      (checked
        ? '<span class="chip chip--green">проверено</span>' +
          '<span class="muted" style="font-size:0.8rem">Верных ответов: ' +
          D.QUIZ.filter((q) => s.quiz.answers[q.id] === q.correct).length + ' из ' + D.QUIZ.length + '</span>'
        : '<button type="button" class="btn btn--primary" data-act="check-quiz" data-focus-key="check-quiz">Проверить ответы</button>') +
      '</div>' +
      '</section>' +
      '<hr class="hr">' +
      '<section>' +
      '<div class="row row--between" style="margin-bottom:8px">' +
      '<h3 style="margin:0">Отчёт по работе</h3>' +
      '<span class="chip">заполняется автоматически</span>' +
      '</div>' +
      '<div class="report__head" style="margin-bottom:10px">' +
      '<div style="flex:1 1 200px"><label for="rep-student" class="muted" style="font-size:0.78rem;display:block;margin-bottom:4px">ФИО</label>' +
      '<input type="text" id="rep-student" data-field="student" value="' + esc(s.report.student) + '" placeholder="Иванов Иван" autocomplete="name"></div>' +
      '<div style="flex:0 1 140px"><label for="rep-group" class="muted" style="font-size:0.78rem;display:block;margin-bottom:4px">Группа / класс</label>' +
      '<input type="text" id="rep-group" data-field="group" value="' + esc(s.report.group) + '" placeholder="10-А"></div>' +
      '</div>' +
      '<div id="report-table">' + tableHTML(s) + '</div>' +
      '<div class="report__comment" style="margin-top:12px">' +
      '<label for="rep-comment">Вывод по работе (не менее 40 символов)</label>' +
      '<textarea id="rep-comment" data-field="comment" placeholder="Например: обжал кабель по T568B, тестер показал все 8 жил без перекрёста. Понял, зачем оболочку заводят под зажим.">' +
      esc(s.report.comment) + '</textarea>' +
      '<span class="muted" style="font-size:0.75rem" id="comment-count">' + s.report.comment.trim().length + ' символов</span>' +
      '</div>' +
      '</section>' +
      '<hr class="hr">' +
      '<section>' + scorePanelHTML(s) + '</section>' +
      '<div class="note note--blue">' +
      G.icon('info', 'note__icon') +
      '<span>Отчёт скачивается как текстовый файл, печатается в PDF через диалог печати, а оценка уходит в МЭШ через <code>postMessage</code>.</span>' +
      '</div>' +
      '</div>';

    return (
      '<div class="step-panel" id="step-7" data-step="7">' +
      '<div class="stage__card">' +
      '<header class="stage__head">' +
      '<span class="stage__badge" aria-hidden="true">7</span>' +
      '<div class="stage__titles"><h2 class="stage__title">' + esc(D.STEPS[6].title) + '</h2>' +
      '<p class="stage__sub">Ответьте на вопросы, заполните отчёт и отправьте оценку.</p></div>' +
      '<div class="stage__head-right">' +
      '<span class="chip ' + (sc.grade.tone === 'ok' ? 'chip--green' : sc.grade.tone === 'warn' ? 'chip--amber' : 'chip--red') + '">' +
      sc.total + ' / 100 · ' + esc(sc.grade.text) + '</span>' +
      '</div></header>' +
      '<div class="bench" style="min-height:0;padding:16px">' + body + '</div>' +
      '<div class="stage-actions">' +
      '<span class="stage-actions__hint">Итоговая оценка: ' + sc.total + ' из 100</span>' +
      '<div class="stage-actions__main">' +
      '<button type="button" class="btn btn--sm" data-act="download" data-focus-key="download">' + G.icon('download') + 'Скачать</button>' +
      '<button type="button" class="btn btn--sm" data-act="copy">' + G.icon('copy') + 'Копировать</button>' +
      '<button type="button" class="btn btn--sm" data-act="print">' + G.icon('print') + 'PDF / печать</button>' +
      '<button type="button" class="btn btn--primary" data-act="send-lms" data-focus-key="send-lms">' + G.icon('check') + 'Завершить и отправить</button>' +
      '</div>' +
      '</div>' +
      '</div></div>'
    );
  }

  /* ---------- Монтирование ----------------------------------------------- */
  function mount(root, s) {
    paintRing(root);

    $$('.quiz input[type="radio"]', root).forEach((input) => {
      input.addEventListener('change', () => {
        if (s.quiz.checked) return;
        s.quiz.answers[input.name] = input.value;
        S.save();
        // подсветка выбранного варианта без перерисовки страницы
        const group = input.closest('.quiz__q');
        if (group) {
          $$('.quiz__opt', group).forEach((lab) => {
            const inp = $('input', lab);
            lab.classList.toggle('is-picked', !!(inp && inp.checked));
          });
        }
        const counter = $('#quiz-counter', root);
        const answered = Object.keys(s.quiz.answers).length;
        if (counter) counter.textContent = 'отвечено ' + answered + ' / ' + D.QUIZ.length;
      });
    });

    const check = $('[data-act="check-quiz"]', root);
    if (check) {
      check.addEventListener('click', () => {
        const answered = Object.keys(s.quiz.answers).length;
        if (answered < D.QUIZ.length) {
          U.toast('warn', 'Не на все вопросы есть ответ', 'Отвечено ' + answered + ' из ' + D.QUIZ.length + '. Можно проверить и сейчас — за пропуски баллы не начисляются.');
        }
        s.quiz.checked = true;
        S.save();
        global.App.render();
        const right = D.QUIZ.filter((q) => s.quiz.answers[q.id] === q.correct).length;
        U.toast(right >= 4 ? 'ok' : 'warn', 'Верных ответов: ' + right + ' из ' + D.QUIZ.length, 'Начислено ' + right * 2 + ' из 10 баллов.');
      });
    }

    // поля отчёта
    $$('[data-field]', root).forEach((el) => {
      const field = el.getAttribute('data-field');
      let t = null;
      el.addEventListener('input', () => {
        s.report[field] = el.value;
        if (field === 'comment') {
          const c = $('#comment-count', root);
          if (c) c.textContent = el.value.trim().length + ' символов';
        }
        S.save();
        if (t) global.clearTimeout(t);
        t = global.setTimeout(() => {
          refreshScore(root);
          if (field === 'comment' && el.value.trim().length >= 40 && !el.dataset.hinted) {
            el.dataset.hinted = '1';
            U.toast('ok', 'Вывод засчитан', 'Оформление отчёта: +4 балла.');
          }
        }, 500);
      });
    });

    const dl = $('[data-act="download"]', root);
    if (dl) dl.addEventListener('click', () => {
      downloadReport(s);
      global.setTimeout(() => refreshScore(root), 120);
    });

    const copy = $('[data-act="copy"]', root);
    if (copy) copy.addEventListener('click', () => {
      copyReport(s);
      global.setTimeout(() => refreshScore(root), 300);
    });

    const print = $('[data-act="print"]', root);
    if (print) print.addEventListener('click', () => {
      s.report.exported = true;
      S.saveNow();
      U.toast('info', 'Печать отчёта', 'В диалоге печати выберите «Сохранить как PDF».');
      global.setTimeout(() => {
        global.print();
        refreshScore(root);
      }, 200);
    });

    const send = $('[data-act="send-lms"]', root);
    if (send) send.addEventListener('click', () => {
      if (!s.quiz.checked) {
        U.toast('warn', 'Мини-тест не проверен', 'Нажмите «Проверить ответы» — иначе 10 баллов не попадут в оценку.');
      }
      const payload = sendToLMS(s, false);
      send.blur();
      refreshScore(root);
      U.announce('Итоговая оценка ' + payload.score + ' из ' + payload.maxScore);
    });
  }

  global.AppReport = {
    render,
    mount,
    reportText,
    sendToLMS,
    scorePanelHTML,
    tableHTML
  };
})(window);
