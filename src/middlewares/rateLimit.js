// ============================================================
// RATE LIMIT — Spam va flooddan himoya
// ============================================================
const userActions = new Map();

// Limitlar
const LIMITS = {
  messages: { max: 20, window: 10 * 1000 },     // 20 xabar / 10 sek
  callbacks: { max: 30, window: 10 * 1000 },    // 30 tugma / 10 sek
  commands: { max: 10, window: 30 * 1000 },     // 10 buyruq / 30 sek
};

// Foydalanuvchi holatini olish/yaratish
function getUserState(userId) {
  if (!userActions.has(userId)) {
    userActions.set(userId, {
      messages: [],
      callbacks: [],
      commands: [],
      lastWarn: 0,
    });
  }
  return userActions.get(userId);
}

// ============================================================
// RATE LIMIT MIDDLEWARE
// ============================================================
function rateLimitMiddleware(ctx, next) {
  if (!ctx.from) return next();

  const userId = ctx.from.id;
  const now = Date.now();
  const user = getUserState(userId);

  // ---------- Xabarlar ----------
  if (ctx.message) {
    user.messages = user.messages.filter((t) => now - t < LIMITS.messages.window);
    user.messages.push(now);

    if (user.messages.length > LIMITS.messages.max) {
      if (now - user.lastWarn > 5000) {
        user.lastWarn = now;
        if (ctx.reply) {
          ctx.reply("⚠️ Juda ko'p xabar yubordingiz. Iltimos, sekinroq.").catch(() => {});
        }
      }
      return;
    }
  }

  // ---------- Callback query'lar ----------
  if (ctx.callbackQuery) {
    user.callbacks = user.callbacks.filter((t) => now - t < LIMITS.callbacks.window);
    user.callbacks.push(now);

    if (user.callbacks.length > LIMITS.callbacks.max) {
      try {
        ctx.answerCbQuery("⚠️ Sekinroq bosing").catch(() => {});
      } catch (e) {}
      return;
    }
  }

  return next();
}

// ============================================================
// ESKI YOZUVLARNI TOZALASH (har 5 daqiqada)
// ============================================================
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userActions.entries()) {
    const hasRecent =
      data.messages.some((t) => now - t < 60000) ||
      data.callbacks.some((t) => now - t < 60000);
    if (!hasRecent) userActions.delete(userId);
  }
}, 5 * 60 * 1000);

module.exports = { rateLimitMiddleware };