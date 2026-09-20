// ============================================================
// LANG MIDDLEWARE — Har bir update uchun tilni aniqlaydi
// ============================================================
const langService = require('../services/langService');

async function langMiddleware(ctx, next) {
  if (ctx.from) {
    try {
      ctx.state.lang = await langService.getUserLang(ctx.from.id);
    } catch (e) {
      ctx.state.lang = langService.DEFAULT_LANG;
    }

    // ctx.t() funksiyasi
    ctx.t = (key, vars = {}) => {
      return langService.t(ctx.state.lang, key, vars);
    };
  } else {
    ctx.t = (key, vars = {}) => langService.t(langService.DEFAULT_LANG, key, vars);
  }

  return next();
}

module.exports = { langMiddleware };