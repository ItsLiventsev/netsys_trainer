#!/usr/bin/env node
/**
 * twisted-pair-full.test.js — сквозной сценарий тренажёра «Обжим витой пары»:
 * оба конца, тестер, отчёт и оценка.
 */
'use strict';

const assert = require('node:assert');
const { bootSimulator, wait } = require('./helpers');

const STD = ['BO', 'O', 'BZ', 'S', 'BS', 'Z', 'BK', 'K'];

async function strip(ctx) {
  const { q, click, key } = ctx;
  click(q('#cable-piece'));
  click(q('#strip-zone'));
  await wait(40);
  for (let i = 0; i < 22; i++) key(q('#strip-grip'), 'ArrowLeft');
  click(q('[data-act="strip-apply"]'));
  await wait(420);
}

async function sort(ctx, order) {
  const { q, click } = ctx;
  for (let i = 0; i < 8; i++) {
    click(q('#bundle [data-wire-id="' + order[i] + '"]'));
    click(q('.slot[data-slot="' + i + '"]'));
    await wait(4);
  }
}

async function insert(ctx, depth) {
  const { q, click, window } = ctx;
  click(q('[data-act="trim"]'));
  await wait(30);
  click(q('[data-act="insert"]'));
  await wait(30);
  q('#depth-range').value = String(depth);
  q('#depth-range').dispatchEvent(new window.Event('input', { bubbles: true }));
  q('#depth-range').dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait(50);
}

async function crimp(ctx) {
  const { q, pdown, pup } = ctx;
  pdown(q('#crimp-hold'));
  await wait(1250);
  pup(q('#crimp-hold'));
  await wait(120);
}

async function run() {
  const ctx = bootSimulator('twisted-pair');
  const { q, qa, click, window, toasts } = ctx;
  await wait(220);

  /* Конец A */
  await strip(ctx);
  assert.strictEqual(window.AppState.get().ends.A.strip.done, true);
  click(q('[data-act="next"]'));
  await wait(50);

  await sort(ctx, STD);
  click(q('[data-act="next"]'));
  await wait(50);

  await insert(ctx, 100);
  click(q('[data-act="next"]'));
  await wait(50);

  await crimp(ctx);
  assert.strictEqual(window.AppState.get().ends.A.crimped, true);
  click(q('[data-act="next"]'));
  await wait(60);

  /* Конец B */
  await strip(ctx);
  click(q('[data-act="next"]'));
  await wait(50);
  await sort(ctx, STD);
  click(q('[data-act="next"]'));
  await wait(50);
  await insert(ctx, 100);
  click(q('[data-act="next"]'));
  await wait(50);
  await crimp(ctx);
  click(q('[data-act="next"]'));
  await wait(60);
  click(q('[data-act="next"]'));
  await wait(80);

  /* Тестер */
  assert.strictEqual(window.AppState.get().step, 6);
  click(q('[data-act="plug"]'));
  await wait(40);
  click(q('[data-act="inspect"]'));
  await wait(40);
  click(q('[data-act="run-test"]'));
  await wait(2800);
  const res = window.AppState.get().tester.result;
  assert.strictEqual(res.ok, true, 'кабель должен быть исправен');
  assert.strictEqual(qa('#leds-main .led.is-on').length, 8, 'все 8 индикаторов');
  assert.strictEqual(window.AppState.computeScore().parts.work.value, 20);
  click(q('[data-act="next"]'));
  await wait(80);

  /* Отчёт и мини-тест */
  assert.strictEqual(window.AppState.get().step, 7);
  window.APP_DATA.QUIZ.forEach((qq) => {
    const input = q('input[name="' + qq.id + '"][value="' + qq.correct + '"]');
    input.checked = true;
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  click(q('[data-act="check-quiz"]'));
  await wait(80);

  const name = q('#rep-student');
  name.value = 'Иванов Иван';
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  const group = q('#rep-group');
  group.value = '10-А';
  group.dispatchEvent(new window.Event('input', { bubbles: true }));
  const comment = q('#rep-comment');
  comment.value = 'Обжал кабель по T568B, тестер показал все 8 жил без перекрёста. Понял, зачем оболочку заводят под зажим.';
  comment.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(700);

  const score = window.AppState.computeScore();
  assert.strictEqual(score.parts.order.value, 30, 'порядок без ошибок');
  assert.strictEqual(score.parts.quiz.value, 10, 'тест на 10 баллов');
  assert.strictEqual(score.parts.quality.value, 25, 'качество обжима');
  assert.ok(score.total >= 95, 'итог не ниже 95, получено ' + score.total);

  const payload = window.AppState.lmsPayload();
  assert.strictEqual(payload.type, 'LMS_SCORE');
  assert.strictEqual(payload.maxScore, 100);
  assert.strictEqual(payload.score, score.total);
  assert.strictEqual(payload.completed, true);

  assert.deepStrictEqual(ctx.errors, [], 'ошибки: ' + ctx.errors.join('; '));
  assert.ok(toasts().length > 0, 'тосты показывались');

  window.close();
  console.log('✓ «Обжим витой пары»: сквозной сценарий — 2 конца, тестер, отчёт, ' + score.total + '/100');
}

run().catch((err) => {
  console.error('✗ сквозной тест не пройден:', err.message);
  process.exit(1);
});
