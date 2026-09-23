// ============================================================
// PAYMENT HANDLER — To'lov cheki (TUZATILGAN: await + fallback)
// ============================================================
const { Markup } = require('telegraf');
const paymentService = require('../services/paymentService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, STATES, PAYMENT_STATUS } = require('../constants');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
  displayName,
} = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

// ============================================================
// YORDAMCHI: Xavfsiz reply (async xatoni tutadi)
// ============================================================
async function safeReply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, extra);
  } catch (e) {
    console.error('safeReply xatosi:', e.message);
    return null;
  }
}

async function safeReplyPhoto(ctx, fileId, caption, extra = {}) {
  try {
    return await ctx.replyWithPhoto(fileId, {
      caption,
      ...extra,
    });
  } catch (e) {
    console.error('safeReplyPhoto xatosi:', e.message);
    return null;
  }
}

module.exports = (bot) => {
  // ============================================================
  // 1. PULLIK TURNIRGA QO'SHILISH — Karta ma'lumotlari
  // ============================================================
  bot.action(/^tour:reg_paid:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const t = await tournamentService.getTournament(tId);
      if (!t) {
        return await safeReply(ctx, ctx.t('tour_not_found'));
      }

      const user = await userService.getUser(ctx.from.id);
      if (!user?.teamId) {
        return await safeReply(ctx, ctx.t('error_team_not_member'), {
          reply_markup: {
            inline_keyboard: [
              [{ text: ctx.t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tId }],
            ],
          },
        });
      }

      const team = await teamService.getTeam(user.teamId);
      if (!team) {
        return await safeReply(ctx, ctx.t('error_not_found'));
      }

      if (team.captainId !== ctx.from.id) {
        return await safeReply(ctx, ctx.t('error_not_captain'));
      }

      // Aktiv to'lov bormi?
      const activePay = await paymentService.getActivePayment(tId, team.id);
      if (activePay) {
        if (activePay.status === PAYMENT_STATUS.PENDING) {
          return await safeReply(
            ctx,
            `⏳ <b>To'lovingiz tekshirilmoqda</b>\n\nIltimos, kuting.`,
            { parse_mode: 'HTML' }
          );
        }
        if (activePay.status === PAYMENT_STATUS.APPROVED) {
          return await safeReply(
            ctx,
            `✅ <b>To'lovingiz tasdiqlangan!</b>\n\nKomandangiz turnirga ro'yxatdan o'tgan.`,
            { parse_mode: 'HTML' }
          );
        }
      }

      if (t.registeredTeams.includes(team.id)) {
        return await safeReply(ctx, ctx.t('error_already_registered'));
      }

      if (t.registeredTeams.length >= t.maxTeams) {
        return await safeReply(ctx, ctx.t('error_tournament_full'));
      }

      // To'lov ma'lumotlari mavjudmi?
      const p = t.payment || {};
      if (!p.cardNumber || !p.amount) {
        return await safeReply(
          ctx,
          `❗ <b>Uzr, ushbu turnir uchun to'lov ma'lumotlari kiritilmagan.</b>\n\nIltimos, organizator bilan bog'laning.`,
          { parse_mode: 'HTML' }
        );
      }

      const currency = p.currency || 'UZS';
      const cardFormatted = formatCardNumber(p.cardNumber);

      const text =
        `╔══════════════════════╗\n` +
        `   💳 <b>TO'LOV MA'LUMOTLARI</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 <b>Ishtirok narxi:</b>\n` +
        `<b>${p.amount} ${currency}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💳 <b>Karta raqami:</b>\n` +
        `<code>${escapeHtml(cardFormatted)}</code>\n\n` +
        `👤 <b>Karta egasi:</b>\n` +
        `<b>${escapeHtml(p.cardOwner || '-')}</b>\n` +
        (p.instruction ? `\n📝 <b>Izoh:</b>\n${escapeHtml(p.instruction)}\n` : '') +
        (p.deadline
          ? `\n⏰ <b>To'lov muddati:</b>\n<b>${escapeHtml(p.deadline)}</b>\n`
          : '') +
        `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <b>To'lovdan so'ng chekni rasm yoki PDF ko'rinishida yuboring.</b>`;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            ctx.t('payment_send_receipt'),
            CALLBACK.PAY_SEND_RECEIPT + t.id
          ),
        ],
        [Markup.button.callback(ctx.t('btn_back'), CALLBACK.TOUR_OPEN + t.id)],
      ]);

      // Rasm bilan yuborishga harakat
      if (t.imageFileId) {
        const result = await safeReplyPhoto(ctx, t.imageFileId, text, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
        if (result) return;
        // rasm ishlamasa — matnga o'tamiz
      }

      await safeReply(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      console.error('tour:reg_paid xatosi:', e.message);
      await safeReply(ctx, ctx.t('error_generic'));
    }
  });

  // ============================================================
  // 2. CHEK YUBORISH — BOSHLASH
  // ============================================================
  bot.action(/^pay:send:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const t = await tournamentService.getTournament(tId);
      if (!t) return await safeReply(ctx, ctx.t('tour_not_found'));

      ctx.session = {
        state: STATES.PAYMENT_RECEIPT,
        data: { tid: tId },
      };

      await safeReply(
        ctx,
        `📤 <b>Chekni yuboring</b>\n\n` +
          `Chekni <b>rasm</b> yoki <b>PDF</b> fayl ko'rinishida yuboring:\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 <i>Caption qo'shishingiz mumkin.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: ctx.t('btn_cancel'),
                  callback_data: CALLBACK.TOUR_OPEN + tId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('pay:send xatosi:', e.message);
    }
  });

  // ============================================================
  // 3. CHEKNI QAYTA YUBORISH
  // ============================================================
  bot.action(/^pay:resend:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const payId = ctx.match[1];
      const payment = await paymentService.getPayment(payId);
      if (!payment) return await safeReply(ctx, ctx.t('error_not_found'));

      if (payment.status !== PAYMENT_STATUS.REJECTED) {
        return await safeReply(
          ctx,
          "❗ Faqat rad etilgan to'lovni qayta yuborish mumkin."
        );
      }

      if (payment.captainId !== ctx.from.id) {
        return await safeReply(ctx, "⛔ Bu sizning to'lovingiz emas.");
      }

      ctx.session = {
        state: STATES.PAYMENT_RECEIPT,
        data: { tid: payment.tournamentId, resendPaymentId: payId },
      };

      await safeReply(
        ctx,
        `🔄 <b>Qayta chek yuborish</b>\n\n` +
          `Yangi chekni rasm yoki PDF ko'rinishida yuboring:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: ctx.t('btn_cancel'),
                  callback_data: CALLBACK.TOUR_OPEN + payment.tournamentId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('pay:resend xatosi:', e.message);
    }
  });

  // ============================================================
  // 4. MENING TO'LOVLARIM
  // ============================================================
  bot.action(CALLBACK.PAY_MY, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const payments = await paymentService.getCaptainPayments(ctx.from.id);

      if (!payments.length) {
        return await safeEdit(ctx, "📭 Sizda to'lovlar yo'q.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: ctx.t('btn_back'), callback_data: CALLBACK.MENU_PROFILE }],
            ],
          },
        });
      }

      const lines = [`💳 <b>Mening to'lovlarim (${payments.length})</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      const statusEmoji = {
        pending: '⏳',
        approved: '✅',
        rejected: '❌',
        cancelled: '🚫',
        expired: '⌛',
      };

      const statusText = {
        pending: ctx.t('payment_status_pending'),
        approved: ctx.t('payment_status_approved'),
        rejected: ctx.t('payment_status_rejected'),
        cancelled: ctx.t('payment_status_cancelled'),
        expired: ctx.t('payment_status_expired'),
      };

      for (const p of payments.slice(0, 10)) {
        const t = await tournamentService.getTournament(p.tournamentId);
        lines.push(
          `${statusEmoji[p.status] || '•'} <b>${escapeHtml(
            t?.title || p.tournamentId
          )}</b>`
        );
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

      const rows = payments
        .filter((p) => p.status === PAYMENT_STATUS.REJECTED)
        .slice(0, 5)
        .map((p) => [
          Markup.button.callback(
            '🔄 Qayta yuborish',
            CALLBACK.PAY_RESEND + p.id
          ),
        ]);
      rows.push([
        Markup.button.callback(ctx.t('btn_back'), CALLBACK.MENU_PROFILE),
      ]);

      await safeEdit(ctx, lines.join('\n'), {
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      console.error('pay:my xatosi:', e.message);
    }
  });

  // ============================================================
  // 5. FSM — CHEK QABUL QILISH (rasm)
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.PAYMENT_RECEIPT) return next();

    try {
      const { tid, resendPaymentId } = ctx.session.data;
      const t = await tournamentService.getTournament(tid);
      if (!t) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, ctx.t('tour_not_found'));
      }

      const user = await userService.getUser(ctx.from.id);
      const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
      if (!team) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, ctx.t('error_not_found'));
      }

      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const caption = cleanText(ctx.message.caption, 500);

      let payment;

      if (resendPaymentId) {
        payment = await paymentService.resendReceipt(resendPaymentId, {
          receiptFileId: fileId,
          receiptType: 'photo',
          receiptCaption: caption,
        });
      } else {
        payment = await paymentService.createPayment({
          tournamentId: t.id,
          teamId: team.id,
          captainId: ctx.from.id,
          organizerId: t.organizerId || t.createdBy,
          receiptFileId: fileId,
          receiptType: 'photo',
          receiptCaption: caption,
          amount: t.payment?.amount,
          currency: t.payment?.currency,
        });
      }

      ctx.session = { state: null, data: {} };

      await safeReply(
        ctx,
        `✅ <b>To'lov chekingiz qabul qilindi!</b>\n\n` +
          `🏆 ${escapeHtml(t.title)}\n` +
          `👥 ${escapeHtml(team.name)}\n` +
          `💰 ${t.payment?.amount} ${t.payment?.currency}\n\n` +
          `⏳ <b>Holat: Tekshirilmoqda</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: ctx.t('payment_my'),
                  callback_data: CALLBACK.PAY_MY,
                },
              ],
              [
                {
                  text: ctx.t('btn_back_tournament'),
                  callback_data: CALLBACK.TOUR_OPEN + t.id,
                },
              ],
            ],
          },
        }
      );

      // Organizerga yuborish
      await sendPaymentToOrganizer(bot, payment, t, team, ctx.from);
    } catch (e) {
      console.error('photo receipt xatosi:', e.message);
      ctx.session = { state: null, data: {} };
      await safeReply(
        ctx,
        `${ctx.t('error_prefix')} ${e.message || ctx.t('error_generic')}`
      );
    }
  });

  // ============================================================
  // 6. FSM — CHEK QABUL QILISH (PDF)
  // ============================================================
  bot.on('document', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.PAYMENT_RECEIPT) return next();

    try {
      const doc = ctx.message.document;
      if (!doc) return next();

      const mime = doc.mime_type || '';
      const isPdf =
        mime === 'application/pdf' ||
        (doc.file_name || '').toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        return await safeReply(ctx, '❗ Faqat PDF yoki rasm qabul qilinadi.');
      }

      const { tid, resendPaymentId } = ctx.session.data;
      const t = await tournamentService.getTournament(tid);
      if (!t) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, ctx.t('tour_not_found'));
      }

      const user = await userService.getUser(ctx.from.id);
      const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
      if (!team) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, ctx.t('error_not_found'));
      }

      const fileId = doc.file_id;
      const caption = cleanText(ctx.message.caption, 500);

      let payment;

      if (resendPaymentId) {
        payment = await paymentService.resendReceipt(resendPaymentId, {
          receiptFileId: fileId,
          receiptType: 'document',
          receiptCaption: caption,
        });
      } else {
        payment = await paymentService.createPayment({
          tournamentId: t.id,
          teamId: team.id,
          captainId: ctx.from.id,
          organizerId: t.organizerId || t.createdBy,
          receiptFileId: fileId,
          receiptType: 'document',
          receiptCaption: caption,
          amount: t.payment?.amount,
          currency: t.payment?.currency,
        });
      }

      ctx.session = { state: null, data: {} };

      await safeReply(
        ctx,
        `✅ <b>To'lov chekingiz qabul qilindi!</b>\n\n` +
          `🏆 ${escapeHtml(t.title)}\n` +
          `👥 ${escapeHtml(team.name)}\n` +
          `💰 ${t.payment?.amount} ${t.payment?.currency}\n\n` +
          `⏳ <b>Holat: Tekshirilmoqda</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: ctx.t('payment_my'),
                  callback_data: CALLBACK.PAY_MY,
                },
              ],
              [
                {
                  text: ctx.t('btn_back_tournament'),
                  callback_data: CALLBACK.TOUR_OPEN + t.id,
                },
              ],
            ],
          },
        }
      );

      await sendPaymentToOrganizer(bot, payment, t, team, ctx.from);
    } catch (e) {
      console.error('document receipt xatosi:', e.message);
      ctx.session = { state: null, data: {} };
      await safeReply(
        ctx,
        `${ctx.t('error_prefix')} ${e.message || ctx.t('error_generic')}`
      );
    }
  });
};

// ============================================================
// YORDAMCHI: Karta formatlash
// ============================================================
function formatCardNumber(cardNumber) {
  if (!cardNumber) return '-';
  const clean = String(cardNumber).replace(/\s/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

// ============================================================
// YORDAMCHI: Organizerga to'lovni yuborish
// ============================================================
async function sendPaymentToOrganizer(
  bot,
  payment,
  tournament,
  team,
  captain
) {
  const organizerId = payment.organizerId;
  if (!organizerId) return;

  const header =
    `💳 <b>YANGI TO'LOV CHEKI</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 <b>Turnir:</b> ${escapeHtml(tournament.title)}\n` +
    `💳 <b>Tur:</b> Pullik\n` +
    `👥 <b>Komanda:</b> ${escapeHtml(team.name)}\n` +
    `🏷 <b>Teg:</b> ${escapeHtml(team.tag)}\n\n` +
    `👤 <b>Captain:</b> ${escapeHtml(displayName(captain))}\n` +
    `📛 <b>Username:</b> ${
      captain.username ? '@' + escapeHtml(captain.username) : "yo'q"
    }\n` +
    `🆔 <b>Telegram ID:</b> <code>${captain.id}</code>\n\n` +
    `💰 <b>Summa:</b> ${payment.amount} ${payment.currency}\n` +
    `📅 <b>Yuborilgan:</b> ${new Date(payment.submittedAt).toLocaleString(
      'uz-UZ'
    )}\n` +
    `🆔 <b>To'lov ID:</b> <code>${payment.id}</code>`;

  const { paymentReviewKeyboard } = require('../keyboards/paymentKeyboard');
  const kb = paymentReviewKeyboard(ctx, payment.id, tournament.id);

  try {
    if (payment.receiptType === 'photo') {
      await bot.telegram.sendPhoto(organizerId, payment.receiptFileId, {
        caption: header,
        parse_mode: 'HTML',
        ...kb,
      });
    } else {
      await bot.telegram.sendMessage(organizerId, header, {
        parse_mode: 'HTML',
      });
      await bot.telegram.sendDocument(organizerId, payment.receiptFileId, {
        caption: `📄 Chek — ${payment.amount} ${payment.currency}`,
        ...kb,
      });
    }
  } catch (e) {
    console.error('Organizerga yuborishda xato:', e.message);
  }
}
