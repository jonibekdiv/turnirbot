const { Markup } = require('telegraf');
const { CALLBACK, ROLES } = require('../constants');

function mainKeyboard(role) {
  const rows = [
    [Markup.button.callback('🏆 Bugungi va keyingi turnirlar', CALLBACK.MENU_TOURNAMENTS)],
    [Markup.button.callback('👥 Komandam', CALLBACK.MENU_TEAM)],
    [Markup.button.callback('👤 Mening profilim', CALLBACK.MENU_PROFILE)],
    [Markup.button.callback('ℹ️ Yordam', CALLBACK.MENU_HELP)],
  ];

  const isStaff = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ORGANIZER].includes(role);
  if (isStaff) {
    rows.push([Markup.button.callback('🛠 Admin panel', CALLBACK.ADMIN_PANEL)]);
  }
  if (role === ROLES.HOST) {
    rows.push([Markup.button.callback('🎙 Host panel', CALLBACK.HOST_TOURS)]);
  }
  return Markup.inlineKeyboard(rows);
}

function backMainKeyboard(role) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

module.exports = { mainKeyboard, backMainKeyboard };