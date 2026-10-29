/**
 * helpers.js — тестовый стенд на jsdom: поднимает страницу тренажёра
 * с нужными скриптами и отдаёт удобные функции для сценариев.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

const SHARED = ['shared/js/core.js', 'shared/js/icons.js', 'shared/js/shell.js', 'shared/js/report.js'];

const SIMULATORS = {
  'twisted-pair': {
    dir: 'simulators/twisted-pair',
    scripts: [
      'simulators/twisted-pair/js/data.js',
      'simulators/twisted-pair/js/graphics.js',
      'simulators/twisted-pair/js/state.js',
      'simulators/twisted-pair/js/steps.js',
      'simulators/twisted-pair/js/report.js',
      'simulators/twisted-pair/js/app.js'
    ]
  },
  'network-socket': {
    dir: 'simulators/network-socket',
    scripts: [
      'simulators/network-socket/js/data.js',
      'simulators/network-socket/js/graphics.js',
      'simulators/network-socket/js/state.js',
      'simulators/network-socket/js/steps.js',
      'simulators/network-socket/js/report.js',
      'simulators/network-socket/js/app.js'
    ]
  }
};

/**
 * bootSimulator('twisted-pair', { storage: '…', reducedMotion: false })
 * Возвращает { window, doc, q, qa, click, key, wait, errors }
 */
function bootSimulator(id, opts) {
  const o = opts || {};
  const sim = SIMULATORS[id];
  if (!sim) throw new Error('неизвестный тренажёр: ' + id);

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  const { window } = dom;

  window.matchMedia = (query) => ({
    matches: !!(o.reducedMotion && /reduced-motion/.test(query)),
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {}
  });
  window.scrollTo = () => {};

  if (o.storage) {
    const key = o.storageKey || 'netsys.tp.state.v1';
    window.localStorage.setItem(key, o.storage);
  }

  const html = fs.readFileSync(path.join(ROOT, sim.dir, 'index.html'), 'utf8');
  const bodyMatch = html.match(/<body>([\s\S]*)<script src=/);
  window.document.body.innerHTML = bodyMatch[1];

  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.message));

  SHARED.concat(sim.scripts).forEach((rel) => {
    const node = window.document.createElement('script');
    node.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.document.body.appendChild(node);
  });

  const doc = window.document;
  const q = (sel) => doc.querySelector(sel);
  const qa = (sel) => Array.from(doc.querySelectorAll(sel));
  const click = (node) => {
    if (!node) throw new Error('элемент для клика не найден');
    node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  const key = (node, k) =>
    node.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const pdown = (node) =>
    node.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  const pup = (node) =>
    node.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  const toasts = () => qa('.toast__title').map((t) => t.textContent);

  return { window, doc, q, qa, click, key, pdown, pup, toasts, errors, wait };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { ROOT, SHARED, SIMULATORS, bootSimulator, wait };
