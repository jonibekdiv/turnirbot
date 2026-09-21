// ============================================================
// ROLE GUARD — Rol tekshiruvi
// ============================================================
const { ROLES } = require('../constants');

// ============================================================
// FOYDALANUVCHI ROLINI TEKSHIRISH
// ============================================================
function hasAnyRole(userRole, allowedRoles) {
  if (!userRole) return false;

  // Super Admin — hamma narsaga ruxsat
  if (userRole === ROLES.SUPER_ADMIN) return true;

  return allowedRoles.includes(userRole);
}

// ============================================================
// RUXSAT BERISH MIDDLEWARE
// ============================================================
function requireRoles(roles) {
  return async (ctx, next) => {
    if (!hasAnyRole(ctx.state?.role, roles)) {
      try {
        await ctx.answerCbQuery?.('⛔ Ruxsat yo\'q');
      } catch (e) {}
      return;
    }
    return next();
  };
}

// ============================================================
// ANIQ TEKSHIRUVLAR
// ============================================================

// Turnir yaratish/tahrirlash (Admin + Organizer)
function canManageTournament(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

// Foydalanuvchi rollarini o'zgartirish (faqat Admin/Super)
function canManageUsers(role) {
  return hasAnyRole(role, [ROLES.ADMIN]);
}

// Admin qo'shish/o'chirish (sozlama bo'yicha)
function canManageAdmins(role, allowAdminAddAdmin = false) {
  if (role === ROLES.SUPER_ADMIN) return true;
  if (role === ROLES.ADMIN && allowAdminAddAdmin) return true;
  return false;
}

// Host boshqarish (Admin + Organizer)
function canManageHosts(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

// Reklama yuborish (Admin + Organizer)
function canBroadcast(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

// Kanal boshqarish (Admin + Organizer)
function canManageChannel(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

// Ban tizimi (faqat Admin)
function canBan(role) {
  return hasAnyRole(role, [ROLES.ADMIN]);
}

// Log ko'rish (Admin + Organizer)
function canViewLogs(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

// Sozlamalar (faqat Super Admin)
function canEditSettings(role) {
  return role === ROLES.SUPER_ADMIN;
}

module.exports = {
  hasAnyRole,
  requireRoles,
  canManageTournament,
  canManageUsers,
  canManageAdmins,
  canManageHosts,
  canBroadcast,
  canManageChannel,
  canBan,
  canViewLogs,
  canEditSettings,
};