// ============================================================
// PAYMENT KEYBOARD — To'lov tugmalari
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK } = require('../constants');

// ============================================================
// TURNIR TURI TANLASH
// ============================================================
function tournamentTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🆓 Bepul turnir', CALLBACK.TOUR_TYPE_FREE)],
    [Markup.button.callback('💳 Pullik turnir', CALLBACK.TOUR_TYPE_PAID)],
    [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
  ]);
}

// ============================================================
// VALYUTA TANLASH
// ============================================================
function currencyKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('UZS 🇺🇿', CALLBACK.TOUR_CURRENCY_SET + 'UZS'),
      Markup.button.callback('USD 🇺🇸', CALLBACK.TOUR_CURRENCY_SET + 'USD'),
    ],
    [
      Markup.button.callback('RUB 🇷🇺', CALLBACK.TOUR_CURRENCY_SET + 'RUB'),
      Markup.button.callback('EUR 🇪🇺', CALLBACK.TOUR_CURRENCY_SET + 'EUR'),
    ],
    [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
  ]);
}

// ============================================================
// KANAL TANLASH (bepul turnir uchun)
// ============================================================
function channelsPickerKeyboard(channels, selected = []) {
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
  rows.push([Markup.button.callback('✅ Tayyor', CALLBACK.TOUR_CH_DONE)]);
  rows.push([Markup.button.callback('⏭ Kanalsiz davom etish', CALLBACK.TOUR_CH_SKIP)]);
  rows.push([Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)]);
  return Markup.inlineKeyboard(rows);
}

// ============================================================
// OBUNA TEKSHIRISH (foydalanuvchi uchun)
// ============================================================
function subscriptionKeyboard(tournamentId, channels) {
  const rows = [];
  channels.forEach((ch, i) => {
    const link = ch.inviteLink || ch.channelUsername || ch.username;
    if (link) {
      const url = link.startsWith('http') ? link : `https://t.me/${link.replace('@', '')}`;
      rows.push([
        Markup.button.url(
          `${i + 1}. ${ch.channelTitle || ch.title || 'Kanal'}`,
          url
        ),
      ]);
    }
  });
  rows.push([
    Markup.button.callback(
      '✅ Obunani tekshirish',
      CALLBACK.CH_VERIFY_ALL + tournamentId
    ),
  ]);
  rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.TOUR_OPEN + tournamentId)]);
  return Markup.inlineKeyboard(rows);
}

// ============================================================
// TO'LOV TUGMALARI (pullik turnir)
// ============================================================
function paymentKeyboard(tournamentId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📤 Chek yuborish', CALLBACK.PAY_SEND_RECEIPT + tournamentId)],
    [Markup.button.callback('⬅️ Orqaga', CALLBACK.TOUR_OPEN + tournamentId)],
  ]);
}

// ============================================================
// ORGANIZER UCHUN TO'LOV TASDIQLASH
// ============================================================
function paymentReviewKeyboard(paymentId, tournamentId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tasdiqlash', CALLBACK.PAY_APPROVE + paymentId),
      Markup.button.callback('❌ Rad etish', CALLBACK.PAY_REJECT + paymentId),
    ],
    [Markup.button.callback('👥 Komanda ma\'lumotlari', CALLBACK.PAY_TEAM_INFO + paymentId)],
    [Markup.button.callback('🏆 Turnir ma\'lumotlari', CALLBACK.PAY_TOUR_INFO + tournamentId)],
  ]);
}

// ============================================================
// RAD ETILGANDAN KEYIN
// ============================================================
function rejectedPaymentKeyboard(paymentId, tournamentId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Qayta chek yuborish', CALLBACK.PAY_RESEND + paymentId)],
    [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + tournamentId)],
  ]);
}

// ============================================================
// ADMIN / ORGANIZER PANEL
// ============================================================
function adminPaymentsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏳ Kutilayotgan', CALLBACK.ADMIN_PAYMENTS_PENDING)],
    [Markup.button.callback('✅ Tasdiqlangan', CALLBACK.ADMIN_PAYMENTS_APPROVED)],
    [Markup.button.callback('❌ Rad etilgan', CALLBACK.ADMIN_PAYMENTS_REJECTED)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

function organizerPaymentsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏳ Kutilayotgan to\'lovlar', CALLBACK.ORG_PENDING_PAYMENTS)],
    [Markup.button.callback('📋 Barcha to\'lovlarim', CALLBACK.ORG_MY_PAYMENTS)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
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
  adminPaymentsKeyboard,
  organizerPaymentsKeyboard,
};