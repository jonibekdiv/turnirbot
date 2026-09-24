// ============================================================
// CHANNEL HANDLER — Turnir + Reklama (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const channelService = require('../services/channelService');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

function backToAdmin(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

function backToChannel(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_back'), CALLBACK.ADMIN_CHANNEL)],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. KANAL SOZLAMALARI MENYUSI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CHANNEL, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) {
      return ctx.reply(`⛔ ${t('error_access')}`, backToAdmin(t));
    }

    const channelId = await channelService.getChannel();
    const testResult = channelId ? await channelService.testChannel(bot) : null;

    const statusLine = !channelId
      ? `❌ <b>${t('tour_announce_no_channel')}</b>`
      : testResult?.ok
      ? `✅ <b>${t('success')}:</b> ${escapeHtml(testResult.title)}\n   <code>${escapeHtml(channelId)}</code>`
      : `⚠️ <b>${t('error_prefix')}:</b> ${escapeHtml(testResult?.reason || '-')}\n   <code>${escapeHtml(channelId)}</code>`;

    const rows = [];
    if (channelId) {
      rows.push([Markup.button.callback(t('channel_test') || `📢 Test`, 'channel:test')]);
      rows.push([Markup.button.callback(t('ch_reklama_btn'), 'channel:custom_text')]);
      rows.push([Markup.button.callback(t('support_attach_photo'), 'channel:custom_photo')]);
      rows.push([Markup.button.callback(`✏️ ${t('channel_add_prompt').slice(0, 20)}`, 'channel:change')]);
      rows.push([Markup.button.callback(`🗑 ${t('btn_delete')}`, 'channel:delete')]);
    } else {
      rows.push([Markup.button.callback(`➕ ${t('ch_add_btn')}`, 'channel:set')]);
    }
    rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    const text =
      `📢 <b>${t('admin_channel')}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${statusLine}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 <i>${t('ch_announce_btn')}</i>`;

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // 2. KANAL ULASH
  // ============================================================
  bot.action('channel:set', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };

    await ctx.reply(
      `📢 <b>${t('channel_add_prompt')}</b>\n\n` +
        `📌 <b>${t('stage_room_format')}:</b>\n` +
        `• <code>@my_channel</code>\n` +
        `• <code>-1001234567890</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ <b>${t('channel_not_admin').slice(0, 30)}</b>`,
      { parse_mode: 'HTML', reply_markup: backToChannel(t).reply_markup }
    );
  });

  bot.action('channel:change', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    ctx.session = { state: STATES.ADMIN_CHANNEL_INPUT, data: {} };
    await ctx.reply(`✏️ ${t('channel_add_prompt')}:`, { reply_markup: backToChannel(t).reply_markup });
  });

  bot.action('channel:delete', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    await channelService.unsetChannel();
    await ctx.reply(`✅ ${t('ch_list_title')} — ${t('btn_delete')}`, backToAdmin(t));
  });

  // ============================================================
  // 3. TEST XABAR
  // ============================================================
  bot.action('channel:test', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const res = await channelService.sendCustomText(
      bot,
      `🧪 <b>Test</b>\n\n✅ ${t('success')}\n\n<i>${t('support_enter_text')}</i>`,
      null,
      null
    );

    if (res.ok) {
      await ctx.reply(`✅ ${t('success')}`, backToChannel(t));
    } else {
      await ctx.reply(`❌ ${t('tour_publish_fail')}: ${escapeHtml(res.reason)}`, backToChannel(t));
    }
  });

  // ============================================================
  // 4. IXTIYORIY MATN
  // ============================================================
  bot.action('channel:custom_text', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    ctx.session = { state: 'channel_custom_text', data: {} };

    await ctx.reply(
      `📝 <b>${t('ch_reklama_btn')}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${t('support_enter_text')}:\n\n` +
        `💡 <i>HTML:</i>\n` +
        `• <code>&lt;b&gt;Qalin&lt;/b&gt;</code>\n` +
        `• <code>&lt;i&gt;Kursiv&lt;/i&gt;</code>\n` +
        `• <code>&lt;code&gt;Kod&lt;/code&gt;</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <i>${t('support_attach_photo')}</i>`,
      { parse_mode: 'HTML', reply_markup: backToChannel(t).reply_markup }
    );
  });

  // ============================================================
  // 5. IXTIYORIY RASM
  // ============================================================
  bot.action('channel:custom_photo', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    ctx.session = { state: 'channel_custom_photo', data: {} };

    await ctx.reply(
      `🖼 <b>${t('support_attach_photo')}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${t('card_ask_avatar')}:\n\n` +
        `💡 <i>Caption ${t('promo_status_active').toLowerCase()}.</i>`,
      { parse_mode: 'HTML', reply_markup: backToChannel(t).reply_markup }
    );
  });

  // ============================================================
  // 6. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    const t = ctx.t;

    // KANAL ID
    if (s === STATES.ADMIN_CHANNEL_INPUT) {
      const v = cleanText(ctx.message.text, 100);
      ctx.session = { state: null, data: {} };

      try {
        await channelService.setChannel(v);
        const test = await channelService.testChannel(bot);

        if (test.ok) {
          await ctx.reply(
            `✅ <b>${t('channel_added')}</b>\n\n` +
              `📛 ${t('name')}: <b>${escapeHtml(test.title)}</b>\n` +
              `🆔 ID: <code>${escapeHtml(v)}</code>\n` +
              `📌 ${t('promo_type_label')}: <b>${escapeHtml(test.type)}</b>`,
            { parse_mode: 'HTML', ...backToChannel(t) }
          );
        } else {
          await ctx.reply(
            `⚠️ <b>${t('error_prefix')}</b>\n\n` +
              `${t('tour_announce_reason')}: <code>${escapeHtml(test.reason)}</code>\n\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `💡 <b>${t('tour_announce_check')}</b>`,
            { parse_mode: 'HTML', ...backToChannel(t) }
          );
        }
      } catch (e) {
        await ctx.reply(`❌ ${t('error_prefix')} ${e.message || t('error_generic')}`, backToChannel(t));
      }
      return;
    }

    // MATN REKLAMA
    if (s === 'channel_custom_text') {
      const text = cleanText(ctx.message.text, 4000);
      if (!text) return ctx.reply(`❗ ${t('support_enter_text')}:`, backToChannel(t));

      ctx.session = { state: 'channel_custom_text_button', data: { text } };

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('support_skip_attach'), 'channel:send_no_button')],
        [Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CHANNEL)],
      ]);

      await ctx.reply(
        `✅ ${t('success')}!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 <b>${t('inv_accept')}</b>\n\n` +
          `${t('stage_room_format')}: <code>${t('promo_top3')} | https://havola.uz</code>\n\n` +
          `<i>${t('wallet_admin_adjust_example')}: ${t('promo_top3')} | https://example.com</i>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
      return;
    }

    // TUGMA
    if (s === 'channel_custom_text_button') {
      const text = ctx.session.data.text;
      const input = cleanText(ctx.message.text, 200);
      ctx.session = { state: null, data: {} };

      const parts = input.split('|').map((p) => p.trim());
      if (parts.length !== 2) {
        return ctx.reply(
          `❗ ${t('stage_room_format')}: <code>${t('promo_top3')} | https://havola</code>`,
          { parse_mode: 'HTML', reply_markup: backToChannel(t).reply_markup }
        );
      }

      const [btnText, btnUrl] = parts;
      if (!/^https?:\/\//i.test(btnUrl)) {
        return ctx.reply(`❗ URL http:// ${t('support_enter_text')}`);
      }

      const res = await channelService.sendCustomText(bot, text, btnText, btnUrl);

      if (res.ok) {
        await ctx.reply(
          `✅ <b>${t('ch_announced')}!</b>\n\n📤 ID: <code>${res.messageId}</code>`,
          { parse_mode: 'HTML', ...backToChannel(t) }
        );
      } else {
        await ctx.reply(`❌ ${t('tour_publish_fail')}: ${escapeHtml(res.reason)}`, backToChannel(t));
      }
      return;
    }

    return next();
  });

  // ============================================================
  // 7. FSM — RASM
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== 'channel_custom_photo') return next();
    const t = ctx.t;

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = ctx.message.caption ? cleanText(ctx.message.caption, 1024) : '';

    ctx.session = { state: 'channel_custom_photo_button', data: { fileId, caption } };

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('support_skip_attach'), 'channel:send_no_button')],
      [Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CHANNEL)],
    ]);

    await ctx.reply(
      `✅ ${t('success')}!\n\n` +
        (caption ? `📝 Caption: <i>${escapeHtml(caption.slice(0, 100))}...</i>\n\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💡 <b>${t('inv_accept')}</b>\n\n` +
        `${t('stage_room_format')}: <code>${t('promo_top3')} | https://havola.uz</code>`,
      { parse_mode: 'HTML', reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 8. TUGMA FORMATI (rasm uchun)
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'channel_custom_photo_button') return next();
    const t = ctx.t;

    const { fileId, caption } = ctx.session.data;
    const input = cleanText(ctx.message.text, 200);
    ctx.session = { state: null, data: {} };

    const parts = input.split('|').map((p) => p.trim());
    if (parts.length !== 2) {
      return ctx.reply(
        `❗ ${t('stage_room_format')}: <code>${t('promo_top3')} | https://havola</code>`,
        { parse_mode: 'HTML', reply_markup: backToChannel(t).reply_markup }
      );
    }

    const [btnText, btnUrl] = parts;
    if (!/^https?:\/\//i.test(btnUrl)) {
      return ctx.reply(`❗ URL http:// ${t('support_enter_text')}`);
    }

    const res = await channelService.sendCustomPhoto(bot, fileId, caption, btnText, btnUrl);

    if (res.ok) {
      await ctx.reply(
        `✅ <b>${t('ch_announced')}!</b>\n\n📤 ID: <code>${res.messageId}</code>`,
        { parse_mode: 'HTML', ...backToChannel(t) }
      );
    } else {
      await ctx.reply(`❌ ${t('tour_publish_fail')}: ${escapeHtml(res.reason)}`, backToChannel(t));
    }
  });

  // ============================================================
  // 9. TUGMASIZ YUBORISH
  // ============================================================
  bot.action('channel:send_no_button', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const s = ctx.session?.state;
    const d = ctx.session?.data || {};

    if (s === 'channel_custom_text_button' && d.text) {
      ctx.session = { state: null, data: {} };
      const res = await channelService.sendCustomText(bot, d.text, null, null);
      if (res.ok) {
        return ctx.editMessageText(
          `✅ <b>${t('ch_announced')}!</b>\n\n📤 ID: <code>${res.messageId}</code>`,
          { parse_mode: 'HTML', ...backToChannel(t) }
        );
      }
      return ctx.editMessageText(`❌ ${escapeHtml(res.reason)}`, backToChannel(t));
    }

    if (s === 'channel_custom_photo_button' && d.fileId) {
      ctx.session = { state: null, data: {} };
      const res = await channelService.sendCustomPhoto(bot, d.fileId, d.caption, null, null);
      if (res.ok) {
        return ctx.editMessageText(
          `✅ <b>${t('ch_announced')}!</b>\n\n📤 ID: <code>${res.messageId}</code>`,
          { parse_mode: 'HTML', ...backToChannel(t) }
        );
      }
      return ctx.editMessageText(`❌ ${escapeHtml(res.reason)}`, backToChannel(t));
    }

    await ctx.editMessageText(`❗ ${t('error_no_data')}`, backToChannel(t));
  });
};