/* ==========================================================================
   report.js — шаг 7 тренажёра «Монтаж сетевых розеток»: конфигурация общего
   модуля отчёта — таблица, текст, оценка и payload для МЭШ.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const S = global.AppState;

  function fmtCm(v) {
    return Number(v || 0).toFixed(1).replace('.', ',') + ' см';
  }

  function wiringText(s) {
    const correct = S.allWiresCorrect(s);
    if (S.filledCount(s) < 8) return 'разведено ' + S.filledCount(s) + ' из 8 жил';
    return 'все 8 жил по маркировке B' + (correct === 8 ? '' : ' (есть отклонения: ' + correct + '/8)');
  }

  function punchedText(s) {
    const bad = D.MODULE_CONTACTS.filter((c) => !s.punched[c.idx]).length;
    if (!bad) return 'все 8 контактов заделаны';
    return 'не заделано контактов: ' + bad;
  }

  function mountText(s) {
    const m = s.mount;
    const parts = [];
    parts.push(m.tie ? 'стяжка ✔' : 'стяжка ✘');
    parts.push(m.module ? 'модуль в корпусе ✔' : 'модуль не установлен ✘');
    parts.push(m.screws[0] && m.screws[1] ? 'рамка закреплена ✔' : 'рамка не закреплена ✘');
    return parts.join(', ');
  }

  function testerText(s) {
    const r = s.tester.result;
    if (!s.tester.tested || !r) return 'не проводилась';
    if (r.ok) return 'линия исправна: 8 жил, прямой порядок по B';
    if (r.crossover.length) return 'перекрёст: ' + r.crossover.map((p) => p.a + '-' + p.b).join(', ');
    return 'обрыв: ' + r.opens.map((p) => p.a + '-×').join(', ');
  }

  function tableRows(s) {
    const sc = S.computeScore(s);
    return [
      ['Тип изделия', 'Сетевая розетка RJ-45, модуль keystone (110 IDC)'],
      ['Стандарт разделки', 'T568B (маркировка B на модуле)'],
      ['Набор инструментов', s.kit.checked ? 'собран верно' : 'не проверен'],
      ['Зачистка оболочки', fmtCm(s.prep.lengthCm) + ' (норма 2,0–2,5 см), жилы ' + (s.prep.wiresStripped ? 'зачищены — ошибка' : 'в изоляции')],
      ['Разделка жил', wiringText(s)],
      ['Заделка контактов', punchedText(s)],
      ['Сборка', mountText(s)],
      ['Проверка тестером', testerText(s)],
      ['Результат', sc.total + ' / 100 — ' + sc.grade.text + ' (оценка ' + sc.grade.mark + ')']
    ];
  }

  function textReport(s) {
    const sc = S.computeScore(s);
    const date = new Date().toLocaleString('ru-RU');
    return [
      'ОТЧЁТ О ЛАБОРАТОРНОЙ РАБОТЕ',
      '«Монтаж сетевой розетки RJ-45. Стандарт T568B»',
      '='.repeat(58),
      'ФИО: ' + (s.report.student || '—'),
      'Группа / класс: ' + (s.report.group || '—'),
      'Дата: ' + date,
      '',
      '1. ИСХОДНЫЕ ДАННЫЕ',
      '   Изделие: сетевая розетка RJ-45 с модулем keystone',
      '   Кабель: UTP, 4 пары, категория 5e',
      '   Стандарт разделки: T568B (цветная маркировка B на модуле)',
      '   Допуск зачистки оболочки: 2,0–2,5 см, жилы не зачищают',
      '',
      '2. РЕЗУЛЬТАТЫ',
      '   Набор инструментов: ' + (s.kit.checked ? 'собран верно' : 'не проверен'),
      '   Зачистка оболочки: ' + fmtCm(s.prep.lengthCm),
      '   Изоляция жил: ' + (s.prep.wiresStripped ? 'снята (ошибка монтажа)' : 'сохранена'),
      '   Разделка: ' + wiringText(s),
      '   Заделка: ' + punchedText(s),
      '   Сборка: ' + mountText(s),
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
    ].join('\n');
  }

  global.AppReport = global.AppReportFactory.create({
    title: 'Отчёт и оценка',
    subtitle: 'Ответьте на вопросы, заполните отчёт и отправьте оценку.',
    fileName: 'lab-network-socket-report.txt',
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
      'Например: заделал 8 жил по маркировке B заделочным ножом, жилы не зачищал. Тестер показал все жилы без перекрёста.',
    lmsWork: 'Монтаж сетевой розетки RJ-45 (T568B)'
  });
})(window);
