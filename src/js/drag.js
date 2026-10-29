/* ==========================================================================
   drag.js — перетаскивание на Pointer Events (мышь + палец) с порогом,
   чтобы обычный клик не превращался в drag. Клавиатурная альтернатива
   реализуется вызывающим кодом (кнопки + Enter).
   ========================================================================== */
(function (global) {
  'use strict';

  const THRESHOLD = 6;

  function pointFromEvent(ev) {
    return { x: ev.clientX, y: ev.clientY };
  }

  /**
   * Включает перетаскивание элемента.
   * opts: {
   *   targetSelector — селектор зон-приёмников для подсветки,
   *   onStart(pt), onMove(pt, dx, dy), onEnd({dx, dy, target, canceled}),
   *   lift — применять transform к элементу (по умолчанию true),
   *   handle — вложенный элемент, с которого начинается drag
   * }
   * Возвращает функцию отключения.
   */
  function enableDrag(el, opts) {
    const o = opts || {};
    const handle = o.handle || el;
    const targetSelector = o.targetSelector || '[data-drop]';
    const lift = o.lift !== false;
    let start = null;
    let active = false;
    let lastTarget = null;

    function setLift(on, dx, dy) {
      if (!lift) return;
      el.classList.toggle('is-dragging', on);
      if (on) {
        el.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.06)';
        el.style.zIndex = '60';
      } else {
        el.style.transform = '';
        el.style.zIndex = '';
      }
    }

    function clearTargets() {
      if (lastTarget) lastTarget.classList.remove('is-over');
      lastTarget = null;
    }

    function onPointerDown(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
      start = Object.assign(pointFromEvent(ev), { id: ev.pointerId });
      active = false;
      handle.setPointerCapture && handle.setPointerCapture(ev.pointerId);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(ev) {
      if (!start) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!active) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        active = true;
        el.classList.add('is-dragging');
        if (o.onStart) o.onStart({ x: ev.clientX, y: ev.clientY });
      }
      if (o.onMove) o.onMove({ x: ev.clientX, y: ev.clientY }, dx, dy);
      setLift(true, dx, dy);

      // подсветка зоны под курсором
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
      el.classList.remove('is-dragging');

      // после перетаскивания гасим следующий клик, чтобы он не сработал дважды
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

  /** Ближайшая зона-приёмник под точкой (для кликов без drag) */
  function zoneFromPoint(x, y, selector) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest(selector || '[data-drop]') : null;
  }

  /** Включена ли анимация у пользователя */
  function reducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  global.AppDrag = { enableDrag, zoneFromPoint, reducedMotion, THRESHOLD };
})(window);
