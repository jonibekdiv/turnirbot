// ============================================================
// PAYMENT KEYBOARD — Ko'p tilli
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
// TURNIR TURI TANLASH
// ============================================================
function tournamentTypeKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('tour_type_free'), CALLBACK.TOUR_TYPE_FREE)],
    [Markup.button.callback(t('tour_type_paid'), CALLBACK.TOUR_TYPE_PAID)],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_CANCEL)],
  ]);
}

// ============================================================
// VALYUTA TANLASH
// ============================================================
function currencyKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('UZS 🇺🇿', CALLBACK.TOUR_CURRENCY_SET + 'UZS'),
      Markup.button.callback('USD 🇺🇸', CALLBACK.TOUR_CURRENCY_SET + 'USD'),
    ],
    [
      Markup.button.callback('RUB 🇷🇺', CALLBACK.TOUR_CURRENCY_SET + 'RUB'),
      Markup.button.callback('EUR 🇪🇺', CALLBACK.TOUR_CURRENCY_SET + 'EUR'),
    ],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_CANCEL)],
  ]);
}

// ============================================================
// KANAL TANLASH
// ============================================================
function channelsPickerKeyboard(ctx, channels, selected = []) {
  const t = getT(ctx);

  const rows = [];
  channels.slice(0, 20).forEach((ch) => {
    const isSelected = selected.includes(ch.id);
    const icon = isSelected ? '✅' : '⬜';
    rows.push([
      Markup.button.callback(
        `${icon} ${ch.title.slice(0, 40)}`,
        CALLBACK.TOUR_CH_PICK + ch.id
      ),
    ]);
  });
  rows.push([Markup.button.callback('✅ ' + t('btn_confirm'), CALLBACK.TOUR_CH_DONE)]);
  rows.push([Markup.button.callback('⏭ ' + t('host_skip'), CALLBACK.TOUR_CH_SKIP)]);
  rows.push([Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_CANCEL)]);
  return Markup.inlineKeyboard(rows);
}

// ============================================================
// OBUNA TEKSHIRISH
// ============================================================
function subscriptionKeyboard(ctx, tournamentId, channels) {
  const t = getT(ctx);

  const rows = [];
  channels.forEach((ch, i) => {
    const link = ch.inviteLink || ch.channelUsername || ch.username;
    if (link) {
      const url = link.startsWith('http')
        ? link
        : `https://t.me/${link.replace('@', '')}`;
      rows.push([
        Markup.button.url(
          `${i + 1}. ${ch.channelTitle || ch.title || t('ch_list_title')}`,
          url
        ),
      ]);
    }
  });
  rows.push([
    Markup.button.callback(t('subscription_check'), CALLBACK.CH_VERIFY_ALL + tournamentId),
  ]);
  rows.push([
    Markup.button.callback(t('btn_back'), CALLBACK.TOUR_OPEN + tournamentId),
  ]);
  return Markup.inlineKeyboard(rows);
}

// ============================================================
// TO'LOV TUGMALARI
// ============================================================
function paymentKeyboard(ctx, tournamentId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('payment_send_receipt'), CALLBACK.PAY_SEND_RECEIPT + tournamentId)],
    [Markup.button.callback(t('btn_back'), CALLBACK.TOUR_OPEN + tournamentId)],
  ]);
}

// ============================================================
// ORGANIZER UCHUN TO'LOV TASDIQLASH
// ============================================================
function paymentReviewKeyboard(ctx, paymentId, tournamentId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t('btn_confirm'), CALLBACK.PAY_APPROVE + paymentId),
      Markup.button.callback(t('btn_cancel'), CALLBACK.PAY_REJECT + paymentId),
    ],
    [
      Markup.button.callback(t('team_members'), CALLBACK.PAY_TEAM_INFO + paymentId),
    ],
    [
      Markup.button.callback(t('admin_tournaments'), CALLBACK.PAY_TOUR_INFO + tournamentId),
    ],
  ]);
}

// ============================================================
// RAD ETILGANDAN KEYIN
// ============================================================
function rejectedPaymentKeyboard(ctx, paymentId, tournamentId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_retry'), CALLBACK.PAY_RESEND + paymentId)],
    [Markup.button.callback(t('btn_back_tournament'), CALLBACK.TOUR_OPEN + tournamentId)],
  ]);
}

module.exports = {
  tournamentTypeKeyboard,
  currencyKeyboard,
  channelsPickerKeyboard,
  subscriptionKeyboard,
  paymentKeyboard,
  paymentReviewKeyboard,
  rejectedPaymentKeyboard,
};