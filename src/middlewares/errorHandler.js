// ============================================================
// ERROR HANDLER — Xatolarni ushlash va loglash
// ============================================================
const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config');

// ============================================================
// XATONI LOGGA YOZISH
// ============================================================
function logError(err, ctx) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const line =
      `[${new Date().toISOString()}] ` +
      `user=${ctx?.from?.id || '-'} ` +
      `username=${ctx?.from?.username || '-'} ` +
      `text=${(ctx?.message?.text || '').slice(0, 100).replace(/\n/g, ' ')} ` +
      `error=${err?.stack || err?.message || err}\n`;
    fs.appendFileSync(path.join(LOGS_DIR, 'error.log'), line);
  } catch (e) {
    // Log yozib bo'lmasa — jim
  }
}

// ============================================================
// ERROR MIDDLEWARE
// ============================================================
async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    logError(err, ctx);

    // Foydalanuvchiga xabar
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery("❌ Xatolik yuz berdi").catch(() => {});
      } else if (ctx.reply) {
        await ctx
          .reply("❌ Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.")
          .catch(() => {});
      }
    } catch (e) {}
  }
}

module.exports = { errorHandler, logError };