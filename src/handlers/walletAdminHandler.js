// ============================================================
// WALLET ADMIN HANDLER — Balans boshqaruvi (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const walletService = require('../services/walletService');
const userService = require('../services/userService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt, isValidTelegramId } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

function backToWalletAdmin(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_back'), CALLBACK.WALLET_ADMIN_MENU)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // MENYU
  // ============================================================
  bot.action(CALLBACK.WALLET_ADMIN_MENU, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const stats = await walletService.getStats();

    const text =
      `╔══════════════════════╗\n` +
      `   💰 <b>${t('wallet_admin_menu_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 ${t('wallet_admin_total_users')}: <b>${stats.totalUsers}</b>\n` +
      `💵 ${t('wallet_admin_total_balance')}: <b>${walletService.formatAmount(stats.totalBalance)}</b>\n` +
      `📈 ${t('wallet_admin_total_in')}: <b>${walletService.formatAmount(stats.totalIn)}</b>\n` +
      `📉 ${t('wallet_admin_total_out')}: <b>${walletService.formatAmount(stats.totalOut)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⏳ ${t('wallet_admin_pending_deposits')}: <b>${stats.pendingDeposits}</b>\n` +
      `⏳ ${t('wallet_admin_pending_withdraws')}: <b>${stats.pendingWithdraws}</b>`;

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${t('wallet_admin_deposits')} (${stats.pendingDeposits})`,
          CALLBACK.WALLET_ADMIN_DEPOSITS
        ),
      ],
      [
        Markup.button.callback(
          `${t('wallet_admin_withdraws')} (${stats.pendingWithdraws})`,
          CALLBACK.WALLET_ADMIN_WITHDRAWS
        ),
      ],
      [Markup.button.callback(t('wallet_admin_users'), CALLBACK.WALLET_ADMIN_USERS)],
      [Markup.button.callback(t('wallet_admin_adjust'), CALLBACK.WALLET_ADMIN_ADJUST)],
      [Markup.button.callback(t('wallet_admin_stats'), CALLBACK.WALLET_ADMIN_STATS)],
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // DEPOSITLAR
  // ============================================================
  bot.action(CALLBACK.WALLET_ADMIN_DEPOSITS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const list = await walletService.getRequests('pending', 'deposit');

    if (!list.length) {
      return safeEdit(ctx, `📭 ${t('wallet_admin_no_pending')}`, backToWalletAdmin(t));
    }

    const lines = [
      `💰 <b>${t('wallet_admin_pending_deposits')} (${list.length})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];
    const rows = [];

    list.slice(0, 10).forEach((r) => {
      lines.push(
        `<b>${r.username ? '@' + escapeHtml(r.username) : 'ID:' + r.userId}</b>\n` +
          `   💵 ${walletService.formatAmount(r.amount)} so'm\n` +
          `   📅 ${new Date(r.createdAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `💰 ${walletService.formatAmount(r.amount)} — ${r.username || r.userId}`,
          CALLBACK.WALLET_ADMIN_VIEW_REQ + r.id
        ),
      ]);
    });

    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.WALLET_ADMIN_MENU)]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // WITHDRAWLAR
  // ============================================================
  bot.action(CALLBACK.WALLET_ADMIN_WITHDRAWS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const list = await walletService.getRequests('pending', 'withdraw');

    if (!list.length) {
      return safeEdit(ctx, `📭 ${t('wallet_admin_no_pending')}`, backToWalletAdmin(t));
    }

    const lines = [
      `💸 <b>${t('wallet_admin_pending_withdraws')} (${list.length})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];
    const rows = [];

    list.slice(0, 10).forEach((r) => {
      lines.push(
        `<b>${r.username ? '@' + escapeHtml(r.username) : 'ID:' + r.userId}</b>\n` +
          `   💵 ${walletService.formatAmount(r.amount)} so'm\n` +
          `   💳 ${escapeHtml(r.cardNumber)}\n` +
          `   📅 ${new Date(r.createdAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `💸 ${walletService.formatAmount(r.amount)} — ${r.username || r.userId}`,
          CALLBACK.WALLET_ADMIN_VIEW_REQ + r.id
        ),
      ]);
    });

    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.WALLET_ADMIN_MENU)]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
  });

  // ============================================================
  // SO'ROVNI KO'RISH
  // ============================================================
  bot.action(/^wal:vreq:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const req = await walletService.getRequest(ctx.match[1]);
    if (!req) return ctx.reply(t('error_not_found'));

    const user = await userService.getUser(req.userId);
    const wallet = await walletService.getWallet(req.userId);

    const typeLabel = req.type === 'deposit' ? `💰 ${t('wallet_deposit_type').toUpperCase()}` : `💸 ${t('wallet_withdraw_type').toUpperCase()}`;

    const text =
      `╔══════════════════════╗\n` +
      `   ${typeLabel}\n` +
      `╚══════════════════════╝\n\n` +
      `👤 ${escapeHtml(displayName(user))}\n` +
      `🆔 <code>${req.userId}</code>\n` +
      `💰 ${t('wallet_admin_balance_label_short')}: <b>${walletService.formatAmount(wallet?.balance || 0)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💵 ${t('wallet_admin_amount')}: <b>${walletService.formatAmount(req.amount)} so'm</b>\n` +
      (req.cardNumber ? `💳 ${t('wallet_admin_card_label')}: <code>${escapeHtml(req.cardNumber)}</code>\n` : '') +
      (req.cardOwner ? `👤 ${t('wallet_admin_owner_label')}: ${escapeHtml(req.cardOwner)}\n` : '') +
      `📅 ${new Date(req.createdAt).toLocaleString('uz-UZ')}`;

    const rows = [];
    if (req.status === 'pending') {
      if (req.type === 'deposit') {
        rows.push([
          Markup.button.callback(t('wallet_admin_approve'), CALLBACK.WALLET_ADMIN_APPROVE_DEP + req.id),
          Markup.button.callback(t('wallet_admin_reject'), CALLBACK.WALLET_ADMIN_REJECT_DEP + req.id),
        ]);
      } else {
        rows.push([
          Markup.button.callback(t('wallet_admin_paid'), CALLBACK.WALLET_ADMIN_APPROVE_WD + req.id),
          Markup.button.callback(t('wallet_admin_reject'), CALLBACK.WALLET_ADMIN_REJECT_WD + req.id),
        ]);
      }
    }
    rows.push([
      Markup.button.callback(
        t('btn_back'),
        req.type === 'deposit' ? CALLBACK.WALLET_ADMIN_DEPOSITS : CALLBACK.WALLET_ADMIN_WITHDRAWS
      ),
    ]);

    try {
      if (req.proofFileId && req.proofType === 'photo') {
        try { await ctx.deleteMessage(); } catch (e) {}
        await ctx.replyWithPhoto(req.proofFileId, {
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
  // TASDIQLASH — DEPOSIT
  // ============================================================
  bot.action(/^wal:apd:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    try {
      const req = await walletService.approveDeposit(ctx.match[1], ctx.from.id);
      const wallet = await walletService.getWallet(req.userId);

      await ctx.reply(
        `✅ <b>${t('wallet_admin_approved_short')}!</b>\n\n` +
          `👤 ID: ${req.userId}\n` +
          `💰 +${walletService.formatAmount(req.amount)} so'm\n` +
          `📊 ${t('wallet_admin_new_balance_short')}: <b>${walletService.formatAmount(wallet.balance)}</b>`,
        { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
      );

      try {
        await bot.telegram.sendMessage(
          req.userId,
          `╔══════════════════════╗\n` +
            `   ✅ <b>${t('wallet_admin_deposit_approved')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `💰 +${walletService.formatAmount(req.amount)} so'm\n\n` +
            `💵 ${t('wallet_admin_new_balance_short')}: <b>${walletService.formatAmount(wallet.balance)}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[Markup.button.callback(t('wallet_menu'), CALLBACK.WALLET_VIEW)]],
            },
          }
        );
      } catch (e) {}
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`, backToWalletAdmin(t));
    }
  });

  // ============================================================
  // TASDIQLASH — WITHDRAW
  // ============================================================
  bot.action(/^wal:apw:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    try {
      const req = await walletService.approveWithdraw(ctx.match[1], ctx.from.id);
      const wallet = await walletService.getWallet(req.userId);

      await ctx.reply(
        `✅ <b>${t('wallet_admin_approved_short')}!</b>\n\n` +
          `👤 ID: ${req.userId}\n` +
          `💸 -${walletService.formatAmount(req.amount)} so'm\n` +
          `📊 ${t('wallet_admin_new_balance_short')}: <b>${walletService.formatAmount(wallet.balance)}</b>`,
        { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
      );

      try {
        await bot.telegram.sendMessage(
          req.userId,
          `╔══════════════════════╗\n` +
            `   ✅ <b>${t('wallet_admin_withdraw_approved')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `💸 -${walletService.formatAmount(req.amount)} so'm\n` +
            `💳 ${t('wallet_admin_card_label')}: <code>${escapeHtml(req.cardNumber)}</code>\n\n` +
            `💵 ${t('wallet_admin_new_balance_short')}: <b>${walletService.formatAmount(wallet.balance)}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[Markup.button.callback(t('wallet_menu'), CALLBACK.WALLET_VIEW)]],
            },
          }
        );
      } catch (e) {}
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`, backToWalletAdmin(t));
    }
  });

  // ============================================================
  // RAD ETISH
  // ============================================================
  bot.action(/^wal:(rjd|rjw):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const reqId = ctx.match[2];
    const req = await walletService.getRequest(reqId);
    if (!req) return;

    ctx.session = { state: 'wallet_admin_reject_reason', data: { reqId } };

    await ctx.reply(
      `❌ <b>${t('wallet_admin_reject_reason')}</b>\n\n` +
        `👤 ID: ${req.userId}\n` +
        `💵 ${walletService.formatAmount(req.amount)} so'm`,
      { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
    );
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'wallet_admin_reject_reason') return next();
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return next();
    const t = ctx.t;

    const reason = cleanText(ctx.message.text, 200);
    if (!reason) return ctx.reply(`❗ ${t('wallet_admin_reject_reason')}`);

    const reqId = ctx.session.data.reqId;
    try {
      const req = await walletService.rejectRequest(reqId, ctx.from.id, reason);
      ctx.session = { state: null, data: {} };

      await ctx.reply(
        `✅ <b>${t('wallet_admin_rejected_short')}</b>\n\n👤 ID: ${req.userId}\n📌 ${escapeHtml(reason)}`,
        { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
      );

      try {
        await bot.telegram.sendMessage(
          req.userId,
          `❌ <b>${t('wallet_admin_rejected_short')}</b>\n\n` +
            `💰 ${walletService.formatAmount(req.amount)} so'm\n` +
            `📌 ${escapeHtml(reason)}`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // FOYDALANUVCHILAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.WALLET_ADMIN_USERS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    return showUsers(ctx, 0);
  });

  bot.action(/^wal:aup:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    return showUsers(ctx, parseInt(ctx.match[1], 10));
  });

  async function showUsers(ctx, offset) {
    const t = ctx.t;
    const all = await walletService.getAllWallets();
    const total = all.length;
    const page = all.slice(offset, offset + LIMITS.WALLET_PAGE_SIZE);

    if (!page.length) {
      return safeEdit(ctx, `📭 ${t('wallet_admin_no_users')}`, backToWalletAdmin(t));
    }

    const lines = [
      `👥 <b>${t('wallet_admin_users')} (${offset + 1}-${offset + page.length} / ${total})</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];
    const rows = [];

    for (const w of page) {
      const u = await userService.getUser(w.userId);
      const name = u ? displayName(u) : `ID:${w.userId}`;
      lines.push(`• ${escapeHtml(name)} — <b>${walletService.formatAmount(w.balance)}</b> so'm`);

      rows.push([
        Markup.button.callback(
          `${name} — ${walletService.formatAmount(w.balance)}`,
          CALLBACK.WALLET_ADMIN_VIEW_USER + w.userId
        ),
      ]);
    }

    const pag = [];
    if (offset > 0) {
      pag.push(
        Markup.button.callback('⬅️', CALLBACK.WALLET_ADMIN_USERS_PAGE + (offset - LIMITS.WALLET_PAGE_SIZE))
      );
    }
    if (offset + LIMITS.WALLET_PAGE_SIZE < total) {
      pag.push(
        Markup.button.callback('➡️', CALLBACK.WALLET_ADMIN_USERS_PAGE + (offset + LIMITS.WALLET_PAGE_SIZE))
      );
    }
    if (pag.length) rows.push(pag);

    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.WALLET_ADMIN_MENU)]);

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
  // FOYDALANUVCHI WALLETINI KO'RISH
  // ============================================================
  bot.action(/^wal:av:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const userId = Number(ctx.match[1]);
    const user = await userService.getUser(userId);
    const wallet = await walletService.getWallet(userId);
    const { total, transactions } = await walletService.getUserTransactions(userId, 5);

    const lines = [
      `╔══════════════════════╗`,
      `   💰 <b>${t('wallet_admin_wallet_view')}</b>`,
      `╚══════════════════════╝`,
      '',
      `👤 ${escapeHtml(displayName(user))}`,
      `🆔 <code>${userId}</code>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `💵 ${t('wallet_admin_balance_label_short')}: <b>${walletService.formatAmount(wallet?.balance || 0)}</b>`,
      `📈 ${t('wallet_total_in')}: <b>${walletService.formatAmount(wallet?.totalIn || 0)}</b>`,
      `📉 ${t('wallet_total_out')}: <b>${walletService.formatAmount(wallet?.totalOut || 0)}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📜 ${t('wallet_admin_recent_tx_list')} (${transactions.length}/${total}):`,
      '',
    ];

    transactions.forEach((tx) => {
      const sign = tx.amount > 0 ? '+' : '';
      lines.push(`${sign}${walletService.formatAmount(tx.amount)} — ${walletService.txTypeLabel(tx.type)}`);
    });

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('wallet_admin_adjust_title_short'), CALLBACK.WALLET_ADMIN_ADJUST + userId)],
      [Markup.button.callback(t('btn_back'), CALLBACK.WALLET_ADMIN_USERS)],
    ]);

    try {
      await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // BALANSNI O'ZGARTIRISH
  // ============================================================
  bot.action(CALLBACK.WALLET_ADMIN_ADJUST, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    ctx.session = { state: STATES.WALLET_ADMIN_ADJUST_ID, data: {} };

    await ctx.reply(
      `➕➖ <b>${t('wallet_admin_adjust_title_short')}</b>\n\n` +
        `${t('wallet_admin_adjust_step1')}\n\n` +
        `🆔 <b>${t('wallet_admin_adjust_prompt_id')}</b>\n\n` +
        `<i>${t('wallet_admin_adjust_example')}: 123456789</i>`,
      { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
    );
  });

  bot.action(/^wal:adj:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const userId = Number(ctx.match[1]);
    ctx.session = { state: STATES.WALLET_ADMIN_ADJUST_AMOUNT, data: { targetId: userId } };

    const wallet = await walletService.getWallet(userId);
    const user = await userService.getUser(userId);

    await ctx.reply(
      `➕➖ <b>${t('wallet_admin_adjust_title_short')}</b>\n\n` +
        `👤 ${escapeHtml(displayName(user))}\n` +
        `💵 ${t('wallet_admin_balance_label_short')}: <b>${walletService.formatAmount(wallet?.balance || 0)}</b>\n\n` +
        `${t('wallet_admin_adjust_step2')}\n\n` +
        `💰 <b>${t('wallet_admin_adjust_prompt_amount')}</b>\n\n` +
        `📌 ${t('wallet_admin_adjust_example')}:\n` +
        `<code>50000</code> — ${t('wallet_admin_add_example')}\n` +
        `<code>-25000</code> — ${t('wallet_admin_sub_example')}`,
      { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
    );
  });

  // FSM
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('wallet_admin_')) return next();
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return next();
    const t = ctx.t;

    // TARGET ID
    if (s === STATES.WALLET_ADMIN_ADJUST_ID) {
      const v = cleanText(ctx.message.text, 20);
      if (!isValidTelegramId(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);

      const user = await userService.getUser(Number(v));
      if (!user) return ctx.reply(`❗ ${t('wallet_admin_user_not_found_short')}`);

      ctx.session.data.targetId = Number(v);
      ctx.session.state = STATES.WALLET_ADMIN_ADJUST_AMOUNT;

      const wallet = await walletService.getWallet(Number(v));

      return ctx.reply(
        `👤 ${escapeHtml(displayName(user))}\n` +
          `💵 ${t('wallet_admin_balance_label_short')}: <b>${walletService.formatAmount(wallet?.balance || 0)}</b>\n\n` +
          `${t('wallet_admin_adjust_step2')}\n\n` +
          `💰 ${t('wallet_admin_adjust_prompt_amount')}\n\n` +
          `<code>50000</code> — ${t('wallet_admin_add_example')}\n` +
          `<code>-25000</code> — ${t('wallet_admin_sub_example')}`,
        { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
      );
    }

    // AMOUNT
    if (s === STATES.WALLET_ADMIN_ADJUST_AMOUNT) {
      const v = cleanText(ctx.message.text, 20).replace(/\s/g, '');
      if (!/^-?\d+$/.test(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);
      const amount = Number(v);
      if (amount === 0) return ctx.reply(`❗ ${t('error_wrong_field')}`);

      ctx.session.data.amount = amount;
      ctx.session.state = STATES.WALLET_ADMIN_ADJUST_REASON;

      return ctx.reply(
        `💰 ${t('promotion_total')}: <b>${amount > 0 ? '+' : ''}${amount.toLocaleString()} so'm</b>\n\n` +
          `${t('wallet_admin_adjust_step3')}\n\n` +
          `📝 <b>${t('wallet_admin_adjust_prompt_reason')}</b>\n\n` +
          `<i>${t('wallet_admin_adjust_example')}: Mukofot</i>`,
        { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
      );
    }

    // REASON
    if (s === STATES.WALLET_ADMIN_ADJUST_REASON) {
      const reason = cleanText(ctx.message.text, 200);
      if (!reason) return ctx.reply(`❗ ${t('wallet_admin_adjust_prompt_reason')}`);

      const { targetId, amount } = ctx.session.data;

      try {
        const wallet = await walletService.adjustBalance(
          targetId,
          amount,
          amount > 0 ? 'admin_add' : 'admin_sub',
          reason,
          ctx.from.id
        );

        ctx.session = { state: null, data: {} };

        await ctx.reply(
          `✅ <b>${t('wallet_admin_adjust_success_short')}</b>\n\n` +
            `👤 ID: ${targetId}\n` +
            `💰 ${amount > 0 ? '+' : ''}${amount.toLocaleString()} so'm\n` +
            `📊 ${t('wallet_admin_new_balance_short')}: <b>${walletService.formatAmount(wallet.balance)}</b>\n` +
            `📝 ${escapeHtml(reason)}`,
          { parse_mode: 'HTML', reply_markup: backToWalletAdmin(t).reply_markup }
        );

        try {
          await bot.telegram.sendMessage(
            targetId,
            `╔══════════════════════╗\n` +
              `   💰 <b>${t('wallet_admin_adjust_notified_short')}</b>\n` +
              `╚══════════════════════╝\n\n` +
              `${amount > 0 ? '➕' : '➖'} <b>${Math.abs(amount).toLocaleString()} so'm</b>\n` +
              `📝 ${escapeHtml(reason)}\n\n` +
              `💵 ${t('wallet_admin_new_balance_short')}: <b>${walletService.formatAmount(wallet.balance)}</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[Markup.button.callback(t('wallet_menu'), CALLBACK.WALLET_VIEW)]],
              },
            }
          );
        } catch (e) {}
      } catch (e) {
        ctx.session = { state: null, data: {} };
        await ctx.reply(`❌ ${e.message}`);
      }
      return;
    }

    return next();
  });

  // ============================================================
  // STATISTIKA
  // ============================================================
  bot.action(CALLBACK.WALLET_ADMIN_STATS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) return;
    const t = ctx.t;

    const stats = await walletService.getStats();
    const recentTx = await walletService.getAllTransactions(10);

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('wallet_admin_stats')}`,
      `╚══════════════════════╝`,
      '',
      `👥 ${t('wallet_admin_total_users')}: <b>${stats.totalUsers}</b>`,
      `💵 ${t('wallet_admin_total_balance')}: <b>${walletService.formatAmount(stats.totalBalance)}</b>`,
      `📈 ${t('wallet_admin_total_in')}: <b>${walletService.formatAmount(stats.totalIn)}</b>`,
      `📉 ${t('wallet_admin_total_out')}: <b>${walletService.formatAmount(stats.totalOut)}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `⏳ ${t('wallet_admin_pending_deposits')}: <b>${stats.pendingDeposits}</b>`,
      `⏳ ${t('wallet_admin_pending_withdraws')}: <b>${stats.pendingWithdraws}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📜 <b>${t('wallet_admin_recent_tx_list')}:</b>`,
      '',
    ];

    recentTx.forEach((tx) => {
      const sign = tx.amount > 0 ? '+' : '';
      const emoji = tx.amount > 0 ? '🟢' : '🔴';
      lines.push(`${emoji} ${sign}${walletService.formatAmount(tx.amount)} — ${walletService.txTypeLabel(tx.type)}`);
    });

    await safeEdit(ctx, lines.join('\n'), backToWalletAdmin(t));
  });
};