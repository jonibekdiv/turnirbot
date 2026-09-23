// ============================================================
// ADMIN EXT HANDLER — Ban, log, kanal, sozlamalar
// ============================================================
const { Markup } = require('telegraf');
const adminExtService = require('../services/adminExtService');
const userService = require('../services/userService');
const channelService = require('../services/channelService');
const settingsService = require('../services/settingsService');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const {
  hasAnyRole,
  canBan,
  canEditSettings,
  canManageChannel,
  canManageUsers,
} = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 1. BAN TIZIMI — Faqat Admin/Super Admin
  // ============================================================
  bot.action(CALLBACK.ADMIN_BAN, async (ctx) => {
    await safeAnswer(ctx);
    if (!canBan(ctx.state.role)) {
      return ctx.reply("⛔ Faqat Admin ban tizimini boshqara oladi.");
    }

    const banned = await adminExtService.listBanned();
    const lines = [];
    lines.push(`🚫 <b>Ban qilinganlar (${banned.length})</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (!banned.length) {
      lines.push("<i>Yo'q</i>");
    } else {
      banned.slice(0, 20).forEach((b, i) => {
        lines.push(`${i + 1}. <code>${b.userId}</code> — ${escapeHtml(b.reason)}`);
      });
      if (banned.length > 20) {
        lines.push(`\n<i>... va yana ${banned.length - 20} ta</i>`);
      }
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Ban qilish', 'admin:ban:new')],
      [Markup.button.callback('➖ Unban', 'admin:ban:unban')],
      [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(ctx, lines.join('\n'), { reply_markup: kb.reply_markup });
  });

  bot.action('admin:ban:new', async (ctx) => {
    await safeAnswer(ctx);
    if (!canBan(ctx.state.role)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    ctx.session = { state: STATES.ADMIN_BAN_INPUT, data: {} };
    await ctx.reply(
      `🚫 <b>Ban qilish</b>\n\n` +
        `Foydalanuvchi Telegram ID sini yuboring:\n\n` +
        `<i>Masalan: 123456789</i>`,
      { parse_mode: 'HTML' }
    );
  });

  bot.action('admin:ban:unban', async (ctx) => {
    await safeAnswer(ctx);
    if (!canBan(ctx.state.role)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    ctx.session = { state: STATES.ADMIN_UNBAN_INPUT, data: {} };
    await ctx.reply(
      `➖ <b>Unban qilish</b>\n\n` +
        `Foydalanuvchi Telegram ID sini yuboring:`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 2. ADMIN AMALLAR TARIXI — Admin + Organizer (ko'rish)
  // ============================================================
  bot.action(CALLBACK.ADMIN_ACTIONS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const { total, actions } = await adminExtService.getActions(15);
    const text = adminExtService.formatActions(actions);

    await safeEdit(
      ctx,
      `${text}\n\n📊 Jami: <b>${total}</b>`,
      {
        reply_markup: {
          inline_keyboard: [[Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]],
        },
      }
    );
  });

  // ============================================================
  // 3. XATO LOGLARI — Admin + Organizer
  // ============================================================
  bot.action(CALLBACK.ADMIN_LOGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const logs = await adminExtService.getRecentLogs(15);
    const text = adminExtService.formatLogs(logs);

    await safeEdit(ctx, text, {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]],
      },
    });
  });

  // ============================================================
  // 4. KANAL SOZLAMALARI — Admin + Organizer
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNEL, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageChannel(ctx.state.role)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    const channelId = await channelService.getChannel();

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Kanal ID kiritish', 'admin:ch:set')],
      ...(channelId ? [[Markup.button.callback("🗑 O'chirish", 'admin:ch:del')]] : []),
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
    if (!canManageChannel(ctx.state.role)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };
    await ctx.reply(
      `📢 <b>Kanal ID yoki @username kiriting:</b>\n\n` +
        `📌 <b>Formatlar:</b>\n` +
        `• <code>@my_channel</code>\n` +
        `• <code>-1001234567890</code>\n\n` +
        `⚠️ <b>Muhim:</b> Bot kanalda <b>admin</b> bo'lishi shart!`,
      { parse_mode: 'HTML' }
    );
  });

  bot.action('admin:ch:del', async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageChannel(ctx.state.role)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    await channelService.unsetChannel();
    await ctx.reply("✅ Kanal uzildi.", {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]],
      },
    });
  });

  // ============================================================
  // 5. SHAXSIY XABAR YUBORISH — Faqat Admin
  // ============================================================
  bot.action(CALLBACK.ADMIN_DM, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageUsers(ctx.state.role)) {
      return ctx.reply("⛔ Faqat Admin.");
    }
    ctx.session = { state: STATES.ADMIN_DM_USER, data: {} };
    await ctx.reply(
      `📨 <b>Xabar yuborish</b>\n\n` +
        `Foydalanuvchi Telegram ID sini yuboring:`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 6. FSM — MATN (ban, unban, kanal, DM)
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();

    // ---------- BAN ----------
    if (s === STATES.ADMIN_BAN_INPUT) {
      if (!canBan(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply("⛔ Ruxsat yo'q.");
      }

      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply('❗ Faqat raqamli ID:');

      const targetId = Number(v);
      ctx.session = { state: null, data: {} };

      // Super Admin'ni ban qilish mumkin emas
      const config = require('../config');
      if (targetId === Number(config.SUPER_ADMIN_ID)) {
        return ctx.reply("⛔ Super Admin'ni ban qilib bo'lmaydi.");
      }

      await adminExtService.banUser(targetId, 'Admin tomonidan', ctx.from.id);
      await adminExtService.logAction(ctx.from.id, 'BAN_USER', { target: targetId });

      await ctx.reply(
        `✅ <code>${targetId}</code> ban qilindi.`,
        { parse_mode: 'HTML' }
      );

      try {
        await ctx.telegram.sendMessage(
          targetId,
          "🚫 Siz botdan bloklandingiz."
        );
      } catch (e) {}
      return;
    }

    // ---------- UNBAN ----------
    if (s === STATES.ADMIN_UNBAN_INPUT) {
      if (!canBan(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply("⛔ Ruxsat yo'q.");
      }

      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply('❗ Faqat raqamli ID:');

      const targetId = Number(v);
      ctx.session = { state: null, data: {} };

      await adminExtService.unbanUser(targetId);
      await adminExtService.logAction(ctx.from.id, 'UNBAN_USER', { target: targetId });

      await ctx.reply(
        `✅ <code>${targetId}</code> unban qilindi.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // ---------- KANAL ----------
    if (s === STATES.ADMIN_CHANNEL_INPUT) {
      if (!canManageChannel(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply("⛔ Ruxsat yo'q.");
      }

      const v = cleanText(ctx.message.text, 100);
      ctx.session = { state: null, data: {} };

      try {
        await channelService.setChannel(v);
        await ctx.reply(
          `✅ Kanal ulandi: <code>${escapeHtml(v)}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        await ctx.reply('❌ ' + (e.message || 'xato'));
      }
      return;
    }

    // ---------- DM USER ----------
    if (s === STATES.ADMIN_DM_USER) {
      if (!canManageUsers(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply("⛔ Ruxsat yo'q.");
      }

      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply('❗ Faqat raqamli ID:');

      ctx.session.data.targetId = Number(v);
      ctx.session.state = STATES.ADMIN_DM_MSG;

      await ctx.reply('📝 Xabar matnini kiriting:');
      return;
    }

    // ---------- DM MSG ----------
    if (s === STATES.ADMIN_DM_MSG) {
      if (!canManageUsers(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply("⛔ Ruxsat yo'q.");
      }

      const text = cleanText(ctx.message.text, 2000);
      const targetId = ctx.session.data.targetId;
      ctx.session = { state: null, data: {} };

      try {
        await ctx.telegram.sendMessage(
          targetId,
          `📨 <b>Admin xabari:</b>\n\n${escapeHtml(text)}`,
          { parse_mode: 'HTML' }
        );
        await adminExtService.logAction(ctx.from.id, 'DM_USER', { target: targetId });
        await ctx.reply('✅ Xabar yuborildi.');
      } catch (e) {
        await ctx.reply(
          "❌ Yuborilmadi: foydalanuvchi botni bloklagan bo'lishi mumkin."
        );
      }
      return;
    }

    return next();
  });
};
