#!/usr/bin/env node
/**
 * twisted-pair.test.js — дымовой тест тренажёра «Обжим витой пары».
 * Запуск: npm test (или node tests/twisted-pair.test.js)
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, bootSimulator, labFiles, wait } = require('./helpers');

const SIM = 'simulators/twisted-pair';
const BASE = 'simulators/twisted-pair';

async function run() {
  const STD = ['BO', 'O', 'BZ', 'S', 'BS', 'Z', 'BK', 'K'];
  const ctx = bootSimulator('twisted-pair');
  const { window, q, qa, click, key } = ctx;
  await wait(220);

  /* 1. Каркас */
  assert.strictEqual(qa('.step-pill').length, 7, 'семь шагов в степпере');
  assert.strictEqual(qa('.tool-card').length, 6, 'шесть инструментов');
  assert.strictEqual(qa('.checklist__item').length, 7, 'чек-лист из семи пунктов');
  assert.match(q('.stage__title').textContent, /Подготовка кабеля/);
  assert.strictEqual(window.AppState.computeScore().total, 0, 'стартовый балл — 0');

  /* 2. Ошибка зачистки: 3,5 см не должны приниматься в тренировке */
  click(q('#cable-piece'));
  click(q('#strip-zone'));
  await wait(40);
  for (let i = 0; i < 35; i++) key(q('#strip-grip'), 'ArrowLeft');
  click(q('[data-act="strip-apply"]'));
  await wait(40);
  assert.strictEqual(window.AppState.get().ends.A.strip.done, false, 'неверная длина не принимается');
  assert.strictEqual(window.AppState.get().ends.A.strip.attempts, 1, 'попытка учтена');

  /* 3. Правильная зачистка — 2,2 см */
  key(q('#strip-grip'), 'Home');
  for (let i = 0; i < 22; i++) key(q('#strip-grip'), 'ArrowLeft');
  click(q('[data-act="strip-apply"]'));
  await wait(40);
  assert.strictEqual(window.AppState.get().ends.A.strip.done, true);
  assert.strictEqual(window.AppState.get().ends.A.strip.lengthCm, 2.2);
  assert.ok(q('#step-1 .strip-readout.is-ok'), 'подтверждение зачистки');
  click(q('[data-act="next"]'));
  await wait(50);
  assert.strictEqual(window.AppState.get().step, 2, 'переход на шаг 2');

  /* 4. Неверная жила возвращается в пучок */
  click(q('#bundle [data-wire-id="K"]'));
  click(q('.slot[data-slot="0"]'));
  await wait(40);
  assert.strictEqual(window.AppState.get().ends.A.order[0], null, 'неверная жила не встала в слот');
  assert.strictEqual(window.AppState.get().ends.A.sortMistakes, 1, 'ошибка раскладки учтена');

  /* 5. Раскладка по T568B */
  for (let i = 0; i < 8; i++) {
    click(q('#bundle [data-wire-id="' + STD[i] + '"]'));
    click(q('.slot[data-slot="' + i + '"]'));
    await wait(4);
  }
  assert.strictEqual(window.AppState.get().ends.A.order.join(','), STD.join(','), 'порядок T568B');
  assert.strictEqual(qa('.slot.has-wire').length, 8, 'все восемь позиций заняты');
  assert.strictEqual(q('[data-act="next"]').disabled, false, 'шаг 2 можно завершить');

  /* 6. Баллы: порядок 15 − 3 за ошибку + 2,5 за зачистку */
  const sc = window.AppState.computeScore();
  assert.strictEqual(sc.parts.order.value, 12, 'баллы за порядок с учётом ошибки');
  assert.strictEqual(sc.parts.quality.value, 2.5, 'баллы за качество после зачистки');
  assert.strictEqual(sc.total, 15, 'итоговый балл на этом этапе');

  /* 7. Прогресс сохранён */
  window.AppState.saveNow();
  const saved = JSON.parse(window.localStorage.getItem(window.AppState.STORAGE_KEY));
  assert.strictEqual(saved.step, 2);
  assert.strictEqual(saved.ends.A.order.filter(Boolean).length, 8);

  /* 8. Нет JS-ошибок */
  assert.deepStrictEqual(ctx.errors, [], 'ошибки исполнения: ' + ctx.errors.join('; '));

  /* 9. Нет внешних запросов — требование изоляции МЭШ */
  const files = labFiles('twisted-pair');
  files.forEach((rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const net = content.match(/(src|href)\s*=\s*["']https?:\/\//gi) || content.match(/@import\s+url\(\s*["']?https?:/gi);
    assert.strictEqual(net, null, 'внешний запрос в ' + rel + ': ' + net);
  });

  window.close();
  console.log('✓ «Обжим витой пары»: каркас, шаги 1–2, баллы, localStorage, отсутствие внешних запросов');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
