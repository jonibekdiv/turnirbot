// ============================================================
// CHANNEL ADMIN HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const channelService = require('../services/channelService');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 1. KANALLAR MENYUSI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNELS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const channels = await channelService.listChannels();

    const lines = [];
    lines.push(`📢 <b>${t('ch_list_title')} (${channels.length})</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (!channels.length) {
      lines.push(`<i>${t('no_data')}</i>`);
    } else {
      channels.forEach((ch, i) => {
        lines.push(`${i + 1}. <b>${escapeHtml(ch.title)}</b>`);
        if (ch.username) lines.push(`   ${escapeHtml(ch.username)}`);
        lines.push(`   ✅ ${t('success')}`);
        lines.push('');
      });
    }

    const rows = [];
    rows.push([Markup.button.callback(t('ch_add_btn'), CALLBACK.ADMIN_CHANNELS_ADD)]);
    rows.push([Markup.button.callback(t('btn_refresh'), CALLBACK.ADMIN_CHANNELS)]);
    rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    if (ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN) {
      channels.slice(0, 5).forEach((ch) => {
        rows.unshift([
          Markup.button.callback(
            `🗑 ${ch.title.slice(0, 30)}`,
            'admin:ch_del:' + ch.id
          ),
        ]);
      });
    }

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // 2. KANAL QO'SHISH
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNELS_ADD, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.CHANNEL_ADD_INPUT, data: {} };

    await ctx.reply(
      `📢 <b>${t('channel_add_prompt')}</b>\n\n` +
        `${t('stage_room_format')}:\n` +
        `• <code>@kanal_uz</code>\n` +
        `• <code>-1001234567890</code>\n\n` +
        `⚠️ <b>${t('channel_not_admin').slice(0, 30)}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: t('btn_cancel'), callback_data: CALLBACK.ADMIN_CHANNELS }],
          ],
        },
      }
    );
  });

  // ============================================================
  // 3. KANALNI O'CHIRISH
  // ============================================================
  bot.action(/^admin:ch_del:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) {
      return ctx.reply(`⛔ ${t('error_only_admin')}`);
    }

    const chId = ctx.match[1];
    await channelService.deleteChannel(chId);

    await ctx.reply(`✅ ${t('success')}`, {
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_CHANNELS }]],
      },
    });
  });

  // ============================================================
  // 4. FSM — KANAL KIRITISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.CHANNEL_ADD_INPUT) return next();
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return;
    }

    const v = cleanText(ctx.message.text, 100);
    if (!v) return ctx.reply(`❗ ${t('channel_add_prompt')}:`);

    await ctx.reply(`⏳ ${t('sub_checking')}`);

    const result = await channelService.verifyChannel(bot, v);

    if (!result.ok) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `❌ <b>${t('tour_announce_fail')}</b>\n\n` +
          `${t('tour_announce_reason')}: <code>${escapeHtml(result.reason)}</code>\n\n` +
          `💡 <b>${t('tour_announce_check')}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_CHANNELS }]],
          },
        }
      );
    }

    if (!result.isBotAdmin) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `❌ <b>${t('channel_not_admin')}</b>\n\n` +
          `${t('name')}: <b>${escapeHtml(result.chat.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 <b>${t('tour_announce_check')}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_CHANNELS }]],
          },
        }
      );
    }

    try {
      const existing = await channelService.findByChannelId(result.chat.id);
      if (existing) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(
          `ℹ️ <b>${t('promo_already_used')}</b>\n\n<b>${escapeHtml(existing.title)}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_CHANNELS }]],
            },
          }
        );
      }

      await channelService.saveChannel({
        channelId: result.chat.id,
        title: result.chat.title,
        username: result.chat.username,
        inviteLink: result.chat.inviteLink,
        addedBy: ctx.from.id,
      });

      ctx.session = { state: null, data: {} };

      await ctx.reply(
        `✅ <b>${t('channel_added')}</b>\n\n` +
          `📛 ${t('name')}: <b>${escapeHtml(result.chat.title)}</b>\n` +
          (result.chat.username ? `🔗 Username: @${escapeHtml(result.chat.username)}\n` : '') +
          `🆔 ID: <code>${result.chat.id}</code>\n` +
          `🤖 Bot: ✅\n\n` +
          `<i>${t('ch_announce_btn')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_CHANNELS }]],
          },
        }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${t('error_prefix')} ${e.message || t('error_generic')}`);
    }
  });
};