// ============================================================
// BOT.JS — Asosiy kirish nuqtasi (OCR integratsiyasi bilan)
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
} catch (e) {
  console.log('⚠️ cronService yuklanmadi:', e.message);
}

let commandsService = null;
try {
  commandsService = require('./services/commandsService');
} catch (e) {
  console.log('⚠️ commandsService yuklanmadi:', e.message);
}

let stageReminderService = null;
try {
  stageReminderService = require('./services/stageReminderService');
} catch (e) {
  console.log('⚠️ stageReminderService yuklanmadi:', e.message);
}

// ============================================================
// HANDLERLAR
// ============================================================

// 1. Asosiy
const startHandler = require('./handlers/startHandler');
const languageHandler = require('./handlers/languageHandler');

// 2. Foydalanuvchi va komanda
const userExtHandler = require('./handlers/userExtHandler');
const teamHandler = require('./handlers/teamHandler');
const teamExtHandler = require('./handlers/teamExtHandler');

// 3. Karta
const cardHandler = require('./handlers/cardHandler');

// 4. To'lov va obuna
const tournamentCreatePaymentHandler = require('./handlers/tournamentCreatePaymentHandler');
const subscriptionHandler = require('./handlers/subscriptionHandler');

// 5. Turnirlar
const tournamentHandler = require('./handlers/tournamentHandler');
const tournamentPaymentHandler = require('./handlers/tournamentPaymentHandler');
const tournamentExtHandler = require('./handlers/tournamentExtHandler');

// 6. YANGI HANDLERLAR
const waitlistHandler = require('./handlers/waitlistHandler');
const teamStatsHandler = require('./handlers/teamStatsHandler');
const broadcastStatsHandler = require('./handlers/broadcastStatsHandler');
const liveScoreHandler = require('./handlers/liveScoreHandler');

// 7. Host
const hostHandler = require('./handlers/hostHandler');
const hostResultOCRHandler = require('./handlers/hostResultOCRHandler');
const hostExtHandler = require('./handlers/hostExtHandler');
const mediaHandler = require('./handlers/mediaHandler');

// 8. Admin
const adminHandler = require('./handlers/adminHandler');
const adminExtHandler = require('./handlers/adminExtHandler');
const organizerHandler = require('./handlers/organizerHandler');

// 9. Channel
const channelHandler = require('./handlers/channelHandler');
const channelAdminHandler = require('./handlers/channelAdminHandler');

// 10. To'lov review
const paymentHandler = require('./handlers/paymentHandler');
const organizerPaymentReviewHandler = require('./handlers/organizerPaymentReviewHandler');

// 11. Qidiruv va Inline
const searchHandler = require('./handlers/searchHandler');
const inlineHandler = require('./handlers/inlineHandler');

// 12. PROMO + SUPPORT + WALLET
const promoHandler = require('./handlers/promoHandler');
const supportHandler = require('./handlers/supportHandler');
const walletHandler = require('./handlers/walletHandler');
const walletAdminHandler = require('./handlers/walletAdminHandler');

// ============================================================
// 13. ETAPLAR TIZIMI
// ============================================================
const stageHandler = require('./handlers/stageHandler');
const promotionHandler = require('./handlers/promotionHandler');
const invitationHandler = require('./handlers/invitationHandler');
const hostStageHandler = require('./handlers/hostStageHandler');

// ============================================================
// ASOSIY FUNKSIYA
// ============================================================
async function main() {
  if (!config.BOT_TOKEN) {
    throw new Error("BOT_TOKEN .env da ko'rsatilmagan");
  }
  if (!config.SUPER_ADMIN_ID) {
    throw new Error("SUPER_ADMIN_ID .env da ko'rsatilmagan");
  }

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

  // 3. Karta handler
  cardHandler(bot);

  // 4. To'lov va obuna
  tournamentCreatePaymentHandler(bot);
  subscriptionHandler(bot);

  // 5. Turnirlar
  tournamentHandler(bot);
  tournamentPaymentHandler(bot);
  tournamentExtHandler(bot);

  // 6. YANGI HANDLERLAR
  waitlistHandler(bot);
  teamStatsHandler(bot);
  broadcastStatsHandler(bot);
  liveScoreHandler(bot);

  // 7. Host (OCR handler hostHandler'dan keyin)
  hostHandler(bot);
  hostResultOCRHandler(bot);
  // hostExtHandler(bot);  // ⚠️ hostHandler bilan dublikat
  mediaHandler(bot);

  // 8. Admin
  adminHandler(bot);
  adminExtHandler(bot);
  organizerPaymentReviewHandler(bot);  // ← pay:view:, ORG_PENDING_PAYMENTS
  organizerHandler(bot);

  // 9. Channel
  channelHandler(bot);
  channelAdminHandler(bot);

  // 10. To'lov review
  paymentHandler(bot);

  // 11. Qidiruv va Inline
  searchHandler(bot);
  inlineHandler(bot);

  // 12. PROMO + SUPPORT + WALLET
  promoHandler(bot);
  supportHandler(bot);
  walletHandler(bot);
  walletAdminHandler(bot);

  // ============================================================
  // 13. ETAPLAR TIZIMI
  // ============================================================
  stageHandler(bot);
  promotionHandler(bot);
  invitationHandler(bot);
  hostStageHandler(bot);

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
        ctx
          .reply("❌ Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.")
          .catch(() => {});
      }
    } catch (e) {}
  });

  // ============================================================
  // XIZMATLAR
  // ============================================================
  reminderService.start(bot);

  if (stageReminderService) {
    try {
      stageReminderService.start(bot);
    } catch (e) {
      console.log('⚠️ Stage Reminder xato:', e.message);
    }
  }

  if (cronService) {
    try {
      cronService.start(bot);
    } catch (e) {
      console.log('⚠️ Cron xato:', e.message);
    }
  }

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
  console.log('');
  console.log('🔒 Xavfsizlik: ✅');
  console.log("💳 To'lov tizimi: ✅");
  console.log('💳 Kartalar: ✅');
  console.log('📢 Kanallar: ✅');
  console.log('📌 Obuna tizimi: ✅');
  console.log('🎯 Organizer panel: ✅');
  console.log("📋 Kutish ro'yxati: ✅");
  console.log('📊 Komanda statistikasi: ✅');
  console.log('📢 Reklama statistikasi: ✅');
  console.log('🔴 Live score: ✅');
  console.log('⏳ Bron tizimi: ✅');
  console.log('📅 Kunlik eslatmalar: ✅');
  console.log('👁 Guest rejim: ✅');
  console.log('📚 Tarix: ✅');
  console.log('📅 Kalendar: ✅');
  console.log('📋 Shablonlar: ✅');
  console.log('🎫 Promo kodlar: ✅');
  console.log("❌ A'zo kick: ✅");
  console.log('💬 Support/Forum: ✅');
  console.log('💰 Wallet: ✅');
  console.log('📊 ETAPLAR TIZIMI: ✅');
  console.log('⬆️ Promotion: ✅');
  console.log('📨 Invitation: ✅');
  console.log('🎙 Host Stage Panel: ✅');
    console.log('📸 OCR (Tesseract): ✅');// ← YANGI
  console.log('⏰ Stage Reminders: ✅');
  console.log('');

  process.once('SIGINT', () => {
    console.log('\n⏹ SIGINT');
    if (stageReminderService) stageReminderService.stop();
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('\n⏹ SIGTERM');
    if (stageReminderService) stageReminderService.stop();
    bot.stop('SIGTERM');
  });
}

main().catch((err) => {
  console.error('❌ Ishga tushirish xatosi:', err);
  process.exit(1);
});