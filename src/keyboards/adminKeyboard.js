// ============================================================
// ADMIN KEYBOARD — Ko'p tilli
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK, ROLES } = require('../constants');
const langService = require('../services/langService');

function getT(ctx) {
  if (ctx?.t) return ctx.t;
  const lang = ctx?.state?.lang || langService.DEFAULT_LANG;
  return (key, vars) => langService.t(lang, key, vars);
}

// ============================================================
// ASOSIY ADMIN PANEL
// ============================================================
function adminPanel(ctx, role) {
  const t = getT(ctx);
  role = role || ctx?.state?.role || ROLES.PLAYER;

  // Organizer uchun alohida panel
  if (role === ROLES.ORGANIZER) {
    const { organizerPanel } = require('./organizerKeyboard');
    return organizerPanel(ctx);
  }

  const rows = [];

  // Super Admin / Admin
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback(t('admin_users'), CALLBACK.ADMIN_USERS)]);
  }

  rows.push([Markup.button.callback(t('admin_teams'), CALLBACK.ADMIN_TEAMS)]);
  rows.push([
    Markup.button.callback(t('admin_tournaments'), CALLBACK.ADMIN_TOURNAMENTS),
  ]);
  rows.push([Markup.button.callback(t('tour_create_again'), CALLBACK.TOUR_CREATE)]);
  rows.push([Markup.button.callback(t('tour_history_btn'), CALLBACK.TOUR_HISTORY)]);
  rows.push([Markup.button.callback(t('tour_calendar_btn'), CALLBACK.TOUR_CALENDAR)]);
  rows.push([Markup.button.callback(t('tour_template_btn'), CALLBACK.TOUR_TEMPLATE)]);
  rows.push([Markup.button.callback(t('admin_hosts'), CALLBACK.ADMIN_HOSTS)]);

  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback(t('admin_admins'), CALLBACK.ADMIN_ADMINS)]);
    rows.push([Markup.button.callback(t('admin_orgs'), CALLBACK.ADMIN_ORGS)]);
  }

  rows.push([Markup.button.callback(t('admin_broadcast'), CALLBACK.ADMIN_BROADCAST)]);
  rows.push([Markup.button.callback(t('admin_channel'), CALLBACK.ADMIN_CHANNEL)]);
  rows.push([Markup.button.callback(t('admin_cards'), CALLBACK.ADMIN_CARDS)]);
  rows.push([Markup.button.callback(t('admin_payments'), CALLBACK.ADMIN_PAYMENTS)]);
  rows.push([Markup.button.callback(t('org_pending_payments'), CALLBACK.ORG_PENDING_PAYMENTS)]);
  rows.push([Markup.button.callback(t('admin_channels'), CALLBACK.ADMIN_CHANNELS)]);
  rows.push([Markup.button.callback(t('admin_channels_add'), CALLBACK.ADMIN_CHANNELS_ADD)]);

  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback(t('admin_ban'), CALLBACK.ADMIN_BAN)]);
  }

  rows.push([Markup.button.callback(t('admin_actions'), CALLBACK.ADMIN_ACTIONS)]);
  rows.push([Markup.button.callback(t('admin_logs'), CALLBACK.ADMIN_LOGS)]);
  rows.push([Markup.button.callback(t('admin_stats'), CALLBACK.ADMIN_STATS)]);

  if (role === ROLES.SUPER_ADMIN) {
    rows.push([Markup.button.callback(t('admin_settings'), CALLBACK.ADMIN_SETTINGS)]);
  }

  rows.push([Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// ROL BOSHQARUVI
// ============================================================
function roleManageKeyboard(ctx, role) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '➕ ' + role + ' — ' + t('btn_add'),
        CALLBACK.ADMIN_ADD_ROLE + role
      ),
    ],
    [
      Markup.button.callback(
        '➖ ' + role + ' — ' + t('btn_delete'),
        CALLBACK.ADMIN_DEL_ROLE + role
      ),
    ],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// TURNIR BOSHQARUV
