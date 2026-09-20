// ============================================================
// BOT.JS — Asosiy kirish nuqtasi (xavfsiz)
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

// Handlerlar
const startHandler = require('./handlers/startHandler');
const languageHandler = require('./handlers/languageHandler');
const userExtHandler = require('./handlers/userExtHandler');
const teamHandler = require('./handlers/teamHandler');
const teamExtHandler = require('./handlers/teamExtHandler');
const tournamentHandler = require('./handlers/tournamentHandler');
const tournamentExtHandler = require('./handlers/tournamentExtHandler');
const hostHandler = require('./handlers/hostHandler');
const hostExtHandler = require('./handlers/hostExtHandler');
const mediaHandler = require('./handlers/mediaHandler');
const adminHandler = require('./handlers/adminHandler');
const adminExtHandler = require('./handlers/adminExtHandler');
const channelHandler = require('./handlers/channelHandler');
const searchHandler = require('./handlers/searchHandler');
const inlineHandler = require('./handlers/inlineHandler');

async function main() {
  if (!config.BOT_TOKEN) throw new Error("BOT_TOKEN .env da yo'q");
  if (!config.SUPER_ADMIN_ID) throw new Error("SUPER_ADMIN_ID .env da yo'q");

  await ensureAllFiles();

  const bot = new Telegraf(config.BOT_TOKEN);

  // ============================================================
  // MIDDLEWARELAR (TARTIB MUHIM!)
  // ============================================================
  bot.use(session());
  bot.use(rateLimitMiddleware);       // ← 1. Rate limit
  bot.use(errorHandler);              // ← 2. Xato ushlash
  bot.use(banCheckMiddleware);        // ← 3. Ban tekshiruv
  bot.use(authMiddleware);            // ← 4. Auth
  bot.use(langMiddleware);            // ← 5. Til

  // ============================================================
  // HANDLERLAR
  // ============================================================
  startHandler(bot);
  languageHandler(bot);
  userExtHandler(bot);
  teamHandler(bot);
  teamExtHandler(bot);
  tournamentHandler(bot);
  tournamentExtHandler(bot);
  hostHandler(bot);
  hostExtHandler(bot);
  mediaHandler(bot);
  adminHandler(bot);
  adminExtHandler(bot);
  channelHandler(bot);
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

  // ============================================================
  // ISHGA TUSHIRISH
  // ============================================================
  await bot.launch();
  console.log('╔══════════════════════╗');
  console.log('   ✅ BOT ISHGA TUSHDI');
  console.log('╚══════════════════════╝');
  console.log(`👤 Super Admin: ${config.SUPER_ADMIN_ID}`);
  console.log(`🤖 Bot: @${config.BOT_USERNAME}`);
  console.log('🔒 Xavfsizlik: ✅ Rate limit, Ban check, Error log');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Ishga tushirish xatosi:', err);
  process.exit(1);
});