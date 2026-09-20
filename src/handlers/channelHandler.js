// ============================================================
// KANAL HANDLERLARI — Turnir + Ixtiyoriy reklama
// ============================================================
const { Markup } = require('telegraf');
const channelService = require('../services/channelService');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

// ============================================================
// YORDAMCHI: ORQAGA TUGMALARI
// ============================================================
function backToAdmin() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

function backToChannel() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Kanal menyusi', CALLBACK.ADMIN_CHANNEL)],
    [Markup.button.callback('🏠 Admin panel', CALLBACK.ADMIN_PANEL)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. KANAL SOZLAMALARI MENYUSI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNEL, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) {
      return ctx.reply("⛔ Ruxsat yo'q.", backToAdmin());
    }

    const channelId = await channelService.getChannel();
    const testResult = channelId ? await channelService.testChannel(bot) : null;

    const statusLine = !channelId
      ? "❌ <b>Kanal ulanmagan</b>"
      : testResult?.ok
      ? `✅ <b>Ulangan:</b> ${escapeHtml(testResult.title)}\n   <code>${escapeHtml(channelId)}</code>`
      : `⚠️ <b>Xatolik:</b> ${escapeHtml(testResult?.reason || 'Noma\'lum')}\n   <code>${escapeHtml(channelId)}</code>`;

    const rows = [];
    if (channelId) {
      rows.push([Markup.button.callback('📢 Test xabar yuborish', 'channel:test')]);
      rows.push([
        Markup.button.callback('📝 Ixtiyoriy matn', 'channel:custom_text'),
      ]);
      rows.push([
        Markup.button.callback('🖼 Ixtiyoriy rasm', 'channel:custom_photo'),
      ]);
      rows.push([
        Markup.button.callback('✏️ Kanal ID o\'zgartirish', 'channel:change'),
      ]);
      rows.push([Markup.button.callback('🗑 Kanalni o\'chirish', 'channel:delete')]);
    } else {
      rows.push([Markup.button.callback('➕ Kanal ulash', 'channel:set')]);
    }
    rows.push([Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]);

    const text =
      `📢 <b>Kanal sozlamalari</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${statusLine}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 <i>Kanal ulangandan keyin turnirni kanalga e'lon qilish mumkin.</i>`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  });

  // ============================================================
  // 2. KANALNI ULASH
  // ============================================================
  bot.action('channel:set', async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };

    await ctx.reply(
      `📢 <b>Kanal ID yoki @username kiriting:</b>\n\n` +
        `📌 <b>Formatlar:</b>\n` +
        `• <code>@my_channel</code>\n` +
        `• <code>-1001234567890</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ <b>Muhim:</b> Bot kanalda <b>admin</b> bo'lishi shart!`,
      { parse_mode: 'HTML', reply_markup: backToChannel().reply_markup }
    );
  });

  bot.action('channel:change', async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };
    await ctx.reply('✏️ Yangi kanal ID yoki @username kiriting:', {
      reply_markup: backToChannel().reply_markup,
    });
  });

  bot.action('channel:delete', async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    await channelService.unsetChannel();
    await ctx.reply('✅ Kanal uzildi.', backToAdmin());
  });

  // ============================================================
  // 3. TEST XABAR
  // ============================================================
  bot.action('channel:test', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const res = await channelService.sendCustomText(
      bot,
      `🧪 <b>Test xabar</b>\n\n✅ Bot kanalga ulangan!\n\n<i>Bu — test xabari.</i>`,
      null,
      null
    );

    if (res.ok) {
      await ctx.reply('✅ Test xabar kanalga yuborildi!', backToChannel());
    } else {
      await ctx.reply(`❌ Yuborilmadi: ${escapeHtml(res.reason)}`, backToChannel());
    }
  });

  // ============================================================
  // 4. IXTIYORIY MATN REKLAMA — BOSHLASH
  // ============================================================
  bot.action('channel:custom_text', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    ctx.session = { state: 'channel_custom_text', data: {} };

    await ctx.reply(
      `📝 <b>Ixtiyoriy reklama (matn)</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Reklama matnini kiriting:\n\n` +
        `💡 <i>HTML formatlash ishlaydi:</i>\n` +
        `• <code>&lt;b&gt;Qalin&lt;/b&gt;</code>\n` +
        `• <code>&lt;i&gt;Kursiv&lt;/i&gt;</code>\n` +
        `• <code>&lt;code&gt;Kod&lt;/code&gt;</code>\n` +
        `• Emoji va havolalar\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <i>Keyingi qadamda tugma qo'shish mumkin (URL bilan).</i>`,
      { parse_mode: 'HTML', reply_markup: backToChannel().reply_markup }
    );
  });

  // ============================================================
  // 5. IXTIYORIY RASM REKLAMA — BOSHLASH
  // ============================================================
  bot.action('channel:custom_photo', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    ctx.session = { state: 'channel_custom_photo', data: {} };

    await ctx.reply(
      `🖼 <b>Ixtiyoriy reklama (rasm)</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Rasm yuboring (caption bilan yoki usiz):\n\n` +
        `💡 <i>Caption'da HTML formatlash ishlaydi.</i>`,
      { parse_mode: 'HTML', reply_markup: backToChannel().reply_markup }
    );
  });

  // ============================================================
  // 6. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;

    // ---------- KANAL ID KIRITISH ----------
    if (s === STATES.ADMIN_CHANNEL_INPUT) {
      const v = cleanText(ctx.message.text, 100);
      ctx.session = { state: null, data: {} };

      try {
        await channelService.setChannel(v);
        const test = await channelService.testChannel(bot);

        if (test.ok) {
          await ctx.reply(
            `✅ <b>Kanal ulandi!</b>\n\n` +
              `📛 Nomi: <b>${escapeHtml(test.title)}</b>\n` +
              `🆔 ID: <code>${escapeHtml(v)}</code>\n` +
              `📌 Turi: <b>${escapeHtml(test.type)}</b>`,
            { parse_mode: 'HTML', ...backToChannel() }
          );
        } else {
          await ctx.reply(
            `⚠️ <b>Kanal saqlandi, lekin test xatolik berdi</b>\n\n` +
              `Sabab: <code>${escapeHtml(test.reason)}</code>\n\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `💡 <b>Tekshiring:</b>\n` +
              `1. Bot kanalda <b>admin</b>mi?\n` +
              `2. Bot "Post messages" huquqiga egami?\n` +
              `3. Kanal ID to'g'rimi?`,
            { parse_mode: 'HTML', ...backToChannel() }
          );
        }
      } catch (e) {
        await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'), backToChannel());
      }
      return;
    }

    // ---------- IXTIYORIY MATN REKLAMA ----------
    if (s === 'channel_custom_text') {
      const text = cleanText(ctx.message.text, 4000);
      if (!text) {
        return ctx.reply('❗ Matn kiriting:', backToChannel());
      }

      // Tugma so'rash
      ctx.session = {
        state: 'channel_custom_text_button',
        data: { text },
      };

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback("⏭ Tugmasiz yuborish", 'channel:send_no_button')],
        [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CHANNEL)],
      ]);

      await ctx.reply(
        `✅ Matn saqlandi!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 <b>Tugma qo'shmoqchimisiz?</b>\n\n` +
          `Format: <code>Tugma matni | https://havola.uz</code>\n\n` +
          `<i>Masalan: Bizning sayt | https://example.com</i>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
      return;
    }

    // ---------- TUGMA FORMATI ----------
    if (s === 'channel_custom_text_button') {
      const text = ctx.session.data.text;
      const input = cleanText(ctx.message.text, 200);
      ctx.session = { state: null, data: {} };

      const parts = input.split('|').map((p) => p.trim());
      if (parts.length !== 2) {
        return ctx.reply(
          '❗ Format: <code>Tugma matni | https://havola</code>',
          { parse_mode: 'HTML', reply_markup: backToChannel().reply_markup }
        );
      }

      const [btnText, btnUrl] = parts;
      if (!/^https?:\/\//i.test(btnUrl)) {
        return ctx.reply('❗ URL http:// yoki https:// bilan boshlanishi kerak');
      }

      const res = await channelService.sendCustomText(bot, text, btnText, btnUrl);

      if (res.ok) {
        await ctx.reply(
          `✅ <b>Reklama kanalga yuborildi!</b>\n\n📤 Xabar ID: <code>${res.messageId}</code>`,
          { parse_mode: 'HTML', ...backToChannel() }
        );
      } else {
        await ctx.reply(`❌ Yuborilmadi: ${escapeHtml(res.reason)}`, backToChannel());
      }
      return;
    }

    return next();
  });

  // ============================================================
  // 7. FSM — RASM REKLAMA
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== 'channel_custom_photo') return next();

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = ctx.message.caption ? cleanText(ctx.message.caption, 1024) : '';

    ctx.session = {
      state: 'channel_custom_photo_button',
      data: { fileId, caption },
    };

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("⏭ Tugmasiz yuborish", 'channel:send_no_button')],
      [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CHANNEL)],
    ]);

    await ctx.reply(
      `✅ Rasm saqlandi!\n\n` +
        (caption ? `📝 Caption: <i>${escapeHtml(caption.slice(0, 100))}...</i>\n\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💡 <b>Tugma qo'shmoqchimisiz?</b>\n\n` +
        `Format: <code>Tugma matni | https://havola.uz</code>`,
      { parse_mode: 'HTML', reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 8. TUGMA FORMATI (rasm uchun)
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'channel_custom_photo_button') return next();

    const { fileId, caption } = ctx.session.data;
    const input = cleanText(ctx.message.text, 200);
    ctx.session = { state: null, data: {} };

    const parts = input.split('|').map((p) => p.trim());
    if (parts.length !== 2) {
      return ctx.reply(
        '❗ Format: <code>Tugma matni | https://havola</code>',
        { parse_mode: 'HTML', reply_markup: backToChannel().reply_markup }
      );
    }

    const [btnText, btnUrl] = parts;
    if (!/^https?:\/\//i.test(btnUrl)) {
      return ctx.reply('❗ URL http:// yoki https:// bilan boshlanishi kerak');
    }

    const res = await channelService.sendCustomPhoto(bot, fileId, caption, btnText, btnUrl);

    if (res.ok) {
      await ctx.reply(
        `✅ <b>Reklama kanalga yuborildi!</b>\n\n📤 Xabar ID: <code>${res.messageId}</code>`,
        { parse_mode: 'HTML', ...backToChannel() }
      );
    } else {
      await ctx.reply(`❌ Yuborilmadi: ${escapeHtml(res.reason)}`, backToChannel());
    }
  });

  // ============================================================
  // 9. TUGMASIZ YUBORISH
  // ============================================================
  bot.action('channel:send_no_button', async (ctx) => {
    await safeAnswer(ctx);
    const s = ctx.session?.state;
    const d = ctx.session?.data || {};

    if (s === 'channel_custom_text_button' && d.text) {
      ctx.session = { state: null, data: {} };
      const res = await channelService.sendCustomText(bot, d.text, null, null);
      if (res.ok) {
        return ctx.editMessageText(
          `✅ <b>Reklama yuborildi!</b>\n\n📤 Xabar ID: <code>${res.messageId}</code>`,
          { parse_mode: 'HTML', ...backToChannel() }
        );
      }
      return ctx.editMessageText(`❌ ${escapeHtml(res.reason)}`, backToChannel());
    }

    if (s === 'channel_custom_photo_button' && d.fileId) {
      ctx.session = { state: null, data: {} };
      const res = await channelService.sendCustomPhoto(bot, d.fileId, d.caption, null, null);
      if (res.ok) {
        return ctx.editMessageText(
          `✅ <b>Rasm yuborildi!</b>\n\n📤 Xabar ID: <code>${res.messageId}</code>`,
          { parse_mode: 'HTML', ...backToChannel() }
        );
      }
      return ctx.editMessageText(`❌ ${escapeHtml(res.reason)}`, backToChannel());
    }

    await ctx.editMessageText('❗ Ma\'lumot topilmadi.', backToChannel());
  });
};