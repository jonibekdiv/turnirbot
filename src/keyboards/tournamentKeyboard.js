const { Markup } = require('telegraf');
const { CALLBACK } = require('../constants');

function tournamentsMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Bugungi', CALLBACK.TOUR_TODAY),
      Markup.button.callback('⏭ Kelgusi', CALLBACK.TOUR_UPCOMING),
    ],
    [Markup.button.callback('✅ Tugagan', CALLBACK.TOUR_FINISHED)],
    [Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

// ✅ TUZATILDI: array ichida array qaytaradi
function tournamentItemButtons(tournamentId) {
  return [
    [Markup.button.callback('🔍 Turnirga kirish', CALLBACK.TOUR_OPEN + tournamentId)],
    [Markup.button.callback('📝 Komandamni ro\'yxatdan o\'tkazish', CALLBACK.TOUR_REGISTER + tournamentId)],
    [Markup.button.callback('💬 Hostga yozish', CALLBACK.TOUR_CONTACT_HOST + tournamentId)],
  ];
}

function confirmTournament() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Tasdiqlash', CALLBACK.TOUR_CONFIRM)],
    [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
  ]);
}

module.exports = { tournamentsMenu, tournamentItemButtons, confirmTournament };