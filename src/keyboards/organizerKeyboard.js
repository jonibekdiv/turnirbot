// ============================================================
// ORGANIZER KEYBOARD — Ko'p tilli
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
// ORGANIZER PANEL
// ============================================================
function organizerPanel(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('org_my_tournaments'), CALLBACK.ORG_MY_TOURNAMENTS)],
    [Markup.button.callback(t('tour_create_again'), CALLBACK.TOUR_CREATE)],
    [Markup.button.callback(t('tour_history_btn'), CALLBACK.TOUR_HISTORY)],
    [Markup.button.callback(t('tour_calendar_btn'), CALLBACK.TOUR_CALENDAR)],

    [Markup.button.callback(t('org_my_payments'), CALLBACK.ORG_MY_PAYMENTS)],
    [Markup.button.callback(t('org_pending_payments'), CALLBACK.ORG_PENDING_PAYMENTS)],

    [Markup.button.callback(t('admin_broadcast'), CALLBACK.ADMIN_BROADCAST)],
    [Markup.button.callback(t('admin_channels'), CALLBACK.ADMIN_CHANNELS)],
    [Markup.button.callback(t('admin_channels_add'), CALLBACK.ADMIN_CHANNELS_ADD)],

    [Markup.button.callback(t('admin_cards'), CALLBACK.ADMIN_CARDS)],

    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

// ============================================================
// ORGANIZER TURNIR BOSHQARUV
// ============================================================
function organizerTournamentKeyboard(ctx, tournamentId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('tour_edit'), CALLBACK.TOUR_EDIT + tournamentId)],
    [Markup.button.callback(t('tour_clone'), CALLBACK.TOUR_CLONE + tournamentId)],
    [Markup.button.callback(t('tour_link'), CALLBACK.TOUR_LINK + tournamentId)],
    [Markup.button.callback(t('tour_stats'), CALLBACK.TOUR_STATS + tournamentId)],
    [Markup.button.callback(t('tour_stage'), CALLBACK.TOUR_STAGE + tournamentId)],
    [Markup.button.callback(t('tour_assign_host'), CALLBACK.TOUR_ASSIGN_HOST + tournamentId)],
    [Markup.button.callback(t('tour_broadcast'), CALLBACK.TOUR_BROADCAST + tournamentId)],
    [Markup.button.callback(t('tour_announce'), CALLBACK.TOUR_ANNOUNCE + tournamentId)],
    [Markup.button.callback(t('tour_report'), CALLBACK.TOUR_REPORT + tournamentId)],
    [Markup.button.callback(t('tour_winners'), CALLBACK.TOUR_WINNERS + tournamentId)],
    [Markup.button.callback(t('org_my_tournaments'), CALLBACK.ORG_MY_TOURNAMENTS)],
  ]);
}

module.exports = {
  organizerPanel,
  organizerTournamentKeyboard,
};