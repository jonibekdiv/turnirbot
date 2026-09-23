// ============================================================
// ORGANIZER HANDLER — Organizer uchun maxsus
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const paymentService = require('../services/paymentService');
const { CALLBACK, ROLES, PAYMENT_STATUS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // MENING TURNIRLARIM (faqat Organizer o'zi yaratgan)
  // ============================================================
  bot.action(CALLBACK.ORG_MY_TOURNAMENTS, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    // Faqat o'zi yaratgan turnirlar
    const tours = await tournamentService.getOrganizerTournaments(ctx.from.id);

    if (!tours.length) {
      return safeEdit(
        ctx,
        `📭 <b>Siz hali turnir yaratmagansiz</b>\n\n` +
          `Yangi turnir yaratish uchun pastdagi tugmani bosing:`,
        {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('➕ Yangi turnir', CALLBACK.TOUR_CREATE)],
              [Markup.button.callback('⬅️ Organizer panel', CALLBACK.ADMIN_PANEL)],
            ],
          },
        }
      );
    }

    const lines = [
      `🏆 <b>Mening turnirlarim (${tours.length})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const buttons = [];

    tours.slice(0, 15).forEach((t, i) => {
      const status =
        t.registeredTeams.length >= t.maxTeams
          ? '🔴'
          : t.status === 'cancelled'
          ? '🚫'
          : '🟢';

      const typeEmoji = t.type === 'paid' ? '💳' : '🆓';

      lines.push(
        `<b>${i + 1}. ${escapeHtml(t.title)}</b> ${typeEmoji}\n` +
          `   📅 ${t.date} | ⏰ ${t.startTime}\n` +
          `   👥 ${t.registeredTeams.length}/${t.maxTeams} ${status}`
      );
      lines.push('');

      const titleShort =
        t.title.length > 30 ? t.title.slice(0, 27) + '...' : t.title;
      buttons.push([
        Markup.button.callback(`📂 ${titleShort}`, CALLBACK.TOUR_OPEN + t.id),
      ]);
    });

    buttons.push([
      Markup.button.callback('➕ Yangi turnir', CALLBACK.TOUR_CREATE),
    ]);
    buttons.push([
      Markup.button.callback('⬅️ Organizer panel', CALLBACK.ADMIN_PANEL),
    ]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    }
  });

  // ============================================================
  // MENING TO'LOVLARIM (faqat o'z turnirlari)
  // ============================================================
  bot.action(CALLBACK.ORG_MY_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const payments = await paymentService.getOrganizerPayments(ctx.from.id);

    if (!payments.length) {
      return safeEdit(ctx, `📭 <b>Sizda to'lovlar yo'q</b>`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⬅️ Organizer panel', CALLBACK.ADMIN_PANEL)],
          ],
        },
      });
    }

    const lines = [
      `💳 <b>Mening to'lovlarim (${payments.length})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const statusEmoji = {
      pending: '⏳',
      approved: '✅',
      rejected: '❌',
      cancelled: '🚫',
      expired: '⌛',
    };

    const statusText = {
      pending: 'Tekshirilmoqda',
      approved: 'Tasdiqlangan',
      rejected: 'Rad etilgan',
      cancelled: 'Bekor qilingan',
      expired: "Muddati o'tgan",
    };

    for (const p of payments.slice(0, 15)) {
      const t = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      const captain = await userService.getUser(p.captainId);

      lines.push(
        `${statusEmoji[p.status] || '•'} <b>${escapeHtml(
          t?.title || p.tournamentId
        )}</b>`
      );
      lines.push(`   👥 ${escapeHtml(team?.name || '-')}`);
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push(
        `   📅 ${new Date(p.submittedAt).toLocaleString('uz-UZ')}`
      );
      lines.push(`   📌 ${statusText[p.status] || p.status}`);
      if (p.rejectReason) {
        lines.push(`   ❗ ${escapeHtml(p.rejectReason)}`);
      }
      lines.push('');
    }

    const rows = [];

    // Faqat pending to'lovlar uchun "ko'rish" tugmasi
    const pending = payments.filter(
      (p) => p.status === PAYMENT_STATUS.PENDING
    );
    pending.slice(0, 5).forEach((p) => {
      rows.push([
        Markup.button.callback(
          `⏳ Ko'rish: ${p.id.slice(0, 12)}`,
          'pay:view:' + p.id
        ),
      ]);
    });

    rows.push([Markup.button.callback('⬅️ Organizer panel', CALLBACK.ADMIN_PANEL)]);

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
  // KUTILAYOTGAN CHEKLAR (faqat organizer'ning o'z turnirlari)
  // ============================================================
  bot.action(CALLBACK.ORG_PENDING_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);

    const isAdmin =
      ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const isOrganizer = ctx.state.role === ROLES.ORGANIZER;

    if (!isAdmin && !isOrganizer) {
      return ctx.reply(ctx.t('error_access'));
    }

    // Filter: admin uchun hammasi, organizer uchun faqat o'zi
    let pending;
    if (isOrganizer) {
      // Faqat organizer'ning o'z turnirlariga tegishli
      const allPending = await paymentService.getAllPayments(
        PAYMENT_STATUS.PENDING
      );
      pending = allPending.filter(
        (p) => Number(p.organizerId) === Number(ctx.from.id)
      );
    } else {
      pending = await paymentService.getAllPayments(PAYMENT_STATUS.PENDING);
    }

    if (!pending.length) {
      return safeEdit(ctx, `📭 <b>Kutilayotgan cheklar yo'q</b>`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⬅️ Orqaga', CALLBACK.ADMIN_PANEL)],
          ],
        },
      });
    }

    const lines = [
      `⏳ <b>Kutilayotgan cheklar (${pending.length})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const rows = [];

    for (const p of pending.slice(0, 10)) {
      const t = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      const captain = await userService.getUser(p.captainId);

      const dt = new Date(p.submittedAt);
      const dateStr = dt.toLocaleString('uz-UZ');

      lines.push(
        `🏆 <b>${escapeHtml(t?.title || '-')}</b>\n` +
          `   👥 ${escapeHtml(team?.name || '-')}\n` +
          `   👤 ${captain?.username ? '@' + captain.username : 'ID:' + p.captainId}\n` +
          `   💰 ${p.amount} ${p.currency}\n` +
          `   📅 ${dateStr}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `👁 Ko'rish — ${team?.name?.slice(0, 20) || p.id.slice(0, 8)}`,
          'pay:view:' + p.id
        ),
      ]);
    }

    rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.ADMIN_PANEL)]);

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
  // TO'LOVNI KO'RISH (chek bilan)
  // ============================================================
  bot.action(/^pay:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const payId = ctx.match[1];

    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply(ctx.t('error_not_found'));

    // Ruxsat tekshirish
    const isAdmin =
      ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const isOwner =
      ctx.state.role === ROLES.ORGANIZER &&
      Number(payment.organizerId) === Number(ctx.from.id);

    if (!isAdmin && !isOwner) {
      return ctx.reply("⛔ Bu to'lovni ko'rishga ruxsatingiz yo'q.");
    }

    const t = await tournamentService.getTournament(payment.tournamentId);
    const team = await teamService.getTeam(payment.teamId);
    const captain = await userService.getUser(payment.captainId);

    const header =
      `╔══════════════════════╗\n` +
      `   💳 <b>TO'LOV MA'LUMOTLARI</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>Turnir:</b> ${escapeHtml(t?.title || '-')}\n` +
      `👥 <b>Komanda:</b> ${escapeHtml(team?.name || '-')}\n` +
      `🏷 <b>Teg:</b> ${escapeHtml(team?.tag || '-')}\n\n` +
      `👤 <b>Captain:</b> ${
        captain?.username ? '@' + captain.username : 'ID:' + payment.captainId
      }\n` +
      `💰 <b>Summa:</b> ${payment.amount} ${payment.currency}\n` +
      `📅 <b>Yuborilgan:</b> ${new Date(payment.submittedAt).toLocaleString(
        'uz-UZ'
      )}\n` +
      `🆔 <b>To'lov ID:</b> <code>${payment.id}</code>\n` +
      `📌 <b>Holat:</b> ${payment.status}`;

    const { paymentReviewKeyboard } = require('../keyboards/paymentKeyboard');
    const kb = paymentReviewKeyboard(payment.id, payment.tournamentId);

    try {
      if (payment.receiptType === 'photo') {
        await ctx.replyWithPhoto(payment.receiptFileId, {
          caption: header,
          parse_mode: 'HTML',
          ...kb,
        });
      } else {
        await ctx.reply(header, { parse_mode: 'HTML' });
        await ctx.replyWithDocument(payment.receiptFileId, {
          caption: `📄 Chek — ${payment.amount} ${payment.currency}`,
          ...kb,
        });
      }
    } catch (e) {
      console.error('pay:view xatosi:', e.message);
      await ctx.reply(
        `❌ Chekni ko'rsatib bo'lmadi.\n\n${header}`,
        { parse_mode: 'HTML' }
      );
    }
  });
};