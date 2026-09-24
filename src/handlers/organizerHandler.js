// ============================================================
// ORGANIZER HANDLER — 3 tilda
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
  // 1. MENING TURNIRLARIM
  // ============================================================
  bot.action(CALLBACK.ORG_MY_TOURNAMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ORGANIZER])) {
      return ctx.reply(t('error_access'));
    }

    const tours = await tournamentService.getOrganizerTournaments(ctx.from.id);

    if (!tours.length) {
      return safeEdit(
        ctx,
        `📭 <b>${t('org_no_tournaments')}</b>\n\n${t('org_pick_your_tournament')}`,
        {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('tour_create_again'), CALLBACK.TOUR_CREATE)],
              [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
            ],
          },
        }
      );
    }

    const lines = [
      `🏆 <b>${t('org_my_tournaments')} (${tours.length})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const buttons = [];

    tours.slice(0, 15).forEach((tour, i) => {
      const status =
        tour.registeredTeams.length >= tour.maxTeams
          ? '🔴'
          : tour.status === 'cancelled'
          ? '🚫'
          : '🟢';

      const typeEmoji = tour.type === 'paid' ? '💳' : '🆓';

      lines.push(
        `<b>${i + 1}. ${escapeHtml(tour.title)}</b> ${typeEmoji}\n` +
          `   📅 ${tour.date} | ⏰ ${tour.startTime}\n` +
          `   👥 ${tour.registeredTeams.length}/${tour.maxTeams} ${status}`
      );
      lines.push('');

      const titleShort = tour.title.length > 30 ? tour.title.slice(0, 27) + '...' : tour.title;
      buttons.push([Markup.button.callback(`📂 ${titleShort}`, CALLBACK.TOUR_OPEN + tour.id)]);
    });

    buttons.push([Markup.button.callback(t('tour_create_again'), CALLBACK.TOUR_CREATE)]);
    buttons.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
    }
  });

  // ============================================================
  // 2. MENING TO'LOVLARIM
  // ============================================================
  bot.action(CALLBACK.ORG_MY_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ORGANIZER])) return ctx.reply(t('error_access'));

    const payments = await paymentService.getOrganizerPayments(ctx.from.id);

    if (!payments.length) {
      return safeEdit(ctx, `📭 <b>${t('org_no_payments')}</b>`, {
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]],
        },
      });
    }

    const lines = [`💳 <b>${t('org_my_payments')} (${payments.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];

    const statusEmoji = { pending: '⏳', approved: '✅', rejected: '❌', cancelled: '🚫', expired: '⌛' };
    const statusKey = {
      pending: 'wallet_pending',
      approved: 'wallet_approved',
      rejected: 'wallet_rejected',
      cancelled: 'wallet_cancelled',
      expired: 'payment_status_expired',
    };

    for (const p of payments.slice(0, 15)) {
      const tour = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);

      lines.push(`${statusEmoji[p.status] || '•'} <b>${escapeHtml(tour?.title || p.tournamentId)}</b>`);
      lines.push(`   👥 ${escapeHtml(team?.name || '-')}`);
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push(`   📅 ${new Date(p.submittedAt).toLocaleString('uz-UZ')}`);
      lines.push(`   📌 ${t(statusKey[p.status] || 'wallet_pending')}`);
      if (p.rejectReason) {
        lines.push(`   ❗ ${escapeHtml(p.rejectReason)}`);
      }
      lines.push('');
    }

    const rows = [];

    const pending = payments.filter((p) => p.status === PAYMENT_STATUS.PENDING);
    pending.slice(0, 5).forEach((p) => {
      rows.push([Markup.button.callback(`⏳ ${t('org_view')}: ${p.id.slice(0, 12)}`, 'pay:view:' + p.id)]);
    });

    rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    try {
      await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // 3. KUTILAYOTGAN CHEKLAR
  // ============================================================
  bot.action(CALLBACK.ORG_PENDING_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const isOrganizer = ctx.state.role === ROLES.ORGANIZER;

    if (!isAdmin && !isOrganizer) return ctx.reply(t('error_access'));

    let pending;
    if (isOrganizer) {
      const allPending = await paymentService.getAllPayments(PAYMENT_STATUS.PENDING);
      pending = allPending.filter((p) => Number(p.organizerId) === Number(ctx.from.id));
    } else {
      pending = await paymentService.getAllPayments(PAYMENT_STATUS.PENDING);
    }

    if (!pending.length) {
      return safeEdit(ctx, `📭 <b>${t('org_no_pending')}</b>`, {
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]],
        },
      });
    }

    const lines = [`⏳ <b>${t('org_pending_title')} (${pending.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
    const rows = [];

    for (const p of pending.slice(0, 10)) {
      const tour = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      const captain = await userService.getUser(p.captainId);

      lines.push(
        `🏆 <b>${escapeHtml(tour?.title || '-')}</b>\n` +
          `   👥 ${escapeHtml(team?.name || '-')}\n` +
          `   👤 ${captain?.username ? '@' + captain.username : 'ID:' + p.captainId}\n` +
          `   💰 ${p.amount} ${p.currency}\n` +
          `   📅 ${new Date(p.submittedAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `👁 ${t('org_view')} — ${team?.name?.slice(0, 20) || p.id.slice(0, 8)}`,
          'pay:view:' + p.id
        ),
      ]);
    }

    rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    try {
      await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // 4. TO'LOVNI KO'RISH
  // ============================================================
  bot.action(/^pay:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const payId = ctx.match[1];
    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply(t('error_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const isOwner = ctx.state.role === ROLES.ORGANIZER && Number(payment.organizerId) === Number(ctx.from.id);

    if (!isAdmin && !isOwner) return ctx.reply(`⛔ ${t('error_access')}`);

    const tour = await tournamentService.getTournament(payment.tournamentId);
    const team = await teamService.getTeam(payment.teamId);
    const captain = await userService.getUser(payment.captainId);

    const header =
      `╔══════════════════════╗\n` +
      `   💳 <b>${t('pay_view_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>${t('admin_tournaments')}:</b> ${escapeHtml(tour?.title || '-')}\n` +
      `👥 <b>${t('admin_teams')}:</b> ${escapeHtml(team?.name || '-')}\n` +
      `🏷 <b>${t('team_tag_label')}:</b> ${escapeHtml(team?.tag || '-')}\n\n` +
      `👤 <b>${t('team_captain')}:</b> ${captain?.username ? '@' + captain.username : 'ID:' + payment.captainId}\n` +
      `💰 <b>${t('promotion_total')}:</b> ${payment.amount} ${payment.currency}\n` +
      `📅 <b>${t('pay_submitted_at')}:</b> ${new Date(payment.submittedAt).toLocaleString('uz-UZ')}\n` +
      `🆔 <b>ID:</b> <code>${payment.id}</code>\n` +
      `📌 <b>${t('pay_status_label')}:</b> ${payment.status}`;

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
          caption: `📄 ${t('payment_new_receipt')} — ${payment.amount} ${payment.currency}`,
          ...kb,
        });
      }
    } catch (e) {
      console.error('pay:view xatosi:', e.message);
      await ctx.reply(`❌ ${t('pay_view_cannot')}\n\n${header}`, { parse_mode: 'HTML' });
    }
  });
};