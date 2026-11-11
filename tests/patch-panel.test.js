#!/usr/bin/env node
/**
 * patch-panel.test.js — дымовой тест тренажёра «Смена на узле связи»
 * (монтаж коммутационной панели): каркас, роли бригады, чат заявки,
 * решения, набор инструмента, сохранение прогресса и изоляция папки.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, bootSimulator, labFiles, wait } = require('./helpers');

async function run() {
  const ctx = bootSimulator('patch-panel');
  const { window, q, qa, click, change, toasts, errors } = ctx;
  await wait(260);
  const S = window.AppState;

  /* 1. Каркас */
  assert.strictEqual(qa('.rail-item').length, 8, 'восемь эпизодов в рельсе');
  assert.match(q('.episode__title').textContent, /Узел связи/);
  assert.strictEqual(q('#score-chip').textContent.trim(), '0 / 100', 'стартовый итог 0');
  assert.strictEqual(q('#next-btn').disabled, true, 'без решения дальше не пускает');
  assert.ok(qa('.msg').length >= 4, 'диалог отрисован');
  assert.strictEqual(q('#shift-clock').textContent.length, 5, 'часы смены идут');
  assert.match(q('#role-chip').textContent, /роль не выбрана/);
  assert.match(q('.q-rail__ticket').textContent, /PP-314/, 'в рельсе номер заявки');

  /* 2. Неверное решение не закрывает эпизод */
  click(q('[data-choice="start"][data-opt="b"]'));
  await wait(40);
  assert.strictEqual(S.isDone(1), false, 'неверный ответ не закрывает эпизод');
  assert.ok(q('.feedback--bad'), 'показан разбор ошибки');

  /* 3. Верное решение + уровень знакомства */
  click(q('[data-choice="start"][data-opt="a"]'));
  await wait(40);
  assert.ok(q('.feedback--ok'), 'показан разбор верного ответа');
  assert.strictEqual(q('#next-btn').disabled, true, 'без отметки уровня эпизод не закрыт');
  click(q('[data-survey="experience"][data-opt="none"]'));
  await wait(40);
  assert.strictEqual(S.isDone(1), true, 'эпизод 1 закрыт');
  assert.strictEqual(q('#next-btn').disabled, false);

  /* 4. Заявка, чат и роли бригады */
  click(q('#next-btn'));
  await wait(60);
  assert.match(q('.episode__title').textContent, /Заявка PP-314/);
  assert.strictEqual(qa('.ticket__row').length, 10, 'в заявке десять строк');
  assert.ok(q('.dlg--chat'), 'чат объекта отрисован');
  assert.strictEqual(qa('.role-card').length, 4, 'четыре роли в бригаде');

  click(q('[data-role="doc"]'));
  await wait(40);
  assert.strictEqual(S.get().roles.picked, 'doc');
  assert.strictEqual(S.get().roles.confirmed, false, 'роль ещё не закреплена');
  click(q('[data-act="role-confirm"]'));
  await wait(40);
  assert.strictEqual(S.get().roles.confirmed, true);
  assert.match(q('#role-chip').textContent, /Документовед/);
  assert.strictEqual(S.isDone(2), false, 'договор бригады ещё не закрыт');

  qa('[data-tick]').forEach((n) => change(n, true));
  await wait(40);
  click(q('[data-choice="plan"][data-opt="a"]'));
  await wait(40);
  assert.strictEqual(S.isDone(2), true, 'эпизод 2 закрыт');

  /* 5. Инструмент: лишнее — ошибка, потом верный набор */
  click(q('#next-btn'));
  await wait(60);
  assert.strictEqual(qa('.kit-item').length, 9, 'девять позиций в наборе');
  qa('[data-safety]').forEach((n) => change(n, true));
  await wait(40);
  assert.ok(q('[data-block="safety"]').classList.contains('is-complete'), 'допуск закрыт');
  assert.strictEqual(S.isDone(3), false, 'без мини-кейса эпизод не закрыт');
  click(q('[data-choice="case"][data-opt="a"]'));
  await wait(40);
  click(q('[data-kit="tape"]'));
  await wait(30);
  click(q('[data-act="kit-check"]'));
  await wait(40);
  assert.strictEqual(S.isDone(3), false, 'с изолентой эпизод не закрыт');
  assert.ok(S.computeScore().parts.wiring.value < 6, 'лишний инструмент снял баллы');

  /* 6. Прогресс сохраняется */
  S.saveNow();
  const saved = JSON.parse(window.localStorage.getItem(S.STORAGE_KEY));
  assert.strictEqual(saved.episode, 3);
  assert.strictEqual(saved.safety.s1, true);
  assert.strictEqual(saved.roles.picked, 'doc');

  /* 7. Изоляция: в папке нет внешних ссылок и ссылок наружу */
  const files = labFiles('patch-panel');
  assert.ok(files.length >= 15, 'в папке достаточно файлов: ' + files.length);
  files.forEach((rel) => {
    if (/\.(woff2|txt)$/.test(rel)) return;
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.strictEqual(/(src|href)\s*=\s*["']https?:\/\//i.test(body), false, 'внешний запрос в ' + rel);
    assert.strictEqual(/\.\.\/\.\.\//.test(body), false, 'путь наружу в ' + rel);
  });
  assert.ok(
    fs.existsSync(path.join(ROOT, 'simulators/patch-panel/fonts/golos-text-cyrillic-wght-normal.woff2')),
    'шрифт лежит внутри папки'
  );

  /* 8. Клавиатура: фокус не теряется после перерисовки */
  const kitItem = q('[data-kit="tester"]');
  kitItem.focus();
  click(kitItem);
  await wait(40);
  assert.strictEqual(window.document.activeElement.getAttribute('data-kit'), 'tester', 'фокус остался на инструменте');

  /* Закрытый эпизод не открывается */
  click(qa('#rail-list [data-ep]')[5]);
  await wait(40);
  assert.match(q('.episode__title').textContent, /Инструмент|Инструктаж|Допуск/, 'остались в текущем эпизоде');
  assert.ok(toasts().includes('Эпизод пока закрыт'), 'подсказка о закрытом эпизоде: ' + toasts().join(' / '));

  assert.deepStrictEqual(errors, [], 'ошибки исполнения: ' + errors.join('; '));
  window.close();
  console.log('✓ «Смена на узле связи»: каркас, роли, чат, решения, инструмент, прогресс, изоляция');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
