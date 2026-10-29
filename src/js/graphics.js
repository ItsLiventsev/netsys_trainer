/* ==========================================================================
   graphics.js — вся графика: иконки, инструменты, коннектор RJ-45, схема жил.
   Только SVG и CSS, никаких внешних картинок.
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.APP_DATA;
  const W = D.WIRES;

  /* ---------- Утилиты ----------------------------------------------------- */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function wireClass(id, extra) {
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

  /* ---------- Большие иллюстрации инструментов --------------------------- */
  // Стриппер: рукоятки + губки с каналом под кабель
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

  // Кримпер: две рукоятки, губки с гнездом RJ-45, храповик
  function crimperArt() {
    return (
      '<svg viewBox="0 0 260 170" role="img" aria-label="Кримпер (обжимной инструмент)">' +
      '<defs><linearGradient id="gripDark" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>' +
      '<linearGradient id="steel2" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#eef2f7"/><stop offset="0.55" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/>' +
      '</linearGradient></defs>' +
      '<g class="crimper__jaw-top">' +
      '<path d="M22 12c16 4 30 12 44 22" stroke="url(#gripDark)" stroke-width="17" stroke-linecap="round" fill="none"/>' +
      '<path d="M62 30c12 6 26 10 40 12l30 4v20l-32-4c-16-2-30-6-42-12z" fill="url(#steel2)" stroke="#64748b" stroke-width="1.6"/>' +
      '<path d="M104 46h16M104 52h16M104 58h16" stroke="#94a3b8" stroke-width="1.3"/>' +
      '</g>' +
      '<g class="crimper__jaw-bottom">' +
      '<path d="M22 158c16-4 30-12 44-22" stroke="url(#gripDark)" stroke-width="17" stroke-linecap="round" fill="none"/>' +
      '<path d="M62 140c12-6 26-10 40-12l30-4v-20l-32 4c-16 2-30 6-42 12z" fill="url(#steel2)" stroke="#64748b" stroke-width="1.6"/>' +
      '</g>' +
      // гнездо RJ-45 между губками
      '<rect x="128" y="66" width="34" height="38" rx="4" fill="#1e293b" opacity="0.14"/>' +
      '<path d="M132 70h26v6h-26zM132 94h26v6h-26z" fill="#475569" opacity="0.5"/>' +
      // ось
      '<circle cx="72" cy="85" r="7" fill="#e2e8f0" stroke="#64748b" stroke-width="1.6"/>' +
      '<circle cx="72" cy="85" r="2.4" fill="#94a3b8"/>' +
      // храповик
      '<path d="M150 74c10 2 16 6 20 11s-6 11-20 11" fill="none" stroke="#94a3b8" stroke-width="2.4" stroke-dasharray="4 4"/>' +
      '</svg>'
    );
  }

  function toolArt(id) {
    if (id === 'stripper') return stripperArt();
    if (id === 'crimper') return crimperArt();
    return '<div style="display:grid;place-items:center;width:100%;height:100%">' + icon(id, 'icon') + '</div>';
  }

  /* ---------- Коннектор RJ-45 (вид сверху) -------------------------------- */
  // depth: 0..100 — насколько жилы продвинуты в каналы
  // order: массив id жил по позициям 1..8 (null — пусто)
  function rjSVG(opts) {
    const o = opts || {};
    const order = o.order || [];
    const depth = Math.max(0, Math.min(100, o.depth || 0));
    const crimped = !!o.crimped;
    const jacketClamped = o.jacketClamped !== false;
    const laneY = (i) => 44 + i * 9.2; // 8 дорожек
    const tipX = 336 - (depth / 100) * 236; // 336 → 100
    const jacketFront = jacketClamped ? 302 : 340;

    let s = '';
    s += '<svg viewBox="0 0 440 150" role="img" aria-label="Коннектор RJ-45, вид сверху: ' +
      (depth >= 98 ? 'жилы дошли до конца каналов' : 'жилы вставлены на ' + Math.round(depth) + '%') + '">';

    // защёлка
    s += '<path class="rj__latch" d="M176 34 L186 12 L258 12 L268 34 Z" fill="#dbe3ec" stroke="#8fa3b8" stroke-width="1.6" stroke-linejoin="round"/>';
    s += '<path d="M192 21h60" stroke="#b3c2d1" stroke-width="1.4"/>';

    // жилы внутри коннектора
    for (let i = 0; i < 8; i++) {
      const id = order[i];
      const y = laneY(i) - 3.5;
      if (!id) {
        // пустой канал
        s += '<rect x="' + tipX + '" y="' + y + '" width="' + (432 - tipX) + '" height="7" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.8"/>';
        continue;
      }
      const w = W[id];
      const color = { orange: '#f97316', green: '#16a34a', blue: '#2563eb', brown: '#92400e' }[w.color];
      if (w.striped) {
        s += '<rect x="' + tipX + '" y="' + y + '" width="' + (432 - tipX) + '" height="7" rx="3" fill="url(#stripe-' + w.color + ')" stroke="' + color + '" stroke-opacity="0.4" stroke-width="0.6"/>';
      } else {
        s += '<rect x="' + tipX + '" y="' + y + '" width="' + (432 - tipX) + '" height="7" rx="3" fill="' + color + '"/>';
        s += '<rect x="' + tipX + '" y="' + y + '" width="' + (432 - tipX) + '" height="3" rx="1.5" fill="#fff" fill-opacity="0.22"/>';
      }
    }

    // оболочка кабеля, входящая в коннектор
    s += '<rect x="' + jacketFront + '" y="35" width="120" height="80" rx="7" fill="#0e7490"/>';
    s += '<rect x="' + jacketFront + '" y="35" width="120" height="14" rx="7" fill="#22a7c4" fill-opacity="0.55"/>';
    s += '<rect x="' + (jacketFront + 1) + '" y="39" width="6" height="72" rx="3" fill="#0b5f78"/>';

    // корпус коннектора
    s += '<rect class="rj__body" x="72" y="28" width="264" height="94" rx="9" fill="#dbe3ec" fill-opacity="0.55" stroke="#8fa3b8" stroke-width="2"/>';
    s += '<rect x="72" y="28" width="16" height="94" rx="8" fill="#c3d0dd" fill-opacity="0.7"/>';
    // каналы
    for (let i = 0; i < 8; i++) {
      s += '<line x1="' + tipX + '" y1="' + (laneY(i) + 3.6) + '" x2="336" y2="' + (laneY(i) + 3.6) + '" stroke="#94a3b8" stroke-width="0.7" stroke-opacity="0.5"/>';
    }
    // конец каналов
    s += '<line x1="100" y1="34" x2="100" y2="116" stroke="#ef4444" stroke-width="1.4" stroke-dasharray="4 3" stroke-opacity="0.6"/>';
    // контакты
    for (let i = 0; i < 8; i++) {
      const y = laneY(i) - 3;
      s += '<rect x="80" y="' + y + '" width="16" height="6" rx="1.2" fill="' + (crimped ? '#b45309' : '#d4a017') + '" stroke="#8a6608" stroke-width="0.6"/>';
      if (crimped) {
        s += '<rect x="80" y="' + (y + 1.6) + '" width="16" height="2.2" rx="1" fill="#92400e" fill-opacity="0.5"/>';
      }
    }
    // зажим оболочки
    s += '<rect x="292" y="40" width="40" height="70" rx="4" fill="none" stroke="' +
      (jacketClamped ? '#16a34a' : '#dc2626') + '" stroke-width="1.6" stroke-dasharray="5 3" stroke-opacity="0.85"/>';
    s += '<text x="312" y="126" text-anchor="middle" font-size="9.5" font-family="system-ui,sans-serif" fill="' +
      (jacketClamped ? '#15803d' : '#b91c1c') + '">зажим</text>';
    s += '<text x="92" y="24" font-size="9.5" font-family="system-ui,sans-serif" fill="#64748b">контакты</text>';
    s += '<text x="150" y="140" font-size="9.5" font-family="system-ui,sans-serif" fill="#64748b">' +
      (depth >= 98 ? 'жилы дошли до конца каналов ✓' : 'глубина вставки: ' + Math.round(depth) + '%') + '</text>';

    s += '<defs>' +
      '<pattern id="stripe-orange" width="9" height="7" patternUnits="userSpaceOnUse">' +
      '<rect width="9" height="7" fill="#fff8f1"/><rect y="0" width="9" height="3.4" fill="#f97316"/></pattern>' +
      '<pattern id="stripe-green" width="9" height="7" patternUnits="userSpaceOnUse">' +
      '<rect width="9" height="7" fill="#f4fdf6"/><rect y="0" width="9" height="3.4" fill="#16a34a"/></pattern>' +
      '<pattern id="stripe-blue" width="9" height="7" patternUnits="userSpaceOnUse">' +
      '<rect width="9" height="7" fill="#f5f8ff"/><rect y="0" width="9" height="3.4" fill="#2563eb"/></pattern>' +
      '<pattern id="stripe-brown" width="9" height="7" patternUnits="userSpaceOnUse">' +
      '<rect width="9" height="7" fill="#fdf8f3"/><rect y="0" width="9" height="3.4" fill="#92400e"/></pattern>' +
      '</defs>';
    s += '</svg>';
    return s;
  }

  /* ---------- Коннектор RJ-45 (вид спереди, для осмотра) ------------------ */
  function rjFrontSVG(status) {
    // status: массив 8 значений 'ok' | 'warn' | 'bad'
    const st = status || new Array(8).fill('ok');
    let s = '<svg viewBox="0 0 300 132" role="img" aria-label="Коннектор RJ-45, вид спереди">';
    s += '<rect x="36" y="26" width="228" height="88" rx="10" fill="#dbe3ec" stroke="#8fa3b8" stroke-width="2"/>';
    s += '<rect x="52" y="12" width="196" height="20" rx="6" fill="#cbd5e1" stroke="#8fa3b8" stroke-width="1.6"/>';
    for (let i = 0; i < 8; i++) {
      const x = 58 + i * 24;
      const state = st[i] || 'ok';
      const fill = state === 'ok' ? '#d4a017' : state === 'warn' ? '#f59e0b' : '#64748b';
      const y = state === 'ok' ? 40 : 47;
      const h = state === 'ok' ? 26 : 19;
      s += '<rect x="' + x + '" y="' + y + '" width="14" height="' + h + '" rx="2" fill="' + fill + '" stroke="#8a6608" stroke-width="0.8"/>';
      s += '<text x="' + (x + 7) + '" y="86" text-anchor="middle" font-size="10" font-family="ui-monospace,monospace" fill="#64748b">' + (i + 1) + '</text>';
      if (state !== 'ok') {
        s += '<text x="' + (x + 7) + '" y="104" text-anchor="middle" font-size="9" font-family="system-ui,sans-serif" fill="' + (state === 'bad' ? '#b91c1c' : '#b45309') + '">' + (state === 'bad' ? 'нет' : 'просел') + '</text>';
      }
    }
    s += '</svg>';
    return s;
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

  /* ---------- Схема жил -------------------------------------------------- */
  function schemeHTML(stdId, opts) {
    const o = opts || {};
    const std = D.STANDARDS[stdId];
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

  global.APP_GFX = {
    icon,
    wireHTML,
    wireClass,
    toolArt,
    stripperArt,
    crimperArt,
    rjSVG,
    rjFrontSVG,
    deviceArt,
    socketArt,
    schemeHTML,
    schemePairHTML,
    ringSVG,
    esc
  };
})(window);
