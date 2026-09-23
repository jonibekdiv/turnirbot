// ============================================================
// TEAM KEYBOARD — Ko'p tilli
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
// KOMANDA MENYUSI
// ============================================================
function teamMenu(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('team_create'), CALLBACK.TEAM_CREATE)],
    [Markup.button.callback(t('team_join'), CALLBACK.TEAM_JOIN)],
    [Markup.button.callback(t('team_my'), CALLBACK.TEAM_MY)],
    [Markup.button.callback(t('team_edit'), CALLBACK.TEAM_EDIT)],
    [Markup.button.callback(t('team_stats'), CALLBACK.TEAM_STATS)],
    [Markup.button.callback(t('team_members'), CALLBACK.TEAM_MEMBERS)],
    [Markup.button.callback(t('team_leave'), CALLBACK.TEAM_LEAVE)],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

// ============================================================
// TASDIQLASH
// ============================================================
function confirmTeam(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_confirm'), CALLBACK.TEAM_CONFIRM)],
    [Markup.button.callback(t('btn_retry'), CALLBACK.TEAM_RETRY)],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.TEAM_CANCEL)],
  ]);
}

// ============================================================
// BEKOR QILISH
// ============================================================
function cancelKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_cancel'), CALLBACK.CANCEL)],
  ]);
}

module.exports = {
  teamMenu,
  confirmTeam,
  cancelKeyboard,
};