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
 *   5. в папке лежат favicon, шрифты и весь набор стилей/скриптов страницы;
 *   6. нет внешних запросов (требование изоляции МЭШ).
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, labFiles } = require('./helpers');

const CORE_JS = [
  ['shared/js/core.js', 'js/vendor/core.js'],
  ['shared/js/icons.js', 'js/vendor/icons.js']
];
const SHELL_JS = CORE_JS.concat([
  ['shared/js/shell.js', 'js/vendor/shell.js'],
  ['shared/js/report.js', 'js/vendor/report.js']
]);
const CLASSIC_CSS = ['css/base.css', 'css/components.css', 'css/report.css', 'css/sim.css'];

const LABS = [
  {
    id: 'twisted-pair',
    css: CLASSIC_CSS,
    js: ['js/vendor/core.js', 'js/vendor/icons.js', 'js/vendor/shell.js', 'js/vendor/report.js'],
    vendored: SHELL_JS,
    font: false,
    minFiles: 14
  },
  {
    id: 'network-socket',
    css: CLASSIC_CSS,
    js: ['js/vendor/core.js', 'js/vendor/icons.js', 'js/vendor/shell.js', 'js/vendor/report.js'],
    vendored: SHELL_JS,
    font: false,
    minFiles: 14
  },
  {
    id: 'patch-panel',
    css: ['css/tokens.css', 'css/quest.css', 'css/panel.css'],
    js: ['js/vendor/core.js', 'js/vendor/icons.js', 'js/data.js', 'js/state.js', 'js/render.js', 'js/app.js'],
    vendored: CORE_JS,
    font: 'fonts/golos-text-cyrillic-wght-normal.woff2',
    minFiles: 16,
    minRefs: 9
  },
  {
    id: 'socket-quest',
    css: ['css/tokens.css', 'css/quest.css'],
    js: ['js/vendor/core.js', 'js/vendor/icons.js', 'js/data.js', 'js/state.js', 'js/render.js', 'js/app.js'],
    vendored: CORE_JS,
    font: 'fonts/golos-text-cyrillic-wght-normal.woff2',
    minFiles: 15,
    minRefs: 8
  }
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Копия внутри лаборатории = баннер сборки + исходник из shared/. */
function stripBanner(text) {
  return text.replace(/^\/\* Сгенерировано из [^\n]*\*\/\n/, '');
}

const BINARY = /\.(woff2?|png|jpe?g|gif|ico|pdf)$/i;

function checkLab(lab) {
  const dir = 'simulators/' + lab.id;
  const html = read(dir + '/index.html');

  /* 1–2. Только локальные ссылки, и все они ведут внутрь папки */
  const refs = [];
  html.replace(/(?:src|href)="([^"]+)"/g, (_, ref) => {
    refs.push(ref);
    return _;
  });
  assert.ok(refs.length >= (lab.minRefs || 11), lab.id + ': страница должна подключать свои файлы');
  refs.forEach((ref) => {
    if (ref.startsWith('#')) return; // якорь внутри страницы
    assert.ok(!/^https?:|^\/\//.test(ref), lab.id + ': внешняя ссылка ' + ref);
    assert.ok(!ref.startsWith('../'), lab.id + ': ссылка выходит из папки лаборатории — ' + ref);
    assert.ok(!ref.startsWith('/'), lab.id + ': абсолютный путь сломается при скачивании — ' + ref);
    const local = path.join(ROOT, dir, ref);
    assert.ok(fs.existsSync(local), lab.id + ': файл из index.html не найден в папке — ' + ref);
  });

  /* Стили и скрипты, без которых страница не работает */
  const cssFiles = refs.filter((r) => r.endsWith('.css'));
  const jsFiles = refs.filter((r) => r.endsWith('.js'));
  lab.css.forEach((css) => {
    assert.ok(cssFiles.includes(css), lab.id + ': в index.html не подключён ' + css);
  });
  lab.js.forEach((js) => {
    assert.ok(jsFiles.includes(js), lab.id + ': в index.html не подключён ' + js);
  });
  assert.ok(refs.includes('favicon.svg'), lab.id + ': иконка должна лежать в папке');
  if (lab.font) {
    assert.ok(fs.existsSync(path.join(ROOT, dir, lab.font)), lab.id + ': шрифт должен лежать в папке — ' + lab.font);
  }

  /* 3. Ни один файл лаборатории не тянет ничего снаружи */
  const files = labFiles(lab.id);
  assert.ok(files.length >= lab.minFiles, lab.id + ': в папке слишком мало файлов — ' + files.length);
  files.forEach((rel) => {
    if (rel.endsWith('.md') || BINARY.test(rel)) return; // в описании можно упоминать пути
    const body = read(rel);
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
  lab.vendored.forEach(([from, to]) => {
    const copy = path.join(ROOT, dir, to);
    assert.ok(fs.existsSync(copy), lab.id + ': нет файла ' + to);
    assert.strictEqual(
      stripBanner(fs.readFileSync(copy, 'utf8')),
      read(from),
      lab.id + ': ' + to + ' отличается от ' + from + ' — запустите npm run build'
    );
  });

  return { lab: lab.id, refs: refs.length, files: files.length };
}

function run() {
  const results = LABS.map(checkLab);
  results.forEach((r) => {
    console.log('  · ' + r.lab + ': ' + r.files + ' файлов, ' + r.refs + ' локальных ссылок в index.html');
  });
  console.log('✓ самодостаточность: все лаборатории работают из своей папки без внешних файлов');
}

try {
  run();
} catch (err) {
  console.error('✗ тест не пройден:', err.message);
  process.exit(1);
}
