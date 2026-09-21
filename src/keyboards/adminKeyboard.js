// ============================================================
// ADMIN KEYBOARD — Rolga qarab menyu (kartalar bilan)
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK, ROLES } = require('../constants');

// ============================================================
// ASOSIY ADMIN PANEL — Rolga qarab
// ============================================================
function adminPanel(role = ROLES.PLAYER) {
  const rows = [];

  // Super Admin / Admin uchun
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback('👤 Foydalanuvchilar', CALLBACK.ADMIN_USERS)]);
  }

  // Barchaga
  rows.push([Markup.button.callback('👥 Komandalar', CALLBACK.ADMIN_TEAMS)]);
  rows.push([Markup.button.callback('🏆 Turnirlar', CALLBACK.ADMIN_TOURNAMENTS)]);
  rows.push([Markup.button.callback('➕ Yangi turnir', CALLBACK.TOUR_CREATE)]);
  rows.push([Markup.button.callback('📚 Turnirlar tarixi', CALLBACK.TOUR_HISTORY)]);
  rows.push([Markup.button.callback('📅 Kalendar', CALLBACK.TOUR_CALENDAR)]);
  rows.push([Markup.button.callback('📋 Shablonlar', CALLBACK.TOUR_TEMPLATE)]);
  rows.push([Markup.button.callback('🎙 Hostlar', CALLBACK.ADMIN_HOSTS)]);

  // Faqat Super Admin / Admin uchun
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback('🛡 Adminlar', CALLBACK.ADMIN_ADMINS)]);
  }

  // Barchaga
  rows.push([Markup.button.callback('🎯 Organizerlar', CALLBACK.ADMIN_ORGS)]);
  rows.push([Markup.button.callback('📢 Reklama yuborish', CALLBACK.ADMIN_BROADCAST)]);
  rows.push([Markup.button.callback('📢 Kanal sozlamalari', CALLBACK.ADMIN_CHANNEL)]);

  // 💳 KARTALAR (YANGI)
  rows.push([Markup.button.callback('💳 Kartalar', CALLBACK.ADMIN_CARDS)]);

  // 💳 TO'LOVLAR
  rows.push([Markup.button.callback("💳 To'lovlar", CALLBACK.ADMIN_PAYMENTS)]);
  rows.push([Markup.button.callback("⏳ Kutilayotgan cheklar", CALLBACK.ORG_PENDING_PAYMENTS)]);

  // 📢 KANALLAR
  rows.push([Markup.button.callback("📢 Kanallar ro'yxati", CALLBACK.ADMIN_CHANNELS)]);
  rows.push([Markup.button.callback("➕ Kanal qo'shish", CALLBACK.ADMIN_CHANNELS_ADD)]);

  // Faqat Super Admin / Admin uchun
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback('🚫 Ban tizimi', CALLBACK.ADMIN_BAN)]);
  }

  // Barchaga
  rows.push([Markup.button.callback('📜 Admin amallari', CALLBACK.ADMIN_ACTIONS)]);
  rows.push([Markup.button.callback('🐛 Xatolar jurnali', CALLBACK.ADMIN_LOGS)]);
  rows.push([Markup.button.callback('📊 Statistika', CALLBACK.ADMIN_STATS)]);

  // Faqat Super Admin uchun
  if (role === ROLES.SUPER_ADMIN) {
    rows.push([Markup.button.callback('⚙️ Sozlamalar', CALLBACK.ADMIN_SETTINGS)]);
  }

  rows.push([Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// ROL BOSHQARUVI
// ============================================================
function roleManageKeyboard(role) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`➕ ${role} qo'shish`, CALLBACK.ADMIN_ADD_ROLE + role)],
    [Markup.button.callback(`➖ ${role} o'chirish`, CALLBACK.ADMIN_DEL_ROLE + role)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// ORGANIZER UCHUN
// ============================================================
function organizerHostsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

function organizerOrgsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// TURNIR BOSHQARUV
// ============================================================
function tournamentAdminKeyboard(tournamentId, role = ROLES.ADMIN) {
  const rows = [
    [Markup.button.callback('✏️ Tahrirlash', CALLBACK.TOUR_EDIT + tournamentId)],
    [Markup.button.callback('📋 Nusxalash', CALLBACK.TOUR_CLONE + tournamentId)],
    [Markup.button.callback('🔗 Havola', CALLBACK.TOUR_LINK + tournamentId)],
    [Markup.button.callback('📊 Statistika', CALLBACK.TOUR_STATS + tournamentId)],
    [Markup.button.callback('⭐️ Etap', CALLBACK.TOUR_STAGE + tournamentId)],
    [Markup.button.callback('🎙 Host biriktirish', CALLBACK.TOUR_ASSIGN_HOST + tournamentId)],
    [Markup.button.callback('📢 Reklama', CALLBACK.TOUR_BROADCAST + tournamentId)],
    [Markup.button.callback("📣 Kanalga e'lon", CALLBACK.TOUR_ANNOUNCE + tournamentId)],
    [Markup.button.callback('📊 Hisobot', CALLBACK.TOUR_REPORT + tournamentId)],
    [Markup.button.callback("🏅 G'oliblar", CALLBACK.TOUR_WINNERS + tournamentId)],
  ];

  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    rows.push([Markup.button.callback('🚫 Bekor qilish', 'tour:cancel:' + tournamentId)]);
    rows.push([Markup.button.callback("🗑 O'chirish", CALLBACK.TOUR_DELETE + tournamentId)]);
  }

  rows.push([Markup.button.callback('⬅️ Turnirlar', CALLBACK.ADMIN_TOURNAMENTS)]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// TURNIR TAHRIRLASH MAYDONLARI
// ============================================================
function tournamentEditKeyboard(tournamentId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏆 Nom', 'tour:editf:' + tournamentId + ':title'),
      Markup.button.callback('🖼 Rasm', 'tour:editf:' + tournamentId + ':image'),
    ],
    [
      Markup.button.callback('📅 Sana', 'tour:editf:' + tournamentId + ':date'),
      Markup.button.callback('⏰ Vaqt', 'tour:editf:' + tournamentId + ':time'),
    ],
    [
      Markup.button.callback('🎮 Rejim', 'tour:editf:' + tournamentId + ':mode'),
      Markup.button.callback('👥 Maks. komanda', 'tour:editf:' + tournamentId + ':maxTeams'),
    ],
    [
      Markup.button.callback('💲 PRIZ', 'tour:editf:' + tournamentId + ':prize'),
      Markup.button.callback('♾️ MAP', 'tour:editf:' + tournamentId + ':mapTag'),
    ],
    [
      Markup.button.callback('⭐️ Etap', 'tour:editf:' + tournamentId + ':etapa'),
      Markup.button.callback('📄 Izoh', 'tour:editf:' + tournamentId + ':desc'),
    ],
    [Markup.button.callback('🎙 Host', 'tour:editf:' + tournamentId + ':host')],
    [Markup.button.callback('⬅️ Orqaga', CALLBACK.TOUR_OPEN + tournamentId)],
  ]);
}

