#!/usr/bin/env node
/**
 * build.js — «упаковка» общих файлов внутрь каждой лаборатории.
 *
 * Каждая папка simulators/<id>/ должна быть полностью самодостаточной:
 * её можно скачать отдельно и открыть index.html двойным щелчком, ничего
 * не потеряв. Поэтому общий код из shared/ копируется внутрь лаборатории:
 *
 *   shared/css/base.css        →  simulators/<id>/css/base.css
 *   shared/css/components.css  →  simulators/<id>/css/components.css
 *   shared/css/report.css      →  simulators/<id>/css/report.css
 *   shared/js/core.js          →  simulators/<id>/js/vendor/core.js
 *   shared/js/icons.js         →  simulators/<id>/js/vendor/icons.js
 *   shared/js/shell.js         →  simulators/<id>/js/vendor/shell.js
 *   shared/js/report.js        →  simulators/<id>/js/vendor/report.js
 *   favicon.svg                →  simulators/<id>/favicon.svg
 *
 * Правим общий код только в shared/ — иначе `npm test` упадёт.
 *
 *   node tools/build.js            пересобрать (перезаписать копии)
 *   node tools/build.js --check    только проверить, что копии актуальны
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const LABS = ['twisted-pair', 'network-socket'];

/** откуда → куда (путь внутри лаборатории) */
const VENDORED = [
  { from: 'shared/css/base.css', to: 'css/base.css' },
  { from: 'shared/css/components.css', to: 'css/components.css' },
  { from: 'shared/css/report.css', to: 'css/report.css' },
  { from: 'shared/js/core.js', to: 'js/vendor/core.js' },
  { from: 'shared/js/icons.js', to: 'js/vendor/icons.js' },
  { from: 'shared/js/shell.js', to: 'js/vendor/shell.js' },
  { from: 'shared/js/report.js', to: 'js/vendor/report.js' },
  { from: 'favicon.svg', to: 'favicon.svg' }
];

const BANNER = (from) =>
  '/* Сгенерировано из ' + from + ' скриптом tools/build.js — не редактируйте вручную. */\n';

/** Содержимое копии: баннер + исходник. */
function expected(from) {
  return BANNER(from) + fs.readFileSync(path.join(ROOT, from), 'utf8');
}

function target(lab, to) {
  return path.join(ROOT, 'simulators', lab, to);
}

function build() {
  let changed = 0;
  LABS.forEach((lab) => {
    VENDORED.forEach((item) => {
      const file = target(lab, item.to);
      const next = expected(item.from);
      const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (prev === next) return;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, next);
      changed += 1;
      console.log('  обновлён simulators/' + lab + '/' + item.to);
    });
  });
  console.log(
    changed
      ? '✓ собрано: обновлено файлов — ' + changed
      : '✓ собрано: всё актуально, копии совпадают с shared/'
  );
}

function check() {
  const problems = [];
  LABS.forEach((lab) => {
    VENDORED.forEach((item) => {
      const file = target(lab, item.to);
      const want = expected(item.from);
      if (!fs.existsSync(file)) {
        problems.push('нет файла simulators/' + lab + '/' + item.to + ' (ожидается из ' + item.from + ')');
        return;
      }
      if (fs.readFileSync(file, 'utf8') !== want) {
        problems.push('устарел simulators/' + lab + '/' + item.to + ' — запустите npm run build');
      }
    });
  });
  if (problems.length) {
    problems.forEach((p) => console.error('✗ ' + p));
    process.exit(1);
  }
  console.log('✓ самодостаточность: копии общих файлов внутри обеих лабораторий актуальны');
}

if (process.argv.includes('--check')) check();
else build();
