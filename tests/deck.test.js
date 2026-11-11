#!/usr/bin/env node
/**
 * deck.test.js — сценарий урока «Монтаж коммутационной панели»:
 * структура слайдов, заметки мастера, навигация, автономность папки.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { ROOT } = require('./helpers');

const DIR = 'lessons/patch-panel';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function run() {
  const html = read(DIR + '/index.html');

  /* 1. Структура: 22 слайда, у каждого — заметка для мастера */
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;
  const doc = window.document;
  const slides = Array.from(doc.querySelectorAll('.slide'));
  assert.strictEqual(slides.length, 22, 'в сценарии 22 слайда');
  slides.forEach((s, i) => {
    assert.ok(s.getAttribute('data-notes'), 'у слайда ' + (i + 1) + ' есть заметка мастера');
  });

  /* 2. Навигация работает: первый слайд активен, счётчик и заметки на месте */
  assert.ok(slides[0].classList.contains('is-active'), 'первый слайд активен');
  assert.strictEqual(doc.getElementById('count').textContent.trim(), '1 / 22');
  assert.strictEqual(doc.querySelectorAll('.notes').length, 22, 'заметки перенесены в блоки');
  assert.strictEqual(doc.querySelector('.notes').hidden, true, 'заметки по умолчанию скрыты');

  doc.getElementById('next').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(slides[1].classList.contains('is-active'), 'кнопка «Дальше» переключает слайд');
  assert.strictEqual(doc.getElementById('count').textContent.trim(), '2 / 22');

  const notesBtn = doc.getElementById('notes-toggle');
  notesBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.strictEqual(notesBtn.getAttribute('aria-pressed'), 'true', 'переключатель заметок включён');
  assert.strictEqual(doc.querySelector('.notes').hidden, false, 'заметки показаны');

  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.ok(slides[21].classList.contains('is-active'), 'End ведёт на последний слайд');

  /* 3. Содержание: обязательные блоки сценария */
  const text = doc.body.textContent;
  [
    'Цель и задачи',
    'Охрана труда',
    'Две формы работы',
    'Роли отыгрыша',
    'Заявка PP-314',
    'Операционная карта',
    'Рефлексивная мишень',
    '43 балла'
  ].forEach((needle) => {
    assert.ok(text.includes(needle), 'в сценарии есть блок «' + needle + '»');
  });

  /* 4. Автономность: только локальные ссылки, шрифты внутри папки */
  const files = walk(path.join(ROOT, DIR)).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
  files.forEach((rel) => {
    if (/\.(woff2|txt)$/.test(rel)) return;
    const body = read(rel);
    assert.strictEqual(/(src|href)\s*=\s*["']https?:\/\//i.test(body), false, 'внешний запрос в ' + rel);
  });
  assert.ok(files.length >= 6, 'в папке сценария достаточно файлов: ' + files.length);
  assert.ok(fs.existsSync(path.join(ROOT, DIR, 'fonts/golos-text-cyrillic-wght-normal.woff2')), 'шрифт внутри папки');
  assert.ok(fs.existsSync(path.join(ROOT, DIR, 'css/deck.css')), 'стили сценария на месте');

  window.close();
  console.log('✓ Сценарий урока: 22 слайда, заметки мастера, навигация, автономность');
}

try {
  run();
} catch (err) {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
}
