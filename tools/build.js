/* ==========================================================================
   build.js — «упаковка» общих файлов внутрь каждой лаборатории.
 *
 * Каждая папка simulators/<id>/ должна быть полностью самодостаточной:
 * её можно скачать отдельно и открыть index.html, ничего не потеряв.
 * Поэтому общий код из shared/ копируется внутрь лаборатории:
 *
 *   shared/css/<name>.css  →  simulators/<id>/css/<name>.css
 *   shared/js/<name>.js    →  simulators/<id>/js/vendor/<name>.js
 *   favicon.svg            →  simulators/<id>/favicon.svg
 *
 * Состав копий у лабораторий разный: классические тренажёры используют
 * оболочку и отчёт, квест — только core и иконки, а его CSS свой.
 * Правим общий код только в shared/ — иначе `npm test` упадёт.
 *
 *   node tools/build.js            пересобрать (перезаписать копии)
 *   node tools/build.js --check    только проверить, что копии актуальны
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** Состав лабораторий: какие общие файлы копируются внутрь. */
const LABS = {
  'twisted-pair': { css: ['base', 'components', 'report'], js: ['core', 'icons', 'shell', 'report'] },
  'network-socket': { css: ['base', 'components', 'report'], js: ['core', 'icons', 'shell', 'report'] },
  // у квеста свой стиль и своя иконка: копируются только общие скрипты
  'socket-quest': { css: [], js: ['core', 'icons'], favicon: false }
};

const BANNER = (from) =>
  '/* Сгенерировано из ' + from + ' скриптом tools/build.js — не редактируйте вручную. */\n';

/** Список копий для лаборатории: [{ from, to }] */
function vendoredFor(lab) {
  const cfg = LABS[lab];
  if (!cfg) throw new Error('неизвестная лаборатория: ' + lab);
  const items = cfg.css.map((name) => ({ from: 'shared/css/' + name + '.css', to: 'css/' + name + '.css' }));
  const js = cfg.js.map((name) => ({ from: 'shared/js/' + name + '.js', to: 'js/vendor/' + name + '.js' }));
  const out = items.concat(js);
  if (cfg.favicon !== false) out.push({ from: 'favicon.svg', to: 'favicon.svg' });
  return out;
}

/** Содержимое копии: баннер + исходник (для SVG баннер не нужен). */
function expected(from) {
  const body = fs.readFileSync(path.join(ROOT, from), 'utf8');
  return from.endsWith('.svg') ? body : BANNER(from) + body;
}

const target = (lab, to) => path.join(ROOT, 'simulators', lab, to);

function build() {
  let changed = 0;
  Object.keys(LABS).forEach((lab) => {
    vendoredFor(lab).forEach((item) => {
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
  Object.keys(LABS).forEach((lab) => {
    vendoredFor(lab).forEach((item) => {
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
  console.log('✓ самодостаточность: копии общих файлов внутри лабораторий актуальны');
}

module.exports = { LABS, vendoredFor };

if (require.main === module) {
  if (process.argv.includes('--check')) check();
  else build();
}
