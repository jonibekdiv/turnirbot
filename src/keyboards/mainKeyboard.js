// ============================================================
// MAIN KEYBOARD — Ko'p tilli
// Panellar: ADMIN/ORGANIZER → admin panel
//           HOST + SUPER_ADMIN + ADMIN → host + stage panel
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK, ROLES } = require('../constants');
const langService = require('../services/langService');

function mainKeyboard(role, lang = 'uz') {
  const t = (key) => langService.t(lang, key);

  // ============================================================
  // UMUMIY BO'LIMLAR — hamma foydalanuvchilarga
  // ============================================================
  const rows = [
    [Markup.button.callback(t('menu_tournaments'), CALLBACK.MENU_TOURNAMENTS)],
    [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
    [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
    [Markup.button.callback(t('menu_search'), CALLBACK.SEARCH_START)],
    [Markup.button.callback(t('menu_wallet'), CALLBACK.WALLET_VIEW)],
    [Markup.button.callback(t('menu_support'), CALLBACK.SUPPORT_START)],
  ];

  // ============================================================
  // ROL TEKSHIRUVI
  // ============================================================
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isAdmin = role === ROLES.ADMIN;
  const isOrganizer = role === ROLES.ORGANIZER;
  const isHost = role === ROLES.HOST;
  const isTopAdmin = isSuperAdmin || isAdmin;

  // ============================================================
  // ADMIN PANEL — SUPER_ADMIN, ADMIN, ORGANIZER
  // ============================================================
  if (isSuperAdmin || isAdmin || isOrganizer) {
    rows.push([
      Markup.button.callback(t('menu_admin'), CALLBACK.ADMIN_PANEL),
    ]);
  }

  // ============================================================
  // HOST PANEL — HOST, SUPER_ADMIN, ADMIN
  // ============================================================
  if (isHost || isTopAdmin) {
    rows.push([
      Markup.button.callback(t('host_panel_btn'), CALLBACK.HOST_TOURS),
    ]);
  }

  // ============================================================
  // STAGE PANEL — HOST, SUPER_ADMIN, ADMIN
  // ============================================================
  if (isHost || isTopAdmin) {
    rows.push([
      Markup.button.callback(t('host_stage_btn'), CALLBACK.HOST_STAGE_TOURS),
    ]);
  }

  // ============================================================
  // UMUMIY — til va yordam
  // ============================================================
  rows.push([
    Markup.button.callback(t('menu_language'), CALLBACK.MENU_LANGUAGE),
  ]);
  rows.push([
    Markup.button.callback(t('menu_help'), CALLBACK.MENU_HELP),
  ]);

  return Markup.inlineKeyboard(rows);
}

function backMainKeyboard(role, lang = 'uz') {
  const t = (key) => langService.t(lang, key);
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

module.exports = { mainKeyboard, backMainKeyboard };