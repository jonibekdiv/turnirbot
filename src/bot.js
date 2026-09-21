// ============================================================
// BOT.JS — Asosiy kirish nuqtasi (to'liq)
// ============================================================
const { Telegraf, session } = require('telegraf');
const config = require('./config');
const { ensureAllFiles } = require('./storage/jsonStore');
const { errorHandler } = require('./middlewares/errorHandler');
const { rateLimitMiddleware } = require('./middlewares/rateLimit');
const { authMiddleware } = require('./middlewares/auth');
const { langMiddleware } = require('./middlewares/langMiddleware');
const { banCheckMiddleware } = require('./middlewares/banCheck');
const reminderService = require('./services/reminderService');

let cronService = null;
try {
  cronService = require('./services/cronService');
} catch (e) {}

let commandsService = null;
try {
  commandsService = require('./services/commandsService');
} catch (e) {
  console.log('⚠️ commandsService yuklanmadi:', e.message);
}

// ============================================================
// HANDLERLAR
// ============================================================
const startHandler = require('./handlers/startHandler');
const languageHandler = require('./handlers/languageHandler');
const userExtHandler = require('./handlers/userExtHandler');
const teamHandler = require('./handlers/teamHandler');
const teamExtHandler = require('./handlers/teamExtHandler');

// Karta handler (turnirdan OLDIN)
const cardHandler = require('./handlers/cardHandler');

// To'lov va obuna (turnirdan OLDIN)
const tournamentCreatePaymentHandler = require('./handlers/tournamentCreatePaymentHandler');
const subscriptionHandler = require('./handlers/subscriptionHandler');

// Turnir handlerlari
const tournamentHandler = require('./handlers/tournamentHandler');
const tournamentPaymentHandler = require('./handlers/tournamentPaymentHandler');
const tournamentExtHandler = require('./handlers/tournamentExtHandler');

// Host
const hostHandler = require('./handlers/hostHandler');
const hostExtHandler = require('./handlers/hostExtHandler');

// Media
const mediaHandler = require('./handlers/mediaHandler');

// Admin
const adminHandler = require('./handlers/adminHandler');
const adminExtHandler = require('./handlers/adminExtHandler');
const channelHandler = require('./handlers/channelHandler');
const channelAdminHandler = require('./handlers/channelAdminHandler');

// To'lov review
const paymentHandler = require('./handlers/paymentHandler');
const organizerPaymentReviewHandler = require('./handlers/organizerPaymentReviewHandler');

// Qidiruv va Inline
const searchHandler = require('./handlers/searchHandler');
const inlineHandler = require('./handlers/inlineHandler');

// ============================================================
// ASOSIY FUNKSIYA
// ============================================================
async function main() {
  if (!config.BOT_TOKEN) throw new Error("BOT_TOKEN .env da ko'rsatilmagan");
  if (!config.SUPER_ADMIN_ID) throw new Error("SUPER_ADMIN_ID .env da ko'rsatilmagan");

  await ensureAllFiles();

  const bot = new Telegraf(config.BOT_TOKEN);

  // ============================================================
  // MIDDLEWARELAR (TARTIB MUHIM!)
  // ============================================================
  bot.use(session());
  bot.use(rateLimitMiddleware);
  bot.use(errorHandler);
  bot.use(banCheckMiddleware);
  bot.use(authMiddleware);
  bot.use(langMiddleware);

  // ============================================================
  // HANDLERLAR (TARTIB MUHIM!)
  // ============================================================

  // 1. Asosiy
  startHandler(bot);
  languageHandler(bot);

  // 2. Foydalanuvchi va komanda
  userExtHandler(bot);
  teamHandler(bot);
  teamExtHandler(bot);

  // 3. Karta handler (CARD_ADD ishlashi uchun turnirdan OLDIN)
  cardHandler(bot);

  // 4. To'lov va obuna (turnirdan OLDIN)
  tournamentCreatePaymentHandler(bot);
  subscriptionHandler(bot);

  // 5. Turnirlar
  tournamentHandler(bot);
  tournamentPaymentHandler(bot);
  tournamentExtHandler(bot);

  // 6. Host
  hostHandler(bot);
  hostExtHandler(bot);
  mediaHandler(bot);

  // 7. Admin
  adminHandler(bot);
  adminExtHandler(bot);
  channelHandler(bot);
  channelAdminHandler(bot);

  // 8. To'lov review
  paymentHandler(bot);
  organizerPaymentReviewHandler(bot);

  // 9. Qidiruv va Inline
  searchHandler(bot);
  inlineHandler(bot);

  // ============================================================
  // XATO USHLAGICH
  // ============================================================
  bot.catch((err, ctx) => {
    console.error('❌ Bot xatosi:', err.message || err);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(0, 3).join('\n'));
    }
    try {
      if (ctx && ctx.reply) {
        ctx.reply("❌ Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.").catch(() => {});
      }
    } catch (e) {}
  });

  // ============================================================
  // XIZMATLAR
  // ============================================================
  reminderService.start(bot);
  if (cronService) {
    try {
      cronService.start(bot);
    } catch (e) {}
  }

  // Buyruqlar menyusi
  if (commandsService) {
    try {
      await commandsService.setupAll(bot);
    } catch (e) {
      console.log('⚠️ Buyruqlar menyusi xato:', e.message);
    }
  }

  // ============================================================
  // ISHGA TUSHIRISH
  // ============================================================
  await bot.launch();
  console.log('╔══════════════════════╗');
  console.log('   ✅ BOT ISHGA TUSHDI');
  console.log('╚══════════════════════╝');
  console.log(`👤 Super Admin: ${config.SUPER_ADMIN_ID}`);
  console.log(`🤖 Bot: @${config.BOT_USERNAME}`);
  console.log('🔒 Xavfsizlik: ✅');
  console.log("💳 To'lov tizimi: ✅");
  console.log('💳 Kartalar: ✅');
  console.log('📢 Kanallar: ✅');
  console.log('📌 Obuna tizimi: ✅');
  console.log('');

  process.once('SIGINT', () => {
    console.log('\n⏹ SIGINT');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('\n⏹ SIGTERM');
    bot.stop('SIGTERM');
  });
}

main().catch((err) => {
  console.error('❌ Ishga tushirish xatosi:', err);
  process.exit(1);
});