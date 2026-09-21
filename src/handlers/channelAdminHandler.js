// ============================================================
// CHANNEL ADMIN HANDLER — Kanallarni boshqarish (Admin panel)
// ============================================================
const { Markup } = require('telegraf');
const channelService = require('../services/channelService');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // KANALLAR MENYUSI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNELS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const channels = await channelService.listChannels();

    const lines = [];
    lines.push(`📢 <b>Kanallar (${channels.length})</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (!channels.length) {
      lines.push("<i>Hozircha kanallar yo'q</i>");
    } else {
      channels.forEach((ch, i) => {
        lines.push(`${i + 1}. <b>${escapeHtml(ch.title)}</b>`);
        if (ch.username) lines.push(`   ${escapeHtml(ch.username)}`);
        lines.push(`   ✅ Tasdiqlangan`);
        lines.push('');
      });
    }

    const rows = [];
    rows.push([Markup.button.callback('➕ Kanal qo\'shish', CALLBACK.ADMIN_CHANNELS_ADD)]);
    rows.push([Markup.button.callback('🔄 Yangilash', CALLBACK.ADMIN_CHANNELS)]);
    rows.push([Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]);

    // O'chirish tugmalari (faqat Admin)
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
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  });

  // ============================================================
  // KANAL QO'SHISH — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNELS_ADD, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.CHANNEL_ADD_INPUT, data: {} };

    await ctx.reply(
      `📢 <b>Kanal qo'shish</b>\n\n` +
        `Kanal ID yoki @username kiriting:\n\n` +
        `📌 Formatlar:\n` +
        `• <code>@kanal_uz</code>\n` +
        `• <code>-1001234567890</code>\n\n` +
        `⚠️ <b>Muhim:</b> Bot kanalda <b>admin</b> bo'lishi shart!`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Bekor qilish', callback_data: CALLBACK.ADMIN_CHANNELS }],
          ],
        },
      }
    );
  });

  // ============================================================
  // KANALNI O'CHIRISH
  // ============================================================
  bot.action(/^admin:ch_del:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) {
      return ctx.reply("⛔ Faqat Admin.");
    }

    const chId = ctx.match[1];
    await channelService.deleteChannel(chId);

    await ctx.reply("✅ Kanal o'chirildi.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Kanallar', callback_data: CALLBACK.ADMIN_CHANNELS }],
        ],
      },
    });
  });

  // ============================================================
  // FSM — KANAL KIRITISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.CHANNEL_ADD_INPUT) return next();

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return;
    }

    const v = cleanText(ctx.message.text, 100);
    if (!v) return ctx.reply("❗ Kanal ID yoki @username kiriting:");

    await ctx.reply('⏳ Kanal tekshirilmoqda...');

    const result = await channelService.verifyChannel(bot, v);

    if (!result.ok) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `❌ <b>Kanalga ulanib bo'lmadi</b>\n\n` +
          `Sabab: <code>${escapeHtml(result.reason)}</code>\n\n` +
          `💡 <b>Tekshiring:</b>\n` +
          `• Kanal ID to'g'rimi?\n` +
          `• Kanal ochiqmi?\n` +
          `• @username to'g'rimi?`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Kanallar', callback_data: CALLBACK.ADMIN_CHANNELS }],
            ],
          },
        }
      );
    }

    if (!result.isBotAdmin) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `❌ <b>Bot bu kanalda admin emas!</b>\n\n` +
          `Kanal: <b>${escapeHtml(result.chat.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 <b>Nima qilish kerak:</b>\n\n` +
          `1. Kanalga o'ting\n` +
          `2. Sozlamalar → Administratorlar\n` +
          `3. Botni qo'shing (@${require('../config').BOT_USERNAME})\n` +
          `4. Unga <b>"Post messages"</b> huquqini bering\n` +
          `5. Qaytadan urinib ko'ring`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Kanallar', callback_data: CALLBACK.ADMIN_CHANNELS }],
            ],
          },
        }
      );
    }

    // Kanalni saqlash
    try {
      const existing = await channelService.findByChannelId(result.chat.id);
      if (existing) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(
          `ℹ️ <b>Bu kanal allaqachon qo'shilgan</b>\n\n` +
            `<b>${escapeHtml(existing.title)}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⬅️ Kanallar', callback_data: CALLBACK.ADMIN_CHANNELS }],
              ],
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
        `✅ <b>Kanal qo'shildi!</b>\n\n` +
          `📛 Nomi: <b>${escapeHtml(result.chat.title)}</b>\n` +
          (result.chat.username ? `🔗 Username: @${escapeHtml(result.chat.username)}\n` : '') +
          `🆔 ID: <code>${result.chat.id}</code>\n` +
          `🤖 Bot admin: ✅\n\n` +
          `<i>Endi bu kanalni bepul turnirlarga majburiy qilib qo'shishingiz mumkin.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Kanallar', callback_data: CALLBACK.ADMIN_CHANNELS }],
            ],
          },
        }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });
};