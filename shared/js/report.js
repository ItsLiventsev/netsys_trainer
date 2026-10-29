/* ==========================================================================
   report.js — общий шаг 7 для тренажёров: мини-тест, автоматический отчёт,
   баллы, выгрузка файла, печать и отправка оценки в МЭШ.

   Использование:
     const report = AppReportFactory.create({
       title, subtitle, fileName,
       quiz, getState, save, score, payload,
       tableRows(state), textReport(state),
       fields: { student: {...}, group: {...} },
       commentLabel, commentPlaceholder,
       lmsWork
     });
     report.render(state) / report.mount(root, state) / report.sendToLMS(state)
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.AppCore;
  const I = global.AppIcons;
  const $ = C.$;
  const $$ = C.$$;
  const esc = C.esc;

  /* ---------- Мини-тест -------------------------------------------------- */
  // схема в варианте ответа: либо id стандарта ('T568B'), либо готовый порядок жил
  function endOrder(spec) {
    const std = global.APP_DATA && global.APP_DATA.STANDARDS && global.APP_DATA.STANDARDS[spec];
    return std ? std.order : spec;
  }

  function miniLanes(order, wireClass) {
    return (
      '<span class="mini-scheme__end" aria-hidden="true"><span class="mini-scheme__wires">' +
      order.map((id) => '<span class="' + wireClass(id) + '"></span>').join('') +
      '</span></span>'
    );
  }

  function miniScheme(pair, wireClass) {
    return (
      '<span class="mini-scheme">' +
      miniLanes(endOrder(pair[0]), wireClass) +
      '<span class="mini-scheme__link" aria-hidden="true">↔</span>' +
      miniLanes(endOrder(pair[1]), wireClass) +
      '</span>'
    );
  }

  /* ---------- Фабрика ---------------------------------------------------- */
  function create(config) {
    const cfg = config;
    const quiz = cfg.quiz || [];
    const wireClass = (id) => I.wireClass(id);

    function score(s) {
      return cfg.score(s);
    }

    function quizHTML(s) {
      const checked = s.quiz.checked;
      const items = quiz
        .map((q, qi) => {
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
                '<span>' + esc(opt.text) + (opt.scheme ? miniScheme(opt.scheme, wireClass) : '') + '</span>' +
                '</label>'
              );
            })
            .join('');

          const correct = checked && s.quiz.answers[q.id] === q.correct;
          const qCls = 'quiz__q' + (checked ? (correct ? ' is-right' : ' is-wrong') : '');

          return (
            '<div class="' + qCls + '" data-q="' + q.id + '">' +
            '<div class="quiz__text">' + (qi + 1) + '. ' + esc(q.text) + '</div>' +
            '<div class="quiz__options" role="radiogroup" aria-label="' + esc(q.text) + '">' + options + '</div>' +
            (checked
              ? '<div class="quiz__feedback"><b>' + (correct ? 'Верно (+2)' : 'Неверно (0)') + '.</b> ' + esc(q.explain) + '</div>'
              : '') +
            '</div>'
          );
        })
        .join('');

      const answered = Object.keys(s.quiz.answers).length;
      return (
        '<div class="quiz" id="quiz">' + items + '</div>' +
        '<div class="row" style="margin-top:10px">' +
        '<span class="chip' + (answered === quiz.length ? ' chip--blue' : '') + '" id="quiz-counter">отвечено ' + answered + ' / ' + quiz.length + '</span>' +
        '<span class="muted" style="font-size:0.78rem">2 балла за верный ответ, всего ' + quiz.length * 2 + '</span>' +
        '</div>'
      );
    }

    /* ---------- Таблица отчёта ------------------------------------------- */
    function tableHTML(s) {
      const rows = cfg.tableRows(s) || [];
      return (
        '<table class="report__table"><tbody>' +
        rows.map((r) => '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') +
        '</tbody></table>'
      );
    }

    function scorePanelHTML(s) {
      const sc = score(s);
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
        I.ringSVG(sc.total) +
        '<div>' +
        '<div class="report__grade">' + esc(sc.grade.text) + ' <span>· оценка ' + sc.grade.mark + '</span></div>' +
        '<p class="muted" style="font-size:0.8rem;margin:2px 0 10px">' +
        (s.quiz.checked ? 'Баллы начислены по всем разделам.' : 'Ответы на вопросы не проверены — ' + quiz.length * 2 + ' баллов пока не начислены.') +
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
      const total = score(cfg.getState()).total;
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
      host.outerHTML = scorePanelHTML(cfg.getState());
      paintRing(root);
      if (global.Shell) global.Shell.refresh();
      const table = $('.report__table', root);
      if (table) table.outerHTML = tableHTML(cfg.getState());
    }

    /* ---------- Текстовый отчёт ----------------------------------------- */
    function reportText(s) {
      return cfg.textReport(s);
    }

    /* ---------- Выгрузка ------------------------------------------------- */
    function downloadReport(s) {
      const text = reportText(s);
      try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cfg.fileName || 'lab-report.txt';
        document.body.appendChild(a);
        a.click();
        global.setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 800);
        s.report.exported = true;
        cfg.save();
        C.toast('ok', 'Отчёт скачан', 'Файл ' + (cfg.fileName || 'lab-report.txt') + ' сохранён.');
      } catch (e) {
        C.toast('error', 'Не удалось сохранить файл', 'Скопируйте отчёт кнопкой «Копировать».');
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
        C.toast('error', 'Копирование недоступно', 'Выделите текст отчёта вручную.');
      }
    }

    function copyReport(s) {
      const text = reportText(s);
      const done = () => {
        s.report.copied = true;
        cfg.save();
        C.toast('ok', 'Отчёт скопирован', 'Вставьте его в документ или чат.');
      };
      if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    }

    /* ---------- Отправка в МЭШ ------------------------------------------- */
    function sendToLMS(s, silent) {
      s.stats.finishedAt = Date.now();
      cfg.save();
      const payload = cfg.payload(s);
      const delivered = C.lms.send(payload);
      if (!silent) {
        if (delivered) {
          C.toast('ok', 'Оценка отправлена в МЭШ', payload.score + ' из ' + payload.maxScore + ' · ' + payload.gradeText);
        } else {
          C.toast(
            'info',
            'Оценка сформирована',
            'Страница открыта вне iframe — отправлять некуда. Внутри МЭШ оценка уйдёт автоматически.'
          );
        }
      }
      return payload;
    }

    /* ---------- Рендер шага ---------------------------------------------- */
    function render(s) {
      const sc = score(s);
      const fields = cfg.fields || {};
      const fStudent = fields.student || { label: 'ФИО', placeholder: 'Иванов Иван' };
      const fGroup = fields.group || { label: 'Группа / класс', placeholder: '10-А' };
      const checked = s.quiz.checked;

      const body =
        '<div class="report">' +
        '<section>' +
        '<div class="row row--between" style="margin-bottom:8px">' +
        '<h3 style="margin:0">Мини-тест по теории</h3>' +
        '<span class="chip chip--blue">' + quiz.length * 2 + ' баллов</span>' +
        '</div>' +
        quizHTML(s) +
        '<div class="row" style="margin-top:10px">' +
        (checked
          ? '<span class="chip chip--green">проверено</span>' +
            '<span class="muted" style="font-size:0.8rem">Верных ответов: ' +
            quiz.filter((q) => s.quiz.answers[q.id] === q.correct).length + ' из ' + quiz.length + '</span>'
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
        '<div style="flex:1 1 200px"><label for="rep-student" class="muted" style="font-size:0.78rem;display:block;margin-bottom:4px">' +
        esc(fStudent.label) + '</label>' +
        '<input type="text" id="rep-student" data-field="student" value="' + esc(s.report.student) + '" placeholder="' +
        esc(fStudent.placeholder) + '" autocomplete="name"></div>' +
        '<div style="flex:0 1 140px"><label for="rep-group" class="muted" style="font-size:0.78rem;display:block;margin-bottom:4px">' +
        esc(fGroup.label) + '</label>' +
        '<input type="text" id="rep-group" data-field="group" value="' + esc(s.report.group) + '" placeholder="' +
        esc(fGroup.placeholder) + '"></div>' +
        '</div>' +
        '<div id="report-table">' + tableHTML(s) + '</div>' +
        '<div class="report__comment" style="margin-top:12px">' +
        '<label for="rep-comment">' + esc(cfg.commentLabel || 'Вывод по работе (не менее 40 символов)') + '</label>' +
        '<textarea id="rep-comment" data-field="comment" placeholder="' + esc(cfg.commentPlaceholder || '') + '">' +
        esc(s.report.comment) + '</textarea>' +
        '<span class="muted" style="font-size:0.75rem" id="comment-count">' + s.report.comment.trim().length + ' символов</span>' +
        '</div>' +
        '</section>' +
        '<hr class="hr">' +
        '<section>' + scorePanelHTML(s) + '</section>' +
        '<div class="note note--blue">' +
        I.icon('info', 'note__icon') +
        '<span>Отчёт скачивается как текстовый файл, печатается в PDF через диалог печати, а оценка уходит в МЭШ через <code>postMessage</code>.</span>' +
        '</div>' +
        '</div>';

      return (
        '<div class="step-panel" id="step-' + s.step + '" data-step="' + s.step + '">' +
        '<div class="stage__card">' +
        '<header class="stage__head">' +
        '<span class="stage__badge" aria-hidden="true">' + s.step + '</span>' +
        '<div class="stage__titles"><h2 class="stage__title">' + esc(cfg.title || 'Отчёт и оценка') + '</h2>' +
        '<p class="stage__sub">' + esc(cfg.subtitle || 'Ответьте на вопросы, заполните отчёт и отправьте оценку.') + '</p></div>' +
        '<div class="stage__head-right">' +
        '<span class="chip ' + (sc.grade.tone === 'ok' ? 'chip--green' : sc.grade.tone === 'warn' ? 'chip--amber' : 'chip--red') + '">' +
        sc.total + ' / ' + sc.max + ' · ' + esc(sc.grade.text) + '</span>' +
        '</div></header>' +
        '<div class="bench" style="min-height:0;padding:16px">' + body + '</div>' +
        '<div class="stage-actions">' +
        '<span class="stage-actions__hint">Итоговая оценка: ' + sc.total + ' из ' + sc.max + '</span>' +
        '<div class="stage-actions__main">' +
        '<button type="button" class="btn btn--sm" data-act="download" data-focus-key="download">' + I.icon('download') + 'Скачать</button>' +
        '<button type="button" class="btn btn--sm" data-act="copy">' + I.icon('copy') + 'Копировать</button>' +
        '<button type="button" class="btn btn--sm" data-act="print">' + I.icon('print') + 'PDF / печать</button>' +
        '<button type="button" class="btn btn--primary" data-act="send-lms" data-focus-key="send-lms">' + I.icon('check') + 'Завершить и отправить</button>' +
        '</div>' +
        '</div>' +
        '</div></div>'
      );
    }

    /* ---------- Монтирование --------------------------------------------- */
    function mount(root, s) {
      paintRing(root);

      $$('.quiz input[type="radio"]', root).forEach((input) => {
        input.addEventListener('change', () => {
          if (s.quiz.checked) return;
          s.quiz.answers[input.name] = input.value;
          cfg.save();
          const group = input.closest('.quiz__q');
          if (group) {
            $$('.quiz__opt', group).forEach((lab) => {
              const inp = $('input', lab);
              lab.classList.toggle('is-picked', !!(inp && inp.checked));
            });
          }
          const counter = $('#quiz-counter', root);
          if (counter) counter.textContent = 'отвечено ' + Object.keys(s.quiz.answers).length + ' / ' + quiz.length;
        });
      });

      const check = $('[data-act="check-quiz"]', root);
      if (check) {
        check.addEventListener('click', () => {
          const answered = Object.keys(s.quiz.answers).length;
          if (answered < quiz.length) {
            C.toast(
              'warn',
              'Не на все вопросы есть ответ',
              'Отвечено ' + answered + ' из ' + quiz.length + '. Можно проверить и сейчас — за пропуски баллы не начисляются.'
            );
          }
          s.quiz.checked = true;
          cfg.save();
          global.App.render();
          const right = quiz.filter((q) => s.quiz.answers[q.id] === q.correct).length;
          C.toast(
            right >= quiz.length - 1 ? 'ok' : 'warn',
            'Верных ответов: ' + right + ' из ' + quiz.length,
            'Начислено ' + right * 2 + ' из ' + quiz.length * 2 + ' баллов.'
          );
        });
      }

      $$('[data-field]', root).forEach((node) => {
        const field = node.getAttribute('data-field');
        let timer = null;
        node.addEventListener('input', () => {
          s.report[field] = node.value;
          if (field === 'comment') {
            const c = $('#comment-count', root);
            if (c) c.textContent = node.value.trim().length + ' символов';
          }
          cfg.save();
          if (timer) global.clearTimeout(timer);
          timer = global.setTimeout(() => {
            refreshScore(root);
            if (field === 'comment' && node.value.trim().length >= 40 && !node.dataset.hinted) {
              node.dataset.hinted = '1';
              C.toast('ok', 'Вывод засчитан', 'Оформление отчёта: +4 балла.');
            }
          }, 500);
        });
      });

      const dl = $('[data-act="download"]', root);
      if (dl)
        dl.addEventListener('click', () => {
          downloadReport(s);
          global.setTimeout(() => refreshScore(root), 120);
        });

      const copyBtn = $('[data-act="copy"]', root);
      if (copyBtn)
        copyBtn.addEventListener('click', () => {
          copyReport(s);
          global.setTimeout(() => refreshScore(root), 300);
        });

      const printBtn = $('[data-act="print"]', root);
      if (printBtn)
        printBtn.addEventListener('click', () => {
          s.report.exported = true;
          cfg.save();
          C.toast('info', 'Печать отчёта', 'В диалоге печати выберите «Сохранить как PDF».');
          global.setTimeout(() => {
            global.print();
            refreshScore(root);
          }, 200);
        });

      const send = $('[data-act="send-lms"]', root);
      if (send)
        send.addEventListener('click', () => {
          if (!s.quiz.checked) {
            C.toast(
              'warn',
              'Мини-тест не проверен',
              'Нажмите «Проверить ответы» — иначе ' + quiz.length * 2 + ' баллов не попадут в оценку.'
            );
          }
          const payload = sendToLMS(s, false);
          send.blur();
          refreshScore(root);
          C.announce('Итоговая оценка ' + payload.score + ' из ' + payload.maxScore);
        });
    }

    return {
      render,
      mount,
      reportText,
      sendToLMS,
      scorePanelHTML,
      tableHTML,
      refreshScore
    };
  }

  global.AppReportFactory = { create };
})(window);
