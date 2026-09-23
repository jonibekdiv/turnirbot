// ============================================================
// TOURNAMENT KEYBOARD — Ko'p tilli
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK } = require('../constants');
const langService = require('../services/langService');

// ============================================================
// YORDAMCHI: `t` funksiyasini olish
// ============================================================
function getT(ctx) {
  if (ctx?.t) return ctx.t;
  const lang = ctx?.state?.lang || langService.DEFAULT_LANG;
  return (key, vars) => langService.t(lang, key, vars);
}

// ============================================================
// TURNIRLAR MENYUSI
// ============================================================
function tournamentsMenu(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t('tour_today'), CALLBACK.TOUR_TODAY),
      Markup.button.callback(t('tour_upcoming'), CALLBACK.TOUR_UPCOMING),
    ],
    [Markup.button.callback(t('tour_finished'), CALLBACK.TOUR_FINISHED)],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

// ============================================================
// TURNIR ICHIDAGI TUGMALAR
// ============================================================
function tournamentItemButtons(ctx, tournamentId) {
  const t = getT(ctx);

  return [
    [
      Markup.button.callback(
        t('tour_open'),
        CALLBACK.TOUR_OPEN + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        t('tour_register'),
        CALLBACK.TOUR_REGISTER + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        t('tour_contact_host'),
        CALLBACK.TOUR_CONTACT_HOST + tournamentId
      ),
    ],
  ];
}

// ============================================================
// TASDIQLASH
// ============================================================
function confirmTournament(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_confirm'), CALLBACK.TOUR_CONFIRM)],
    [Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_CANCEL)],
  ]);
}

module.exports = {
  tournamentsMenu,
  tournamentItemButtons,
  confirmTournament,
};