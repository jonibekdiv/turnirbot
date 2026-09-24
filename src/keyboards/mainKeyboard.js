// ============================================================
// MAIN KEYBOARD — Ko'p tilli (etap tizimi bilan)
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK, ROLES } = require('../constants');
const langService = require('../services/langService');

function mainKeyboard(role, lang = 'uz') {
  const t = (key) => langService.t(lang, key);

  const rows = [
    [Markup.button.callback(t('menu_tournaments'), CALLBACK.MENU_TOURNAMENTS)],
    [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
    [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
    [Markup.button.callback(t('menu_search'), CALLBACK.SEARCH_START)],
        [Markup.button.callback('👛 Hamyon', CALLBACK.WALLET_VIEW)],
    [Markup.button.callback('💬 Yordam', CALLBACK.SUPPORT_START)],
  ];

  const isStaff = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ORGANIZER].includes(role);
  if (isStaff) {
    rows.push([Markup.button.callback(t('menu_admin'), CALLBACK.ADMIN_PANEL)]);
  }

  // ============================================================
  // HOST — Host Stage panel
  // ============================================================
  if (role === ROLES.HOST) {
    rows.push([
      Markup.button.callback('🎙 Host panel', CALLBACK.HOST_STAGE_TOURS),
    ]);
  }

  rows.push([Markup.button.callback(t('menu_language'), CALLBACK.MENU_LANGUAGE)]);
  rows.push([Markup.button.callback(t('menu_help'), CALLBACK.MENU_HELP)]);

  return Markup.inlineKeyboard(rows);
}

function backMainKeyboard(role, lang = 'uz') {
  const t = (key) => langService.t(lang, key);
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

module.exports = { mainKeyboard, backMainKeyboard };