#!/usr/bin/env node
/**
 * network-socket-full.test.js — сквозной сценарий тренажёра «Монтаж сетевых розеток»:
 * набор → зачистка → разделка → заделка → сборка → тестер → отчёт и оценка.
 */
'use strict';

const assert = require('node:assert');
const { bootSimulator, wait } = require('./helpers');

async function strip(ctx) {
  const { q, click, key } = ctx;
  click(q('#cable-piece'));
  click(q('#strip-zone'));
  await wait(40);
  for (let i = 0; i < 22; i++) key(q('#strip-grip'), 'ArrowLeft');
  click(q('[data-act="strip-apply"]'));
  await wait(420);
}

async function run() {
  const ctx = bootSimulator('network-socket');
  const { q, qa, click, window, toasts } = ctx;
  await wait(220);
  const D = window.APP_DATA;

  /* Шаг 1: набор инструментов */
  D.KIT.filter((k) => k.required).forEach((k) => click(q('[data-kit="' + k.id + '"]')));
  click(q('[data-act="kit-check"]'));
  await wait(80);
  assert.strictEqual(window.AppState.get().kit.checked, true);
  click(q('[data-act="next"]'));
  await wait(60);

  /* Шаг 2: зачистка оболочки */
  await strip(ctx);
  assert.strictEqual(window.AppState.get().prep.done, true, 'оболочка снята');
  click(q('[data-act="next"]'));
  await wait(60);

  /* Шаг 3: разделка по маркировке B */
  D.MODULE_CONTACTS.forEach((c) => {
    click(q('#bundle [data-wire-id="' + c.wire + '"]'));
    click(q('[data-contact="' + c.idx + '"]'));
    assert.ok(q('[data-contact="' + c.idx + '"]').querySelector('.kterm__wire'), 'жила в контакте ' + c.idx);
  });
  assert.strictEqual(window.AppState.allWiresCorrect(window.AppState.get()), 8, 'разделка по B');
  click(q('[data-act="next"]'));
  await wait(60);

  /* Шаг 4: заделка заделочным ножом */
  click(q('[data-act="punch-all"]'));
  await wait(160);
  assert.strictEqual(window.AppState.allPunched(window.AppState.get()), true, 'все контакты заделаны');
  click(q('[data-act="next"]'));
  await wait(60);

  /* Шаг 5: сборка */
  click(q('[data-act="tie"]'));
  await wait(60);
  click(q('[data-act="module"]'));
  await wait(60);
  click(q('[data-screw="0"]'));
  await wait(60);
  click(q('[data-screw="1"]'));
  await wait(80);
  assert.strictEqual(window.AppState.mountDone(window.AppState.get()), true, 'розетка собрана');
  click(q('[data-act="next"]'));
  await wait(60);

  /* Шаг 6: тестер */
  assert.strictEqual(window.AppState.get().step, 6);
  click(q('[data-act="plug"]'));
  await wait(40);
  click(q('[data-act="inspect"]'));
  await wait(40);
  click(q('[data-act="run-test"]'));
  await wait(3000);
  const res = window.AppState.get().tester.result;
  assert.strictEqual(res.ok, true, 'линия должна быть исправна');
  assert.strictEqual(res.straightPins, 8, 'все 8 жил в прямом порядке');
  assert.strictEqual(qa('#leds-main .led.is-on').length, 8, 'все 8 индикаторов');
  assert.strictEqual(window.AppState.computeScore().parts.work.value, 20, 'работа на 20');
  click(q('[data-act="next"]'));
  await wait(80);

  /* Шаг 7: мини-тест и отчёт */
  assert.strictEqual(window.AppState.get().step, 7);
  window.APP_DATA.QUIZ.forEach((qq) => {
    const input = q('input[name="' + qq.id + '"][value="' + qq.correct + '"]');
    input.checked = true;
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  click(q('[data-act="check-quiz"]'));
  await wait(80);

  const name = q('#rep-student');
  name.value = 'Петрова Анна';
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  const group = q('#rep-group');
  group.value = '11-Б';
  group.dispatchEvent(new window.Event('input', { bubbles: true }));
  const comment = q('#rep-comment');
  comment.value =
    'Заделал жилы в модуль keystone по маркировке B заделочным ножом, изоляцию с жил не снимал, оболочку завёл под стяжку. Тестер показал все 8 жил без перекрёста.';
  comment.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(700);

  const score = window.AppState.computeScore();
  assert.strictEqual(score.parts.wiring.value, 30, 'разделка без ошибок');
  assert.strictEqual(score.parts.quality.value, 25, 'качество монтажа');
  assert.strictEqual(score.parts.work.value, 20, 'работа тестером');
  assert.strictEqual(score.parts.quiz.value, 10, 'мини-тест на 10');
  assert.ok(score.total >= 95, 'итог не ниже 95, получено ' + score.total);

  const payload = window.AppState.lmsPayload();
  assert.strictEqual(payload.type, 'LMS_SCORE');
  assert.strictEqual(payload.maxScore, 100);
  assert.strictEqual(payload.score, score.total);
  assert.strictEqual(payload.completed, true);
  assert.match(payload.work, /розетк/i);

  assert.deepStrictEqual(ctx.errors, [], 'ошибки: ' + ctx.errors.join('; '));
  assert.ok(toasts().length > 0, 'тосты показывались');
  assert.ok(q('[data-act="download"]'), 'кнопка выгрузки отчёта');
  assert.ok(q('[data-act="send-lms"]'), 'кнопка отправки в МЭШ');

  window.close();
  console.log('✓ «Монтаж сетевых розеток»: сквозной сценарий — модуль, сборка, тестер, отчёт, ' + score.total + '/100');
}

run().catch((err) => {
  console.error('✗ сквозной тест не пройден:', err.message);
  process.exit(1);
});
