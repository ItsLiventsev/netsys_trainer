#!/usr/bin/env node
/**
 * patch-panel-full.test.js — сквозной сценарий тренажёра «Смена на узле связи»:
 * восемь эпизодов от вводной до подписанного акта, журнал кроссовой,
 * рефлексивная мишень, итог 100 баллов и отправка результата в МЭШ.
 */
'use strict';

const assert = require('node:assert');
const { bootSimulator, wait } = require('./helpers');

async function run() {
  const ctx = bootSimulator('patch-panel');
  const { window, q, qa, click, change, type, toasts, wait: tick, errors } = ctx;
  await wait(300);
  const S = window.AppState;

  /* 1. Вводная */
  click(q('[data-choice="start"][data-opt="a"]'));
  await tick(30);
  click(q('[data-survey="experience"][data-opt="saw"]'));
  await tick(30);
  click(q('#next-btn'));
  await tick(60);

  /* 2. Заявка и роли */
  assert.match(q('.episode__title').textContent, /Заявка PP-314/);
  assert.strictEqual(qa('.ticket__row').length, 10);
  click(q('[data-role="lead"]'));
  await tick(30);
  click(q('[data-act="role-confirm"]'));
  await tick(40);
  assert.strictEqual(S.roleName(), 'Техник-исполнитель');
  qa('[data-block="charter"] [data-tick]').forEach((box) => {
    box.checked = true;
    change(box);
  });
  await tick(30);
  assert.strictEqual(S.isDone(2), false, 'нужно ещё решение по плану работ');
  click(q('[data-choice="plan"][data-opt="a"]'));
  await tick(30);
  assert.strictEqual(S.isDone(2), true);
  click(q('#next-btn'));
  await tick(60);

  /* 3. Допуск и инструмент */
  qa('[data-safety]').forEach((n) => change(n, true));
  await tick(30);
  assert.strictEqual(S.safetyDone(), true, 'пять пунктов инструктажа');
  click(q('[data-choice="case"][data-opt="a"]'));
  await tick(30);
  ['punch', 'stripper', 'cutter', 'tester', 'driver', 'organizer', 'labels'].forEach((id) =>
    click(q('[data-kit="' + id + '"]'))
  );
  await tick(30);
  click(q('[data-act="kit-check"]'));
  await tick(40);
  assert.strictEqual(S.isDone(3), true, 'набор собран верно');
  assert.strictEqual(S.computeScore().parts.wiring.value, 6, 'за набор 6 баллов');
  click(q('#next-btn'));
  await tick(60);

  /* 4. Аудит чужой работы */
  assert.match(q('.episode__title').textContent, /Толик/);
  assert.strictEqual(qa('.evidence__card').length, 4, 'четыре улики');
  click(q('[data-choice="diag"][data-opt="open"]'));
  await tick(30);
  assert.strictEqual(S.isDone(4), false, 'неверный диагноз не закрывает эпизод');
  click(q('[data-choice="diag"][data-opt="mixed"]'));
  await tick(30);
  click(q('[data-choice="escalate"][data-opt="a"]'));
  await tick(30);
  assert.strictEqual(S.isDone(4), true);
  click(q('#next-btn'));
  await tick(60);

  /* 5. Теория, порядок жил и кросс-план */
  ['t1', 't2', 't3'].forEach((id, i) => {
    const value = ['a', 'a', 'b'][i];
    const radio = q('input[name="' + id + '"][value="' + value + '"]');
    radio.checked = true;
    change(radio);
  });
  await tick(30);
  click(q('[data-act="theory-check"]'));
  await tick(40);
  assert.strictEqual(S.get().theory.checked, true);

  /* Неверная жила — подсказка и штраф, затем сборка по B */
  click(q('[data-wire="K"]'));
  await tick(30);
  assert.strictEqual(S.get().wires.mistakes, 1, 'ошибка посчитана');
  assert.ok(toasts().includes('Не по порядку'), 'подсказка о неверной жиле: ' + toasts().join(' / '));
  ['BO', 'O', 'BZ', 'S', 'BS', 'Z', 'BK', 'K'].forEach((id) => click(q('[data-wire="' + id + '"]')));
  await tick(40);
  assert.strictEqual(S.get().wires.done, true, 'порядок собран');
  assert.strictEqual(S.computeScore().parts.wiring.value, 6 + 5 + 6 + 8, 'диагноз со второй попытки — 5');

  /* Кросс-план: игровая часть, без баллов */
  click(q('[data-link="l1"][data-port="12"]'));
  await tick(30);
  assert.strictEqual(S.get().links.answers.l1, '12');
  assert.strictEqual(S.get().links.done, false, 'неверный порт не закрывает кросс-план');
  click(q('[data-link="l1"][data-port="13"]'));
  await tick(30);
  click(q('[data-link="l2"][data-port="14"]'));
  await tick(30);
  click(q('[data-link="l3"][data-port="21"]'));
  await tick(30);
  assert.strictEqual(S.get().links.done, true, 'кросс-план сходится с журналом');
  assert.strictEqual(S.isDone(5), true);
  click(q('#next-btn'));
  await tick(60);

  /* 6. Операционная карта, тайм-бокс и самоконтроль */
  assert.strictEqual(qa('.op').length, 8);
  assert.ok(q('#rotate-clock'), 'тайм-бокс ротации отрисован');
  click(q('[data-act="timer-start"]'));
  await tick(40);
  assert.strictEqual(q('#timer-toggle').textContent, 'Пауза');
  click(q('[data-act="timer-start"]'));
  await tick(20);
  assert.strictEqual(q('#timer-toggle').textContent, 'Продолжить');

  for (let i = 1; i <= 8; i += 1) {
    const node = q('[data-op="op' + i + '"]');
    node.checked = true;
    change(node);
    await tick(20);
  }
  assert.strictEqual(S.computeScore().parts.quality.value, 25, 'все этапы — 25 баллов');
  assert.strictEqual(S.isDone(6), false, 'без самоконтроля карта не закрыта');
  qa('[data-block="selfcheck"] [data-tick]').forEach((n) => change(n, true));
  await tick(30);
  assert.strictEqual(S.isDone(6), true);
  click(q('#next-btn'));
  await tick(60);

  /* 7. Тест по восьми портам, журнал, приёмка */
  for (let p = 1; p <= 8; p += 1) {
    click(q('[data-port="' + p + '"][data-tester="pass"]'));
    await tick(20);
  }
  assert.strictEqual(S.testedPorts(), 8, 'восемь портов PASS');
  assert.strictEqual(S.computeScore().parts.work.value, 10, 'тест без приёмки — 10');
  const master = q('[data-act="teacher-confirm"]');
  master.checked = true;
  change(master);
  await tick(40);
  assert.strictEqual(S.computeScore().parts.work.value, 20, 'с приёмкой мастера — 20');

  const places = ['Р-12 · бухгалтерия', 'Р-13 · диспетчерская', 'Р-14 · комната отдыха', 'Р-15 · склад', 'Р-16 · проходная', 'Р-17 · касса', 'Р-18 · архив', 'Р-19 · серверная'];
  for (let p = 1; p <= 8; p += 1) {
    type(q('[data-journal="place"][data-port="' + p + '"]'), places[p - 1]);
    const sel = q('[data-journal="result"][data-port="' + p + '"]');
    sel.value = 'pass';
    change(sel);
    await tick(15);
  }
  await tick(40);
  assert.strictEqual(S.journalRowsFilled(), 8, 'журнал заполнен по восьми портам');
  assert.strictEqual(S.isDone(7), true, 'эпизод 7 закрыт');
  click(q('#next-btn'));
  await tick(60);

  /* 8. Контрольные вопросы, рефлексия, акт */
  const answers = {
    q1: 'Патч-панель ставят выше активного оборудования, потому что горизонтальные кабели заводят сверху в органайзер, а патч-корды идут вниз без натяга и не перекрывают доступ к портам коммутатора.',
    q2: 'Металлическая стяжка не имеет плавной регулировки: при перетяжке оболочка и жилы деформируются, шаг свивки меняется, растут наводки и обратные потери, медь надламывается и линия перестаёт держать гигабит.',
    q3: 'Смотреть линк и счётчики ошибок на порту коммутатора, затем методом исключения заменить патч-корд и перевести линию на заведомо исправный порт панели: если ошибки уходят вместе с портом — дефект в заделке.',
    q4: 'Свитая пара работает как балансная линия: наводки в соседних витках равны и противоположны, поэтому гасят друг друга. Расплетённый участок ловит помехи, растут NEXT и обратные потери, категория не держится.',
    q5: 'Патч-панель — пассивный элемент СКС: она только фиксирует и коммутирует кабели, без питания и логики. Коммутатор — активное устройство: обрабатывает кадры, ведёт таблицу MAC-адресов и требует питания.'
  };
  Object.keys(answers).forEach((id) => type(q('[data-question="' + id + '"]'), answers[id]));
  click(q('[data-act="questions-check"]'));
  await tick(50);
  assert.strictEqual(qa('.qa__model').length, 5, 'показаны модельные ответы');
  assert.strictEqual(S.computeScore().parts.quiz.value, 10, 'развёрнутые ответы — 10');

  click(q('[data-target="was"][data-val="9"]'));
  await tick(20);
  click(q('[data-target="useful"][data-val="10"]'));
  await tick(20);
  click(q('[data-target="clear"][data-val="8"]'));
  await tick(20);
  const target = S.get().retro.target;
  assert.deepStrictEqual(
    { was: target.was, useful: target.useful, clear: target.clear },
    { was: 9, useful: 10, clear: 8 },
    'мишень отмечена'
  );

  type(q('[data-report="student"]'), 'Иванов Иван');
  type(q('[data-report="group"]'), 'ЭК-21');
  type(q('[data-report="brigade"]'), 'бригада 2 · ШТК-2');
  type(
    q('[data-report="comment"]'),
    'Панель смонтирована на 8U, заделаны восемь портов по B, пучок в органайзере, журнал заполнен, все порты PASS.'
  );
  await tick(40);
  assert.strictEqual(S.computeScore().parts.report.value, 8, 'поля акта заполнены — 8');
  assert.strictEqual(S.isDone(8), false, 'без печати или выгрузки смена не сдана');

  click(q('[data-act="print-act"]'));
  await tick(120);
  assert.strictEqual(window.__printed, true, 'акт отправлен на печать');
  assert.ok(q('#print-area').textContent.includes('PP-314'), 'в акте есть номер заявки');
  assert.ok(q('#print-area').textContent.includes('Р-12'), 'в акте есть журнал портов');
  assert.strictEqual(S.computeScore().parts.report.value, 12, 'печать акта — ещё 4 балла');
  click(q('[data-act="export"]'));
  await tick(60);
  assert.ok(S.get().report.exported || S.get().report.copied, 'файл выгружен');
  assert.strictEqual(S.computeScore().parts.report.value, 15, 'отчёт сдан — 15');

  click(q('[data-act="finish"]'));
  await tick(60);
  assert.ok(S.get().finishedAt, 'смена завершена');
  assert.strictEqual(S.isDone(8), true);

  const total = S.computeScore();
  // эталонный прогон с двумя «человеческими» ошибками: диагноз со второй
  // попытки (5 из 8) и одна неверная жила (8 из 10)
  assert.strictEqual(total.total, 95, 'итог: 25 + 25 + 20 + 15 + 10 = 95');
  assert.strictEqual(q('#score-chip').textContent.trim(), '95 / 100');
  assert.strictEqual(qa('.bar-row').length, 5, 'в отчёте пять критериев');
  assert.strictEqual(qa('.bar-row')[0].querySelector('.bar-row__value').textContent, '25/30', 'первая строка — подключение');
  assert.ok(q('.done-banner'), 'показан финальный экран');

  const message = S.lmsPayload();
  assert.strictEqual(message.type, 'LMS_SCORE');
  assert.strictEqual(message.score, 95);
  assert.strictEqual(message.maxScore, 100);
  assert.strictEqual(message.simulator, 'patch-panel');
  assert.strictEqual(message.completed, true);

  const act = S.reportText();
  assert.ok(act.includes('АКТ ВЫПОЛНЕННЫХ РАБОТ'), 'акт имеет шапку');
  assert.ok(act.includes('Мастер производственного обучения'), 'в акте есть подпись мастера');
  assert.ok(act.includes('РЕФЛЕКСИЯ'), 'в акт попала рефлексия');

  /* Перезагрузка возвращает на восьмой эпизод с завершённой сменой */
  const stored = JSON.parse(window.localStorage.getItem(S.STORAGE_KEY));
  assert.strictEqual(stored.episode, 8);
  assert.strictEqual(stored.wires.order.length, 8);
  assert.strictEqual(Object.keys(stored.journal.rows).length, 8);

  assert.deepStrictEqual(errors, [], 'ошибки исполнения: ' + errors.join('; '));
  window.close();
  console.log('✓ «Смена на узле связи»: сквозной сценарий — 8 эпизодов, журнал, мишень, акт, 95/100, LMS_SCORE');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
