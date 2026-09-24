// ============================================================
// ADMIN EXT HANDLER — Ban, log, kanal, sozlamalar (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const adminExtService = require('../services/adminExtService');
const channelService = require('../services/channelService');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const { hasAnyRole, canBan, canManageChannel, canManageUsers } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 1. BAN TIZIMI
  // ============================================================
  bot.action(CALLBACK.ADMIN_BAN, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canBan(ctx.state.role)) return ctx.reply(`⛔ ${t('error_access')}`);

    const banned = await adminExtService.listBanned();
    const lines = [];
    lines.push(`🚫 <b>${t('admin_ban')} (${banned.length})</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (!banned.length) {
      lines.push(`<i>${t('no_data')}</i>`);
    } else {
      banned.slice(0, 20).forEach((b, i) => {
        lines.push(`${i + 1}. <code>${b.userId}</code> — ${escapeHtml(b.reason)}`);
      });
      if (banned.length > 20) {
        lines.push(`\n<i>... +${banned.length - 20}</i>`);
      }
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('➕ ' + t('btn_add'), 'admin:ban:new')],
      [Markup.button.callback('➖ ' + t('btn_delete'), 'admin:ban:unban')],
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(ctx, lines.join('\n'), { reply_markup: kb.reply_markup });
  });

  bot.action('admin:ban:new', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canBan(ctx.state.role)) return ctx.reply(`⛔ ${t('error_access')}`);

    ctx.session = { state: STATES.ADMIN_BAN_INPUT, data: {} };
    await ctx.reply(
      `🚫 <b>${t('admin_ban')}</b>\n\n${t('admin_send_id')}\n\n<i>${t('admin_id_example')}: 123456789</i>`,
      { parse_mode: 'HTML' }
    );
  });

  bot.action('admin:ban:unban', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canBan(ctx.state.role)) return ctx.reply(`⛔ ${t('error_access')}`);

    ctx.session = { state: STATES.ADMIN_UNBAN_INPUT, data: {} };
    await ctx.reply(`➖ <b>${t('admin_ban')}</b>\n\n${t('admin_send_id')}`, { parse_mode: 'HTML' });
  });

  // ============================================================
  // 2. ADMIN ACTIONS
  // ============================================================
  bot.action(CALLBACK.ADMIN_ACTIONS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const { total, actions } = await adminExtService.getActions(15);
    const text = adminExtService.formatActions(actions);

    await safeEdit(ctx, `${text}\n\n📊 ${t('promotion_total')}: <b>${total}</b>`, {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]],
      },
    });
  });

  // ============================================================
  // 3. LOGS
  // ============================================================
  bot.action(CALLBACK.ADMIN_LOGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    const t = ctx.t;

    const logs = await adminExtService.getRecentLogs(15);
    const text = adminExtService.formatLogs(logs);

    await safeEdit(ctx, text, {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]],
      },
    });
  });

  // ============================================================
  // 4. KANAL SOZLAMALARI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNEL, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageChannel(ctx.state.role)) return ctx.reply(`⛔ ${t('error_access')}`);

    const channelId = await channelService.getChannel();

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ ' + t('channel_add_prompt').slice(0, 20), 'admin:ch:set')],
      ...(channelId ? [[Markup.button.callback('🗑 ' + t('btn_delete'), 'admin:ch:del')]] : []),
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(
      ctx,
      `📢 <b>${t('admin_channel')}</b>\n\n` +
        `${t('admin_active')}: <code>${escapeHtml(channelId || '-')}</code>\n\n` +
        `💡 <i>${t('ch_announce_btn')}</i>`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action('admin:ch:set', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageChannel(ctx.state.role)) return ctx.reply(`⛔ ${t('error_access')}`);

    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };
    await ctx.reply(
      `📢 <b>${t('channel_add_prompt')}</b>\n\n` +
        `📌 <b>Format:</b>\n` +
        `• <code>@my_channel</code>\n` +
        `• <code>-1001234567890</code>\n\n` +
        `⚠️ <b>${t('channel_not_admin').slice(0, 30)}</b>`,
      { parse_mode: 'HTML' }
    );
  });

  bot.action('admin:ch:del', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageChannel(ctx.state.role)) return ctx.reply(`⛔ ${t('error_access')}`);

    await channelService.unsetChannel();
    await ctx.reply(`✅ ${t('ch_list_title')} - ${t('btn_delete')}`, {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]],
      },
    });
  });

  // ============================================================
  // 5. DM USER
  // ============================================================
  bot.action(CALLBACK.ADMIN_DM, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageUsers(ctx.state.role)) return ctx.reply(`⛔ ${t('error_only_admin')}`);

    ctx.session = { state: STATES.ADMIN_DM_USER, data: {} };
    await ctx.reply(`📨 <b>${t('support_reply_btn')}</b>\n\n${t('admin_send_id')}`, { parse_mode: 'HTML' });
  });

  // ============================================================
  // 6. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    const t = ctx.t;

    // BAN
    if (s === STATES.ADMIN_BAN_INPUT) {
      if (!canBan(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(`⛔ ${t('error_access')}`);
      }

      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);

      const targetId = Number(v);
      ctx.session = { state: null, data: {} };

      const config = require('../config');
      if (targetId === Number(config.SUPER_ADMIN_ID)) {
        return ctx.reply(`⛔ ${t('error_only_super')}`);
      }

      await adminExtService.banUser(targetId, 'Admin', ctx.from.id);
      await adminExtService.logAction(ctx.from.id, 'BAN_USER', { target: targetId });

      await ctx.reply(`✅ <code>${targetId}</code> - ${t('admin_ban')}`, { parse_mode: 'HTML' });

      try {
        await ctx.telegram.sendMessage(targetId, `🚫 ${t('error_access')}`);
      } catch (e) {}
      return;
    }

    // UNBAN
    if (s === STATES.ADMIN_UNBAN_INPUT) {
      if (!canBan(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(`⛔ ${t('error_access')}`);
      }

      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);

      const targetId = Number(v);
      ctx.session = { state: null, data: {} };

      await adminExtService.unbanUser(targetId);
      await adminExtService.logAction(ctx.from.id, 'UNBAN_USER', { target: targetId });

      await ctx.reply(`✅ <code>${targetId}</code> - ${t('success')}`, { parse_mode: 'HTML' });
      return;
    }

    // KANAL
    if (s === STATES.ADMIN_CHANNEL_INPUT) {
      if (!canManageChannel(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(`⛔ ${t('error_access')}`);
      }

      const v = cleanText(ctx.message.text, 100);
      ctx.session = { state: null, data: {} };

      try {
        await channelService.setChannel(v);
        await ctx.reply(`✅ <code>${escapeHtml(v)}</code>`, { parse_mode: 'HTML' });
      } catch (e) {
        await ctx.reply(`❌ ${e.message || t('error_generic')}`);
      }
      return;
    }

    // DM USER
    if (s === STATES.ADMIN_DM_USER) {
      if (!canManageUsers(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(`⛔ ${t('error_only_admin')}`);
      }

      const v = cleanText(ctx.message.text, 20);
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);

      ctx.session.data.targetId = Number(v);
      ctx.session.state = STATES.ADMIN_DM_MSG;
      await ctx.reply(`📝 ${t('support_enter_text')}`);
      return;
    }

    // DM MSG
    if (s === STATES.ADMIN_DM_MSG) {
      if (!canManageUsers(ctx.state.role)) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(`⛔ ${t('error_only_admin')}`);
      }

      const text = cleanText(ctx.message.text, 2000);
      const targetId = ctx.session.data.targetId;
      ctx.session = { state: null, data: {} };

      try {
        await ctx.telegram.sendMessage(
          targetId,
          `📨 <b>${t('support_reply_to_user')}:</b>\n\n${escapeHtml(text)}`,
          { parse_mode: 'HTML' }
        );
        await adminExtService.logAction(ctx.from.id, 'DM_USER', { target: targetId });
        await ctx.reply(`✅ ${t('success')}`);
      } catch (e) {
        await ctx.reply(`❌ ${t('error_generic')}`);
      }
      return;
    }

    return next();
  });
};