#!/usr/bin/env node
/**
 * run-all.js — запускает все тесты тренажёров подряд.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

let failed = 0;
files.forEach((f) => {
  process.stdout.write('\n▶ ' + f + '\n');
  try {
    const out = execFileSync(process.execPath, [path.join(DIR, f)], { encoding: 'utf8' });
    process.stdout.write(out.split('\n').filter(Boolean).map((l) => '  ' + l).join('\n') + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write((err.stdout || '') + (err.stderr || '') + '\n');
    process.stdout.write('  ✗ ' + f + ' упал\n');
  }
});

console.log(failed ? '\n✗ тестов с ошибками: ' + failed : '\n✓ все тесты пройдены');
process.exit(failed ? 1 : 0);
