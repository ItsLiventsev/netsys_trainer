/* ==========================================================================
   graphics.js — графика тренажёра «Монтаж сетевых розеток»:
   иконки инструментов, заделочный нож, модуль keystone с контактами IDC,
   корпус розетки с рамкой и винтами.
   ========================================================================== */
(function (global) {
  'use strict';

  const I = global.AppIcons;
  const esc = global.AppCore.esc;

  /* ---------- Иконки инструментов --------------------------------------- */
  I.register({
    punchdown:
      '<path d="M12 3v9" stroke-width="2.6"/><path d="M9.6 3h4.8"/><path d="M7.5 12h9l1.5 4.5h-12z"/><path d="M10 16.5 8 21h8l-2-4.5"/>',
    keystone:
      '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M7.5 9h9M7.5 12h9M7.5 15h9"/>',
    socket:
      '<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="8" y="8.5" width="8" height="7" rx="1.4"/><path d="M10 11.5v1M12 11.5v1M14 11.5v1"/>',
    tie:
      '<path d="M4 9.5h9a4 4 0 0 1 0 8H4"/><path d="M4 13.5h9"/><rect x="15" y="10" width="5" height="7" rx="1.2"/>',
    screwdriver:
      '<path d="M4 20l5-5"/><path d="M9.5 14.5 16 8l3 3-6.5 6.5z"/><path d="M16.5 4.5 19.5 7.5"/>'
  });

  /* ---------- Заделочный нож -------------------------------------------- */
  function punchToolArt() {
    return (
      '<svg viewBox="0 0 220 150" role="img" aria-label="Заделочный нож (punch-down)">' +
      '<defs><linearGradient id="punchGrip" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/></linearGradient>' +
      '<linearGradient id="punchSteel" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f1f5f9"/><stop offset="0.6" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/>' +
      '</linearGradient></defs>' +
      // рукоятка
      '<rect x="86" y="16" width="48" height="72" rx="16" fill="url(#punchGrip)" stroke="#1d4ed8" stroke-width="1.4"/>' +
      '<rect x="98" y="28" width="24" height="10" rx="5" fill="#dbeafe" opacity="0.75"/>' +
      '<rect x="98" y="46" width="24" height="10" rx="5" fill="#dbeafe" opacity="0.45"/>' +
      // корпус
      '<rect x="92" y="88" width="36" height="22" rx="4" fill="url(#punchSteel)" stroke="#64748b" stroke-width="1.4"/>' +
      // лезвие
      '<path d="M104 110h12l3 26h-18z" fill="url(#punchSteel)" stroke="#64748b" stroke-width="1.4"/>' +
      '<path d="M107 136h6l-3 8z" fill="#94a3b8"/>' +
      // боковой крючок-срезатель
      '<path d="M128 96h14a4 4 0 0 1 0 8h-14z" fill="#cbd5e1" stroke="#64748b" stroke-width="1.2"/>' +
      '<path d="M134 100h8" stroke="#64748b" stroke-width="1.2"/>' +
      '</svg>'
    );
  }

  /* ---------- Модуль keystone ------------------------------------------- */
  // opts: { assigned: {contactIdx: wireId}, punched: {contactIdx: true},
  //         focusIdx, dropAttrs: bool, showHint }
  function keystoneHTML(opts) {
    const o = opts || {};
    const D = global.APP_DATA;
    const assigned = o.assigned || {};
    const punched = o.punched || {};
    const W = D.WIRES;

    function term(contact) {
      const wireId = assigned[contact.idx];
      const isPunched = !!punched[contact.idx];
      const w = wireId ? W[wireId] : null;
      const classes = ['kterm', 'kterm--c' + contact.col];
      if (wireId) classes.push('is-filled');
      if (isPunched) classes.push('is-punched');
      if (o.focusIdx === contact.idx) classes.push('is-focus');

      const slot = w
        ? '<span class="kterm__slot">' +
          '<span class="wire wire--' + w.color + (w.striped ? '' : ' wire--solid') + ' kterm__wire"></span>' +
          (isPunched ? '' : '<span class="kterm__tail" aria-hidden="true"></span>') +
          '</span>'
        : '<span class="kterm__slot kterm__slot--empty" aria-hidden="true"></span>';

      return (
        '<button type="button" class="' + classes.join(' ') + '" data-contact="' + contact.idx + '"' +
        ' data-drop="contact" data-focus-key="contact-' + contact.idx + '"' +
        ' aria-label="Контакт ' + contact.pin + ', маркировка ' + W[contact.wire].abbr + ': ' +
        (w ? 'жила ' + w.abbr + (isPunched ? ', заделана' : ', не заделана') : 'пусто') + '">' +
        '<span class="kterm__mark"><span class="kterm__dot kterm__dot--' + W[contact.wire].color +
        (W[contact.wire].striped ? ' kterm__dot--striped' : '') + '"></span>' +
        '<span class="kterm__abbr">' + W[contact.wire].abbr + '</span>' +
        '<span class="kterm__pin">' + contact.pin + '</span></span>' +
        slot +
        '</button>'
      );
    }

    let rows = '';
    D.MODULE_ROWS.forEach((row, r) => {
      rows +=
        '<div class="kmod__row" role="group" aria-label="Ряд ' + (r + 1) + '">' +
        D.MODULE_CONTACTS.filter((c) => c.row === r)
          .map(term)
          .join('') +
        '</div>';
    });

    return (
      '<div class="kmod" id="kmod">' +
      '<div class="kmod__head"><span class="kmod__title">Модуль keystone</span>' +
      '<span class="kmod__tag">маркировка B</span></div>' +
      '<div class="kmod__body">' +
      '<div class="kmod__rows">' + rows + '</div>' +
      '<div class="kmod__port" aria-hidden="true"><span>RJ-45</span></div>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------- Корпус розетки -------------------------------------------- */
  // opts: { tie, module, screws: [bool, bool] }
  function housingHTML(opts) {
    const o = opts || {};
    const screws = o.screws || [false, false];
    const screw = (i) =>
      '<button type="button" class="screw' + (screws[i] ? ' is-tight' : '') + '" data-screw="' + i + '"' +
      ' data-focus-key="screw-' + i + '" aria-label="Винт рамки ' + (i + 1) + (screws[i] ? ', затянут' : ', не затянут') + '">' +
      '<span class="screw__slot" aria-hidden="true"></span>' +
      '</button>';

    return (
      '<div class="housing' + (o.module ? ' has-module' : '') + (o.tie ? ' has-tie' : '') + '" id="housing">' +
      '<div class="housing__plate">' +
      '<div class="housing__port' + (o.module ? ' is-filled' : '') + '">' +
      (o.module
        ? '<span class="housing__rj" aria-hidden="true">' +
          '<span class="housing__rj-pins"></span></span>'
        : '<span class="housing__empty">модуль<br>не установлен</span>') +
      '</div>' +
      '<div class="housing__brand">UTP · T568B</div>' +
      '</div>' +
      '<div class="housing__frame">' +
      screw(0) +
      '<div class="housing__frame-hole" aria-hidden="true"></div>' +
      screw(1) +
      '</div>' +
      '<div class="housing__cable' + (o.tie ? ' is-tied' : '') + '" aria-hidden="true">' +
      '<span class="housing__jacket"></span>' +
      '<span class="housing__tie">' + (o.tie ? 'стяжка затянута' : '') + '</span>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------- Карточка для палитры набора ------------------------------- */
  function kitHTML(item, selected, state) {
    const cls = ['kit-card'];
    if (selected) cls.push('is-selected');
    if (state === 'right') cls.push('is-right');
    if (state === 'wrong') cls.push('is-wrong');
    if (state === 'missed') cls.push('is-missed');
    return (
      '<button type="button" class="' + cls.join(' ') + '" data-kit="' + item.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
      '<span class="kit-card__icon" aria-hidden="true">' + I.icon(item.id) + '</span>' +
      '<span class="kit-card__name">' + esc(item.name) + '</span>' +
      '<span class="kit-card__mark" aria-hidden="true"></span>' +
      '</button>'
    );
  }

  global.APP_GFX = Object.assign({}, I, {
    punchToolArt,
    keystoneHTML,
    housingHTML,
    kitHTML
  });
})(window);
