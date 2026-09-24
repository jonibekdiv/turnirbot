// ============================================================
// WALLET HANDLER — Foydalanuvchi hamyoni (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const walletService = require('../services/walletService');
const userService = require('../services/userService');
const cardService = require('../services/cardService');
const { CALLBACK, STATES, LIMITS, CARD_TYPE_LABELS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');

function backToWallet(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('wallet_menu'), CALLBACK.WALLET_VIEW)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // HAMYON KO'RISH
  // ============================================================
  bot.action(CALLBACK.WALLET_VIEW, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const wallet = await walletService.getOrCreate(ctx.from.id);

    const text =
      `╔══════════════════════╗\n` +
      `   ${t('wallet_menu')}\n` +
      `╚══════════════════════╝\n\n` +
      `💵 ${t('wallet_balance')}: <b>${walletService.formatAmount(wallet.balance)} so'm</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📈 ${t('wallet_total_in')}: <b>${walletService.formatAmount(wallet.totalIn)}</b>\n` +
      `📉 ${t('wallet_total_out')}: <b>${walletService.formatAmount(wallet.totalOut)}</b>`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('wallet_deposit'), CALLBACK.WALLET_DEPOSIT)],
      [Markup.button.callback(t('wallet_withdraw'), CALLBACK.WALLET_WITHDRAW)],
      [Markup.button.callback(t('wallet_history'), CALLBACK.WALLET_HISTORY)],
      [Markup.button.callback(t('wallet_my_requests'), CALLBACK.WALLET_MY_REQUESTS)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // TARIX
  // ============================================================
  bot.action(CALLBACK.WALLET_HISTORY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const { total, transactions } = await walletService.getUserTransactions(ctx.from.id, 10);

    if (!transactions.length) {
      return safeEdit(ctx, `📭 ${t('wallet_tx_none')}`, backToWallet(t));
    }

    const lines = [
      `📜 <b>${t('wallet_tx_page_info', { from: 1, to: transactions.length, total })}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    transactions.forEach((tx) => {
      const sign = tx.amount > 0 ? '+' : '';
      const emoji = tx.amount > 0 ? '🟢' : '🔴';
      lines.push(
        `${emoji} <b>${sign}${walletService.formatAmount(tx.amount)}</b> so'm\n` +
          `   📌 ${walletService.txTypeLabel(tx.type)}\n` +
          (tx.reason ? `   💬 ${escapeHtml(tx.reason)}\n` : '') +
          `   📅 ${new Date(tx.at).toLocaleString('uz-UZ')}`
      );
      lines.push('');
    });

    const rows = [];
    if (total > 10) {
      rows.push([
        Markup.button.callback(t('wallet_tx_more'), CALLBACK.WALLET_HISTORY_PAGE + '10'),
      ]);
    }
    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.WALLET_VIEW)]);

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

  bot.action(/^wal:hp:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    const offset = parseInt(ctx.match[1], 10);
    const { total, transactions } = await walletService.getUserTransactions(ctx.from.id, 10, offset);

    if (!transactions.length) {
      return ctx.reply(`📭 ${t('wallet_tx_none')}`);
    }

    const lines = [
      `📜 <b>${t('wallet_tx_page_info', { from: offset + 1, to: offset + transactions.length, total })}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    transactions.forEach((tx) => {
      const sign = tx.amount > 0 ? '+' : '';
      const emoji = tx.amount > 0 ? '🟢' : '🔴';
      lines.push(
        `${emoji} <b>${sign}${walletService.formatAmount(tx.amount)}</b> so'm — ${walletService.txTypeLabel(tx.type)}\n   📅 ${new Date(tx.at).toLocaleString('uz-UZ')}`
      );
      lines.push('');
    });

    const rows = [];
    if (offset + 10 < total) {
      rows.push([
        Markup.button.callback(t('wallet_tx_next'), CALLBACK.WALLET_HISTORY_PAGE + (offset + 10)),
      ]);
    }
    if (offset > 0) {
      rows.push([
        Markup.button.callback(t('wallet_tx_prev'), CALLBACK.WALLET_HISTORY_PAGE + Math.max(0, offset - 10)),
      ]);
    }
    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.WALLET_VIEW)]);

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
  // PUL KIRITISH
  // ============================================================
  bot.action(CALLBACK.WALLET_DEPOSIT, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const defaultCard = await cardService.getDefaultCard();
    const allCards = await cardService.getAllCards();
    const card = defaultCard || allCards[0] || null;

    if (!card) {
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('wallet_contact_admin'), CALLBACK.SUPPORT_START)],
        [Markup.button.callback(t('btn_back'), CALLBACK.WALLET_VIEW)],
      ]);

      const text =
        `╔══════════════════════╗\n` +
        `   ${t('wallet_deposit_title')}\n` +
        `╚══════════════════════╝\n\n` +
        `⚠️ <b>${t('wallet_no_card')}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${t('wallet_no_card_desc')}`;

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      } catch (e) {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
      return;
    }

    const cardFormatted = cardService.formatCardNumber(card.number);
    const typeLabel = CARD_TYPE_LABELS[card.type] || '💳';

    const text =
      `╔══════════════════════╗\n` +
      `   ${t('wallet_deposit_title')}\n` +
      `╚══════════════════════╝\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${typeLabel}\n\n` +
      `💳 <b>${t('wallet_copy_card').replace('📋 ', '')}:</b>\n` +
      `<code>${escapeHtml(cardFormatted)}</code>\n\n` +
      `👤 <b>${t('wallet_card_owner_short')}:</b>\n` +
      `<b>${escapeHtml(card.owner)}</b>\n` +
      (card.bank ? `🏦 <b>Bank:</b> ${escapeHtml(card.bank)}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 <b>${t('wallet_deposit_limit')}:</b>\n` +
      `💰 Min: <b>${LIMITS.WALLET_MIN_DEPOSIT.toLocaleString()} so'm</b>\n` +
      `💰 Max: <b>${LIMITS.WALLET_MAX_DEPOSIT.toLocaleString()} so'm</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 <b>${t('wallet_deposit_steps')}:</b>\n` +
      `   ${t('wallet_step_1')}\n` +
      `   ${t('wallet_step_2')}\n` +
      `   ${t('wallet_step_3')}\n` +
      `   ${t('wallet_step_4')}\n` +
      `   ${t('wallet_step_5')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('wallet_deposit_start'), 'wal:dep_start')],
      [{ text: t('wallet_copy_card'), copy_text: { text: String(card.number) } }],
      [Markup.button.callback(t('btn_back'), CALLBACK.WALLET_VIEW)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  bot.action('wal:dep_start', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const reqs = await walletService.getUserRequests(ctx.from.id);
    const activeDep = reqs.find((r) => r.type === 'deposit' && r.status === 'pending');
    if (activeDep) {
      return ctx.reply(
        `⏳ <b>${t('wallet_active_deposit')}</b>\n\n` +
          `💰 ${t('promotion_total')}: <b>${walletService.formatAmount(activeDep.amount)} so'm</b>\n` +
          `📅 ${new Date(activeDep.createdAt).toLocaleString('uz-UZ')}\n\n` +
          `<i>${t('wallet_request_sent_desc')}</i>`,
        { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
      );
    }

    const defaultCard = await cardService.getDefaultCard();
    const allCards = await cardService.getAllCards();
    const card = defaultCard || allCards[0] || null;

    if (!card) {
      return ctx.reply(`⚠️ <b>${t('wallet_no_card')}</b>`, {
        parse_mode: 'HTML',
        reply_markup: backToWallet(t).reply_markup,
      });
    }

    ctx.session = { state: STATES.WALLET_DEPOSIT_AMOUNT, data: { cardId: card.id } };

    const cardFormatted = cardService.formatCardNumber(card.number);

    await ctx.reply(
      `💰 <b>${t('wallet_deposit_prompt')}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${t('wallet_min_deposit')}: <b>${LIMITS.WALLET_MIN_DEPOSIT.toLocaleString()}</b>\n` +
        `${t('wallet_max_deposit')}: <b>${LIMITS.WALLET_MAX_DEPOSIT.toLocaleString()}</b>\n\n` +
        `💳 <b>${t('wallet_pay_to_card')}:</b>\n` +
        `<code>${escapeHtml(cardFormatted)}</code>\n` +
        `👤 ${escapeHtml(card.owner)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <i>${t('wallet_admin_adjust_example')}: 50000</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: t('wallet_copy_card'), copy_text: { text: String(card.number) } }],
            [Markup.button.callback(t('btn_cancel'), CALLBACK.WALLET_VIEW)],
          ],
        },
      }
    );
  });

  // ============================================================
  // PUL CHIQARISH
  // ============================================================
  bot.action(CALLBACK.WALLET_WITHDRAW, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const wallet = await walletService.getOrCreate(ctx.from.id);

    if (wallet.balance < LIMITS.WALLET_MIN_WITHDRAW) {
      return ctx.reply(
        `❌ <b>${t('wallet_insufficient_balance')}</b>\n\n` +
          `💰 ${t('wallet_your_balance')}: <b>${walletService.formatAmount(wallet.balance)} so'm</b>\n` +
          `📉 ${t('wallet_min_withdraw')}: <b>${LIMITS.WALLET_MIN_WITHDRAW.toLocaleString()} so'm</b>`,
        { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
      );
    }

    const reqs = await walletService.getUserRequests(ctx.from.id);
    const activeW = reqs.find((r) => r.type === 'withdraw' && r.status === 'pending');
    if (activeW) {
      return ctx.reply(
        `⏳ <b>${t('wallet_active_withdraw')}</b>\n\n` +
          `💰 ${t('promotion_total')}: <b>${walletService.formatAmount(activeW.amount)} so'm</b>\n\n` +
          `<i>${t('wallet_request_sent_desc')}</i>`,
        { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
      );
    }

    ctx.session = { state: STATES.WALLET_WITHDRAW_AMOUNT, data: {} };

    await ctx.reply(
      `💸 <b>${t('wallet_withdraw_title')}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 ${t('wallet_your_balance')}: <b>${walletService.formatAmount(wallet.balance)} so'm</b>\n` +
        `📉 Min: <b>${LIMITS.WALLET_MIN_WITHDRAW.toLocaleString()}</b>\n` +
        `📈 Max: <b>${LIMITS.WALLET_MAX_WITHDRAW.toLocaleString()}</b>\n\n` +
        `📝 <b>${t('wallet_withdraw_prompt')}</b>`,
      { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
    );
  });

  // ============================================================
  // MENING SO'ROVLARIM
  // ============================================================
  bot.action(CALLBACK.WALLET_MY_REQUESTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const reqs = await walletService.getUserRequests(ctx.from.id);

    if (!reqs.length) {
      return safeEdit(ctx, `📭 ${t('wallet_no_requests')}`, backToWallet(t));
    }

    const lines = [`📋 <b>${t('wallet_my_requests')} (${reqs.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];

    reqs.slice(0, 10).forEach((r) => {
      const emoji = r.type === 'deposit' ? '💰' : '💸';
      const statusEmoji = {
        pending: '⏳',
        approved: '✅',
        rejected: '❌',
        cancelled: '🚫',
      }[r.status];
      const statusKey = {
        pending: 'wallet_pending',
        approved: 'wallet_approved',
        rejected: 'wallet_rejected',
        cancelled: 'wallet_cancelled',
      }[r.status];
      const statusName = t(statusKey || 'wallet_pending');

      lines.push(
        `${emoji} <b>${r.type === 'deposit' ? t('wallet_deposit_type') : t('wallet_withdraw_type')}</b>\n` +
          `   💵 ${walletService.formatAmount(r.amount)} so'm\n` +
          `   ${statusEmoji} ${statusName}\n` +
          (r.rejectReason ? `   ❗ ${escapeHtml(r.rejectReason)}\n` : '') +
          `   📅 ${new Date(r.createdAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');
    });

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: backToWallet(t).reply_markup,
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: backToWallet(t).reply_markup,
      });
    }
  });

  // ============================================================
  // FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('wallet_')) return next();
    const t = ctx.t;

    // DEPOSIT AMOUNT
    if (s === STATES.WALLET_DEPOSIT_AMOUNT) {
      const v = cleanText(ctx.message.text, 15).replace(/\s/g, '');
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);
      const amount = Number(v);
      if (amount < LIMITS.WALLET_MIN_DEPOSIT) {
        return ctx.reply(`❗ ${t('wallet_min_deposit')}: ${LIMITS.WALLET_MIN_DEPOSIT.toLocaleString()} so'm`);
      }
      if (amount > LIMITS.WALLET_MAX_DEPOSIT) {
        return ctx.reply(`❗ ${t('wallet_max_deposit')}: ${LIMITS.WALLET_MAX_DEPOSIT.toLocaleString()} so'm`);
      }

      const defaultCard = await cardService.getDefaultCard();
      const allCards = await cardService.getAllCards();
      const card = defaultCard || allCards[0] || null;
      const cardFormatted = card ? cardService.formatCardNumber(card.number) : '-';

      ctx.session.data.amount = amount;
      ctx.session.state = STATES.WALLET_DEPOSIT_PROOF;

      const text =
        `✅ <b>${t('promotion_total')}: ${amount.toLocaleString()} so'm</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        (card
          ? `💳 <b>${t('wallet_pay_to_card')}:</b>\n` +
            `<code>${escapeHtml(cardFormatted)}</code>\n` +
            `👤 <b>${t('wallet_admin_owner_label')}:</b> ${escapeHtml(card.owner)}\n` +
            (card.bank ? `🏦 ${escapeHtml(card.bank)}\n` : '') +
            `\n━━━━━━━━━━━━━━━━━━━━\n\n`
          : '') +
        `📎 <b>${t('wallet_send_receipt')}</b>\n\n` +
        `${t('wallet_send_receipt_hint')}`;

      const kbRows = [];
      if (card) {
        kbRows.push([{ text: t('wallet_copy_card'), copy_text: { text: String(card.number) } }]);
      }
      kbRows.push([Markup.button.callback(t('wallet_no_proof'), 'wal:dep_noproof')]);
      kbRows.push([Markup.button.callback(t('btn_cancel'), CALLBACK.WALLET_VIEW)]);

      return ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kbRows } });
    }

    // WITHDRAW AMOUNT
    if (s === STATES.WALLET_WITHDRAW_AMOUNT) {
      const wallet = await walletService.getWallet(ctx.from.id);
      const v = cleanText(ctx.message.text, 15).replace(/\s/g, '');
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);
      const amount = Number(v);

      if (amount < LIMITS.WALLET_MIN_WITHDRAW) {
        return ctx.reply(`❗ Min: ${LIMITS.WALLET_MIN_WITHDRAW.toLocaleString()}`);
      }
      if (amount > LIMITS.WALLET_MAX_WITHDRAW) {
        return ctx.reply(`❗ Max: ${LIMITS.WALLET_MAX_WITHDRAW.toLocaleString()}`);
      }
      if (amount > wallet.balance) {
        return ctx.reply(
          `❗ ${t('wallet_your_balance')} ${walletService.formatAmount(wallet.balance)} so'm`
        );
      }

      ctx.session.data.amount = amount;
      ctx.session.state = STATES.WALLET_WITHDRAW_CARD;

      await ctx.reply(
        `✅ ${t('promotion_total')}: <b>${amount.toLocaleString()} so'm</b>\n\n` +
          `💳 <b>${t('wallet_card_prompt')}</b>\n\n<i>${t('wallet_admin_adjust_example')}: 8600 1234 5678 9012</i>`,
        { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
      );
      return;
    }

    // WITHDRAW CARD
    if (s === STATES.WALLET_WITHDRAW_CARD) {
      const v = cleanText(ctx.message.text, 30);
      const digits = v.replace(/\D/g, '');
      if (digits.length < 16) {
        return ctx.reply(`❗ ${t('team_name_short')}`);
      }

      ctx.session.data.cardNumber = v;
      ctx.session.state = STATES.WALLET_WITHDRAW_OWNER;

      await ctx.reply(
        `👤 <b>${t('wallet_card_owner_short')}:</b>\n\n<i>${t('wallet_admin_adjust_example')}: Ali Valiyev</i>`,
        { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
      );
      return;
    }

    // WITHDRAW OWNER
    if (s === STATES.WALLET_WITHDRAW_OWNER) {
      const v = cleanText(ctx.message.text, 60);
      if (v.length < 3) return ctx.reply(`❗ ${t('team_name_short')}`);
      ctx.session.data.cardOwner = v;

      try {
        const req = await walletService.createWithdrawRequest({
          userId: ctx.from.id,
          username: ctx.from.username,
          amount: ctx.session.data.amount,
          cardNumber: ctx.session.data.cardNumber,
          cardOwner: ctx.session.data.cardOwner,
        });

        ctx.session = { state: null, data: {} };

        await ctx.reply(
          `╔══════════════════════╗\n` +
            `   ✅ <b>${t('wallet_request_sent')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `💸 ${t('promotion_total')}: <b>${walletService.formatAmount(req.amount)} so'm</b>\n` +
            `💳 ${t('wallet_admin_card_label')}: <code>${escapeHtml(req.cardNumber)}</code>\n` +
            `👤 ${t('wallet_admin_owner_label')}: ${escapeHtml(req.cardOwner)}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⏳ <i>${t('wallet_request_withdraw_desc')}</i>`,
          { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
        );

        await notifyAdminWithdraw(ctx, bot, req);
      } catch (e) {
        ctx.session = { state: null, data: {} };
        await ctx.reply(`❌ ${e.message}`, backToWallet(t));
      }
      return;
    }

    return next();
  });

  // ============================================================
  // DEPOSIT — CHEK QABUL QILISH
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== STATES.WALLET_DEPOSIT_PROOF) return next();
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    return submitDeposit(ctx, bot, fileId, 'photo');
  });

  bot.on('document', async (ctx, next) => {
    if (ctx.session?.state !== STATES.WALLET_DEPOSIT_PROOF) return next();
    const doc = ctx.message.document;
    if (!doc) return next();
    if (!doc.mime_type || !doc.mime_type.includes('pdf')) {
      const t = ctx.t;
      return ctx.reply(`❗ ${t('error_only_digits')}`);
    }
    return submitDeposit(ctx, bot, doc.file_id, 'document');
  });

  bot.action('wal:dep_noproof', async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.session?.state !== STATES.WALLET_DEPOSIT_PROOF) return;
    return submitDeposit(ctx, bot, null, null);
  });

  async function submitDeposit(ctx, bot, fileId, type) {
    const t = ctx.t;
    try {
      const req = await walletService.createDepositRequest({
        userId: ctx.from.id,
        username: ctx.from.username,
        amount: ctx.session.data.amount,
        proofFileId: fileId,
        proofType: type,
      });

      ctx.session = { state: null, data: {} };

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   ✅ <b>${t('wallet_request_sent')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `💰 ${t('promotion_total')}: <b>${walletService.formatAmount(req.amount)} so'm</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⏳ <i>${t('wallet_request_sent_desc')}</i>`,
        { parse_mode: 'HTML', reply_markup: backToWallet(t).reply_markup }
      );

      await notifyAdminDeposit(ctx, bot, req);
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`, backToWallet(t));
    }
  }

  async function notifyAdminDeposit(ctx, bot, req) {
    const t = ctx.t;
    const config = require('../config');
    const roleService = require('../services/roleService');

    const admins = await roleService.list('admin');
    const adminIds = new Set([config.SUPER_ADMIN_ID, ...admins.map((a) => a.id)]);

    const header =
      `💰 <b>${t('wallet_admin_deposit_new')}</b>\n\n` +
      `👤 ${req.username ? '@' + req.username : 'ID:' + req.userId}\n` +
      `🆔 <code>${req.userId}</code>\n` +
      `💵 ${t('wallet_admin_amount')}: <b>${walletService.formatAmount(req.amount)} so'm</b>\n` +
      `📅 ${new Date(req.createdAt).toLocaleString('uz-UZ')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('wallet_admin_approve'), CALLBACK.WALLET_ADMIN_APPROVE_DEP + req.id)],
      [Markup.button.callback(t('wallet_admin_reject'), CALLBACK.WALLET_ADMIN_REJECT_DEP + req.id)],
    ]);

    for (const adminId of adminIds) {
      try {
        if (req.proofFileId && req.proofType === 'photo') {
          await bot.telegram.sendPhoto(adminId, req.proofFileId, {
            caption: header,
            parse_mode: 'HTML',
            reply_markup: kb.reply_markup,
          });
        } else if (req.proofFileId && req.proofType === 'document') {
          await bot.telegram.sendMessage(adminId, header, { parse_mode: 'HTML' });
          await bot.telegram.sendDocument(adminId, req.proofFileId, {
            caption: `📄 ${t('wallet_admin_card_label')}`,
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

  async function notifyAdminWithdraw(ctx, bot, req) {
    const t = ctx.t;
    const config = require('../config');
    const roleService = require('../services/roleService');

    const admins = await roleService.list('admin');
    const adminIds = new Set([config.SUPER_ADMIN_ID, ...admins.map((a) => a.id)]);

    const header =
      `💸 <b>${t('wallet_admin_withdraw_new')}</b>\n\n` +
      `👤 ${req.username ? '@' + req.username : 'ID:' + req.userId}\n` +
      `🆔 <code>${req.userId}</code>\n` +
      `💵 ${t('wallet_admin_amount')}: <b>${walletService.formatAmount(req.amount)} so'm</b>\n` +
      `💳 ${t('wallet_admin_card_label')}: <code>${escapeHtml(req.cardNumber)}</code>\n` +
      `👤 ${t('wallet_admin_owner_label')}: ${escapeHtml(req.cardOwner)}\n` +
      `📅 ${new Date(req.createdAt).toLocaleString('uz-UZ')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('wallet_admin_paid'), CALLBACK.WALLET_ADMIN_APPROVE_WD + req.id)],
      [Markup.button.callback(t('wallet_admin_reject'), CALLBACK.WALLET_ADMIN_REJECT_WD + req.id)],
    ]);

    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, header, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      } catch (e) {}
    }
  }
};