// ============================================================
// HOST TANLASH
// ============================================================
function hostPickerKeyboard(hosts, tournamentId) {
  const rows = hosts.slice(0, 10).map((h) => [
    Markup.button.callback(
      `🎙 Host ID: ${h.id}`,
      'tour:ah_set:' + tournamentId + ':' + h.id
    ),
  ]);
  rows.push([Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_OPEN + tournamentId)]);
  return Markup.inlineKeyboard(rows);
}

// ============================================================
// TASDIQLASH
// ============================================================
function confirmAction(confirmCb, cancelCb) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Tasdiqlash', confirmCb)],
    [Markup.button.callback('❌ Bekor qilish', cancelCb)],
  ]);
}

// ============================================================
// TO'LOV PANELLARI
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
    [Markup.button.callback("⏳ Kutilayotgan to'lovlar", CALLBACK.ORG_PENDING_PAYMENTS)],
    [Markup.button.callback("📋 Barcha to'lovlarim", CALLBACK.ORG_MY_PAYMENTS)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// KANALLAR
// ============================================================
function channelsAdminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Kanal qo'shish", CALLBACK.ADMIN_CHANNELS_ADD)],
    [Markup.button.callback('🔄 Yangilash', CALLBACK.ADMIN_CHANNELS)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  adminPanel,
  roleManageKeyboard,
  organizerHostsKeyboard,
  organizerOrgsKeyboard,
  tournamentAdminKeyboard,
  tournamentEditKeyboard,
  hostPickerKeyboard,
  confirmAction,
  adminPaymentsKeyboard,
  organizerPaymentsKeyboard,
  channelsAdminKeyboard,
};