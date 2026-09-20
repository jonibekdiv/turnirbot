// ============================================================
// BAN CHECK — Ban qilingan foydalanuvchilarni bloklash
// ============================================================
const adminExtService = require('../services/adminExtService');
const config = require('../config');

async function banCheckMiddleware(ctx, next) {
  if (!ctx.from) return next();

  // Super Admin — hech qachon bloklanmaydi
  if (Number(ctx.from.id) === Number(config.SUPER_ADMIN_ID)) {
    return next();
  }

  // Ban tekshiruvi
  let banned = false;
  try {
    banned = await adminExtService.isBanned(ctx.from.id);
  } catch (e) {
    // Agar ban fayl xato bersa — davom etamiz
    return next();
  }

  if (banned) {
    // Callback bo'lsa
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery("🚫 Siz botdan bloklangansiz");
      } catch (e) {}
      return;
    }
    // Xabar bo'lsa
    if (ctx.message) {
      try {
        await ctx.reply(
          "🚫 <b>Siz botdan bloklangansiz.</b>\n\nAdministratorga murojaat qiling.",
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }
    return;
  }

  return next();
}

module.exports = { banCheckMiddleware };