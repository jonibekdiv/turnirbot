// ============================================================
// PAYMENT REVIEW HANDLER — Organizer chekni ko'radi (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const paymentService = require('../services/paymentService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, STATES, ROLES, PAYMENT_STATUS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');
const {
  adminPaymentsKeyboard,
  organizerPaymentsKeyboard,
} = require('../keyboards/paymentKeyboard');

module.exports = (bot) => {
  // ============================================================
  // 1. TO'LOVNI TASDIQLASH
  // ============================================================
  bot.action(/^pay:a:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const payId = ctx.match[1];
    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply(`❗ ${t('error_not_found')}`);

    const isOwner = Number(payment.organizerId) === Number(ctx.from.id);
    const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);
    if (!isOwner && !isAdmin) return ctx.reply(`⛔ ${t('error_access')}`);

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      return ctx.reply(`❗ ${t('error_payment_reviewed')}`);
    }

    const tour = await tournamentService.getTournament(payment.tournamentId);
    if (!tour) return ctx.reply(`❗ ${t('tour_not_found')}`);

    if (tour.registeredTeams.length >= tour.maxTeams) {
      return ctx.reply(
        `⚠️ <b>${t('error_tournament_full')}</b>\n\n` +
          `Max: ${tour.maxTeams}, ${t('promotion_total')}: ${tour.registeredTeams.length}\n\n` +
          `<i>${t('error_only_admin')}</i>`,
        { parse_mode: 'HTML' }
      );
    }

    if (tour.registeredTeams.includes(payment.teamId)) {
      return ctx.reply(`❗ ${t('error_already_registered')}`);
    }

    try {
      await paymentService.approvePayment(payId, ctx.from.id);
      await tournamentService.registerTeam(tour.id, payment.teamId);

      const team = await teamService.getTeam(payment.teamId);

      // Captainga xabar
      try {
        await ctx.telegram.sendMessage(
          payment.captainId,
          `╔══════════════════════╗\n` +
            `   ✅ <b>${t('payment_approved')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 ${t('admin_tournaments')}: <b>${escapeHtml(tour.title)}</b>\n` +
            `👥 ${t('admin_teams')}: <b>${escapeHtml(team?.name || '-')}</b>\n\n` +
            `<i>${t('sub_registered')}</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}

      if (team) {
        for (const memberId of team.members) {
          if (memberId === payment.captainId) continue;
          try {
            await ctx.telegram.sendMessage(
              memberId,
              `✅ <b>${t('sub_registered')}</b>\n\n` +
                `🏆 ${escapeHtml(tour.title)}\n` +
                `👥 ${escapeHtml(team.name)}`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        }
      }

      await safeEdit(
        ctx,
        `✅ <b>${t('payment_approved')}</b>\n\n` +
          `🏆 ${escapeHtml(tour.title)}\n` +
          `👥 ${escapeHtml(team?.name || '-')}\n` +
          `📊 ${t('stage_match_teams')}: ${tour.registeredTeams.length + 1}/${tour.maxTeams}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('org_pending_payments'),
                  callback_data: CALLBACK.ORG_PENDING_PAYMENTS,
                },
              ],
              [{ text: t('admin_panel'), callback_data: CALLBACK.ADMIN_PANEL }],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply(`❌ ${t('error_prefix')} ${e.message || t('error_generic')}`);
    }
  });

  // ============================================================
  // 2. TO'LOVNI RAD ETISH
  // ============================================================
  bot.action(/^pay:r:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const payId = ctx.match[1];
    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply(`❗ ${t('error_not_found')}`);

    const isOwner = Number(payment.organizerId) === Number(ctx.from.id);
    const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);
    if (!isOwner && !isAdmin) return ctx.reply(`⛔ ${t('error_access')}`);

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      return ctx.reply(`❗ ${t('error_payment_reviewed')}`);
    }

    ctx.session = {
      state: STATES.PAYMENT_REJECT_REASON,
      data: { paymentId: payId },
    };

    await ctx.reply(
      `❌ <b>${t('payment_rejected')}</b>\n\n` +
        `${t('support_enter_text')}:\n\n` +
        `<i>${t('wallet_admin_adjust_example')}: "${t('pay_view_cannot')}" ${t('wallet_admin_sub_example')} "${t('wallet_insufficient_balance')}"</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 3. FSM — SABAB
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.PAYMENT_REJECT_REASON) return next();
    const t = ctx.t;

    const { paymentId } = ctx.session.data;
    const reason = cleanText(ctx.message.text, 200);
    if (!reason) return ctx.reply(`❗ ${t('support_enter_text')}:`);

    const payment = await paymentService.getPayment(paymentId);
    if (!payment) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`❗ ${t('error_not_found')}`);
    }

    const isOwner = Number(payment.organizerId) === Number(ctx.from.id);
    const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);
    if (!isOwner && !isAdmin) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    try {
      await paymentService.rejectPayment(paymentId, ctx.from.id, reason);
      ctx.session = { state: null, data: {} };

      const tour = await tournamentService.getTournament(payment.tournamentId);
      const team = await teamService.getTeam(payment.teamId);

      try {
        const { rejectedPaymentKeyboard } = require('../keyboards/paymentKeyboard');
        const kb = rejectedPaymentKeyboard(payment.id, payment.tournamentId);

        await ctx.telegram.sendMessage(
          payment.captainId,
          `╔══════════════════════╗\n` +
            `   ❌ <b>${t('payment_rejected')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 ${t('admin_tournaments')}: <b>${escapeHtml(tour?.title || '-')}</b>\n` +
            `👥 ${t('admin_teams')}: <b>${escapeHtml(team?.name || '-')}</b>\n` +
            `❗ <b>${t('tour_announce_reason')}:</b>\n${escapeHtml(reason)}\n\n` +
            `<i>${t('btn_retry')}</i>`,
          { parse_mode: 'HTML', ...kb }
        );
      } catch (e) {}

      await ctx.reply(
        `✅ <b>${t('payment_rejected')}</b>\n\n` +
          `${t('tour_announce_reason')}: ${escapeHtml(reason)}\n` +
          `${t('captain_notified')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('org_pending_payments'),
                  callback_data: CALLBACK.ORG_PENDING_PAYMENTS,
                },
              ],
              [{ text: t('admin_panel'), callback_data: CALLBACK.ADMIN_PANEL }],
            ],
          },
        }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${t('error_prefix')} ${e.message || t('error_generic')}`);
    }
  });

  // ============================================================
  // 4. TO'LOVLAR PANELI
  // ============================================================
  bot.action(CALLBACK.ADMIN_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;

    if (isAdmin) {
      await safeEdit(
        ctx,
        `💳 <b>${t('admin_payments')}</b>\n\n${t('admin_panel_subtitle')}`,
        adminPaymentsKeyboard(ctx)
      );
    } else {
      await safeEdit(
        ctx,
        `💳 <b>${t('admin_payments')}</b>\n\n${t('admin_panel_subtitle')}`,
        organizerPaymentsKeyboard(ctx)
      );
    }
  });

  // ============================================================
  // 5. KUTILAYOTGAN TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ORG_PENDING_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const list = isAdmin
      ? await paymentService.getAllPayments(PAYMENT_STATUS.PENDING)
      : await paymentService.getOrganizerPayments(ctx.from.id, PAYMENT_STATUS.PENDING);

    if (!list.length) {
      return safeEdit(ctx, `📭 ${t('org_no_pending')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
        },
      });
    }

    const lines = [`⏳ <b>${t('org_pending_title')} (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const p of list.slice(0, 20)) {
      const tour = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      lines.push(`🆔 <code>${p.id}</code>`);
      lines.push(`   🏆 ${escapeHtml(tour?.title || '-')}`);
      lines.push(`   👥 ${escapeHtml(team?.name || '-')}`);
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
      },
    });
  });

  // ============================================================
  // 6. TASDIQLANGAN TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_PAYMENTS_APPROVED, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    const list = await paymentService.getAllPayments(PAYMENT_STATUS.APPROVED);

    if (!list.length) {
      return safeEdit(ctx, `📭 ${t('no_data')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
        },
      });
    }

    const lines = [`✅ <b>${t('payment_approved')} (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const p of list.slice(0, 20)) {
      const tour = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      lines.push(`🆔 <code>${p.id}</code>`);
      lines.push(`   🏆 ${escapeHtml(tour?.title || '-')}`);
      lines.push(`   👥 ${escapeHtml(team?.name || '-')}`);
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
      },
    });
  });

  // ============================================================
  // 7. RAD ETILGAN TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_PAYMENTS_REJECTED, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    const list = await paymentService.getAllPayments(PAYMENT_STATUS.REJECTED);

    if (!list.length) {
      return safeEdit(ctx, `📭 ${t('no_data')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
        },
      });
    }

    const lines = [`❌ <b>${t('payment_rejected')} (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const p of list.slice(0, 20)) {
      const tour = await tournamentService.getTournament(p.tournamentId);
      lines.push(`🆔 <code>${p.id}</code>`);
      lines.push(`   🏆 ${escapeHtml(tour?.title || '-')}`);
      lines.push(`   ❗ ${escapeHtml(p.rejectReason || '-')}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
      },
    });
  });

  // ============================================================
  // 8. MENING TO'LOVLARIM (Organizer)
  // ============================================================
  bot.action(CALLBACK.ORG_MY_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const list = isAdmin
      ? await paymentService.getAllPayments()
      : await paymentService.getOrganizerPayments(ctx.from.id);

    if (!list.length) {
      return safeEdit(ctx, `📭 ${t('org_no_payments')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
        },
      });
    }

    const lines = [`💳 <b>${t('pay_all_payments')} (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    const statusEmoji = {
      pending: '⏳',
      approved: '✅',
      rejected: '❌',
      cancelled: '🚫',
      expired: '⌛',
    };

    for (const p of list.slice(0, 20)) {
      const tour = await tournamentService.getTournament(p.tournamentId);
      lines.push(
        `${statusEmoji[p.status]} <code>${p.id}</code> — <b>${escapeHtml(tour?.title || '-')}</b>`
      );
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.ADMIN_PAYMENTS }]],
      },
    });
  });

  // ============================================================
  // 9. PAY: TEAM INFO
  // ============================================================
  bot.action(/^pay:ti:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const payId = ctx.match[1];
    const p = await paymentService.getPayment(payId);
    if (!p) return ctx.reply(`❗ ${t('error_not_found')}`);

    const team = await teamService.getTeam(p.teamId);
    const captain = await userService.getUser(p.captainId);

    if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);

    const lines = [`👥 <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>`, ''];
    lines.push(`👑 ${t('team_captain')}: <b>${escapeHtml(displayName(captain))}</b>`);
    lines.push(`👤 ${t('team_members_count')}: <b>${team.members.length}/8</b>`);
    lines.push('');

    for (let i = 0; i < team.members.length; i++) {
      const m = await userService.getUser(team.members[i]);
      lines.push(`${i + 1}. ${escapeHtml(displayName(m))}`);
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // ============================================================
  // 10. PAY: TOUR INFO
  // ============================================================
  bot.action(/^pay:tri:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(`❗ ${t('error_not_found')}`);

    const text =
      `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
      `💰 ${t('promotion_total')}: <b>${tour.payment?.amount} ${tour.payment?.currency}</b>\n` +
      `📅 ${tour.date} | ⏰ ${tour.startTime}\n` +
      `🎮 ${escapeHtml(tour.mode)}\n` +
      `👥 ${tour.registeredTeams.length}/${tour.maxTeams}`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  });
};