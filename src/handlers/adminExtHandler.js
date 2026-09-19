// Admin qo'shimcha handlerlari (39, 44, 46)
const { Markup } = require('telegraf');
const adminExtService = require('../services/adminExtService');
const userService = require('../services/userService');
const channelService = require('../services/channelService');
const settingsService = require('../services/settingsService');
const { CALLBACK, ROLES, STATES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 39. BAN TIZIMI
  // ============================================================
  bot.action(CALLBACK.ADMIN_BAN, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const banned = await adminExtService.listBanned();
    const lines = [];
    lines.push(`🚫 <b>Ban qilinganlar (${banned.length})</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    if (!banned.length) lines.push('<i>Yo\'q</i>');
    else banned.slice(0, 20).forEach((b, i) => {
      lines.push(`${i + 1}. <code>${b.userId}</code> — ${escapeHtml(b.reason)}`);
    });

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Ban qilish', 'admin:ban:new')],
      [Markup.button.callback('➖ Unban', 'admin:ban:unban')],
      [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(ctx, lines.join('\n'), { reply_markup: kb.reply_markup });
  });

  bot.action('admin:ban:new', async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.ADMIN_BAN_INPUT, data: {} };
    await ctx.reply('🚫 Ban qilinadigan foydalanuvchi Telegram ID sini yuboring:');
  });

  bot.action('admin:ban:unban', async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.ADMIN_UNBAN_INPUT, data: {} };
    await ctx.reply('➖ Unban qilinadigan foydalanuvchi ID sini yuboring:');
  });

  // ============================================================
  // 44. AMALLAR TARIXI
  // ============================================================
  bot.action(CALLBACK.ADMIN_ACTIONS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const { total, actions } = await adminExtService.getActions(15);
    const text = adminExtService.formatActions(actions);

    await safeEdit(ctx, `${text}\n\n📊 Jami: <b>${total}</b>`, {
      reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]] },
    });
  });

  // ============================================================
  // LOG KO'RISH
  // ============================================================
  bot.action(CALLBACK.ADMIN_LOGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const logs = await adminExtService.getRecentLogs(15);
    const text = adminExtService.formatLogs(logs);

    await safeEdit(ctx, text, {
      reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]] },
    });
  });

  // ============================================================
  // 46. KANAL SOZLAMASI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNEL, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN) return ctx.reply('⛔ Faqat Super Admin.');

    const channelId = await channelService.getChannel();

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Kanal ID kiritish', 'admin:ch:set')],
      ...(channelId ? [[Markup.button.callback('🗑 O\'chirish', 'admin:ch:del')]] : []),
      [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(
      ctx,
      `📢 <b>Kanal sozlamalari</b>\n\n` +
        `Hozirgi kanal: <code>${escapeHtml(channelId || 'ulanmagan')}</code>\n\n` +
        `💡 <i>Turnirlar avtomatik shu kanalga e'lon qilinadi.</i>`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action('admin:ch:set', async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };
    await ctx.reply('📢 Kanal ID yoki @username kiriting:\n\n<i>Masalan: @my_channel yoki -1001234567890</i>', { parse_mode: 'HTML' });
  });

  bot.action('admin:ch:del', async (ctx) => {
    await safeAnswer(ctx);
    await channelService.unsetChannel();
    await ctx.reply('✅ Kanal uziIdi.');
  });

  // ============================================================
  // FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();

    // ---------- BAN ----------
    if (s === STATES.ADMIN_BAN_INPUT) {
      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply('❗ Faqat raqamli ID:');
      const targetId = Number(v);
      ctx.session = { state: null, data: {} };

      await adminExtService.banUser(targetId, 'Admin tomonidan', ctx.from.id);
      await adminExtService.logAction(ctx.from.id, 'BAN_USER', { target: targetId });

      await ctx.reply(`✅ <code>${targetId}</code> ban qilindi.`, { parse_mode: 'HTML' });
      try {
        await ctx.telegram.sendMessage(targetId, '🚫 Siz botdan bloklandingiz.');
      } catch {}
      return;
    }

    // ---------- UNBAN ----------
    if (s === STATES.ADMIN_UNBAN_INPUT) {
      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply('❗ Faqat raqamli ID:');
      const targetId = Number(v);
      ctx.session = { state: null, data: {} };

      await adminExtService.unbanUser(targetId);
      await adminExtService.logAction(ctx.from.id, 'UNBAN_USER', { target: targetId });

      await ctx.reply(`✅ <code>${targetId}</code> unban qilindi.`, { parse_mode: 'HTML' });
      return;
    }

    // ---------- KANAL ----------
    if (s === STATES.ADMIN_CHANNEL_INPUT) {
      const v = cleanText(ctx.message.text, 100);
      ctx.session = { state: null, data: {} };
      try {
        await channelService.setChannel(v);
        await ctx.reply(`✅ Kanal ulandi: <code>${escapeHtml(v)}</code>`, { parse_mode: 'HTML' });
      } catch (e) {
        await ctx.reply('❌ ' + e.message);
      }
      return;
    }

    // ---------- DM ----------
    if (s === STATES.ADMIN_DM_MSG) {
      const text = cleanText(ctx.message.text, 2000);
      const targetId = ctx.session.data.targetId;
      ctx.session = { state: null, data: {} };
      try {
        await ctx.telegram.sendMessage(targetId, `📨 <b>Admin xabari:</b>\n\n${escapeHtml(text)}`, { parse_mode: 'HTML' });
        await adminExtService.logAction(ctx.from.id, 'DM_USER', { target: targetId });
        await ctx.reply('✅ Xabar yuborildi.');
      } catch (e) {
        await ctx.reply('❌ Yuborilmadi: foydalanuvchi botni bloklagan bo\'lishi mumkin.');
      }
      return;
    }

    return next();
  });
};