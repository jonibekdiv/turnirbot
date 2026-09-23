// ============================================================
// CARD KEYBOARD — Ko'p tilli
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK } = require('../constants');
const langService = require('../services/langService');

function getT(ctx) {
  if (ctx?.t) return ctx.t;
  const lang = ctx?.state?.lang || langService.DEFAULT_LANG;
  return (key, vars) => langService.t(lang, key, vars);
}

// ============================================================
// KARTALAR PANELI
// ============================================================
function cardsPanelKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('card_add_btn'), CALLBACK.CARD_ADD)],
    [Markup.button.callback(t('card_list_btn'), CALLBACK.CARD_LIST)],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// KARTA TURINI TANLASH
// ============================================================
function cardTypeKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💳 UzCard', CALLBACK.CARD_TYPE + 'uzcard'),
      Markup.button.callback('💳 Humo', CALLBACK.CARD_TYPE + 'humo'),
    ],
    [
      Markup.button.callback('💳 Visa', CALLBACK.CARD_TYPE + 'visa'),
      Markup.button.callback('💳 MasterCard', CALLBACK.CARD_TYPE + 'mastercard'),
    ],
    [
      Markup.button.callback('💳 UnionPay', CALLBACK.CARD_TYPE + 'unionpay'),
      Markup.button.callback('💳 ' + t('card_other_type'), CALLBACK.CARD_TYPE + 'other'),
    ],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.CARD_LIST)],
  ]);
}

// ============================================================
// KARTA TASDIQLASH
// ============================================================
function cardConfirmKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_confirm'), 'card:confirm')],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CARDS)],
  ]);
}

// ============================================================
// KARTA KO'RISH
// ============================================================
function cardViewKeyboard(ctx, cardId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('card_set_default'), CALLBACK.CARD_SET_DEFAULT + cardId)],
    [Markup.button.callback(t('btn_delete'), CALLBACK.CARD_DELETE + cardId)],
    [Markup.button.callback(t('card_list_btn'), CALLBACK.CARD_LIST)],
  ]);
}

// ============================================================
// KARTANI O'CHIRISH TASDIQLASH
// ============================================================
function cardDeleteConfirmKeyboard(ctx, cardId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_delete') + ' ✅', CALLBACK.CARD_DELETE_CONFIRM + cardId)],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.CARD_VIEW + cardId)],
  ]);
}

// ============================================================
// TURNIRDA KARTA TANLASH
// ============================================================
function pickCardKeyboard(ctx, cards) {
  const t = getT(ctx);

  const rows = [];

  cards.slice(0, 8).forEach((card) => {
    const label = card.isDefault
      ? `⭐ ${card.owner} — ${card.number}`
      : `${card.owner} — ${card.number}`;
    rows.push([
      Markup.button.callback(label.slice(0, 60), CALLBACK.TOUR_PICK_CARD + card.id),
    ]);
  });

  rows.push([
    Markup.button.callback('✏️ ' + t('card_manual_input'), CALLBACK.TOUR_CARD_MANUAL),
  ]);
  rows.push([
    Markup.button.callback('➕ ' + t('card_add_btn'), CALLBACK.CARD_ADD),
  ]);
  rows.push([Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

module.exports = {
  cardsPanelKeyboard,
  cardTypeKeyboard,
  cardConfirmKeyboard,
  cardViewKeyboard,
  cardDeleteConfirmKeyboard,
  pickCardKeyboard,
};