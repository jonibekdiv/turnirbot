// ============================================================
// PAYMENT HANDLER — Wallet + Karta + Promo (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const paymentService = require('../services/paymentService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const promoService = require('../services/promoService');
const walletService = require('../services/walletService');
const auditService = require('../services/auditService');
const {
  CALLBACK,
  STATES,
  PAYMENT_STATUS,
  LIMITS,
} = require('../constants');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
  displayName,
} = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

// ============================================================
// YORDAMCHI: Xavfsiz reply
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
    return await ctx.replyWithPhoto(fileId, { caption, ...extra });
  } catch (e) {
    console.error('safeReplyPhoto xatosi:', e.message);
    return null;
  }
}

// ============================================================
// YORDAMCHI: Narx hisoblash
// ============================================================
function calculateTournamentPrice(tournament, promoData) {
  const baseAmount = tournament.payment?.amount || 0;

  if (!promoData || !promoData.promoId) {
    return {
      baseAmount,
      discount: 0,
      finalAmount: baseAmount,
      isFree: baseAmount === 0,
      promoCode: null,
    };
  }

  const discount = promoData.discount || 0;
  const finalAmount = Math.max(0, baseAmount - discount);
  const isFree = finalAmount === 0;

  return {
    baseAmount,
    discount,
    finalAmount,
    isFree,
    promoCode: promoData.promoCode,
  };
}

