// ============================================================
// CARD HANDLER — Kartalar boshqaruvi (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const cardService = require('../services/cardService');
const {
  CALLBACK,
  STATES,
  ROLES,
  LIMITS,
  CARD_TYPE_LABELS,
} = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');
const {
  cardsPanelKeyboard,
  cardTypeKeyboard,
  cardConfirmKeyboard,
  cardViewKeyboard,
  cardDeleteConfirmKeyboard,
} = require('../keyboards/cardKeyboard');

module.exports = (bot) => {
  // ============================================================
  // 1. KARTALAR PANELI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CARDS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const cards = isAdmin ? await cardService.getAllCards() : await cardService.getUserCards(ctx.from.id);

    const text =
      `╔══════════════════════╗\n` +
      `   💳 <b>${t('card_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `📊 ${t('promotion_total')}: <b>${cards.length}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 <i>${t('card_type_pick_prompt')}</i>\n\n` +
      `👇 ${t('support_choose_type')}`;

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...cardsPanelKeyboard(ctx) });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', ...cardsPanelKeyboard(ctx) });
    }
  });

  // ============================================================
  // 2. RO'YXAT
  // ============================================================
  bot.action(CALLBACK.CARD_LIST, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const cards = isAdmin ? await cardService.getAllCards() : await cardService.getUserCards(ctx.from.id);

    if (!cards.length) {
      return safeEdit(
        ctx,
        `📭 <b>${t('card_no_cards')}</b>\n\n${t('card_list_empty')}`,
        cardsPanelKeyboard(ctx)
      );
    }

    const lines = [`💳 <b>${t('card_list_title')} (${cards.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
    const rows = [];

    cards.slice(0, 15).forEach((card, i) => {
      const defaultIcon = card.isDefault ? '⭐ ' : '';
      const typeLabel = CARD_TYPE_LABELS[card.type] || '💳';
      lines.push(
        `${i + 1}. ${defaultIcon}<b>${escapeHtml(card.owner)}</b>\n` +
          `   ${typeLabel} | <code>${card.number}</code>\n` +
          (card.phone ? `   📱 ${escapeHtml(card.phone)}\n` : '')
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `${defaultIcon}${card.owner} — ${card.number.slice(-4)}`,
          CALLBACK.CARD_VIEW + card.id
        ),
      ]);
    });

    rows.push([Markup.button.callback(t('card_add_btn'), CALLBACK.CARD_ADD)]);
    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.ADMIN_CARDS)]);

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
  // 3. KARTANI KO'RISH
  // ============================================================
  bot.action(/^card:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(t('card_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const typeLabel = CARD_TYPE_LABELS[card.type] || '💳';

    const text =
      `╔══════════════════════╗\n` +
      `   💳 <b>${t('card_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `👤 <b>${t('wallet_admin_owner_label')}:</b> ${escapeHtml(card.owner)}\n\n` +
      `🔢 <b>${t('card_ask_number')}:</b>\n` +
      `<code>${cardService.formatCardNumber(card.number)}</code>\n\n` +
      `📱 <b>${t('card_ask_phone')}:</b>\n` +
      `<code>${escapeHtml(card.phone || '-')}</code>\n\n` +
      `💳 <b>${t('promo_type_label')}:</b> ${typeLabel}\n` +
      (card.bank ? `🏦 <b>Bank:</b> ${escapeHtml(card.bank)}\n` : '') +
      (card.isDefault ? `⭐ <b>${t('card_default_label')}</b>\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 ${new Date(card.createdAt).toLocaleString('uz-UZ')}`;

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...cardViewKeyboard(ctx, cardId) });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', ...cardViewKeyboard(ctx, cardId) });
    }
  });

  // ============================================================
  // 4. YANGI KARTA — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.CARD_ADD, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.CARD_ADD_NUMBER, data: {} };

    await ctx.reply(
      `➕ <b>${t('card_add_title')}</b>\n\n` +
        `📍 ${t('card_add_step')} <b>1/5</b>\n\n` +
        `🔢 <b>${t('card_ask_number')}:</b>\n\n` +
        `<i>${t('card_ask_number_example')}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CARDS)]],
        },
      }
    );
  });

  // ============================================================
  // 5. KARTA TURI TANLASH
  // ============================================================
  bot.action(/^ctype:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data || ctx.session.state !== STATES.CARD_ADD_TYPE) return;

    const type = ctx.match[1];
    ctx.session.data.type = type;
    ctx.session.state = STATES.CARD_ADD_BANK;

    await ctx.editMessageText(
      `📍 ${t('card_add_step')} <b>5/5</b>\n\n` +
        `🏦 <b>${t('card_ask_bank')}</b>\n\n` +
        `<i>${t('card_ask_bank_example')}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('card_skip_bank'), 'card:bank_skip')],
            [Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CARDS)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 6. BANKNI SKIP
  // ============================================================
  bot.action('card:bank_skip', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    ctx.session.data.bank = null;
    return showCardConfirm(ctx);
  });

  // ============================================================
  // 7. TELEFON SKIP
  // ============================================================
  bot.action('card:phone_skip', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    ctx.session.data.phone = null;
    ctx.session.state = STATES.CARD_ADD_TYPE;

    await ctx.editMessageText(
      `📍 ${t('card_add_step')} <b>4/5</b>\n\n` +
        `💳 <b>${t('card_type_pick_prompt')}</b>`,
      { parse_mode: 'HTML', ...cardTypeKeyboard(ctx) }
    );
  });

  // ============================================================
  // 8. KARTANI TASDIQLASH
  // ============================================================
  bot.action('card:confirm', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const d = ctx.session?.data;
    if (!d || !d.number || !d.owner) return ctx.reply(`❗ ${t('error_no_data')}`);

    try {
      const card = await cardService.createCard({
        number: d.number,
        owner: d.owner,
        phone: d.phone || null,
        type: d.type || 'other',
        bank: d.bank || null,
        addedBy: ctx.from.id,
      });

      ctx.session = { state: null, data: {} };

      const typeLabel = CARD_TYPE_LABELS[card.type] || '💳';

      await safeEdit(
        ctx,
        `✅ <b>${t('card_created_success')}</b>\n\n` +
          `👤 ${t('wallet_admin_owner_label')}: <b>${escapeHtml(card.owner)}</b>\n` +
          `🔢 ${t('card_ask_number')}: <code>${cardService.formatCardNumber(card.number)}</code>\n` +
          (card.phone ? `📱 ${t('card_ask_phone')}: <code>${escapeHtml(card.phone)}</code>\n` : '') +
          `💳 ${t('promo_type_label')}: ${typeLabel}\n` +
          (card.bank ? `🏦 Bank: ${escapeHtml(card.bank)}\n` : ''),
        {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('card_list_btn'), CALLBACK.CARD_LIST)],
              [Markup.button.callback(t('card_add_more'), CALLBACK.CARD_ADD)],
              [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
            ],
          },
        }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 9. KARTANI O'CHIRISH
  // ============================================================
  bot.action(/^card:d:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(t('card_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const text =
      `⚠️ <b>${t('tour_delete_confirm')}</b>\n\n` +
      `👤 ${t('wallet_admin_owner_label')}: <b>${escapeHtml(card.owner)}</b>\n` +
      `🔢 ${t('card_ask_number')}: <code>${cardService.formatCardNumber(card.number)}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `❗️ <i>${t('tour_delete_warning')}</i>`;

    await safeEdit(ctx, text, cardDeleteConfirmKeyboard(ctx, cardId));
  });

  bot.action(/^card:dc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(t('card_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    await cardService.deleteCard(cardId);

    await safeEdit(
      ctx,
      `✅ <b>${t('card_deleted_ok')}</b>\n\n` +
        `👤 ${escapeHtml(card.owner)}\n` +
        `🔢 ${cardService.formatCardNumber(card.number)}`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('card_list_btn'), CALLBACK.CARD_LIST)],
            [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 10. DEFAULT QILISH
  // ============================================================
  bot.action(/^card:sd:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(t('card_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    await cardService.setDefault(cardId);

    await safeEdit(
      ctx,
      `⭐ <b>${t('card_default_set')}</b>\n\n` +
        `👤 ${escapeHtml(card.owner)}\n` +
        `🔢 ${cardService.formatCardNumber(card.number)}`,
      {
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(t('card_list_btn'), CALLBACK.CARD_LIST)]],
        },
      }
    );
  });

  // ============================================================
  // 11. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('card_add')) return next();
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return;
    }

    // NUMBER
    if (s === STATES.CARD_ADD_NUMBER) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_CARD_NUMBER_LEN);
      if (!cardService.isValidCardNumber(v)) {
        return ctx.reply(`❗ ${t('card_invalid_number')}\n\n${t('card_ask_number_example')}`);
      }
      ctx.session.data.number = v;
      ctx.session.state = STATES.CARD_ADD_OWNER;

      return ctx.reply(
        `📍 ${t('card_add_step')} <b>2/5</b>\n\n` +
          `👤 <b>${t('card_ask_owner')}</b>\n\n` +
          `<i>${t('card_ask_owner_example')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CARDS)]],
          },
        }
      );
    }

    // OWNER
    if (s === STATES.CARD_ADD_OWNER) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_CARD_OWNER_LEN);
      if (v.length < 3) return ctx.reply(`❗ ${t('card_owner_short')}`);
      ctx.session.data.owner = v;
      ctx.session.state = STATES.CARD_ADD_PHONE;

      return ctx.reply(
        `📍 ${t('card_add_step')} <b>3/5</b>\n\n` +
          `📱 <b>${t('card_ask_phone')}</b>\n\n` +
          `<i>${t('card_ask_phone_example')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('card_skip_phone'), 'card:phone_skip')],
              [Markup.button.callback(t('btn_cancel'), CALLBACK.ADMIN_CARDS)],
            ],
          },
        }
      );
    }

    // BANK
    if (s === STATES.CARD_ADD_BANK) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_BANK_LEN);
      ctx.session.data.bank = v.toLowerCase() === '/skip' ? null : v;
      return showCardConfirm(ctx);
    }

    return next();
  });

  // ============================================================
  // 12. FSM — TELEFON
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.CARD_ADD_PHONE) return next();
    const t = ctx.t;

    const v = cleanText(ctx.message.text, LIMITS.MAX_PHONE_LEN);
    ctx.session.data.phone = v;
    ctx.session.state = STATES.CARD_ADD_TYPE;

    return ctx.reply(
      `📍 ${t('card_add_step')} <b>4/5</b>\n\n` +
        `💳 <b>${t('card_type_pick_prompt')}</b>`,
      { parse_mode: 'HTML', ...cardTypeKeyboard(ctx) }
    );
  });
};

