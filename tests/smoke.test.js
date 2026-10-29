#!/usr/bin/env node
/**
 * Дымовой тест тренажёра (без браузера, на jsdom).
 * Запуск: npm install && npm test
 *
 * Проверяет:
 *  1. страница собирается без JS-ошибок и все панели отрисованы;
 *  2. стартовый балл равен 0;
 *  3. полный проход шагов 1–2 (клавиатурный сценарий) меняет состояние и баллы;
 *  4. отказ от неверной длины зачистки не завершает шаг;
 *  5. прогресс сохраняется в localStorage;
 *  6. в проекте нет внешних сетевых запросов (требование МЭШ).
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['data', 'graphics', 'state', 'drag', 'ui', 'steps', 'report', 'app'];

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  const { window } = dom;

  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {}
  });
  window.scrollTo = () => {};

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<script src="src\/js\/data.js"/)[1];
  window.document.body.innerHTML = body;

  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.message));

  SCRIPTS.forEach((name) => {
    const el = window.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, 'src/js/' + name + '.js'), 'utf8');
    window.document.body.appendChild(el);
  });

  window.__errors = errors;
  return window;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function helpers(window) {
  const doc = window.document;
  const q = (sel) => doc.querySelector(sel);
  const qa = (sel) => Array.from(doc.querySelectorAll(sel));
  const click = (el) => {
    assert.ok(el, 'элемент для клика не найден');
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  const key = (el, k) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  return { doc, q, qa, click, key };
}

async function run() {
  const STD = ['BO', 'O', 'BZ', 'S', 'BS', 'Z', 'BK', 'K'];
  const window = boot();
  const { q, qa, click, key } = helpers(window);
  await wait(200);

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
  assert.deepStrictEqual(window.__errors, [], 'ошибки исполнения: ' + window.__errors.join('; '));

  /* 9. Нет внешних запросов — требование изоляции МЭШ */
  const files = [
    'index.html',
    'src/styles/base.css',
    'src/styles/layout.css',
    'src/styles/stage.css',
    ...SCRIPTS.map((n) => 'src/js/' + n + '.js')
  ];
  files.forEach((rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const net = content.match(/(src|href)\s*=\s*["']https?:\/\//gi) || content.match(/@import\s+url\(\s*["']?https?:/gi);
    assert.strictEqual(net, null, 'внешний запрос в ' + rel + ': ' + net);
  });

  window.close();
  console.log('✓ дымовой тест пройден: каркас, шаги 1–2, баллы, localStorage, отсутствие внешних запросов');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
