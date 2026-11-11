/* Сгенерировано из shared/js/icons.js скриптом tools/build.js — не редактируйте вручную. */
/* ==========================================================================
   icons.js — общая графика тренажёров: линейные иконки, жилы витой пары,
   схема стандарта, иконки устройств, кольцо оценки.
   Зависит от APP_DATA.WIRES (одинаковая структура в обоих тренажёрах).
   ========================================================================== */
(function (global) {
  'use strict';

  const esc = global.AppCore.esc;

  /* ---------- Утилиты ----------------------------------------------------- */
  // APP_DATA загружается после этого файла, поэтому жилы берём лениво
  function wires() {
    return (global.APP_DATA && global.APP_DATA.WIRES) || {};
  }

  function wireClass(id, extra) {
    const W = wires();
    const w = W[id];
    if (!w) return 'wire';
    return ['wire', 'wire--' + w.color, w.striped ? '' : 'wire--solid', extra || ''].filter(Boolean).join(' ');
  }

  function wireHTML(id, extraClass) {
    return '<span class="' + wireClass(id, extraClass) + '" data-wire="' + id + '"></span>';
  }

  /* ---------- Линейные иконки интерфейса ---------------------------------- */
  const ICONS = {
    stripper:
      '<path d="M4 5.5 11 12M4 18.5 11 12" stroke-width="2.2"/><path d="M11.5 8.2c2.4-1.6 4.9-2 6.2-.7 1.3 1.3.9 3.8-.7 6.2M11.5 15.8c2.4 1.6 4.9 2 6.2.7 1.3-1.3.9-3.8-.7-6.2"/><circle cx="17.6" cy="11.8" r="1.5"/>',
    crimper:
      '<path d="M3 6.5 9.5 11M3 17.5 9.5 13" stroke-width="2.2"/><path d="M10 8.5h4.5v7H10z"/><path d="M15 12h3.5M18.5 9.5 21 12l-2.5 2.5"/>',
    tester:
      '<rect x="3" y="6" width="18" height="12" rx="2.4"/><path d="M6.5 10h1.2M9.5 10h1.2M12.5 10h1.2M15.5 10h1.2M6.5 14h11"/>',
    scissors:
      '<circle cx="6.5" cy="7" r="2.2"/><circle cx="6.5" cy="17" r="2.2"/><path d="M8.4 8.5 20 16.5M8.4 15.5 20 7.5"/>',
    rj45:
      '<path d="M4 9.5h11.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4z"/><path d="M17.5 12h2.5M4 12.5v3M7 9.5v-2h5v2"/>',
    cable:
      '<path d="M3 12h5.5c1.6 0 1.6-3 3.2-3s1.6 3 3.2 3S16.5 9 18 9h3"/><path d="M3 15h6c1.6 0 1.6-3 3.2-3"/>',
    check: '<path d="M4.5 12.5 9 17l10.5-10.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>',
    download: '<path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H5.5A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15"/>',
    print: '<path d="M7 9V4h10v5M7 18H5.5A1.5 1.5 0 0 1 4 16.5v-5A1.5 1.5 0 0 1 5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 18.5 18H17"/><rect x="7" y="14" width="10" height="6" rx="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.6"/>',
    warn: '<path d="M12 4.5 21 20H3z"/><path d="M12 10v4.5M12 17.2v.6"/>',
    eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
    arrowRight: '<path d="M5 12h13m0 0-5-5m5 5-5 5"/>',
    arrowLeft: '<path d="M19 12H6m0 0 5-5m-5 5 5 5"/>',
    arrowUp: '<path d="M12 19V6m0 0-5 5m5-5 5 5"/>',
    arrowDown: '<path d="M12 5v13m0 0 5-5m-5 5-5-5"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6zM12 17v4"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    brand:
      '<path d="M3 12h4.5c2 0 2-4 4-4s2 4 4 4 2-4 4-4H21" stroke-width="1.9"/><circle cx="3.4" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="20.6" cy="8" r="1.1" fill="currentColor" stroke="none"/>',
    hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.8V16h7v-2.2A6 6 0 0 0 12 3z"/>',
    mode: '<path d="M4 7h6l3 5-3 5H4M20 7h-6l-3 5 3 5h6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.3"/><path d="M12 17.2v.5"/>'
  };

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.info;
    return (
      '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body +
      '</svg>'
    );
  }

  /* ---------- Иконки устройств ------------------------------------------- */
  function deviceArt(kind) {
    if (kind === 'pc') {
      return (
        '<svg viewBox="0 0 72 56" role="img" aria-label="Компьютер">' +
        '<rect x="6" y="8" width="60" height="34" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>' +
        '<rect x="11" y="13" width="50" height="24" rx="2" fill="#93c5fd" opacity="0.55"/>' +
        '<path d="M30 42v6h12v-6M24 50h24" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>'
      );
    }
    return (
      '<svg viewBox="0 0 72 56" role="img" aria-label="Маршрутизатор">' +
      '<rect x="5" y="24" width="62" height="22" rx="4" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>' +
      '<path d="M18 24V12M54 24V12M18 12h0M54 12h0" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M30 24v-9M42 24v-9" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="18" cy="35" r="2.4" fill="#94a3b8"/><circle cx="27" cy="35" r="2.4" fill="#94a3b8"/>' +
      '<circle cx="36" cy="35" r="2.4" fill="#94a3b8"/><circle cx="45" cy="35" r="2.4" fill="#94a3b8"/>' +
      '</svg>'
    );
  }

  function socketArt() {
    return (
      '<svg viewBox="0 0 34 26" aria-hidden="true">' +
      '<rect x="1" y="4" width="30" height="18" rx="3" fill="#0f172a" stroke="#64748b" stroke-width="1.4"/>' +
      '<rect x="6" y="9" width="20" height="8" rx="1.5" fill="#1e293b" stroke="#475569" stroke-width="1"/>' +
      '<path d="M9 11v4M12 11v4M15 11v4M18 11v4M21 11v4" stroke="#94a3b8" stroke-width="1"/>' +
      '</svg>'
    );
  }

  /* ---------- Стриппер: общий инструмент обоих тренажёров ---------------- */
  function stripperArt() {
    return (
      '<svg viewBox="0 0 240 150" role="img" aria-label="Стриппер (съёмник изоляции)">' +
      '<defs><linearGradient id="gripBlue" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/></linearGradient>' +
      '<linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f1f5f9"/><stop offset="0.5" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/>' +
      '</linearGradient></defs>' +
      // рукоятки
      '<path d="M18 126c-4-6 6-11 12-3l26 37" stroke="url(#gripBlue)" stroke-width="15" stroke-linecap="round" fill="none" transform="translate(0,-42)"/>' +
      '<path d="M18 24c-4 6 6 11 12 3l26-37" stroke="url(#gripBlue)" stroke-width="15" stroke-linecap="round" fill="none" transform="translate(0,42)"/>' +
      // корпус
      '<path d="M64 52c14-4 30-2 44 8l24 18-14 14-24-16c-14-9-28-11-40-9z" fill="url(#steel)" stroke="#64748b" stroke-width="1.6"/>' +
      '<path d="M64 98c14 4 30 2 44-8l24-18-14-14-24 16c-14 9-28 11-40 9z" fill="url(#steel)" stroke="#64748b" stroke-width="1.6"/>' +
      // канал под кабель
      '<circle cx="146" cy="75" r="5.5" fill="#e2e8f0" stroke="#64748b" stroke-width="1.4"/>' +
      // регулировочный винт
      '<circle cx="86" cy="75" r="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.4"/>' +
      '<path d="M86 70.5v9M81.5 75h9" stroke="#94a3b8" stroke-width="1.2"/>' +
      // губки
      '<path d="M172 58c10 2 18 8 22 17h-24z" fill="#94a3b8" stroke="#64748b" stroke-width="1.2"/>' +
      '<path d="M172 92c10-2 18-8 22-17h-24z" fill="#94a3b8" stroke="#64748b" stroke-width="1.2"/>' +
      '</svg>'
    );
  }


  /* ---------- Схема жил -------------------------------------------------- */
  function schemeHTML(stdId, opts) {
    const o = opts || {};
    const std = (global.APP_DATA && global.APP_DATA.STANDARDS[stdId]) || null;
    if (!std) return '';
    let s = '<div class="scheme__card">';
    s += '<div class="scheme__title">' + std.title + (o.caption ? ' <span class="muted">— ' + esc(o.caption) + '</span>' : '') + '</div>';
    s += '<div class="scheme__lanes">';
    std.order.forEach((id, i) => {
      s += '<div class="scheme__lane">' + wireHTML(id) + '<b>' + (i + 1) + '</b></div>';
    });
    s += '</div></div>';
    return s;
  }

  function schemePairHTML(a, b) {
    return '<div class="scheme">' + schemeHTML(a) + schemeHTML(b) + '</div>';
  }

  /* ---------- Кольцо оценки ---------------------------------------------- */
  function ringSVG(percent) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    return (
      '<div class="ring">' +
      '<svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">' +
      '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>' +
      '<circle class="ring__track" cx="64" cy="64" r="' + r + '"/>' +
      '<circle class="ring__value" cx="64" cy="64" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg>' +
      '<div class="ring__center"><div class="ring__num" data-ring-num>0</div><div class="ring__of">из 100</div></div>' +
      '</div>'
    );
  }

  /** Добавить иконки конкретного тренажёра (id → svg-тело) */
  function register(extra) {
    Object.keys(extra || {}).forEach((k) => {
      ICONS[k] = extra[k];
    });
  }

  global.AppIcons = {
    register,
    stripperArt,
    esc,
    icon,
    wireClass,
    wireHTML,
    schemeHTML,
    schemePairHTML,
    deviceArt,
    socketArt,
    ringSVG,
    ICONS
  };
})(window);
