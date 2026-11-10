#!/usr/bin/env node
/**
 * socket-quest-full.test.js — сквозной сценарий квеста:
 * семь эпизодов от первого утра до подписанного акта, 100 баллов,
 * отправка результата в МЭШ и корректная печать документа.
 */
'use strict';

const assert = require('node:assert');
const { bootSimulator, wait } = require('./helpers');

async function run() {
  const ctx = bootSimulator('socket-quest');
  const { window, q, qa, click, change, type, toasts, wait: tick, errors } = ctx;
  await wait(300);
  const S = window.AppState;

  /* Эпизод 1 — знакомство */
  click(q('[data-choice="start"][data-opt="a"]'));
  await tick(30);
  click(q('[data-survey="experience"][data-opt="saw"]'));
  await tick(30);
  click(q('#next-btn'));
  await tick(60);

  /* Эпизод 2 — заявка */
  assert.match(q('.episode__title').textContent, /Заявка INC-2147/);
  assert.strictEqual(qa('.ticket__row').length, 10);
  click(q('[data-choice="plan"][data-opt="a"]'));
  await tick(30);
  click(q('#next-btn'));
  await tick(60);

  /* Эпизод 3 — инструмент */
  qa('[data-safety]').forEach((n) => change(n, true));
  await tick(30);
  ['stripper', 'punch', 'cutter', 'tester', 'screwdriver'].forEach((id) => click(q('[data-kit="' + id + '"]')));
  await tick(30);
  click(q('[data-act="kit-check"]'));
  await tick(40);
  assert.strictEqual(S.isDone(3), true, 'набор собран верно');
  assert.strictEqual(S.computeScore().parts.wiring.value, 6, 'за набор 6 баллов');
  click(q('#next-btn'));
  await tick(60);

  /* Эпизод 4 — диагностика */
  assert.match(q('.episode__title').textContent, /Толик/);
  click(q('[data-choice="diag"][data-opt="cross"]'));
  await tick(30);
  assert.strictEqual(S.isDone(4), true);
  click(q('#next-btn'));
  await tick(60);

  /* Эпизод 5 — теория и жилы */
  ['t1', 't2', 't3'].forEach((id, i) => {
    const value = ['a', 'b', 'a'][i];
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
  assert.strictEqual(qa('.wslot.is-filled').length, 0, 'неверная жила не заняла контакт');
  ['BO', 'O', 'BZ', 'S', 'BS', 'Z', 'BK', 'K'].forEach((id) => click(q('[data-wire="' + id + '"]')));
  await tick(40);
  assert.strictEqual(S.get().wires.done, true, 'порядок собран');
  assert.strictEqual(S.isDone(5), true);
  const wiring = S.computeScore().parts.wiring.value;
  assert.strictEqual(wiring, 6 + 8 + 6 + 8, 'жилы с одной ошибкой — 8 из 10');
  click(q('#next-btn'));
  await tick(60);

  /* Эпизод 6 — операционная карта */
  assert.strictEqual(qa('.op').length, 8);
  for (let i = 1; i <= 8; i += 1) {
    const node = q('[data-op="op' + i + '"]');
    node.checked = true;
    change(node);
    await tick(20);
  }
  assert.strictEqual(S.computeScore().parts.quality.value, 25, 'все этапы — 25 баллов');
  assert.strictEqual(S.isDone(6), true);
  click(q('#next-btn'));
  await tick(60);

  /* Эпизод 7 — тест, мастер, вопросы, отчёт, акт */
  click(q('[data-tester="pass"]'));
  await tick(40);
  assert.strictEqual(S.computeScore().parts.work.value, 10, 'успешный тест — 10');
  const master = q('[data-act="teacher-confirm"]');
  master.checked = true;
  change(master);
  await tick(40);
  assert.strictEqual(S.computeScore().parts.work.value, 20, 'с подтверждением мастера — 20');

  const answers = {
    q1: 'Стандарт B принят на объекте: так собрана вся инфраструктура, и оба конца линии должны быть в одном стандарте, иначе пары окажутся перекрёстными.',
    q2: 'Перегиб ломает шаг свивки и повреждает жилу: растут наводки, падает скорость, поэтому радиус изгиба не меньше четырёх диаметров кабеля.',
    q3: 'Подключить патч-корд к ноутбуку и проверить линк, затем ping до шлюза и при возможности замер скорости через iPerf.',
    q4: 'В розетке жилы заделывают кроссировочным ножом в контакты IDC, а коннектор обжимают кримпером на патч-корде: инструмент разный, стандарт общий.',
    q5: 'Нож вдавливает жилу в прорезь до щелчка и срезает излишек, не задевая соседей; отвёртка давит неровно, контакт получается ненадёжным.'
  };
  Object.keys(answers).forEach((id) => type(q('[data-question="' + id + '"]'), answers[id]));
  click(q('[data-act="questions-check"]'));
  await tick(50);
  assert.strictEqual(qa('.qa__model').length, 5, 'показаны модельные ответы');
  assert.strictEqual(S.computeScore().parts.quiz.value, 10, 'развёрнутые ответы — 10');

  type(q('[data-report="student"]'), 'Иванов Иван');
  type(q('[data-report="group"]'), 'ЭК-21');
  type(
    q('[data-report="comment"]'),
    'Линия Р-3 была собрана по A, поэтому тестер показывал перекрёст. Переделал по B, заделал жилы ножом до щелчка, зажал оболочку и проверил линию.'
  );
  await tick(40);
  assert.strictEqual(S.computeScore().parts.report.value, 8, 'поля акта заполнены — 8');
  assert.strictEqual(S.isDone(7), false, 'без печати или выгрузки смена не сдана');

  click(q('[data-act="print-act"]'));
  await tick(120);
  assert.strictEqual(window.__printed, true, 'акт отправлен на печать');
  assert.ok(q('#print-area').textContent.includes('INC-2147'), 'в акте есть номер заявки');
  assert.strictEqual(S.computeScore().parts.report.value, 12, 'печать акта — ещё 4 балла');
  click(q('[data-act="export"]'));
  await tick(60);
  assert.ok(S.get().report.exported || S.get().report.copied, 'файл выгружен');
  assert.strictEqual(S.computeScore().parts.report.value, 15, 'отчёт сдан — 15');

  click(q('[data-act="finish"]'));
  await tick(60);
  assert.ok(S.get().finishedAt, 'смена завершена');
  assert.strictEqual(S.isDone(7), true);

  const total = S.computeScore();
  assert.strictEqual(total.total, 98, 'итог: 28 + 25 + 20 + 15 + 10 = 98');
  assert.strictEqual(q('#score-chip').textContent.trim(), '98 / 100');
  assert.strictEqual(qa('.bar-row').length, 5, 'в отчёте пять критериев');
  assert.strictEqual(qa('.bar-row')[0].querySelector('.bar-row__value').textContent, '28/30', 'первая строка — подключение');
  assert.ok(q('.done-banner'), 'показан финальный экран');

  const message = S.lmsPayload();
  assert.strictEqual(message.type, 'LMS_SCORE');
  assert.strictEqual(message.score, 98);
  assert.strictEqual(message.maxScore, 100);
  assert.strictEqual(message.completed, true);

  /* Перезагрузка возвращает на седьмой эпизод с завершённой сменой */
  const stored = JSON.parse(window.localStorage.getItem(S.STORAGE_KEY));
  assert.strictEqual(stored.episode, 7);
  assert.strictEqual(stored.wires.order.length, 8);

  assert.deepStrictEqual(errors, [], 'ошибки исполнения: ' + errors.join('; '));
  window.close();
  console.log('✓ «Смена в СетьПолисе»: сквозной сценарий — 7 эпизодов, акт, 98/100, LMS_SCORE');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