// ============================================================
// YORDAMCHI: TASDIQLASH
// ============================================================
async function showCardConfirm(ctx) {
  const t = ctx.t;
  const d = ctx.session.data;

  if (!d.type) {
    ctx.session.state = STATES.CARD_ADD_TYPE;
    return ctx.reply(
      `📍 ${t('card_add_step')} <b>4/5</b>\n\n` +
        `💳 <b>${t('card_type_pick_prompt')}</b>`,
      { parse_mode: 'HTML', ...cardTypeKeyboard(ctx) }
    );
  }

  ctx.session.state = STATES.CARD_ADD_CONFIRM;

  const typeLabel = CARD_TYPE_LABELS[d.type] || '💳';

  const text =
    `╔══════════════════════╗\n` +
    `   📋 <b>${t('confirm_title')}</b>\n` +
    `╚══════════════════════╝\n\n` +
    `🔢 <b>${t('card_ask_number')}:</b>\n` +
    `<code>${cardService.formatCardNumber(d.number)}</code>\n\n` +
    `👤 <b>${t('wallet_admin_owner_label')}:</b> ${escapeHtml(d.owner)}\n\n` +
    `📱 <b>${t('card_ask_phone')}:</b> <code>${escapeHtml(d.phone || '-')}</code>\n\n` +
    `💳 <b>${t('promo_type_label')}:</b> ${typeLabel}\n` +
    (d.bank ? `🏦 <b>Bank:</b> ${escapeHtml(d.bank)}\n` : '');

  await ctx.reply(text, { parse_mode: 'HTML', ...cardConfirmKeyboard(ctx) });
}

module.exports.showCardConfirm = showCardConfirm;