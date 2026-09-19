const { ROLES } = require('../constants');

function hasAnyRole(userRole, roles) {
  if (!userRole) return false;
  if (userRole === ROLES.SUPER_ADMIN) return true;
  return roles.includes(userRole);
}

function requireRoles(roles) {
  return async (ctx, next) => {
    if (!hasAnyRole(ctx.state?.role, roles)) {
      try { await ctx.answerCbQuery?.('⛔ Ruxsat yo\'q'); } catch {}
      return;
    }
    return next();
  };
}

module.exports = { requireRoles, hasAnyRole };