// ============================================================
function tournamentAdminKeyboard(ctx, tournamentId, role) {
  const t = getT(ctx);
  role = role || ctx?.state?.role || ROLES.ADMIN;

  const rows = [
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
  ];

  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([
      Markup.button.callback(t('tour_cancel'), 'tour:cancel:' + tournamentId),
    ]);
    rows.push([
      Markup.button.callback(t('tour_delete'), CALLBACK.TOUR_DELETE + tournamentId),
    ]);
  }

  rows.push([Markup.button.callback(t('admin_tournaments'), CALLBACK.ADMIN_TOURNAMENTS)]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// TURNIR TAHRIRLASH
// ============================================================
function tournamentEditKeyboard(ctx, tournamentId) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏆 ' + t('name'), 'tour:editf:' + tournamentId + ':title'),
      Markup.button.callback('🖼 ' + t('image'), 'tour:editf:' + tournamentId + ':image'),
    ],
    [
      Markup.button.callback('📅 ' + t('date'), 'tour:editf:' + tournamentId + ':date'),
      Markup.button.callback('⏰ ' + t('time'), 'tour:editf:' + tournamentId + ':time'),
    ],
    [
      Markup.button.callback('🎮 ' + t('mode'), 'tour:editf:' + tournamentId + ':mode'),
      Markup.button.callback('👥 ' + t('max_teams'), 'tour:editf:' + tournamentId + ':maxTeams'),
    ],
    [
      Markup.button.callback('💲 PRIZ', 'tour:editf:' + tournamentId + ':prize'),
      Markup.button.callback('♾️ MAP', 'tour:editf:' + tournamentId + ':mapTag'),
    ],
    [
      Markup.button.callback('⭐️ ' + t('stage'), 'tour:editf:' + tournamentId + ':etapa'),
      Markup.button.callback('📄 ' + t('description'), 'tour:editf:' + tournamentId + ':desc'),
    ],
    [Markup.button.callback('🎙 ' + t('host_label'), 'tour:editf:' + tournamentId + ':host')],
    [Markup.button.callback(t('btn_back'), CALLBACK.TOUR_OPEN + tournamentId)],
  ]);
}

// ============================================================
// HOST TANLASH
// ============================================================
function hostPickerKeyboard(ctx, hosts, tournamentId) {
  const t = getT(ctx);

  const rows = hosts.slice(0, 10).map((h) => [
    Markup.button.callback(
      `🎙 ${t('host_label')} ID: ${h.id}`,
      'tour:ah_set:' + tournamentId + ':' + h.id
    ),
  ]);
  rows.push([
    Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_OPEN + tournamentId),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// TASDIQLASH
// ============================================================
function confirmAction(ctx, confirmCb, cancelCb) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_confirm'), confirmCb)],
    [Markup.button.callback(t('btn_cancel'), cancelCb)],
  ]);
}

// ============================================================
// TO'LOV PANELLARI
// ============================================================
function adminPaymentsKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('payment_status_pending'), CALLBACK.ADMIN_PAYMENTS_PENDING)],
    [Markup.button.callback(t('payment_status_approved'), CALLBACK.ADMIN_PAYMENTS_APPROVED)],
    [Markup.button.callback(t('payment_status_rejected'), CALLBACK.ADMIN_PAYMENTS_REJECTED)],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

function organizerPaymentsKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('org_pending_payments'), CALLBACK.ORG_PENDING_PAYMENTS)],
    [Markup.button.callback(t('pay_all_payments'), CALLBACK.ORG_MY_PAYMENTS)],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// KANALLAR
// ============================================================
function channelsAdminKeyboard(ctx) {
  const t = getT(ctx);

  return Markup.inlineKeyboard([
    [Markup.button.callback(t('ch_add_btn'), CALLBACK.ADMIN_CHANNELS_ADD)],
    [Markup.button.callback(t('btn_refresh'), CALLBACK.ADMIN_CHANNELS)],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

module.exports = {
  adminPanel,
  roleManageKeyboard,
  tournamentAdminKeyboard,
  tournamentEditKeyboard,
  hostPickerKeyboard,
  confirmAction,
  adminPaymentsKeyboard,
  organizerPaymentsKeyboard,
  channelsAdminKeyboard,
};