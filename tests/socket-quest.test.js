#!/usr/bin/env node
/**
 * socket-quest.test.js — дымовой тест квеста «Смена в СетьПолисе»:
 * сборка страницы, диалоги, решения, заявка, переход между эпизодами,
 * сохранение прогресса и изоляция от внешних запросов.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, bootSimulator, labFiles, wait } = require('./helpers');

async function run() {
  const ctx = bootSimulator('socket-quest');
  const { window, q, qa, click, change, type, toasts, errors } = ctx;
  await wait(260);
  const S = window.AppState;

  /* 1. Каркас */
  assert.strictEqual(qa('.rail-item').length, 7, 'семь эпизодов в рельсе');
  assert.match(q('.episode__title').textContent, /Первое утро/);
  assert.strictEqual(q('#score-chip').textContent.trim(), '0 / 100', 'стартовый итог 0');
  assert.strictEqual(q('#next-btn').disabled, true, 'без решения дальше не пускает');
  assert.ok(qa('.msg').length >= 4, 'диалог отрисован');
  assert.strictEqual(q('#shift-clock').textContent.length, 5, 'часы смены идут');

  /* 2. Неверное решение не закрывает эпизод */
  click(q('[data-choice="start"][data-opt="c"]'));
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

  /* 4. Заявка и второй эпизод */
  click(q('#next-btn'));
  await wait(60);
  assert.match(q('.episode__title').textContent, /Заявка/);
  assert.strictEqual(qa('.ticket__row').length, 10, 'в заявке десять строк');
  assert.strictEqual(q('.ticket__stamp').textContent.trim(), '⚡ INC-2147');
  assert.strictEqual(S.isDone(2), false);
  click(q('[data-choice="plan"][data-opt="b"]'));
  await wait(40);
  assert.strictEqual(S.isDone(2), false, 'неверный план не пускает дальше');
  click(q('[data-choice="plan"][data-opt="a"]'));
  await wait(40);
  assert.strictEqual(S.isDone(2), true);

  /* 5. Инструмент: лишнее — ошибка, потом верный набор */
  click(q('#next-btn'));
  await wait(60);
  assert.strictEqual(qa('.kit-item').length, 7, 'семь позиций в наборе');
  qa('[data-safety]').forEach((n) => change(n, true));
  await wait(40);
  assert.ok(q('[data-block="safety"]').classList.contains('is-complete'), 'допуск закрыт');
  click(q('[data-kit="crimper"]'));
  await wait(30);
  click(q('[data-act="kit-check"]'));
  await wait(40);
  assert.strictEqual(S.isDone(3), false, 'с кримпером эпизод не закрыт');
  assert.ok(S.computeScore().parts.wiring.value < 6, 'лишний инструмент снял баллы');

  /* 6. Прогресс сохраняется */
  S.saveNow();
  const saved = JSON.parse(window.localStorage.getItem(S.STORAGE_KEY));
  assert.strictEqual(saved.episode, 3);
  assert.strictEqual(saved.safety.s1, true);

  /* 7. Изоляция: в папке нет внешних ссылок и ссылок наружу */
  const files = labFiles('socket-quest');
  assert.ok(files.length >= 12, 'в папке достаточно файлов: ' + files.length);
  files.forEach((rel) => {
    if (/\.(woff2|txt)$/.test(rel)) return;
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.strictEqual(/(src|href)\s*=\s*["']https?:\/\//i.test(body), false, 'внешний запрос в ' + rel);
    assert.strictEqual(/\.\.\/\.\.\//.test(body), false, 'путь наружу в ' + rel);
  });
  assert.ok(fs.existsSync(path.join(ROOT, 'simulators/socket-quest/fonts/golos-text-cyrillic-wght-normal.woff2')),
    'шрифт лежит внутри папки');

  /* 8. Клавиатура: фокус не теряется после перерисовки */
  const kitItem = q('[data-kit="tester"]');
  kitItem.focus();
  click(kitItem);
  await wait(40);
  assert.strictEqual(window.document.activeElement.getAttribute('data-kit'), 'tester', 'фокус остался на инструменте');
  assert.strictEqual(qa('#rail-list [data-ep]')[0].disabled, false, 'пройденный эпизод открыт');
  assert.strictEqual(qa('#rail-list [data-ep]')[3].disabled, true, 'будущий эпизод закрыт');

  /* Закрытый эпизод не открывается ни мышью, ни с клавиатуры */
  click(qa('#rail-list [data-ep]')[5]);
  await wait(40);
  assert.match(q('.episode__title').textContent, /Инструмент|Инструктаж/, 'остались в текущем эпизоде');
  assert.ok(toasts().includes('Эпизод пока закрыт'), 'подсказка о закрытом эпизоде: ' + toasts().join(' / '));

  /* Назад к началу смены */
  click(q('#prev-btn'));
  await wait(60);
  assert.match(q('.episode__title').textContent, /Заявка/);
  click(q('#prev-btn'));
  await wait(60);
  assert.match(q('.episode__title').textContent, /Первое утро/);
  assert.strictEqual(q('#prev-btn').disabled, true, 'на первом эпизоде «назад» недоступно');
  click(q('#next-btn'));
  await wait(60);
  click(q('#next-btn'));
  await wait(60);
  assert.match(q('.episode__title').textContent, /Инструмент|Инструктаж/, 'вернулись на третий эпизод');

  assert.deepStrictEqual(errors, [], 'ошибки исполнения: ' + errors.join('; '));
  window.close();
  console.log('✓ «Смена в СетьПолисе»: каркас, решения, заявка, инструмент, прогресс, изоляция');
}

run().catch((err) => {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
});
