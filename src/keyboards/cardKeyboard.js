// ============================================================
// CARD KEYBOARD — Kartalar uchun tugmalar
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK, CARD_TYPES } = require('../constants');

// ============================================================
// KARTALAR PANELI
// ============================================================
function cardsPanelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Yangi karta qo\'shish', CALLBACK.CARD_ADD)],
    [Markup.button.callback('📋 Kartalar ro\'yxati', CALLBACK.CARD_LIST)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// KARTA TURINI TANLASH
// ============================================================
function cardTypeKeyboard() {
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
      Markup.button.callback('💳 Boshqa', CALLBACK.CARD_TYPE + 'other'),
    ],
    [Markup.button.callback('❌ Bekor qilish', CALLBACK.CARD_LIST)],
  ]);
}

// ============================================================
// KARTA TASDIQLASH
// ============================================================
function cardConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Tasdiqlash', 'card:confirm')],
    [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CARDS)],
  ]);
}

// ============================================================
// KARTA KO'RISH
// ============================================================
function cardViewKeyboard(cardId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⭐ Default qilish', CALLBACK.CARD_SET_DEFAULT + cardId)],
    [Markup.button.callback('🗑 O\'chirish', CALLBACK.CARD_DELETE + cardId)],
    [Markup.button.callback('⬅️ Kartalar', CALLBACK.CARD_LIST)],
  ]);
}

// ============================================================
// KARTANI O'CHIRISH TASDIQLASH
// ============================================================
function cardDeleteConfirmKeyboard(cardId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🗑 Ha, o\'chirish', CALLBACK.CARD_DELETE_CONFIRM + cardId)],
    [Markup.button.callback('❌ Bekor qilish', CALLBACK.CARD_VIEW + cardId)],
  ]);
}

// ============================================================
// TURNIRDA KARTA TANLASH
// ============================================================
function pickCardKeyboard(cards) {
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
    Markup.button.callback('✏️ Qo\'lda kiritish', CALLBACK.TOUR_CARD_MANUAL),
  ]);
  rows.push([
    Markup.button.callback('➕ Yangi karta qo\'shish', CALLBACK.CARD_ADD),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)]);

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