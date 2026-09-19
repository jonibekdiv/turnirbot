const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config');

function logError(err, ctx) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const line =
      `[${new Date().toISOString()}] ` +
      `user=${ctx?.from?.id || '-'} ` +
      `text=${(ctx?.message?.text || '').slice(0, 100)} ` +
      `error=${err?.stack || err?.message || err}\n`;
    fs.appendFileSync(path.join(LOGS_DIR, 'error.log'), line);
  } catch {}
}

async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    logError(err, ctx);
    try {
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko\'ring.');
    } catch {}
  }
}

module.exports = { errorHandler, logError };