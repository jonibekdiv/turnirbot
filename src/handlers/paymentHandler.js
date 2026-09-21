// ============================================================
// PAYMENT HANDLER — To'lov cheki yuborish
// ============================================================
const { Markup } = require('telegraf');
const paymentService = require('../services/paymentService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, STATES, ROLES, PAYMENT_STATUS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

module.exports = (bot) => {
  // ============================================================
  // PULLIK TURNIRGA QO'SHILISH — Karta ma'lumotlari
  // ============================================================
  bot.action(/^tour:reg_paid:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply("❗ Siz komandada emassiz.", {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: CALLBACK.TOUR_OPEN + tId }]],
        },
      });
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply('❗ Komanda topilmadi.');

    if (team.captainId !== ctx.from.id) {
      return ctx.reply("❗ Faqat captain ro'yxatdan o'tkaza oladi.", {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: CALLBACK.TOUR_OPEN + tId }]],
        },
      });
    }

    // Aktiv to'lov bormi?
    const activePay = await paymentService.getActivePayment(tId, team.id);
    if (activePay) {
      // Pending
      if (activePay.status === PAYMENT_STATUS.PENDING) {
        return ctx.reply(
          `⏳ <b>To'lovingiz tekshirilmoqda</b>\n\n` +
            `Iltimos, kuting. Organizer chekni ko'rib chiqmoqda.`,
          { parse_mode: 'HTML' }
        );
      }
      // Approved
      if (activePay.status === PAYMENT_STATUS.APPROVED) {
        return ctx.reply(
          `✅ <b>To'lovingiz allaqachon tasdiqlangan!</b>\n\n` +
            `Komandangiz turnirga ro'yxatdan o'tgan.`,
          { parse_mode: 'HTML' }
        );
      }
    }

    // Turnir to'lgan?
    if (t.registeredTeams.includes(team.id)) {
      return ctx.reply("❗ Komandangiz allaqachon ro'yxatdan o'tgan.");
    }

    if (t.registeredTeams.length >= t.maxTeams) {
      return ctx.reply("❗ Turnir to'lgan.");
    }

    // Karta ma'lumotlarini ko'rsatish
    const p = t.payment || {};
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
      (p.deadline ? `\n⏰ <b>To'lov muddati:</b>\n<b>${escapeHtml(p.deadline)}</b>\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 <b>To'lovni amalga oshirgandan so'ng chekni rasm yoki PDF ko'rinishida botga yuboring.</i>`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📤 Chek yuborish', CALLBACK.PAY_SEND_RECEIPT + t.id)],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + t.id)],
    ]);

    if (t.imageFileId) {
      try {
        return ctx.replyWithPhoto(t.imageFileId, {
          caption: text,
          parse_mode: 'HTML',
          ...kb,
        });
      } catch (e) {}
    }

    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  });

  // ============================================================
  // CHEK YUBORISH — BOSHLASH
  // ============================================================
  bot.action(/^pay:send:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    ctx.session = {
      state: STATES.PAYMENT_RECEIPT,
      data: { tid: tId },
    };

    await ctx.reply(
      `📤 <b>Chekni yuboring</b>\n\n` +
        `Chekni <b>rasm</b> yoki <b>PDF</b> fayl ko'rinishida yuboring:\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💡 <i>Caption qo'shishingiz mumkin (izoh uchun).</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Bekor qilish', callback_data: CALLBACK.TOUR_OPEN + tId }],
          ],
        },
      }
    );
  });

  // ============================================================
  // CHEKNI QAYTA YUBORISH (rad etilgandan keyin)
  // ============================================================
  bot.action(/^pay:resend:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const payId = ctx.match[1];
    const payment = await paymentService.getPayment(payId);
    if (!payment) return ctx.reply('❗ To\'lov topilmadi.');

    if (payment.status !== PAYMENT_STATUS.REJECTED) {
      return ctx.reply('❗ Faqat rad etilgan to\'lovni qayta yuborish mumkin.');
    }

    if (payment.captainId !== ctx.from.id) {
      return ctx.reply("⛔ Bu sizning to'lovingiz emas.");
    }

    ctx.session = {
      state: STATES.PAYMENT_RECEIPT,
      data: { tid: payment.tournamentId, resendPaymentId: payId },
    };

    await ctx.reply(
      `🔄 <b>Qayta chek yuborish</b>\n\n` +
        `Yangi chekni rasm yoki PDF ko'rinishida yuboring:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⬅️ Bekor qilish',
                callback_data: CALLBACK.TOUR_OPEN + payment.tournamentId,
              },
            ],
          ],
        },
      }
    );
  });

  // ============================================================
  // MENING TO'LOVLARIM
  // ============================================================
  bot.action(CALLBACK.PAY_MY, async (ctx) => {
    await safeAnswer(ctx);
    const payments = await paymentService.getCaptainPayments(ctx.from.id);

    if (!payments.length) {
      return safeEdit(ctx, "📭 Sizda to'lovlar yo'q.", {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: CALLBACK.MENU_PROFILE }]],
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
      pending: 'Tekshirilmoqda',
      approved: 'Tasdiqlangan',
      rejected: 'Rad etilgan',
      cancelled: 'Bekor qilingan',
      expired: 'Muddati o\'tgan',
    };

    for (const p of payments.slice(0, 10)) {
      const t = await tournamentService.getTournament(p.tournamentId);
      lines.push(
        `${statusEmoji[p.status] || '•'} <b>${escapeHtml(t?.title || p.tournamentId)}</b>`
      );
      lines.push(`   💰 ${p.amount} ${p.currency}`);
      lines.push(`   📅 ${new Date(p.submittedAt).toLocaleString('uz-UZ')}`);
      lines.push(`   📌 ${statusText[p.status] || p.status}`);
      if (p.rejectReason) {
        lines.push(`   ❗ Sabab: ${escapeHtml(p.rejectReason)}`);
      }
      lines.push('');
    }

    const rows = payments
      .filter((p) => p.status === PAYMENT_STATUS.REJECTED)
      .slice(0, 5)
      .map((p) => [
        Markup.button.callback(
          `🔄 Qayta yuborish`,
          CALLBACK.PAY_RESEND + p.id
        ),
      ]);
    rows.push([Markup.button.callback('⬅️ Profil', CALLBACK.MENU_PROFILE)]);

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: { inline_keyboard: rows },
    });
  });

  // ============================================================
  // FSM — CHEK QABUL QILISH (rasm)
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.PAYMENT_RECEIPT) return next();

    const { tid, resendPaymentId } = ctx.session.data;
    const t = await tournamentService.getTournament(tid);
    if (!t) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('❗ Turnir topilmadi.');
    }

    const user = await userService.getUser(ctx.from.id);
    const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
    if (!team) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('❗ Komanda topilmadi.');
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = cleanText(ctx.message.caption, 500);

    try {
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

      await ctx.reply(
        `✅ <b>To'lov chekingiz qabul qilindi!</b>\n\n` +
          `🏆 ${escapeHtml(t.title)}\n` +
          `👥 ${escapeHtml(team.name)}\n` +
          `💰 ${t.payment?.amount} ${t.payment?.currency}\n\n` +
          `⏳ <b>Holat: Tekshirilmoqda</b>\n\n` +
          `<i>Organizer chekni ko'rib chiqib, javob beradi.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '💳 Mening to\'lovlarim',
                  callback_data: CALLBACK.PAY_MY,
                },
              ],
              [
                {
                  text: '⬅️ Turnirga qaytish',
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
      ctx.session = { state: null, data: {} };
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });

  // ============================================================
  // FSM — CHEK QABUL QILISH (PDF)
  // ============================================================
  bot.on('document', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.PAYMENT_RECEIPT) return next();

    const doc = ctx.message.document;
    if (!doc) return next();

    const mime = doc.mime_type || '';
    const isPdf = mime === 'application/pdf' || (doc.file_name || '').toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return ctx.reply('❗ Faqat PDF yoki rasm qabul qilinadi.');
    }

    const { tid, resendPaymentId } = ctx.session.data;
    const t = await tournamentService.getTournament(tid);
    if (!t) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('❗ Turnir topilmadi.');
    }

    const user = await userService.getUser(ctx.from.id);
    const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
    if (!team) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('❗ Komanda topilmadi.');
    }

    const fileId = doc.file_id;
    const caption = cleanText(ctx.message.caption, 500);

    try {
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

      await ctx.reply(
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
                  text: '💳 Mening to\'lovlarim',
                  callback_data: CALLBACK.PAY_MY,
                },
              ],
              [
                {
                  text: '⬅️ Turnirga qaytish',
                  callback_data: CALLBACK.TOUR_OPEN + t.id,
                },
              ],
            ],
          },
        }
      );

      await sendPaymentToOrganizer(bot, payment, t, team, ctx.from);
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
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
async function sendPaymentToOrganizer(bot, payment, tournament, team, captain) {
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
    `📛 <b>Username:</b> ${captain.username ? '@' + escapeHtml(captain.username) : "yo'q"}\n` +
    `🆔 <b>Telegram ID:</b> <code>${captain.id}</code>\n\n` +
    `💰 <b>Summa:</b> ${payment.amount} ${payment.currency}\n` +
    `📅 <b>Yuborilgan:</b> ${new Date(payment.submittedAt).toLocaleString('uz-UZ')}\n` +
    `🆔 <b>To'lov ID:</b> <code>${payment.id}</code>`;

  const { paymentReviewKeyboard } = require('../keyboards/paymentKeyboard');
  const kb = paymentReviewKeyboard(payment.id, tournament.id);

  try {
    if (payment.receiptType === 'photo') {
      await bot.telegram.sendPhoto(organizerId, payment.receiptFileId, {
        caption: header,
        parse_mode: 'HTML',
        ...kb,
      });
    } else {
      // Avval header matn
      await bot.telegram.sendMessage(organizerId, header, {
        parse_mode: 'HTML',
      });
      // Keyin PDF
      await bot.telegram.sendDocument(organizerId, payment.receiptFileId, {
        caption: `📄 Chek — ${payment.amount} ${payment.currency}`,
        ...kb,
      });
    }
  } catch (e) {
    console.error('Organizerga yuborishda xato:', e.message);
  }
}