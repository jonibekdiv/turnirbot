const { Markup } = require('telegraf');
const { CALLBACK } = require('../constants');

const teamMenu = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Komanda yaratish', CALLBACK.TEAM_CREATE)],
  [Markup.button.callback('🔑 Komandaga qo\'shilish', CALLBACK.TEAM_JOIN)],
  [Markup.button.callback('👥 Mening komandam', CALLBACK.TEAM_MY)],
  [Markup.button.callback('🚪 Komandani tark etish', CALLBACK.TEAM_LEAVE)],
  [Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)],
]);

const confirmTeam = Markup.inlineKeyboard([
  [Markup.button.callback('✅ Tasdiqlash', CALLBACK.TEAM_CONFIRM)],
  [Markup.button.callback('🔁 Qayta kiritish', CALLBACK.TEAM_RETRY)],
  [Markup.button.callback('❌ Bekor qilish', CALLBACK.TEAM_CANCEL)],
]);

const cancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Bekor qilish', CALLBACK.CANCEL)],
]);

module.exports = { teamMenu, confirmTeam, cancelKeyboard };