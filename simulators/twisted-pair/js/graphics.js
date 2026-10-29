/* ==========================================================================
   graphics.js — иллюстрации тренажёра «Обжим витой пары»: стриппер, кримпер,
   коннектор RJ-45 (вид сверху и спереди). Общие иконки, жилы и схемы
   приходят из shared/js/icons.js, поэтому APP_GFX — их объединение.
   ========================================================================== */
(function (global) {
  'use strict';

  const I = global.AppIcons;

  function wires() {
    return (global.APP_DATA && global.APP_DATA.WIRES) || {};
  }

  /* ---------- Большие иллюстрации инструментов --------------------------- */
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
    return '<div style="display:grid;place-items:center;width:100%;height:100%">' + I.icon(id) + '</div>';
  }

  /* ---------- Коннектор RJ-45 (вид сверху) -------------------------------- */
  // depth: 0..100 — насколько жилы продвинуты в каналы
  // order: массив id жил по позициям 1..8 (null — пусто)
  function rjSVG(opts) {
    const W = wires();
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

  global.APP_GFX = Object.assign({}, I, {
    crimperArt,
    toolArt,
    rjSVG,
    rjFrontSVG
  });
})(window);
