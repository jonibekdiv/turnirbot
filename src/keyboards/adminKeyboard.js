const { Markup } = require('telegraf');
const { CALLBACK } = require('../constants');

// ============================================================
// ASOSIY ADMIN PANEL
// ============================================================
function adminPanel() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👤 Foydalanuvchilar', CALLBACK.ADMIN_USERS)],
    [Markup.button.callback('👥 Komandalar', CALLBACK.ADMIN_TEAMS)],
    [Markup.button.callback('🏆 Turnirlar', CALLBACK.ADMIN_TOURNAMENTS)],
    [Markup.button.callback('📚 Turnirlar tarixi', CALLBACK.TOUR_HISTORY)],
    [Markup.button.callback('📅 Kalendar', CALLBACK.TOUR_CALENDAR)],
    [Markup.button.callback('📋 Shablonlar', CALLBACK.TOUR_TEMPLATE)],
    [Markup.button.callback('🎙 Hostlar', CALLBACK.ADMIN_HOSTS)],
    [Markup.button.callback('🛡 Adminlar', CALLBACK.ADMIN_ADMINS)],
    [Markup.button.callback('🎯 Organizerlar', CALLBACK.ADMIN_ORGS)],
    [Markup.button.callback('📢 Reklama yuborish', CALLBACK.ADMIN_BROADCAST)],
    [Markup.button.callback('🚫 Ban tizimi', CALLBACK.ADMIN_BAN)],
    [Markup.button.callback('📜 Admin amallari', CALLBACK.ADMIN_ACTIONS)],
    [Markup.button.callback('🐛 Xatolar jurnali', CALLBACK.ADMIN_LOGS)],
    [Markup.button.callback('📢 Kanal sozlamalari', CALLBACK.ADMIN_CHANNEL)],
    [Markup.button.callback('📊 Statistika', CALLBACK.ADMIN_STATS)],
    [Markup.button.callback('⚙️ Sozlamalar', CALLBACK.ADMIN_SETTINGS)],
    [Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

// ============================================================
// ROL BOSHQARUVI (Host/Admin/Organizer uchun)
// ============================================================
function roleManageKeyboard(role) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`➕ ${role} qo'shish`, CALLBACK.ADMIN_ADD_ROLE + role)],
    [Markup.button.callback(`➖ ${role} o'chirish`, CALLBACK.ADMIN_DEL_ROLE + role)],
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

// ============================================================
// TURNIR BOSHQARUV (admindagi turnir kartasi uchun)
// ============================================================
function tournamentAdminKeyboard(tournamentId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Tahrirlash', CALLBACK.TOUR_EDIT + tournamentId)],
    [Markup.button.callback('📋 Nusxalash', CALLBACK.TOUR_CLONE + tournamentId)],
    [Markup.button.callback('🔗 Havola', CALLBACK.TOUR_LINK + tournamentId)],
    [Markup.button.callback('📊 Statistika', CALLBACK.TOUR_STATS + tournamentId)],
    [Markup.button.callback('⭐️ Etap', CALLBACK.TOUR_STAGE + tournamentId)],
    [Markup.button.callback('📢 Reklama', CALLBACK.TOUR_BROADCAST + tournamentId)],
    [Markup.button.callback('📣 Kanalga e\'lon', CALLBACK.TOUR_ANNOUNCE + tournamentId)],
    [Markup.button.callback('📊 Hisobot', CALLBACK.TOUR_REPORT + tournamentId)],
    [Markup.button.callback('🏅 G\'oliblar', CALLBACK.TOUR_WINNERS + tournamentId)],
    [Markup.button.callback('🚫 Bekor qilish', 'tour:cancel:' + tournamentId)],
    [Markup.button.callback('🗑 O\'chirish', CALLBACK.TOUR_DELETE + tournamentId)],
    [Markup.button.callback('⬅️ Turnirlar', CALLBACK.ADMIN_TOURNAMENTS)],
  ]);
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
// TASDIQLASH
// ============================================================
function confirmAction(confirmCb, cancelCb) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Tasdiqlash', confirmCb)],
    [Markup.button.callback('❌ Bekor qilish', cancelCb)],
  ]);
}

module.exports = {
  adminPanel,
  roleManageKeyboard,
  tournamentAdminKeyboard,
  tournamentEditKeyboard,
  confirmAction,
};