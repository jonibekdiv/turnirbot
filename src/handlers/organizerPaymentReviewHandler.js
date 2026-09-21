// ============================================================
// PAYMENT REVIEW HANDLER — Organizer chekni ko'rib chiqadi
// ============================================================
const { Markup } = require('telegraf');
const paymentService = require('../services/paymentService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const {
  CALLBACK,
  STATES,
  ROLES,
  PAYMENT_STATUS,
} = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');
const {
  adminPaymentsKeyboard,
  organizerPaymentsKeyboard,
} = require('../keyboards/paymentKeyboard');

module.exports = (bot) => {
  // ============================================================
  // TO'LOVNI TASDIQLASH
  // ============================================================
  bot.action(/^pay:a:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const payId = ctx.match[1];
    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply('❗ To\'lov topilmadi.');

    // Ruxsat tekshirish
    const isOwner = Number(payment.organizerId) === Number(ctx.from.id);
    const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);
    if (!isOwner && !isAdmin) {
      return ctx.reply("⛔ Bu to'lovni tasdiqlashga ruxsatingiz yo'q.");
    }

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      return ctx.reply("❗ Bu to'lov allaqachon ko'rib chiqilgan.");
    }

    const t = await tournamentService.getTournament(payment.tournamentId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    // Joy to'lganmi?
    if (t.registeredTeams.length >= t.maxTeams) {
      return ctx.reply(
        `⚠️ <b>Turnirda bo'sh joy qolmagan!</b>\n\n` +
          `Max: ${t.maxTeams}, hozirgi: ${t.registeredTeams.length}\n\n` +
          `<i>Admin bilan bog'laning.</i>`,
        { parse_mode: 'HTML' }
      );
    }

    // Allaqachon ro'yxatdan o'tganmi?
    if (t.registeredTeams.includes(payment.teamId)) {
      return ctx.reply("❗ Bu komanda allaqachon ro'yxatdan o'tgan.");
    }

    try {
      await paymentService.approvePayment(payId, ctx.from.id);
      await tournamentService.registerTeam(t.id, payment.teamId);

      const team = await teamService.getTeam(payment.teamId);
      const captain = await userService.getUser(payment.captainId);

      // Captainga xabar
      try {
        await ctx.telegram.sendMessage(
          payment.captainId,
          `╔══════════════════════╗\n` +
            `   ✅ <b>TO'LOV TASDIQLANDI!</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 Turnir: <b>${escapeHtml(t.title)}</b>\n` +
            `👥 Komanda: <b>${escapeHtml(team?.name || '-')}</b>\n\n` +
            `<i>Sizning komandangiz turnirga muvaffaqiyatli ro'yxatdan o'tdi!</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}

      // Komanda a'zolariga xabar
      if (team) {
        for (const memberId of team.members) {
          if (memberId === payment.captainId) continue;
          try {
            await ctx.telegram.sendMessage(
              memberId,
              `✅ <b>Komandangiz turnirga ro'yxatdan o'tdi!</b>\n\n` +
                `🏆 ${escapeHtml(t.title)}\n` +
                `👥 ${escapeHtml(team.name)}`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        }
      }

      await safeEdit(
        ctx,
        `✅ <b>To'lov tasdiqlandi!</b>\n\n` +
          `🏆 ${escapeHtml(t.title)}\n` +
          `👥 ${escapeHtml(team?.name || '-')}\n` +
          `📊 Komandalar: ${t.registeredTeams.length + 1}/${t.maxTeams}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⏳ Kutilayotgan to\'lovlar',
                  callback_data: CALLBACK.ORG_PENDING_PAYMENTS,
                },
              ],
              [
                {
                  text: '⬅️ Admin panel',
                  callback_data: CALLBACK.ADMIN_PANEL,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });

  // ============================================================
  // TO'LOVNI RAD ETISH — BOSHLASH
  // ============================================================
  bot.action(/^pay:r:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const payId = ctx.match[1];
    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply('❗ To\'lov topilmadi.');

    const isOwner = Number(payment.organizerId) === Number(ctx.from.id);
    const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);
    if (!isOwner && !isAdmin) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      return ctx.reply("❗ Bu to'lov allaqachon ko'rib chiqilgan.");
    }

    ctx.session = {
      state: STATES.PAYMENT_REJECT_REASON,
      data: { paymentId: payId },
    };

    await ctx.reply(
      `❌ <b>To'lovni rad etish</b>\n\n` +
        `Rad etish sababini yozing:\n\n` +
        `<i>Masalan: "Chek ko'rinmayapti" yoki "Summa noto'g'ri"</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // FSM — RAD ETISH SABABI
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.PAYMENT_REJECT_REASON) return next();

    const { paymentId } = ctx.session.data;
    const reason = cleanText(ctx.message.text, 200);
    if (!reason) {
      return ctx.reply('❗ Sababni kiriting:');
    }

    const payment = await paymentService.getPayment(paymentId);
    if (!payment) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('❗ To\'lov topilmadi.');
    }

    const isOwner = Number(payment.organizerId) === Number(ctx.from.id);
    const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);
    if (!isOwner && !isAdmin) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    try {
      await paymentService.rejectPayment(paymentId, ctx.from.id, reason);
      ctx.session = { state: null, data: {} };

      const t = await tournamentService.getTournament(payment.tournamentId);
      const team = await teamService.getTeam(payment.teamId);

      // Captainga xabar
      try {
        const { rejectedPaymentKeyboard } = require('../keyboards/paymentKeyboard');
        const kb = rejectedPaymentKeyboard(payment.id, payment.tournamentId);

        await ctx.telegram.sendMessage(
          payment.captainId,
          `╔══════════════════════╗\n` +
            `   ❌ <b>TO'LOV RAD ETILDI</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 Turnir: <b>${escapeHtml(t?.title || '-')}</b>\n` +
            `👥 Komanda: <b>${escapeHtml(team?.name || '-')}</b>\n` +
            `❗ <b>Sabab:</b>\n${escapeHtml(reason)}\n\n` +
            `<i>To'g'ri chekni qayta yuborishingiz mumkin.</i>`,
          { parse_mode: 'HTML', ...kb }
        );
      } catch (e) {}

      await ctx.reply(
        `✅ <b>To'lov rad etildi</b>\n\n` +
          `Sabab: ${escapeHtml(reason)}\n` +
          `Captainga xabar yuborildi.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⏳ Kutilayotgan to\'lovlar',
                  callback_data: CALLBACK.ORG_PENDING_PAYMENTS,
                },
              ],
              [{ text: '⬅️ Admin panel', callback_data: CALLBACK.ADMIN_PANEL }],
            ],
          },
        }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });

  // ============================================================
  // ADMIN / ORGANIZER PANEL — TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;

    if (isAdmin) {
      await safeEdit(
        ctx,
        `💳 <b>To'lovlar</b>\n\nBo'limni tanlang:`,
        adminPaymentsKeyboard()
      );
    } else {
      await safeEdit(
        ctx,
        `💳 <b>To'lovlar</b>\n\nBo'limni tanlang:`,
        organizerPaymentsKeyboard()
      );
    }
  });

  // ============================================================
  // KUTILAYOTGAN TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ORG_PENDING_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const list = isAdmin
      ? await paymentService.getAllPayments(PAYMENT_STATUS.PENDING)
      : await paymentService.getOrganizerPayments(ctx.from.id, PAYMENT_STATUS.PENDING);

    if (!list.length) {
      return safeEdit(ctx, "📭 Kutilayotgan to'lovlar yo'q.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
          ],
        },
      });
    }

    const lines = [`⏳ <b>Kutilayotgan to'lovlar (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const p of list.slice(0, 20)) {
      const t = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      lines.push(`🆔 <code>${p.id}</code>`);
      lines.push(`   🏆 ${escapeHtml(t?.title || '-')}`);
      lines.push(`   👥 ${escapeHtml(team?.name || '-')}`);
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
        ],
      },
    });
  });

  // ============================================================
  // TASDIQLANGAN TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_PAYMENTS_APPROVED, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    const list = await paymentService.getAllPayments(PAYMENT_STATUS.APPROVED);

    if (!list.length) {
      return safeEdit(ctx, "📭 Tasdiqlangan to'lovlar yo'q.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
          ],
        },
      });
    }

    const lines = [`✅ <b>Tasdiqlangan to'lovlar (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const p of list.slice(0, 20)) {
      const t = await tournamentService.getTournament(p.tournamentId);
      const team = await teamService.getTeam(p.teamId);
      lines.push(`🆔 <code>${p.id}</code>`);
      lines.push(`   🏆 ${escapeHtml(t?.title || '-')}`);
      lines.push(`   👥 ${escapeHtml(team?.name || '-')}`);
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
        ],
      },
    });
  });

  // ============================================================
  // RAD ETILGAN TO'LOVLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_PAYMENTS_REJECTED, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN && ctx.state.role !== ROLES.ADMIN) return;

    const list = await paymentService.getAllPayments(PAYMENT_STATUS.REJECTED);

    if (!list.length) {
      return safeEdit(ctx, "📭 Rad etilgan to'lovlar yo'q.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
          ],
        },
      });
    }

    const lines = [`❌ <b>Rad etilgan to'lovlar (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const p of list.slice(0, 20)) {
      const t = await tournamentService.getTournament(p.tournamentId);
      lines.push(`🆔 <code>${p.id}</code>`);
      lines.push(`   🏆 ${escapeHtml(t?.title || '-')}`);
      lines.push(`   ❗ ${escapeHtml(p.rejectReason || '-')}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
        ],
      },
    });
  });

  // ============================================================
  // ORGANIZER — MENING TO'LOVLARIM
  // ============================================================
  bot.action(CALLBACK.ORG_MY_PAYMENTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const list = isAdmin
      ? await paymentService.getAllPayments()
      : await paymentService.getOrganizerPayments(ctx.from.id);

    if (!list.length) {
      return safeEdit(ctx, "📭 To'lovlar yo'q.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
          ],
        },
      });
    }

    const lines = [`💳 <b>Barcha to'lovlar (${list.length})</b>`, ''];
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
      const t = await tournamentService.getTournament(p.tournamentId);
      lines.push(
        `${statusEmoji[p.status]} <code>${p.id}</code> — <b>${escapeHtml(t?.title || '-')}</b>`
      );
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ To\'lovlar', callback_data: CALLBACK.ADMIN_PAYMENTS }],
        ],
      },
    });
  });

  // ============================================================
  // CHEK OSTIDAGI "Komanda ma'lumotlari"
  // ============================================================
  bot.action(/^pay:ti:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const payId = ctx.match[1];
    const p = await paymentService.getPayment(payId);
    if (!p) return ctx.reply('❗ Topilmadi.');

    const team = await teamService.getTeam(p.teamId);
    const captain = await userService.getUser(p.captainId);

    if (!team) return ctx.reply('❗ Komanda topilmadi.');

    const lines = [`👥 <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>`, ''];
    lines.push(`👑 Captain: <b>${escapeHtml(displayName(captain))}</b>`);
    lines.push(`👤 A'zolar: <b>${team.members.length}/8</b>`);
    lines.push('');

    for (let i = 0; i < team.members.length; i++) {
      const m = await userService.getUser(team.members[i]);
      lines.push(`${i + 1}. ${escapeHtml(displayName(m))}`);
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // ============================================================
  // CHEK OSTIDAGI "Turnir ma'lumotlari"
  // ============================================================
  bot.action(/^pay:tri:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Topilmadi.');

    const text =
      `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
      `💰 Summa: <b>${t.payment?.amount} ${t.payment?.currency}</b>\n` +
      `📅 ${t.date} | ⏰ ${t.startTime}\n` +
      `🎮 ${escapeHtml(t.mode)}\n` +
      `👥 ${t.registeredTeams.length}/${t.maxTeams}`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  });
};