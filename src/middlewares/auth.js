const userService = require('../services/userService');
const roleService = require('../services/roleService');
const { ROLES } = require('../constants');
const config = require('../config');

// Foydalanuvchi rolini aniqlash
async function resolveRole(userId) {
  if (Number(userId) === Number(config.SUPER_ADMIN_ID)) return ROLES.SUPER_ADMIN;
  if (await roleService.has('admin', userId)) return ROLES.ADMIN;
  if (await roleService.has('organizer', userId)) return ROLES.ORGANIZER;
  if (await roleService.has('host', userId)) return ROLES.HOST;
  return ROLES.PLAYER;
}

// Har bir update oldidan rolni ctx.state ga yozamiz
async function authMiddleware(ctx, next) {
  if (ctx.from) {
    ctx.state.user = await userService.getUser(ctx.from.id);
    ctx.state.role = await resolveRole(ctx.from.id);
  }
  return next();
}

module.exports = { authMiddleware, resolveRole };