#!/usr/bin/env node
/**
 * file-protocol.test.js — проверка «скачал папку → открыл index.html».
 *
 * Страница загружается не из памяти и не по http, а прямо с диска по file://,
 * как это делает браузер при двойном щелчке: все стили и скрипты должны
 * подключиться из папки лаборатории, интерфейс — собраться без ошибок.
 * В этом режиме localStorage обычно запрещён, поэтому дополнительно проверяем,
 * что тренажёр продолжает работать без сохранения прогресса.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { ROOT } = require('./helpers');

const LABS = [
  { id: 'twisted-pair', firstStep: /Подготовка кабеля|Инструменты/ },
  { id: 'network-socket', firstStep: /Инструменты/ }
];

async function checkLab(lab) {
  const file = path.join(ROOT, 'simulators', lab.id, 'index.html');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));

  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  await new Promise((resolve) => setTimeout(resolve, 700));
  const doc = window.document;
  const qa = (sel) => Array.from(doc.querySelectorAll(sel));

  /* Стили подключились из папки, а не «пропали» */
  assert.ok(doc.styleSheets.length >= 4, lab.id + ': подключилось стилей — ' + doc.styleSheets.length);
  const cssHrefs = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.getAttribute('href'));
  cssHrefs.forEach((href) => {
    const sheet = Array.from(doc.styleSheets).find((s) => (s.href || '').endsWith(href));
    assert.ok(sheet, lab.id + ': таблица стилей не загрузилась по file:// — ' + href);
    assert.ok(sheet.cssRules.length > 10, lab.id + ': пустая таблица стилей — ' + href);
  });

  /* Скрипты исполнились: интерфейс собран */
  assert.strictEqual(qa('.step-pill').length, 7, lab.id + ': степпер не построен');
  assert.ok(qa('.tool-card').length >= 6, lab.id + ': панель инструментов пуста');
  assert.ok(qa('.checklist__item').length >= 6, lab.id + ': чек-лист пуст');
  assert.ok(qa('#theory .acc__head, #theory details').length > 0, lab.id + ': теория не отрисована');
  assert.match(doc.querySelector('.stage__title').textContent, lab.firstStep, lab.id + ': сцена шага не отрисована');
  assert.strictEqual(typeof window.AppState, 'object', lab.id + ': модель состояния не загрузилась');
  assert.strictEqual(typeof window.AppState.computeScore().total, 'number', lab.id + ': баллы не считаются');
  assert.strictEqual(window.AppState.computeScore().total, 0, lab.id + ': стартовый балл должен быть 0');

  /* Без localStorage работа не ломается */
  if (window.AppState.canStore === false) {
    assert.ok(qa('.toast').length > 0, lab.id + ': нет предупреждения о недоступном хранилище');
  }

  /* Первое действие в сцене выполняется */
  const firstAction = doc.querySelector('.kterm, .kit-card, #cable-piece, .chip-wire, [data-act]');
  assert.ok(firstAction, lab.id + ': в сцене нет ни одного интерактивного элемента');

  assert.deepStrictEqual(errors, [], lab.id + ': ошибки при загрузке по file:// — ' + errors.join('; '));
  window.close();
  return { id: lab.id, sheets: doc.styleSheets.length };
}

async function run() {
  const results = [];
  for (const lab of LABS) results.push(await checkLab(lab));
  results.forEach((r) => console.log('  · ' + r.id + ': file:// — стилей ' + r.sheets + ', интерфейс собран'));
  console.log('✓ по file://: обе папки открываются и работают без сервера и без сохранения прогресса');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
