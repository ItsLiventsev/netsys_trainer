/* ==========================================================================
   report.js — шаг 7 тренажёра «Обжим витой пары»: конфигурация общего
   модуля отчёта (shared/js/report.js) — таблица, текст, оценка и payload МЭШ.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const S = global.AppState;

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

  function tableRows(s) {
    const A = s.ends.A;
    const B = s.ends.B;
    const sc = S.computeScore(s);
    return [
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
  }

  function textReport(s) {
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

  global.AppReport = global.AppReportFactory.create({
    title: 'Отчёт и оценка',
    subtitle: 'Ответьте на вопросы, заполните отчёт и отправьте оценку.',
    fileName: 'lab-twisted-pair-report.txt',
    quiz: D.QUIZ,
    getState: S.get,
    save: S.saveNow,
    score: S.computeScore,
    payload: S.lmsPayload,
    tableRows: tableRows,
    textReport: textReport,
    fields: {
      student: { label: 'ФИО', placeholder: 'Иванов Иван' },
      group: { label: 'Группа / класс', placeholder: '10-А' }
    },
    commentLabel: 'Вывод по работе (не менее 40 символов)',
    commentPlaceholder:
      'Например: обжал кабель по T568B, тестер показал все 8 жил без перекрёста. Понял, зачем оболочку заводят под зажим.',
    lmsWork: 'Обжим витой пары (Straight-Through, T568B)'
  });
})(window);