// ============================================================
// YORDAMCHI: To'lov sahifasi
// ============================================================
async function showPaymentPage(ctx, tournament, team, options = {}) {
  const isEdit = options.isEdit !== false;
  const t = ctx.t;

  const wallet = await walletService.getOrCreate(ctx.from.id);

  const promoId = ctx.session?.data?.promoId;
  const promoCode = ctx.session?.data?.promoCode;
  const discount = ctx.session?.data?.discount || 0;
  const hasPromo = promoId && ctx.session?.data?.tournamentId === tournament.id;

  const priceData = calculateTournamentPrice(tournament, {
    promoId: hasPromo ? promoId : null,
    promoCode,
    discount,
  });

  const currency = tournament.payment?.currency || 'UZS';
  const cardFormatted = formatCardNumber(tournament.payment?.cardNumber);
  const walletEnough = wallet.balance >= priceData.finalAmount;

  const lines = [];

  lines.push('╔══════════════════════╗');
  lines.push(`   💳 <b>${t('pay_view_title')}</b>`);
  lines.push('╚══════════════════════╝');
  lines.push('');
  lines.push(`🏆 <b>${escapeHtml(tournament.title)}</b>`);
  lines.push(`👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (hasPromo) {
    lines.push(
      `💰 <b>${t('wallet_pay_original_price')}:</b> <s>${priceData.baseAmount.toLocaleString()} ${currency}</s>`
    );
    lines.push(`🎫 <b>${t('promo_code')}:</b> <code>${escapeHtml(promoCode)}</code>`);
    lines.push(
      `💸 <b>${t('wallet_pay_saved')}:</b> -${priceData.discount.toLocaleString()} ${currency}`
    );
    lines.push('');
    lines.push(
      `💵 <b>${t('wallet_pay_to_pay')}:</b> <b>${priceData.finalAmount.toLocaleString()} ${currency}</b>`
    );
  } else {
    lines.push(
      `💰 <b>${t('payment_amount')}:</b> <b>${priceData.baseAmount.toLocaleString()} ${currency}</b>`
    );
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(
    `👛 <b>${t('wallet_balance_label')}:</b> <b>${walletService.formatAmount(wallet.balance)} ${currency}</b>`
  );

  if (priceData.isFree) {
    lines.push('');
    lines.push(`🎉 <b>${t('wallet_pay_free')}</b>`);
    lines.push('');
    lines.push(`<i>${t('wallet_pay_free_desc')}</i>`);
  } else if (walletEnough) {
    lines.push(`✅ <i>${t('wallet_sufficient')}</i>`);
  } else {
    const missing = priceData.finalAmount - wallet.balance;
    lines.push(
      `⚠️ <i>${t('wallet_insufficient')} ${walletService.formatAmount(missing)} ${currency}</i>`
    );
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (!priceData.isFree && tournament.payment?.cardNumber) {
    lines.push(`💳 <b>${t('wallet_pay_card')}:</b>`);
    lines.push(`<code>${escapeHtml(cardFormatted)}</code>`);
    lines.push(`👤 ${escapeHtml(tournament.payment.cardOwner || '-')}`);
    lines.push('');
  }

  lines.push(`👇 <b>${t('support_choose_type')}</b>`);

  const rows = [];

  if (priceData.isFree) {
    rows.push([
      Markup.button.callback(
        t('wallet_free_register'),
        'tour:pay_free:' + tournament.id
      ),
    ]);
  } else {
    if (walletEnough) {
      rows.push([
        Markup.button.callback(
          `${t('wallet_pay_tournament')} (${priceData.finalAmount.toLocaleString()} ${currency})`,
          'tour:pay_wallet:' + tournament.id
        ),
      ]);
    } else {
      rows.push([
        Markup.button.callback(t('wallet_topup'), CALLBACK.WALLET_DEPOSIT),
      ]);
    }

    rows.push([
      Markup.button.callback(
        t('wallet_pay_card'),
        CALLBACK.PAY_SEND_RECEIPT + tournament.id
      ),
    ]);
  }

  if (hasPromo) {
    rows.push([
      Markup.button.callback(
        t('promo_remove'),
        CALLBACK.PROMO_REMOVE + tournament.id
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        t('promo_apply_title'),
        CALLBACK.PROMO_APPLY + tournament.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(t('btn_back_tournament'), CALLBACK.TOUR_OPEN + tournament.id),
  ]);

  const kb = Markup.inlineKeyboard(rows);

  if (isEdit) {
    try {
      return await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {}
  }

  if (tournament.imageFileId) {
    const r = await safeReplyPhoto(ctx, tournament.imageFileId, lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: kb.reply_markup,
    });
    if (r) return;
  }

  await safeReply(ctx, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: kb.reply_markup,
  });
}

// ============================================================
// YORDAMCHI: Karta formatlash
// ============================================================
function formatCardNumber(cardNumber) {
  if (!cardNumber) return '-';
  const clean = String(cardNumber).replace(/\s/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

// ============================================================
// YORDAMCHI: Wallet to'lov
// ============================================================
async function processWalletPayment(ctx, tournament, team, amount, promoData) {
  const user = ctx.from;
  const wallet = await walletService.getWallet(user.id);

  if (!wallet || wallet.balance < amount) {
    throw new Error(ctx.t('wallet_insufficient_balance'));
  }

  const updatedWallet = await walletService.adjustBalance(
    user.id,
    -amount,
    'tournament_pay',
    `Turnir: ${tournament.title}`,
    null,
    tournament.id
  );

  const payment = await paymentService.createPayment({
    tournamentId: tournament.id,
    teamId: team.id,
    captainId: user.id,
    organizerId: tournament.organizerId || tournament.createdBy,
    receiptFileId: null,
    receiptType: 'wallet',
    receiptCaption: `Wallet. Promo: ${promoData?.promoCode || '-'}`,
    amount: amount,
    currency: tournament.payment?.currency,
  });

  await paymentService.approvePayment(payment.id, user.id);

  if (promoData && promoData.promoId) {
    try {
      await promoService.applyPromo(
        promoData.promoId,
        user.id,
        tournament.id,
        team.id,
        promoData.discount || 0,
        tournament.payment?.amount || 0,
        amount
      );
    } catch (e) {
      console.error('Promo apply:', e.message);
    }
  }

  const reg = await tournamentService.registerTeam(tournament.id, team.id);

  try {
    await auditService.log({
      action: 'WALLET_TOURNAMENT_PAYMENT',
      actorId: user.id,
      tournamentId: tournament.id,
      teamId: team.id,
      details: {
        amount,
        promoCode: promoData?.promoCode || null,
        newBalance: updatedWallet.balance,
      },
    });
  } catch (e) {}

  if (tournament.hostId) {
    try {
      await ctx.telegram.sendMessage(
        tournament.hostId,
        `ℹ️ <b>${escapeHtml(tournament.title)}</b>\n` +
          `💰 Wallet\n` +
          `👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }

  return {
    ok: true,
    payment,
    registered: reg.ok,
    wallet: updatedWallet,
  };
}

