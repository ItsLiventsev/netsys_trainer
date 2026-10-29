#!/usr/bin/env node
/**
 * standalone.test.js — каждая лаборатория должна быть полностью самодостаточной:
 * папку можно скачать отдельно, открыть index.html и всё заработает.
 *
 * Проверяем:
 *   1. в index.html нет ссылок «наружу» (../ и абсолютных путей);
 *   2. все локальные src/href существуют внутри папки лаборатории;
 *   3. ни один файл лаборатории не ссылается на shared/ или ../../;
 *   4. копии общих файлов совпадают с shared/ (нет «дрейфа» версий);
 *   5. в папке лежат favicon и весь набор стилей/скриптов, которые ждёт страница;
 *   6. нет внешних запросов (требование изоляции МЭШ).
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, labFiles } = require('./helpers');

const LABS = ['twisted-pair', 'network-socket'];

const VENDORED = [
  ['shared/css/base.css', 'css/base.css'],
  ['shared/css/components.css', 'css/components.css'],
  ['shared/css/report.css', 'css/report.css'],
  ['shared/js/core.js', 'js/vendor/core.js'],
  ['shared/js/icons.js', 'js/vendor/icons.js'],
  ['shared/js/shell.js', 'js/vendor/shell.js'],
  ['shared/js/report.js', 'js/vendor/report.js'],
  ['favicon.svg', 'favicon.svg']
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Копия внутри лаборатории = баннер сборки + исходник из shared/. */
function stripBanner(text) {
  return text.replace(/^\/\* Сгенерировано из [^\n]*\*\/\n/, '');
}

function checkLab(lab) {
  const dir = 'simulators/' + lab;
  const html = read(dir + '/index.html');

  /* 1–2. Только локальные ссылки, и все они ведут внутрь папки */
  const refs = [];
  html.replace(/(?:src|href)="([^"]+)"/g, (_, ref) => {
    refs.push(ref);
    return _;
  });
  assert.ok(refs.length > 10, lab + ': страница должна подключать свои файлы');
  refs.forEach((ref) => {
    if (ref.startsWith('#')) return; // якорь внутри страницы
    assert.ok(!/^https?:|^\/\//.test(ref), lab + ': внешняя ссылка ' + ref);
    assert.ok(!ref.startsWith('../'), lab + ': ссылка выходит из папки лаборатории — ' + ref);
    assert.ok(!ref.startsWith('/'), lab + ': абсолютный путь сломается при скачивании — ' + ref);
    const local = path.join(ROOT, dir, ref);
    assert.ok(fs.existsSync(local), lab + ': файл из index.html не найден в папке — ' + ref);
  });

  /* Стили и скрипты, без которых страница не работает */
  const cssFiles = refs.filter((r) => r.endsWith('.css'));
  const jsFiles = refs.filter((r) => r.endsWith('.js'));
  ['css/base.css', 'css/components.css', 'css/report.css', 'css/sim.css'].forEach((css) => {
    assert.ok(cssFiles.includes(css), lab + ': в index.html не подключён ' + css);
  });
  ['js/vendor/core.js', 'js/vendor/icons.js', 'js/vendor/shell.js', 'js/vendor/report.js'].forEach((js) => {
    assert.ok(jsFiles.includes(js), lab + ': в index.html не подключён ' + js);
  });
  assert.ok(refs.includes('favicon.svg'), lab + ': иконка должна лежать в папке');

  /* 3. Ни один файл лаборатории не тянет ничего снаружи */
  const files = labFiles(lab);
  assert.ok(files.length >= 14, lab + ': в папке слишком мало файлов — ' + files.length);
  files.forEach((rel) => {
    const body = read(rel);
    if (rel.endsWith('.md')) return; // в описании можно упоминать пути
    assert.strictEqual(
      /(\.\.\/)+shared\//.test(body),
      false,
      rel + ': ссылка на shared/ снаружи лаборатории'
    );
    assert.strictEqual(
      /\.\.\/\.\.\//.test(body),
      false,
      rel + ': путь на два уровня выше — папка перестанет работать отдельно'
    );
    assert.strictEqual(
      /(src|href)\s*=\s*["']https?:\/\//i.test(body) || /@import\s+url\(\s*["']?https?:/i.test(body),
      false,
      rel + ': внешний запрос (CDN)'
    );
  });

  /* 4. Копии общих файлов актуальны */
  VENDORED.forEach(([from, to]) => {
    const copy = path.join(ROOT, dir, to);
    assert.ok(fs.existsSync(copy), lab + ': нет файла ' + to);
    assert.strictEqual(
      stripBanner(fs.readFileSync(copy, 'utf8')),
      read(from),
      lab + ': ' + to + ' отличается от ' + from + ' — запустите npm run build'
    );
  });

  return { lab, refs: refs.length, files: files.length };
}

function run() {
  const results = LABS.map(checkLab);
  results.forEach((r) => {
    console.log('  · ' + r.lab + ': ' + r.files + ' файлов, ' + r.refs + ' локальных ссылок в index.html');
  });
  window_close();
  console.log('✓ самодостаточность: обе лаборатории работают из своей папки без внешних файлов');
}

// jsdom здесь не нужен — заглушка, чтобы структура файла совпадала с остальными тестами
function window_close() {}

try {
  run();
} catch (err) {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
}
