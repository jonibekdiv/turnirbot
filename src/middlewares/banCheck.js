// Ban tekshiruvi — har bir update oldidan
const adminExtService = require('../services/adminExtService');

async function banCheckMiddleware(ctx, next) {
  if (!ctx.from) return next();
  // Super Admin hech qachon ban qilinmaydi
  const config = require('../config');
  if (Number(ctx.from.id) === Number(config.SUPER_ADMIN_ID)) return next();

  const banned = await adminExtService.isBanned(ctx.from.id);
  if (banned) {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery('🚫 Siz bloklangansiz'); } catch {}
      return;
    }
    if (ctx.message) {
      try {
        await ctx.reply('🚫 <b>Siz botdan bloklangansiz.</b>\n\nAdministratorga murojaat qiling.', {
          parse_mode: 'HTML',
        });
      } catch {}
    }
    return;
  }
  return next();
}

module.exports = { banCheckMiddleware };