// ============================================================
// YORDAMCHI: Bepul ro'yxat
// ============================================================
async function processFreeRegistration(ctx, tournament, team, promoData) {
  const user = ctx.from;

  if (promoData && promoData.promoId) {
    try {
      await promoService.applyPromo(
        promoData.promoId,
        user.id,
        tournament.id,
        team.id,
        promoData.discount || 0,
        tournament.payment?.amount || 0,
        0
      );
    } catch (e) {
      console.error('Promo apply:', e.message);
    }
  }

  const reg = await tournamentService.registerTeam(tournament.id, team.id);

  try {
    const payment = await paymentService.createPayment({
      tournamentId: tournament.id,
      teamId: team.id,
      captainId: user.id,
      organizerId: tournament.organizerId || tournament.createdBy,
      receiptFileId: null,
      receiptType: 'free',
      receiptCaption: `Bepul. Promo: ${promoData?.promoCode || '-'}`,
      amount: 0,
      currency: tournament.payment?.currency,
    });
    await paymentService.approvePayment(payment.id, user.id);
  } catch (e) {
    console.error('Free payment:', e.message);
  }

  try {
    await auditService.log({
      action: 'FREE_TOURNAMENT_REGISTRATION',
      actorId: user.id,
      tournamentId: tournament.id,
      teamId: team.id,
      details: { promoCode: promoData?.promoCode || null },
    });
  } catch (e) {}

  return { ok: true, registered: reg.ok };
}

