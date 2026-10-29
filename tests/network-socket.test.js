#!/usr/bin/env node
/**
 * network-socket.test.js — дымовой тест тренажёра «Монтаж сетевых розеток»:
 * каркас, набор инструментов, подготовка кабеля, разделка и заделка.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, SHARED, bootSimulator, wait } = require('./helpers');

const SIM = 'simulators/network-socket';

async function run() {
  const ctx = bootSimulator('network-socket');
  const { window, q, qa, click, key, errors } = ctx;
  await wait(240);

  /* 1. Каркас */
  assert.strictEqual(qa('.step-pill').length, 7, 'семь шагов в степпере');
  assert.strictEqual(qa('.kit-card').length, 9, 'девять позиций в наборе');
  assert.strictEqual(qa('.tool-card').length, 6, 'шесть инструментов в панели');
  assert.strictEqual(qa('.checklist__item').length, 6, 'чек-лист из шести пунктов');
  assert.match(q('.stage__title').textContent, /Инструменты и материалы/);
  assert.strictEqual(window.AppState.computeScore().total, 0, 'стартовый балл — 0');

  /* 2. Лишний инструмент — ошибка */
  click(q('[data-kit="crimper"]'));
  click(q('[data-kit="stripper"]'));
  click(q('[data-act="kit-check"]'));
  await wait(60);
  assert.strictEqual(window.AppState.get().kit.checked, false, 'с кримпером набор не принимается');
  assert.strictEqual(window.AppState.get().kit.mistakes, 1, 'ошибка набора учтена');
  assert.ok(q('.kit-card.is-wrong'), 'лишний инструмент подсвечен');
  assert.ok(q('.kit-card.is-missed'), 'недостающие отмечены');

  /* 3. Верный набор */
  click(q('[data-kit="crimper"]'));
  const D = window.APP_DATA;
  D.KIT.filter((k) => k.required).forEach((k) => {
    const card = q('[data-kit="' + k.id + '"]');
    if (card.getAttribute('aria-pressed') !== 'true') click(card);
  });
  click(q('[data-act="kit-check"]'));
  await wait(60);
  assert.strictEqual(window.AppState.get().kit.checked, true, 'набор собран');
  assert.strictEqual(q('[data-act="next"]').disabled, false, 'шаг 1 можно завершить');

  /* 4. Подготовка кабеля: неверная длина не принимается */
  click(q('[data-act="next"]'));
  await wait(60);
  click(q('#cable-piece'));
  click(q('#strip-zone'));
  await wait(40);
  for (let i = 0; i < 35; i++) key(q('#strip-grip'), 'ArrowLeft');
  click(q('[data-act="strip-apply"]'));
  await wait(60);
  assert.strictEqual(window.AppState.get().prep.done, false, '3,5 см не принимается в тренировке');

  key(q('#strip-grip'), 'Home');
  for (let i = 0; i < 22; i++) key(q('#strip-grip'), 'ArrowLeft');
  click(q('[data-act="strip-apply"]'));
  await wait(420);
  assert.strictEqual(window.AppState.get().prep.done, true);
  assert.strictEqual(window.AppState.get().prep.lengthCm, 2.2);

  /* 5. Зачистка жил — ошибка монтажа */
  click(q('[data-act="wires-strip"]'));
  await wait(60);
  assert.strictEqual(window.AppState.get().prep.wiresStripped, true, 'зачистка жил зафиксирована');
  click(q('[data-act="wires-restore"]'));
  await wait(60);
  assert.strictEqual(window.AppState.get().prep.wiresStripped, false, 'изоляцию можно вернуть');

  /* 6. Разделка: жила не по маркировке возвращается */
  click(q('[data-act="next"]'));
  await wait(60);
  assert.strictEqual(qa('.kterm').length, 8, 'восемь контактов на модуле');
  const wrongWire = window.APP_DATA.MODULE_CONTACTS[0].wire === 'BO' ? 'K' : 'BO';
  click(q('#bundle [data-wire-id="' + wrongWire + '"]'));
  click(q('[data-contact="0"]'));
  await wait(40);
  assert.strictEqual(window.AppState.get().contacts[0], null, 'жила не встала в чужой контакт');
  assert.strictEqual(window.AppState.get().wrongDrops, 1, 'ошибка разделки учтена');

  /* 7. Верная разделка */
  const contacts = window.APP_DATA.MODULE_CONTACTS;
  contacts.forEach((c) => {
    click(q('#bundle [data-wire-id="' + c.wire + '"]'));
    click(q('[data-contact="' + c.idx + '"]'));
  });
  await wait(60);
  assert.strictEqual(window.AppState.filledCount(window.AppState.get()), 8, 'все жилы разведены');
  assert.strictEqual(window.AppState.allWiresCorrect(window.AppState.get()), 8, 'по маркировке B');
  assert.strictEqual(q('[data-act="next"]').disabled, false);

  /* 8. Заделка */
  click(q('[data-act="next"]'));
  await wait(60);
  click(q('[data-act="use-crimper"]'));
  await wait(40);
  assert.strictEqual(window.AppState.get().usedCrimper, true, 'попытка кримпера зафиксирована');
  click(q('[data-act="punch-all"]'));
  await wait(120);
  assert.strictEqual(window.AppState.punchedCount(window.AppState.get()), 8, 'все контакты заделаны');

  /* 9. Баллы и сохранение */
  const sc = window.AppState.computeScore();
  assert.strictEqual(sc.parts.wiring.value, 27, 'порядок 30 минус 3 за ошибку');
  assert.strictEqual(sc.parts.quality.value, 13.5, 'качество: набор 1,5 + зачистка 4 + заделка 8 (сборка ещё не выполнена)');
  window.AppState.saveNow();
  const saved = JSON.parse(window.localStorage.getItem(window.AppState.STORAGE_KEY));
  assert.strictEqual(saved.step, 4);
  assert.strictEqual(saved.contacts.filter(Boolean).length, 8);

  /* 10. Нет ошибок и внешних запросов */
  assert.deepStrictEqual(errors, [], 'ошибки исполнения: ' + errors.join('; '));

  const files = [
    SIM + '/index.html',
    'shared/css/base.css',
    'shared/css/components.css',
    'shared/css/report.css',
    SIM + '/css/sim.css'
  ].concat(SHARED, [
    SIM + '/js/data.js',
    SIM + '/js/graphics.js',
    SIM + '/js/state.js',
    SIM + '/js/steps.js',
    SIM + '/js/report.js',
    SIM + '/js/app.js'
  ]);
  files.forEach((rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const net = content.match(/(src|href)\s*=\s*["']https?:\/\//gi);
    assert.strictEqual(net, null, 'внешний запрос в ' + rel + ': ' + net);
  });

  window.close();
  console.log('✓ «Монтаж сетевых розеток»: каркас, набор, зачистка, разделка, заделка, баллы, localStorage');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
