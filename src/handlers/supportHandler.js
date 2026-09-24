// ============================================================
// SUPPORT HANDLER — Murojaatlar (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const supportService = require('../services/supportService');
const userService = require('../services/userService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 1. FOYDALANUVCHI — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.SUPPORT_START, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('support_center_title')}`,
      `╚══════════════════════╝`,
      '',
      t('support_pick_type'),
      '',
    ];

    const rows = [
      [
        Markup.button.callback(t('support_type_bug'), CALLBACK.SUPPORT_TYPE + 'bug'),
        Markup.button.callback(t('support_type_payment'), CALLBACK.SUPPORT_TYPE + 'payment'),
      ],
      [
        Markup.button.callback(t('support_type_team'), CALLBACK.SUPPORT_TYPE + 'team'),
        Markup.button.callback(t('support_type_tournament'), CALLBACK.SUPPORT_TYPE + 'tournament'),
      ],
      [
        Markup.button.callback(t('support_type_complaint'), CALLBACK.SUPPORT_TYPE + 'complaint'),
        Markup.button.callback(t('support_type_other'), CALLBACK.SUPPORT_TYPE + 'other'),
      ],
      [Markup.button.callback(t('support_my'), CALLBACK.SUPPORT_MY)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ];

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
  // 2. TUR TANLANGANDA
  // ============================================================
  bot.action(/^sup:type:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const type = ctx.match[1];
    const typeInfo = supportService.TYPES[type];
    if (!typeInfo) return;

    ctx.session = { state: STATES.SUPPORT_INPUT_TEXT, data: { type } };

    await ctx.reply(
      `${typeInfo.emoji} <b>${t('support_type_' + type)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>${t('support_enter_text')}</b>\n\n` +
        `<i>${t('support_input_min_len') || ''} ${LIMITS.SUPPORT_MAX_TEXT}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_cancel'), CALLBACK.SUPPORT_START)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 3. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.SUPPORT_INPUT_TEXT) return next();
    const t = ctx.t;

    const text = cleanText(ctx.message.text, LIMITS.SUPPORT_MAX_TEXT);
    if (text.length < 10) {
      return ctx.reply(`❗ ${t('support_input_min_len')}`);
    }

    ctx.session.data.text = text;
    ctx.session.state = STATES.SUPPORT_INPUT_ATTACH;

    await ctx.reply(
      `✅\n\n` +
        `${t('support_attach_photo')}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('support_skip_attach'), 'sup:skip_attach')],
            [Markup.button.callback(t('btn_cancel'), CALLBACK.SUPPORT_START)],
          ],
        },
      }
    );
  });

  // RASM
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== STATES.SUPPORT_INPUT_ATTACH) return next();
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    ctx.session.data.attachmentFileId = fileId;
    ctx.session.data.attachmentType = 'photo';
    return submitTicket(ctx, bot);
  });

  bot.action('sup:skip_attach', async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.session?.state !== STATES.SUPPORT_INPUT_ATTACH) return;
    return submitTicket(ctx, bot);
  });

  // ============================================================
  // SUBMIT
  // ============================================================
  async function submitTicket(ctx, bot) {
    const t = ctx.t;
    const { type, text, attachmentFileId, attachmentType } = ctx.session.data;

    try {
      const ticket = await supportService.createTicket({
        userId: ctx.from.id,
        username: ctx.from.username,
        type,
        text,
        attachmentFileId,
        attachmentType,
      });

      ctx.session = { state: null, data: {} };

      const typeInfo = supportService.TYPES[type];

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   ✅ <b>${t('support_sent')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🎫 ${t('support_number')}: <b>#${ticket.number}</b>\n` +
          `${typeInfo.emoji} ${t('promo_type_label')}: <b>${t('support_type_' + type)}</b>\n` +
          `📅 ${new Date(ticket.createdAt).toLocaleString('uz-UZ')}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⏳ <i>${t('support_sent_desc')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('support_my'), CALLBACK.SUPPORT_MY)],
              [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
            ],
          },
        }
      );

      await notifyAdmins(ctx, bot, ticket);
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  }

  // ============================================================
  // ADMINLARGA XABAR
  // ============================================================
  async function notifyAdmins(ctx, bot, ticket) {
    const t = ctx.t;
    const config = require('../config');
    const roleService = require('../services/roleService');

    const admins = await roleService.list('admin');
    const adminIds = new Set([config.SUPER_ADMIN_ID, ...admins.map((a) => a.id)]);

    const typeInfo = supportService.TYPES[ticket.type];

    const header =
      `🔔 <b>${t('support_notify_admins_new')} #${ticket.number}</b>\n\n` +
      `👤 ${escapeHtml(displayName(ctx.from))}\n` +
      `🆔 <code>${ctx.from.id}</code>\n` +
      `${typeInfo.emoji} ${t('promo_type_label')}: <b>${t('support_type_' + ticket.type)}</b>\n` +
      `📅 ${new Date(ticket.createdAt).toLocaleString('uz-UZ')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📝 ${escapeHtml(ticket.text)}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('support_reply_btn'), CALLBACK.SUPPORT_REPLY + ticket.id)],
      [Markup.button.callback(t('support_close_btn'), CALLBACK.SUPPORT_CLOSE + ticket.id)],
    ]);

    for (const adminId of adminIds) {
      try {
        if (ticket.attachmentFileId && ticket.attachmentType === 'photo') {
          await bot.telegram.sendPhoto(adminId, ticket.attachmentFileId, {
            caption: header,
            parse_mode: 'HTML',
            reply_markup: kb.reply_markup,
          });
        } else {
          await bot.telegram.sendMessage(adminId, header, {
            parse_mode: 'HTML',
            reply_markup: kb.reply_markup,
          });
        }
      } catch (e) {}
    }
  }

  // ============================================================
  // 4. MENING MUROJAATLARIM
  // ============================================================
  bot.action(CALLBACK.SUPPORT_MY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tickets = await supportService.getUserTickets(ctx.from.id);

    if (!tickets.length) {
      return safeEdit(ctx, `📭 ${t('support_no_tickets')}`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('support_menu'), CALLBACK.SUPPORT_START)],
            [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
          ],
        },
      });
    }

    const lines = [`📋 <b>${t('support_my_title')} (${tickets.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
    const rows = [];

    tickets.slice(0, 10).forEach((tk) => {
      const typeInfo = supportService.TYPES[tk.type];
      const emoji = supportService.statusEmoji(tk.status);
      const statusKey = 'support_status_' + tk.status + '_short';
      const statusName = t(statusKey) || tk.status;

      lines.push(
        `${emoji} <b>#${tk.number}</b> — ${typeInfo.emoji} ${t('support_type_' + tk.type)}\n` +
          `   📌 ${statusName}\n` +
          `   📅 ${new Date(tk.createdAt).toLocaleDateString('uz-UZ')}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `${emoji} #${tk.number} — ${t('support_type_' + tk.type)}`,
          CALLBACK.SUPPORT_MY_VIEW + tk.id
        ),
      ]);
    });

    rows.push([Markup.button.callback(t('support_menu'), CALLBACK.SUPPORT_START)]);
    rows.push([Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)]);

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
  // 5. FOYDALANUVCHI O'Z MUROJAATINI KO'RISH
  // ============================================================
  bot.action(/^sup:mv:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const ticket = await supportService.getTicket(ctx.match[1]);
    if (!ticket || Number(ticket.userId) !== Number(ctx.from.id)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const typeInfo = supportService.TYPES[ticket.type];
    const emoji = supportService.statusEmoji(ticket.status);
    const statusKey = 'support_status_' + ticket.status + '_short';
    const statusName = t(statusKey) || ticket.status;

    let text =
      `╔══════════════════════╗\n` +
      `   💬 <b>#${ticket.number}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${typeInfo.emoji} ${t('support_type_' + ticket.type)}\n` +
      `${emoji} ${t('promo_status_label')}: <b>${statusName}</b>\n` +
      `📅 ${new Date(ticket.createdAt).toLocaleString('uz-UZ')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📝 <b>${t('support_enter_text')}</b>\n${escapeHtml(ticket.text)}`;

    if (ticket.reply) {
      text +=
        `\n\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💬 <b>${t('support_reply_to_user')}:</b>\n${escapeHtml(ticket.reply)}\n\n` +
        `📅 ${new Date(ticket.answeredAt).toLocaleString('uz-UZ')}`;
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('btn_back'), CALLBACK.SUPPORT_MY)],
    ]);

    try {
      if (ticket.attachmentFileId && ticket.attachmentType === 'photo') {
        try { await ctx.deleteMessage(); } catch (e) {}
        await ctx.replyWithPhoto(ticket.attachmentFileId, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      } else {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 6. ADMIN — RO'YXAT
  // ============================================================
  bot.action(CALLBACK.SUPPORT_ADMIN_LIST, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const stats = await supportService.getStats();

    const lines = [
      `╔══════════════════════╗`,
      `   💬 <b>${t('support_admin_title')}</b>`,
      `╚══════════════════════╝`,
      '',
      `${t('support_admin_stats')}`,
      `${t('support_new_count')}: <b>${stats.new}</b>`,
      `${t('support_viewed_count')}: <b>${stats.viewed}</b>`,
      `${t('support_answered_count')}: <b>${stats.answered}</b>`,
      `${t('support_closed_count')}: <b>${stats.closed}</b>`,
      `${t('support_avg_response')}: <b>${stats.avgResponseHours} ${t('support_avg_hours')}</b>`,
    ];

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(`${t('support_new_count')} (${stats.new})`, CALLBACK.SUPPORT_ADMIN_NEW)],
      [Markup.button.callback(`${t('support_viewed_count')} (${stats.new + stats.viewed})`, CALLBACK.SUPPORT_ADMIN_ACTIVE)],
      [Markup.button.callback(t('support_closed_count'), CALLBACK.SUPPORT_ADMIN_CLOSED)],
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    try {
      await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  bot.action(CALLBACK.SUPPORT_ADMIN_NEW, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    return showAdminList(ctx, 'new');
  });

  bot.action(CALLBACK.SUPPORT_ADMIN_ACTIVE, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    return showAdminList(ctx, 'active');
  });

  bot.action(CALLBACK.SUPPORT_ADMIN_CLOSED, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    return showAdminList(ctx, 'closed');
  });

  async function showAdminList(ctx, filter) {
    const t = ctx.t;
    const tickets = await supportService.getTicketsByStatus(filter);

    if (!tickets.length) {
      return safeEdit(ctx, `📭 ${t('support_no_tickets_admin')}`, {
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(t('btn_back'), CALLBACK.SUPPORT_ADMIN_LIST)]],
        },
      });
    }

    const lines = [`💬 <b>${t('support_admin_title')} (${tickets.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
    const rows = [];

    tickets.slice(0, 10).forEach((tk) => {
      const typeInfo = supportService.TYPES[tk.type];
      const emoji = supportService.statusEmoji(tk.status);

      lines.push(
        `${emoji} <b>#${tk.number}</b> — ${typeInfo.emoji} ${t('support_type_' + tk.type)}\n` +
          `   👤 ${tk.username ? '@' + escapeHtml(tk.username) : 'ID:' + tk.userId}\n` +
          `   📅 ${new Date(tk.createdAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `${emoji} #${tk.number} — ${t('support_type_' + tk.type)}`,
          CALLBACK.SUPPORT_VIEW + tk.id
        ),
      ]);
    });

    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.SUPPORT_ADMIN_LIST)]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  }

  // ============================================================
  // 7. ADMIN — KO'RISH
  // ============================================================
  bot.action(/^sup:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const ticket = await supportService.getTicket(ctx.match[1]);
    if (!ticket) return ctx.reply(t('error_not_found'));

    await supportService.markViewed(ticket.id);
    const refreshed = await supportService.getTicket(ticket.id);

    const typeInfo = supportService.TYPES[refreshed.type];
    const emoji = supportService.statusEmoji(refreshed.status);
    const statusKey = 'support_status_' + refreshed.status + '_short';
    const statusName = t(statusKey) || refreshed.status;

    const text =
      `╔══════════════════════╗\n` +
      `   💬 <b>#${refreshed.number}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `👤 ${refreshed.username ? '@' + escapeHtml(refreshed.username) : 'ID:' + refreshed.userId}\n` +
      `${typeInfo.emoji} ${t('support_type_' + refreshed.type)}\n` +
      `${emoji} ${t('promo_status_label')}: <b>${statusName}</b>\n` +
      `📅 ${new Date(refreshed.createdAt).toLocaleString('uz-UZ')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📝 <b>${t('support_enter_text')}:</b>\n${escapeHtml(refreshed.text)}`;

    if (refreshed.reply) {
      text += `\n\n━━━━━━━━━━━━━━━━━━━━\n\n💬 <b>${t('support_reply_to_user')}:</b>\n${escapeHtml(refreshed.reply)}`;
    }

    const rows = [];
    if (refreshed.status === 'new' || refreshed.status === 'viewed') {
      rows.push([Markup.button.callback(t('support_reply_btn'), CALLBACK.SUPPORT_REPLY + refreshed.id)]);
      rows.push([Markup.button.callback(t('support_close_btn'), CALLBACK.SUPPORT_CLOSE + refreshed.id)]);
    }
    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.SUPPORT_ADMIN_LIST)]);

    try {
      if (refreshed.attachmentFileId && refreshed.attachmentType === 'photo') {
        try { await ctx.deleteMessage(); } catch (e) {}
        await ctx.replyWithPhoto(refreshed.attachmentFileId, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: rows },
        });
      } else {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
      }
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // 8. ADMIN — JAVOB BERISH
  // ============================================================
  bot.action(/^sup:reply:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const ticket = await supportService.getTicket(ctx.match[1]);
    if (!ticket) return;

    ctx.session = { state: STATES.SUPPORT_ADMIN_REPLY, data: { ticketId: ticket.id } };

    await ctx.reply(
      `💬 <b>${t('support_reply_btn')}</b>\n\n🎫 #${ticket.number}\n\n` +
        `${t('support_user_label')}: ${ticket.username ? '@' + escapeHtml(ticket.username) : 'ID:' + ticket.userId}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_cancel'), CALLBACK.SUPPORT_VIEW + ticket.id)],
          ],
        },
      }
    );
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.SUPPORT_ADMIN_REPLY) return next();
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
      ctx.session = { state: null, data: {} };
      return next();
    }
    const t = ctx.t;

    const ticketId = ctx.session.data.ticketId;
    const reply = cleanText(ctx.message.text, LIMITS.SUPPORT_MAX_TEXT);
    if (reply.length < 3) return ctx.reply(`❗ ${t('support_input_min_len')}`);

    try {
      const ticket = await supportService.answerTicket(ticketId, ctx.from.id, reply);
      ctx.session = { state: null, data: {} };

      await ctx.reply(`✅ <b>${t('support_reply_sent')}</b>\n\n🎫 #${ticket.number}`, {
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(t('btn_back'), CALLBACK.SUPPORT_ADMIN_LIST)]],
        },
      });

      try {
        await bot.telegram.sendMessage(
          ticket.userId,
          `╔══════════════════════╗\n` +
            `   📩 <b>${t('support_reply_received')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🎫 #${ticket.number}\n\n` +
            `📝 <b>${t('support_enter_text')}:</b>\n${escapeHtml(ticket.text)}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `💬 <b>${t('support_reply_to_user')}:</b>\n${escapeHtml(reply)}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[Markup.button.callback(t('support_my'), CALLBACK.SUPPORT_MY)]],
            },
          }
        );
      } catch (e) {}
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 9. ADMIN — YOPISH
  // ============================================================
  bot.action(/^sup:close:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;

    const ticket = await supportService.getTicket(ctx.match[1]);
    if (!ticket) return;

    await supportService.closeTicket(ticket.id);

    await ctx.reply(`✅ <b>#${ticket.number} ${t('support_closed')}</b>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[Markup.button.callback(t('btn_back'), CALLBACK.SUPPORT_ADMIN_LIST)]],
      },
    });

    try {
      await bot.telegram.sendMessage(
        ticket.userId,
        `✅ <b>#${ticket.number} ${t('support_closed')}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  });
};