// ============================================================
// MODULE
// ============================================================
module.exports = (bot) => {
  // ============================================================
  // 1. PULLIK TURNIRGA QO'SHILISH
  // ============================================================
  bot.action(/^tour:reg_paid:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return await safeReply(ctx, t('tour_not_found'));

      const user = await userService.getUser(ctx.from.id);
      if (!user?.teamId) return await safeReply(ctx, t('error_team_not_member'));

      const team = await teamService.getTeam(user.teamId);
      if (!team) return await safeReply(ctx, t('error_not_found'));

      if (team.captainId !== ctx.from.id) {
        return await safeReply(ctx, t('error_not_captain'));
      }

      const activePay = await paymentService.getActivePayment(tId, team.id);
      if (activePay) {
        if (activePay.status === PAYMENT_STATUS.PENDING) {
          return await safeReply(
            ctx,
            `⏳ <b>${t('payment_status_pending')}</b>\n\n<i>${t('wallet_request_sent_desc')}</i>`,
            { parse_mode: 'HTML' }
          );
        }
        if (activePay.status === PAYMENT_STATUS.APPROVED) {
          return await safeReply(
            ctx,
            `✅ <b>${t('payment_approved')}</b>`,
            { parse_mode: 'HTML' }
          );
        }
      }

      if (tour.registeredTeams.includes(team.id)) {
        return await safeReply(ctx, t('error_already_registered'));
      }

      if (tour.registeredTeams.length >= tour.maxTeams) {
        return await safeReply(ctx, t('error_tournament_full'));
      }

      const p = tour.payment || {};
      if (!p.cardNumber || !p.amount) {
        return await safeReply(ctx, t('error_no_data'), { parse_mode: 'HTML' });
      }

      if (ctx.session?.data?.tournamentId !== tour.id) {
        ctx.session = {
          state: null,
          data: {
            tournamentId: tour.id,
            promoId: null,
            promoCode: null,
            discount: 0,
          },
        };
      }

      await showPaymentPage(ctx, tour, team, { isEdit: false });
    } catch (e) {
      console.error('tour:reg_paid:', e.message);
      await safeReply(ctx, t('tour_generic_error'));
    }
  });

  // ============================================================
  // 2. WALLET BILAN TO'LASH — TASDIQLASH SAHIFASI
  // ============================================================
  bot.action(/^tour:pay_wallet:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return await safeReply(ctx, t('tour_not_found'));

      const user = await userService.getUser(ctx.from.id);
      if (!user?.teamId) return await safeReply(ctx, t('error_team_not_member'));

      const team = await teamService.getTeam(user.teamId);
      if (!team) return await safeReply(ctx, t('error_not_found'));

      if (team.captainId !== ctx.from.id) {
        return await safeReply(ctx, t('error_not_captain'));
      }

      const promoId = ctx.session?.data?.promoId;
      const promoCode = ctx.session?.data?.promoCode;
      const discount = ctx.session?.data?.discount || 0;
      const hasPromo = promoId && ctx.session?.data?.tournamentId === tour.id;

      const priceData = calculateTournamentPrice(tour, {
        promoId: hasPromo ? promoId : null,
        promoCode,
        discount,
      });

      const currency = tour.payment?.currency || 'UZS';

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('wallet_pay_yes'),
            'tour:pay_wallet_confirm:' + tour.id
          ),
        ],
        [
          Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_OPEN + tour.id),
        ],
      ]);

      const lines = [
        '╔══════════════════════╗',
        `   ${t('wallet_pay_confirm')}`,
        '╚══════════════════════╝',
        '',
        `🏆 <b>${escapeHtml(tour.title)}</b>`,
        `👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      if (hasPromo) {
        lines.push(
          `💰 ${t('wallet_pay_original_price')}: <s>${priceData.baseAmount.toLocaleString()} ${currency}</s>`
        );
        lines.push(`🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>`);
        lines.push(
          `💸 ${t('wallet_pay_saved')}: -${priceData.discount.toLocaleString()} ${currency}`
        );
        lines.push('');
      }

      lines.push(
        `💵 <b>${t('wallet_pay_to_pay')}:</b> ${priceData.finalAmount.toLocaleString()} ${currency}`
      );
      lines.push('');
      lines.push(`👇 <b>${t('wallet_pay_confirm_question')}</b>`);

      try {
        await ctx.editMessageText(lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      } catch (e) {
        await safeReply(ctx, lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }
    } catch (e) {
      console.error('tour:pay_wallet:', e.message);
      await safeReply(ctx, `❌ ${e.message}`);
    }
  });

  // ============================================================
  // 3. WALLET TO'LOVNI BAJARISH
  // ============================================================
  bot.action(/^tour:pay_wallet_confirm:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return await safeReply(ctx, t('tour_not_found'));

      const user = await userService.getUser(ctx.from.id);
      const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
      if (!team) return await safeReply(ctx, t('error_not_found'));

      if (team.captainId !== ctx.from.id) {
        return await safeReply(ctx, t('error_not_captain'));
      }

      const promoId = ctx.session?.data?.promoId;
      const promoCode = ctx.session?.data?.promoCode;
      const discount = ctx.session?.data?.discount || 0;
      const hasPromo = promoId && ctx.session?.data?.tournamentId === tour.id;

      const priceData = calculateTournamentPrice(tour, {
        promoId: hasPromo ? promoId : null,
        promoCode,
        discount,
      });

      const currency = tour.payment?.currency || 'UZS';

      // Bepul
      if (priceData.isFree) {
        const res = await processFreeRegistration(ctx, tour, team, {
          promoId,
          promoCode,
          discount,
        });

        ctx.session = { state: null, data: {} };

        return await safeReply(
          ctx,
          `╔══════════════════════╗\n` +
            `   🎉 <b>${t('wallet_free_success')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 ${escapeHtml(tour.title)}\n` +
            `👥 ${escapeHtml(team.name)}\n\n` +
            (promoCode
              ? `🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>\n\n`
              : '') +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `✅ ${t('wallet_pay_registered')}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: t('tour_teamlist'),
                    callback_data: CALLBACK.TOUR_TEAMLIST + tour.id,
                  },
                ],
                [
                  {
                    text: t('btn_back_tournament'),
                    callback_data: CALLBACK.TOUR_OPEN + tour.id,
                  },
                ],
              ],
            },
          }
        );
      }

      const loading = await ctx.reply(`⏳ ${t('wallet_pay_processing')}`);

      try {
        const result = await processWalletPayment(
          ctx,
          tour,
          team,
          priceData.finalAmount,
          { promoId, promoCode, discount }
        );

        ctx.session = { state: null, data: {} };

        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
        } catch (e) {}

        if (result.ok) {
          const msgLines = [
            '╔══════════════════════╗',
            `   ✅ <b>${t('wallet_pay_success')}</b>`,
            '╚══════════════════════╝',
            '',
            `🏆 ${escapeHtml(tour.title)}`,
            `👥 ${escapeHtml(team.name)}`,
            '',
            '━━━━━━━━━━━━━━━━━━━━',
            '',
            `💵 ${t('wallet_pay_paid')}: <b>${priceData.finalAmount.toLocaleString()} ${currency}</b>`,
          ];

          if (hasPromo) {
            msgLines.push(`🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>`);
            msgLines.push(
              `💸 ${t('wallet_pay_saved')}: <b>${priceData.discount.toLocaleString()} ${currency}</b>`
            );
          }

          msgLines.push('');
          msgLines.push(
            `👛 ${t('wallet_pay_new_balance')}: <b>${walletService.formatAmount(result.wallet.balance)} ${currency}</b>`
          );
          msgLines.push('');
          msgLines.push('━━━━━━━━━━━━━━━━━━━━');
          msgLines.push('');
          msgLines.push(`✅ <b>${t('wallet_pay_registered')}</b>`);

          await safeReply(ctx, msgLines.join('\n'), {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: t('tour_teamlist'),
                    callback_data: CALLBACK.TOUR_TEAMLIST + tour.id,
                  },
                ],
                [
                  {
                    text: t('wallet_menu'),
                    callback_data: CALLBACK.WALLET_VIEW,
                  },
                ],
                [
                  {
                    text: t('btn_back_tournament'),
                    callback_data: CALLBACK.TOUR_OPEN + tour.id,
                  },
                ],
              ],
            },
          });
        } else {
          await safeReply(
            ctx,
            `❌ <b>${t('tour_generic_error')}</b>\n\n${result.reason || ''}`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (e) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
        } catch (err) {}
        await safeReply(ctx, `❌ ${e.message}`);
      }
    } catch (e) {
      console.error('tour:pay_wallet_confirm:', e.message);
      await safeReply(ctx, `❌ ${e.message}`);
    }
  });

  // ============================================================
  // 4. BEPUL RO'YXATDAN O'TISH
  // ============================================================
  bot.action(/^tour:pay_free:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return await safeReply(ctx, t('tour_not_found'));

      const user = await userService.getUser(ctx.from.id);
      const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
      if (!team) return await safeReply(ctx, t('error_not_found'));

      if (team.captainId !== ctx.from.id) {
        return await safeReply(ctx, t('error_not_captain'));
      }

      const promoId = ctx.session?.data?.promoId;
      const promoCode = ctx.session?.data?.promoCode;
      const discount = ctx.session?.data?.discount || 0;

      const loading = await ctx.reply(`⏳ ${t('wallet_pay_processing')}`);

      const result = await processFreeRegistration(ctx, tour, team, {
        promoId,
        promoCode,
        discount,
      });

      ctx.session = { state: null, data: {} };

      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
      } catch (e) {}

      await safeReply(
        ctx,
        `╔══════════════════════╗\n` +
          `   🎉 <b>${t('wallet_free_success')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 ${escapeHtml(tour.title)}\n` +
          `👥 ${escapeHtml(team.name)}\n\n` +
          (promoCode
            ? `🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>\n`
            : '') +
          `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ ${t('wallet_pay_registered')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('tour_teamlist'),
                  callback_data: CALLBACK.TOUR_TEAMLIST + tour.id,
                },
              ],
              [
                {
                  text: t('btn_back_tournament'),
                  callback_data: CALLBACK.TOUR_OPEN + tour.id,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('tour:pay_free:', e.message);
      await safeReply(ctx, `❌ ${e.message}`);
    }
  });

  // ============================================================
  // 5. PROMO KODNI QO'LLASH
  // ============================================================
  bot.action(/^promo:apply:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    if (tour.type !== 'paid') {
      return ctx.reply(t('promo_wrong_tournament'));
    }

    ctx.session = {
      state: STATES.PROMO_APPLY_INPUT,
      data: { tournamentId: tId },
    };

    await ctx.reply(
      `🎫 <b>${t('promo_apply_title')}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 ${t('payment_amount')}: <b>${(tour.payment?.amount || 0).toLocaleString()} ${
          tour.payment?.currency || ''
        }</b>\n\n` +
        `🎫 ${t('promo_apply_prompt')}\n\n` +
        `<i>${t('promo_code_example')}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_cancel'), CALLBACK.TOUR_OPEN + tId)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 6. FSM — PROMO KODNI TEKSHIRISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PROMO_APPLY_INPUT) return next();
    const t = ctx.t;

    const code = cleanText(ctx.message.text, LIMITS.PROMO_CODE_MAX);
    const data = ctx.session.data;

    const tour = await tournamentService.getTournament(data.tournamentId);
    if (!tour) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(t('tour_not_found'));
    }

    const res = await promoService.validatePromo(
      code,
      ctx.from.id,
      data.tournamentId,
      tour.payment?.amount || 0
    );

    if (!res.ok) {
      const keyMap = {
        not_found: 'promo_invalid',
        inactive: 'promo_inactive',
        expired: 'promo_expired',
        limit_reached: 'promo_limit_reached',
        wrong_tournament: 'promo_wrong_tournament',
        already_used: 'promo_already_used',
      };
      return ctx.reply(t(keyMap[res.reason] || 'tour_generic_error'));
    }

    ctx.session.data.promoId = res.promo.id;
    ctx.session.data.promoCode = res.promo.code;
    ctx.session.data.discount = res.discount;
    ctx.session.data.finalAmount = res.finalAmount;
    ctx.session.state = null;

    const currency = tour.payment?.currency || 'UZS';

    if (res.finalAmount === 0) {
      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   🎉 <b>${t('promo_applied')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🎫 ${t('promo_code')}: <code>${escapeHtml(res.promo.code)}</code>\n` +
          `💸 ${t('wallet_pay_saved')}: <b>-${res.discount.toLocaleString()} ${currency}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🎁 <b>${t('wallet_pay_free')}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('wallet_free_register'),
                  callback_data: 'tour:pay_free:' + data.tournamentId,
                },
              ],
              [
                {
                  text: t('btn_back'),
                  callback_data: CALLBACK.TOUR_OPEN + data.tournamentId,
                },
              ],
            ],
          },
        }
      );
      return;
    }

    await ctx.reply(
      `✅ <b>${t('promo_applied')}</b>\n\n` +
        `🎫 <code>${escapeHtml(res.promo.code)}</code>\n` +
        `💸 ${t('wallet_pay_saved')}: <b>-${res.discount.toLocaleString()} ${currency}</b>\n\n` +
        `💰 ${t('wallet_pay_new_price')}: <b>${res.finalAmount.toLocaleString()} ${currency}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t('wallet_pay_card'),
                callback_data: 'tour:reg_paid:' + data.tournamentId,
              },
            ],
          ],
        },
      }
    );
  });

  // ============================================================
  // 7. PROMONI OLIB TASHLASH
  // ============================================================
  bot.action(/^promo:rm:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    const tId = ctx.match[1];

    if (ctx.session?.data?.promoId) {
      ctx.session = {
        state: null,
        data: {
          tournamentId: tId,
          promoId: null,
          promoCode: null,
          discount: 0,
        },
      };
    }

    await ctx.reply(`❌ ${t('promo_removed')}`, {
      reply_markup: {
        inline_keyboard: [
          [
            Markup.button.callback(
              t('wallet_pay_card'),
              'tour:reg_paid:' + tId
            ),
          ],
        ],
      },
    });
  });

  // ============================================================
  // 8. CHEK YUBORISH — KARTA
  // ============================================================
  bot.action(/^pay:send:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return await safeReply(ctx, t('tour_not_found'));

      const promoId = ctx.session?.data?.promoId;
      const promoCode = ctx.session?.data?.promoCode;
      const discount = ctx.session?.data?.discount || 0;
      const hasPromo = promoId && ctx.session?.data?.tournamentId === tour.id;

      const priceData = calculateTournamentPrice(tour, {
        promoId: hasPromo ? promoId : null,
        promoCode,
        discount,
      });

      ctx.session = {
        state: STATES.PAYMENT_RECEIPT,
        data: {
          tid: tId,
          promoId: hasPromo ? promoId : null,
          promoCode: hasPromo ? promoCode : null,
          discount: hasPromo ? discount : 0,
          finalAmount: priceData.finalAmount,
        },
      };

      const currency = tour.payment?.currency || 'UZS';

      await safeReply(
        ctx,
        `📤 <b>${t('payment_send_receipt')}</b>\n\n` +
          `💰 ${t('wallet_pay_to_pay')}: <b>${priceData.finalAmount.toLocaleString()} ${currency}</b>\n` +
          (hasPromo
            ? `🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>\n`
            : '') +
          `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${t('payment_receipt_prompt')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('btn_cancel'),
                  callback_data: CALLBACK.TOUR_OPEN + tId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('pay:send:', e.message);
    }
  });

  // ============================================================
  // 9. CHEK QABUL QILISH (rasm)
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PAYMENT_RECEIPT) return next();
    const t = ctx.t;

    try {
      const { tid, resendPaymentId, promoId, promoCode, discount, finalAmount } =
        ctx.session.data;

      const tour = await tournamentService.getTournament(tid);
      if (!tour) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, t('tour_not_found'));
      }

      const user = await userService.getUser(ctx.from.id);
      const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
      if (!team) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, t('error_not_found'));
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
          tournamentId: tour.id,
          teamId: team.id,
          captainId: ctx.from.id,
          organizerId: tour.organizerId || tour.createdBy,
          receiptFileId: fileId,
          receiptType: 'photo',
          receiptCaption: caption,
          amount: promoId ? finalAmount : tour.payment?.amount,
          currency: tour.payment?.currency,
        });

        if (promoId) {
          try {
            await promoService.applyPromo(
              promoId,
              ctx.from.id,
              tour.id,
              team.id,
              discount,
              tour.payment?.amount,
              finalAmount
            );
          } catch (e) {
            console.error('Promo apply:', e.message);
          }
        }
      }

      ctx.session = { state: null, data: {} };

      const currency = tour.payment?.currency || 'UZS';

      await safeReply(
        ctx,
        `✅ <b>${t('payment_receipt_accepted')}</b>\n\n` +
          `🏆 ${escapeHtml(tour.title)}\n` +
          `👥 ${escapeHtml(team.name)}\n` +
          `💰 ${(promoId ? finalAmount : tour.payment?.amount)?.toLocaleString()} ${currency}\n` +
          (promoId
            ? `🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>\n`
            : '') +
          `\n⏳ <b>${t('payment_status_pending')}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('payment_my'),
                  callback_data: CALLBACK.PAY_MY,
                },
              ],
              [
                {
                  text: t('btn_back_tournament'),
                  callback_data: CALLBACK.TOUR_OPEN + tour.id,
                },
              ],
            ],
          },
        }
      );

      await sendPaymentToOrganizer(bot, payment, tour, team, ctx.from);
    } catch (e) {
      console.error('photo receipt:', e.message);
      ctx.session = { state: null, data: {} };
      await safeReply(ctx, `❌ ${e.message}`);
    }
  });

  // ============================================================
  // 10. CHEK QABUL QILISH (PDF)
  // ✅ TUZATILDI: noto'g'ri xato xabari almashtirildi
  // ============================================================
  bot.on('document', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PAYMENT_RECEIPT) return next();
    const t = ctx.t;

    try {
      const doc = ctx.message.document;
      if (!doc) return next();

      const mime = doc.mime_type || '';
      const isPdf =
        mime === 'application/pdf' ||
        (doc.file_name || '').toLowerCase().endsWith('.pdf');

      // ✅ TUZATILDI: "error_only_admin" o'rniga aniq xabar
      if (!isPdf) {
        return await safeReply(
          ctx,
          `❗ Faqat PDF yoki rasm yuboring.`
        );
      }

      const { tid, resendPaymentId, promoId, promoCode, discount, finalAmount } =
        ctx.session.data;

      const tour = await tournamentService.getTournament(tid);
      if (!tour) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, t('tour_not_found'));
      }

      const user = await userService.getUser(ctx.from.id);
      const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
      if (!team) {
        ctx.session = { state: null, data: {} };
        return await safeReply(ctx, t('error_not_found'));
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
          tournamentId: tour.id,
          teamId: team.id,
          captainId: ctx.from.id,
          organizerId: tour.organizerId || tour.createdBy,
          receiptFileId: fileId,
          receiptType: 'document',
          receiptCaption: caption,
          amount: promoId ? finalAmount : tour.payment?.amount,
          currency: tour.payment?.currency,
        });

        if (promoId) {
          try {
            await promoService.applyPromo(
              promoId,
              ctx.from.id,
              tour.id,
              team.id,
              discount,
              tour.payment?.amount,
              finalAmount
            );
          } catch (e) {
            console.error('Promo apply:', e.message);
          }
        }
      }

      ctx.session = { state: null, data: {} };

      const currency = tour.payment?.currency || 'UZS';

      await safeReply(
        ctx,
        `✅ <b>${t('payment_receipt_accepted')}</b>\n\n` +
          `🏆 ${escapeHtml(tour.title)}\n` +
          `👥 ${escapeHtml(team.name)}\n` +
          `💰 ${(promoId ? finalAmount : tour.payment?.amount)?.toLocaleString()} ${currency}\n` +
          (promoId
            ? `🎫 ${t('promo_code')}: <code>${escapeHtml(promoCode)}</code>\n`
            : '') +
          `\n⏳ <b>${t('payment_status_pending')}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('payment_my'),
                  callback_data: CALLBACK.PAY_MY,
                },
              ],
              [
                {
                  text: t('btn_back_tournament'),
                  callback_data: CALLBACK.TOUR_OPEN + tour.id,
                },
              ],
            ],
          },
        }
      );

      await sendPaymentToOrganizer(bot, payment, tour, team, ctx.from);
    } catch (e) {
      console.error('doc receipt:', e.message);
      ctx.session = { state: null, data: {} };
      await safeReply(ctx, `❌ ${e.message}`);
    }
  });

  // ============================================================
  // 11. MENING TO'LOVLARIM
  // ============================================================
  bot.action(CALLBACK.PAY_MY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const payments = await paymentService.getCaptainPayments(ctx.from.id);

      if (!payments.length) {
        return await safeEdit(ctx, `📭 ${t('wallet_no_transactions')}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t('btn_back'), callback_data: CALLBACK.MENU_PROFILE }],
            ],
          },
        });
      }

      const lines = [`💳 <b>${t('payment_my')} (${payments.length})</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      const statusEmoji = {
        pending: '⏳',
        approved: '✅',
        rejected: '❌',
        cancelled: '🚫',
        expired: '⌛',
      };

      const statusKey = {
        pending: 'payment_status_pending',
        approved: 'payment_status_approved',
        rejected: 'payment_status_rejected',
        cancelled: 'payment_status_cancelled',
        expired: 'payment_status_expired',
      };

      for (const p of payments.slice(0, 10)) {
        const tour = await tournamentService.getTournament(p.tournamentId);
        lines.push(
          `${statusEmoji[p.status] || '•'} <b>${escapeHtml(
            tour?.title || p.tournamentId
          )}</b>`
        );
        lines.push(`   💰 ${p.amount} ${p.currency}`);
        lines.push(`   📅 ${new Date(p.submittedAt).toLocaleString('uz-UZ')}`);
        lines.push(`   📌 ${t(statusKey[p.status] || 'payment_status_pending')}`);
        lines.push('');
      }

      const rows = payments
        .filter((p) => p.status === PAYMENT_STATUS.REJECTED)
        .slice(0, 5)
        .map((p) => [
          Markup.button.callback(t('btn_retry'), CALLBACK.PAY_RESEND + p.id),
        ]);
      rows.push([Markup.button.callback(t('btn_back'), CALLBACK.MENU_PROFILE)]);

      await safeEdit(ctx, lines.join('\n'), {
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      console.error('pay:my:', e.message);
    }
  });

  // ============================================================
  // 12. CHEKNI QAYTA YUBORISH
  // ============================================================
  bot.action(/^pay:resend:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const payId = ctx.match[1];
      const payment = await paymentService.getPayment(payId);
      if (!payment) return await safeReply(ctx, t('error_not_found'));

      if (payment.status !== PAYMENT_STATUS.REJECTED) {
        return await safeReply(ctx, t('error_payment_reviewed'));
      }

      if (payment.captainId !== ctx.from.id) {
        return await safeReply(ctx, `⛔ ${t('error_access')}`);
      }

      ctx.session = {
        state: STATES.PAYMENT_RECEIPT,
        data: { tid: payment.tournamentId, resendPaymentId: payId },
      };

      await safeReply(
        ctx,
        `🔄 <b>${t('payment_send_receipt')}</b>\n\n${t('payment_receipt_prompt')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('btn_cancel'),
                  callback_data: CALLBACK.TOUR_OPEN + payment.tournamentId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('pay:resend:', e.message);
    }
  });
};

// ============================================================
// YORDAMCHI: Organizerga yuborish
// ============================================================
async function sendPaymentToOrganizer(bot, payment, tournament, team, captain) {
  const organizerId = payment.organizerId;
  if (!organizerId) return;

  const header =
    `💳 <b>YANGI TO'LOV CHEKI</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 <b>Turnir:</b> ${escapeHtml(tournament.title)}\n` +
    `💳 <b>Tur:</b> ${
      payment.receiptType === 'wallet'
        ? '👛 Wallet'
        : payment.receiptType === 'free'
        ? '🎁 Bepul'
        : 'Pullik'
    }\n` +
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
  const kb = paymentReviewKeyboard({}, payment.id, tournament.id);

  try {
    if (payment.receiptType === 'photo') {
      await bot.telegram.sendPhoto(organizerId, payment.receiptFileId, {
        caption: header,
        parse_mode: 'HTML',
        ...kb,
      });
    } else if (payment.receiptType === 'document') {
      await bot.telegram.sendMessage(organizerId, header, { parse_mode: 'HTML' });
      await bot.telegram.sendDocument(organizerId, payment.receiptFileId, {
        caption: `📄 Chek — ${payment.amount} ${payment.currency}`,
        ...kb,
      });
    } else {
      await bot.telegram.sendMessage(organizerId, header, {
        parse_mode: 'HTML',
        ...kb,
      });
    }
  } catch (e) {
    console.error('Organizerga yuborishda xato:', e.message);
  }
}