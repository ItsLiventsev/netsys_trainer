/* Сгенерировано из shared/js/core.js скриптом tools/build.js — не редактируйте вручную. */
/* ==========================================================================
   core.js — общее ядро тренажёров:
   DOM-хелперы, тосты, модальные окна, перетаскивание (Pointer Events),
   хранилище прогресса, обмен сообщениями с МЭШ.

   Глобальные объекты:
     AppCore  — API ядра
     AppDrag  — совместимый алиас для перетаскивания
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- DOM и текст ------------------------------------------------ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (html != null) node.innerHTML = html;
    return node;
  }

  /* ---------- Скринридер ------------------------------------------------ */
  function announce(text) {
    const node = $('#sr-status');
    if (!node) return;
    node.textContent = '';
    global.setTimeout(() => {
      node.textContent = text;
    }, 40);
  }

  /* ---------- Настройки анимации ---------------------------------------- */
  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- Тосты ------------------------------------------------------ */
  const TOAST_ICONS = {
    info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.6"/></svg>',
    ok: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 9 17l10.5-10.5"/></svg>',
    warn: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.5 21 20H3z"/><path d="M12 10v4.5M12 17.2v.6"/></svg>',
    error: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  function toast(kind, title, text, opts) {
    const host = $('#toasts');
    if (!host) return;
    const o = opts || {};
    const node = el('div', { class: 'toast toast--' + (kind || 'info') });
    node.innerHTML =
      (TOAST_ICONS[kind] || TOAST_ICONS.info) +
      '<div><div class="toast__title">' + esc(title) + '</div>' +
      (text ? '<div class="toast__text">' + esc(text) + '</div>' : '') + '</div>';
    host.appendChild(node);
    if (!o.silent) announce((title || '') + '. ' + (text || ''));

    while (host.children.length > 3) host.removeChild(host.firstElementChild);

    const timer = global.setTimeout(() => {
      node.classList.add('is-leaving');
      global.setTimeout(() => node.remove(), 220);
    }, o.duration || 4600);
    node.addEventListener('click', () => {
      global.clearTimeout(timer);
      node.remove();
    });
  }

  /* ---------- Модальные окна -------------------------------------------- */
  let modalState = null;

  function closeModal() {
    const root = $('#modal-root');
    if (!root || !root.firstChild) return;
    if (modalState && modalState.keyHandler) {
      document.removeEventListener('keydown', modalState.keyHandler, true);
    }
    if (modalState && modalState.onClose) modalState.onClose();
    root.innerHTML = '';
    document.body.style.removeProperty('overflow');
    const last = modalState && modalState.lastFocus;
    modalState = null;
    if (last && last.focus) last.focus();
  }

  function openModal(opts) {
    const root = $('#modal-root');
    if (!root) return;
    const o = opts || {};
    closeModal();

    const wrap = el('div', { class: 'modal', role: 'presentation' });
    wrap.innerHTML = '<div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">' + o.html + '</div>';
    root.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    modalState = { lastFocus: document.activeElement, onClose: o.onClose };

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) closeModal();
    });
    $$('[data-modal-close]', wrap).forEach((b) => b.addEventListener('click', closeModal));

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', wrap).filter(
        (n) => !n.disabled && n.offsetParent !== null
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!wrap.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    if (modalState) modalState.keyHandler = onKey;

    const focusable = $('button, [href], input, textarea', wrap);
    if (focusable) focusable.focus();
    return wrap;
  }

  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        closeModal();
        resolve(v);
      };
      openModal({
        html:
          '<div class="modal__head"><div><h2 class="modal__title" id="modal-title">' + esc(o.title || 'Подтвердите действие') + '</h2>' +
          (o.text ? '<p class="modal__sub">' + esc(o.text) + '</p>' : '') + '</div></div>' +
          '<div class="modal__actions">' +
          '<button type="button" class="btn" data-modal-close>' + esc(o.cancelText || 'Отмена') + '</button>' +
          '<button type="button" class="btn btn--primary" data-confirm>' + esc(o.confirmText || 'Продолжить') + '</button>' +
          '</div>',
        onClose: () => done(false)
      });
      const btn = $('[data-confirm]');
      if (btn) {
        btn.focus();
        btn.addEventListener('click', () => done(true));
      }
    });
  }

  /* ---------- Перетаскивание (Pointer Events) --------------------------- */
  const DRAG_THRESHOLD = 6;

  /**
   * enableDrag(el, opts)
   *   opts.targetSelector — селектор зон-приёмников для подсветки
   *   opts.onStart(pt) / opts.onMove(pt, dx, dy) / opts.onEnd({dx, dy, target, canceled})
   *   opts.lift — применять transform к элементу (по умолчанию true)
   * Работает и мышью, и пальцем; клик без движения не считается перетаскиванием.
   */
  function enableDrag(node, opts) {
    const o = opts || {};
    const targetSelector = o.targetSelector || '[data-drop]';
    const lift = o.lift !== false;
    const handle = o.handle || node;
    let start = null;
    let active = false;
    let lastTarget = null;

    function setLift(on, dx, dy) {
      if (!lift) return;
      node.classList.toggle('is-dragging', on);
      if (on) {
        node.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.06)';
        node.style.zIndex = '60';
      } else {
        node.style.transform = '';
        node.style.zIndex = '';
      }
    }

    function clearTargets() {
      if (lastTarget) lastTarget.classList.remove('is-over');
      lastTarget = null;
    }

    function onPointerDown(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (node.getAttribute('aria-disabled') === 'true' || node.disabled) return;
      start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      active = false;
      if (handle.setPointerCapture) handle.setPointerCapture(ev.pointerId);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(ev) {
      if (!start) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!active) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        active = true;
        node.classList.add('is-dragging');
        if (o.onStart) o.onStart({ x: ev.clientX, y: ev.clientY });
      }
      if (o.onMove) o.onMove({ x: ev.clientX, y: ev.clientY }, dx, dy);
      setLift(true, dx, dy);

      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const zone = under && under.closest ? under.closest(targetSelector) : null;
      if (zone !== lastTarget) {
        clearTargets();
        if (zone) {
          zone.classList.add('is-over');
          lastTarget = zone;
        }
      }
    }

    function onPointerUp(ev) {
      if (!start) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      const wasActive = active;
      start = null;
      active = false;
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
      clearTargets();
      if (!wasActive) return;

      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const target = under && under.closest ? under.closest(targetSelector) : null;

      setLift(false);
      node.classList.remove('is-dragging');

      // гасим следующий клик, чтобы после перетаскивания не срабатывал обработчик клика
      const swallow = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      document.addEventListener('click', swallow, true);
      global.setTimeout(() => document.removeEventListener('click', swallow, true), 260);

      if (o.onEnd) o.onEnd({ dx: dx, dy: dy, target: target, canceled: ev.type === 'pointercancel' });
    }

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('dragstart', (e) => e.preventDefault());

    return function destroy() {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
    };
  }

  function zoneFromPoint(x, y, selector) {
    const node = document.elementFromPoint(x, y);
    return node && node.closest ? node.closest(selector || '[data-drop]') : null;
  }

  /* ---------- Хранилище прогресса --------------------------------------- */
  function storageAvailable() {
    try {
      const k = 'netsys.probe';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  const canStore = storageAvailable();

  function merge(base, incoming) {
    if (Array.isArray(base)) {
      return Array.isArray(incoming) && incoming.length === base.length ? incoming.slice() : base.slice();
    }
    if (base && typeof base === 'object') {
      if (!incoming || typeof incoming !== 'object') return merge(base, {});
      const out = {};
      const keys = Object.keys(base);
      Object.keys(incoming).forEach((k) => {
        if (keys.indexOf(k) === -1) keys.push(k);
      });
      keys.forEach((k) => {
        out[k] = k in base ? merge(base[k], incoming[k]) : incoming[k];
      });
      return out;
    }
    if (incoming === undefined || incoming === null) return base;
    return typeof incoming === typeof base ? incoming : base;
  }

  /**
   * createStore({ key, version, defaults, onReset })
   * Возвращает объект с состоянием и методами сохранения.
   */
  function createStore(opts) {
    const o = opts || {};
    const key = o.key;
    const version = o.version || 1;
    const defaults = o.defaults;
    let state = merge(defaults, {});
    let timer = null;
    const listeners = [];

    function get() {
      return state;
    }

    function load() {
      if (!canStore) return state;
      try {
        const raw = global.localStorage.getItem(key);
        if (!raw) return state;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== version) return state;
        state = merge(defaults, parsed);
        return state;
      } catch (e) {
        return state;
      }
    }

    function saveNow() {
      if (!canStore) return;
      try {
        global.localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        /* переполнение хранилища не должно ломать работу */
      }
    }

    function save() {
      if (timer) global.clearTimeout(timer);
      timer = global.setTimeout(() => {
        timer = null;
        saveNow();
      }, 200);
    }

    function reset() {
      state = merge(defaults, {});
      if (canStore) {
        try {
          global.localStorage.removeItem(key);
        } catch (e) {
          /* noop */
        }
      }
      if (o.onReset) o.onReset(state);
      saveNow();
      return state;
    }

    function subscribe(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    function logEntry(text) {
      if (!Array.isArray(state.log)) state.log = [];
      state.log.push({ t: Date.now(), text: text });
      if (state.log.length > 60) state.log.shift();
    }

    return {
      key: key,
      canStore: canStore,
      get: get,
      load: load,
      save: save,
      saveNow: saveNow,
      reset: reset,
      subscribe: subscribe,
      logEntry: logEntry
    };
  }

  /* ---------- Обмен сообщениями с МЭШ ----------------------------------- */
  const lms = {
    /** Сообщить оболочке LMS, что тренажёр готов */
    ready(info) {
      if (!global.parent || global.parent === global) return false;
      try {
        global.parent.postMessage(
          Object.assign({ type: 'LMS_READY', version: 1 }, info || {}),
          '*'
        );
        return true;
      } catch (e) {
        return false;
      }
    },

    /** Отправить оценку (score, maxScore, parts, ...) */
    send(payload, silent) {
      let delivered = false;
      try {
        if (global.parent && global.parent !== global) {
          global.parent.postMessage(payload, '*');
          delivered = true;
        }
        if (global.top && global.top !== global && global.top !== global.parent) {
          global.top.postMessage(payload, '*');
        }
      } catch (e) {
        delivered = false;
      }
      return delivered;
    },

    /**
     * Подписка на команды LMS.
     * handlers: { requestScore(reply), reset(), setMode(mode) }
     */
    listen(handlers) {
      const h = handlers || {};
      global.addEventListener('message', (ev) => {
        const data = ev.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'LMS_REQUEST_SCORE' && h.requestScore) {
          const payload = h.requestScore();
          if (ev.source && ev.source.postMessage) {
            try {
              ev.source.postMessage(payload, '*');
            } catch (e) {
              /* noop */
            }
          }
        } else if (data.type === 'LMS_RESET' && h.reset) {
          h.reset();
        } else if (data.type === 'LMS_SET_MODE' && h.setMode && (data.mode === 'training' || data.mode === 'exam')) {
          h.setMode(data.mode);
        }
      });
    }
  };

  global.AppCore = {
    $,
    $$,
    el,
    esc,
    announce,
    reducedMotion,
    toast,
    openModal,
    closeModal,
    confirmDialog,
    enableDrag,
    zoneFromPoint,
    DRAG_THRESHOLD,
    createStore,
    storageAvailable,
    canStore,
    lms
  };

  // совместимость с кодом тренажёров, который обращается к AppDrag
  global.AppDrag = {
    enableDrag,
    zoneFromPoint,
    reducedMotion,
    THRESHOLD: DRAG_THRESHOLD
  };
})(window);
