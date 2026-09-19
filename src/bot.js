// Botning asosiy kirish nuqtasi
const { Telegraf, session } = require('telegraf');
const config = require('./config');
const { ensureAllFiles } = require('./storage/jsonStore');
const { errorHandler } = require('./middlewares/errorHandler');
const { authMiddleware } = require('./middlewares/auth');
const { banCheckMiddleware } = require('./middlewares/banCheck');
const reminderService = require('./services/reminderService');
const cronService = require('./services/cronService');

// Handlerlar — TARTIB MUHIM!
const startHandler = require('./handlers/startHandler');
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
const searchHandler = require('./handlers/searchHandler');
const inlineHandler = require('./handlers/inlineHandler');

async function main() {
  if (!config.BOT_TOKEN) throw new Error("BOT_TOKEN .env da ko'rsatilmagan");
  if (!config.SUPER_ADMIN_ID) throw new Error("SUPER_ADMIN_ID .env da ko'rsatilmagan");

  await ensureAllFiles();

  const bot = new Telegraf(config.BOT_TOKEN);

  // ============================================================
  // MIDDLEWARELAR (tartib muhim!)
  // ============================================================
  bot.use(session());
  bot.use(errorHandler);
  bot.use(banCheckMiddleware);
  bot.use(authMiddleware);

  // ============================================================
  // HANDLERLAR (tartib muhim — FSM va action uchun)
  // ============================================================
  startHandler(bot);          // /start, menu:main, menu:profile, menu:help
  userExtHandler(bot);        // PUBG ID, stats, achievements, leaderboard
  teamHandler(bot);           // Komanda yaratish/qo'shilish/chiqish
  teamExtHandler(bot);        // Komanda tahrirlash, captain, a'zolar
  tournamentHandler(bot);     // Turnirlar ro'yxati, turnir yaratish, turnir ID
  tournamentExtHandler(bot);  // Clone, cancel, history, templates, calendar
  hostHandler(bot);           // Host panel, room, broadcast, match input
  hostExtHandler(bot);        // Kartani tahrirlash
  mediaHandler(bot);          // Voice, video, poll
  adminHandler(bot);          // Admin panel
  adminExtHandler(bot);       // Ban, logs, actions, channel
  searchHandler(bot);         // Qidiruv, filtrlar
  inlineHandler(bot);         // Inline mode

  // ============================================================
  // XATO USHLAGICH
  // ============================================================
  bot.catch((err, ctx) => {
    console.error('❌ Bot xatosi:', err.message || err);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 3).join('\n'));
  });

  // ============================================================
  // XIZMATLAR
  // ============================================================
  reminderService.start(bot);
  try { cronService.start(bot); } catch (e) { console.log('Cron ishlamadi:', e.message); }

  // ============================================================
  // ISHGA TUSHIRISH
  // ============================================================
  await bot.launch();
  console.log('✅ Bot ishga tushdi');
  console.log('👤 Super Admin ID:', config.SUPER_ADMIN_ID);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Ishga tushirish xatosi:', err);
  process.exit(1);
});