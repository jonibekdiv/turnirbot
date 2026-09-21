// ============================================================
// CARD HANDLER — Kartalar boshqaruvi
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
  // KARTALAR PANELI
  // ============================================================
  bot.action(CALLBACK.ADMIN_CARDS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const cards = isAdmin
      ? await cardService.getAllCards()
      : await cardService.getUserCards(ctx.from.id);

    const text =
      `╔══════════════════════╗\n` +
      `   💳 <b>KARTALAR</b>\n` +
      `╚══════════════════════╝\n\n` +
      `📊 Jami: <b>${cards.length}</b> ta karta\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 <i>Turnir yaratishda karta tanlash mumkin</i>\n\n` +
      `👇 Amalni tanlang:`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...cardsPanelKeyboard(),
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...cardsPanelKeyboard(),
      });
    }
  });

  // ============================================================
  // KARTALAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.CARD_LIST, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    const cards = isAdmin
      ? await cardService.getAllCards()
      : await cardService.getUserCards(ctx.from.id);

    if (!cards.length) {
      return safeEdit(
        ctx,
        `📭 <b>Kartalar yo'q</b>\n\n` +
          `Yangi karta qo'shish uchun pastdagi tugmani bosing:`,
        cardsPanelKeyboard()
      );
    }

    const lines = [`💳 <b>Kartalar (${cards.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];

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

    rows.push([Markup.button.callback('➕ Yangi karta', CALLBACK.CARD_ADD)]);
    rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.ADMIN_CARDS)]);

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
  // KARTANI KO'RISH
  // ============================================================
  bot.action(/^card:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(ctx.t('error_not_found'));

    // Ruxsat tekshirish
    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(ctx.t('error_access'));
    }

    const typeLabel = CARD_TYPE_LABELS[card.type] || '💳';

    const text =
      `╔══════════════════════╗\n` +
      `   💳 <b>KARTA</b>\n` +
      `╚══════════════════════╝\n\n` +
      `👤 <b>Egasi:</b> ${escapeHtml(card.owner)}\n\n` +
      `🔢 <b>Raqami:</b>\n` +
      `<code>${cardService.formatCardNumber(card.number)}</code>\n\n` +
      `📱 <b>Telefon:</b>\n` +
      `<code>${escapeHtml(card.phone || '-')}</code>\n\n` +
      `💳 <b>Turi:</b> ${typeLabel}\n` +
      (card.bank ? `🏦 <b>Bank:</b> ${escapeHtml(card.bank)}\n` : '') +
      (card.isDefault ? `⭐ <b>Default karta</b>\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 Qo'shilgan: ${new Date(card.createdAt).toLocaleString('uz-UZ')}`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...cardViewKeyboard(cardId),
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...cardViewKeyboard(cardId),
      });
    }
  });

  // ============================================================
  // KARTA QO'SHISH — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.CARD_ADD, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.CARD_ADD_NUMBER, data: {} };

    await ctx.reply(
      `➕ <b>Yangi karta qo'shish</b>\n\n` +
        `📍 Qadam <b>1/5</b>\n\n` +
        `🔢 <b>Karta raqamini kiriting:</b>\n\n` +
        `<i>Masalan: 8600 1234 5678 9012</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CARDS)],
          ],
        },
      }
    );
  });

  // ============================================================
  // KARTA TURINI TANLASH
  // ============================================================
  bot.action(/^ctype:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data || ctx.session.state !== STATES.CARD_ADD_TYPE) return;

    const type = ctx.match[1];
    ctx.session.data.type = type;
    ctx.session.state = STATES.CARD_ADD_BANK;

    await ctx.editMessageText(
      `📍 Qadam <b>5/5</b>\n\n` +
        `🏦 <b>Bank nomini kiriting</b> (yoki /skip):\n\n` +
        `<i>Masalan: Kapitalbank, TBC, Uzum Bank</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⏭ O\'tkazib yuborish', 'card:bank_skip')],
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CARDS)],
          ],
        },
      }
    );
  });

  // ============================================================
  // BANKNI O'TKAZIB YUBORISH
  // ============================================================
  bot.action('card:bank_skip', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    ctx.session.data.bank = null;
    return showCardConfirm(ctx);
  });

  // ============================================================
  // KARTANI TASDIQLASH
  // ============================================================
  bot.action('card:confirm', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const d = ctx.session?.data;
    if (!d || !d.number || !d.owner) {
      return ctx.reply(ctx.t('error_no_data'));
    }

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
        `✅ <b>Karta qo'shildi!</b>\n\n` +
          `👤 Egasi: <b>${escapeHtml(card.owner)}</b>\n` +
          `🔢 Raqami: <code>${cardService.formatCardNumber(card.number)}</code>\n` +
          (card.phone ? `📱 Telefon: <code>${escapeHtml(card.phone)}</code>\n` : '') +
          `💳 Turi: ${typeLabel}\n` +
          (card.bank ? `🏦 Bank: ${escapeHtml(card.bank)}\n` : ''),
        {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('💳 Kartalar ro\'yxati', CALLBACK.CARD_LIST)],
              [Markup.button.callback('➕ Yana qo\'shish', CALLBACK.CARD_ADD)],
              [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
            ],
          },
        }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(ctx.t('error_prefix') + ' ' + (e.message || 'xato'));
    }
  });

  // ============================================================
  // KARTANI O'CHIRISH — TASDIQLASH
  // ============================================================
  bot.action(/^card:d:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(ctx.t('error_not_found'));

    // Ruxsat
    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(ctx.t('error_access'));
    }

    const text =
      `⚠️ <b>Kartani o'chirmoqchimisiz?</b>\n\n` +
      `👤 Egasi: <b>${escapeHtml(card.owner)}</b>\n` +
      `🔢 Raqami: <code>${cardService.formatCardNumber(card.number)}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `❗️ <i>Bu amalni qaytarib bo'lmaydi</i>`;

    await safeEdit(ctx, text, cardDeleteConfirmKeyboard(cardId));
  });

  // ============================================================
  // KARTANI O'CHIRISH — BAJARISH
  // ============================================================
  bot.action(/^card:dc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(ctx.t('error_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(ctx.t('error_access'));
    }

    await cardService.deleteCard(cardId);

    await safeEdit(
      ctx,
      `✅ <b>Karta o'chirildi</b>\n\n` +
        `👤 ${escapeHtml(card.owner)}\n` +
        `🔢 ${cardService.formatCardNumber(card.number)}`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('💳 Kartalar ro\'yxati', CALLBACK.CARD_LIST)],
            [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
          ],
        },
      }
    );
  });

  // ============================================================
  // DEFAULT QILIB BELGILASH
  // ============================================================
  bot.action(/^card:sd:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const cardId = ctx.match[1];
    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(ctx.t('error_not_found'));

    const isAdmin = ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;
    if (!isAdmin && Number(card.addedBy) !== Number(ctx.from.id)) {
      return ctx.reply(ctx.t('error_access'));
    }

    await cardService.setDefault(cardId);

    await safeEdit(
      ctx,
      `⭐ <b>Default karta o'zgartirildi</b>\n\n` +
        `👤 ${escapeHtml(card.owner)}\n` +
        `🔢 ${cardService.formatCardNumber(card.number)}`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('💳 Kartalar ro\'yxati', CALLBACK.CARD_LIST)],
          ],
        },
      }
    );
  });

  // ============================================================
  // FSM — KARTA QO'SHISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('card_add')) return next();

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return;
    }

    // ---------- 1. RAQAM ----------
    if (s === STATES.CARD_ADD_NUMBER) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_CARD_NUMBER_LEN);
      if (!cardService.isValidCardNumber(v)) {
        return ctx.reply(
          `❗ <b>Karta raqami noto'g'ri</b>\n\n` +
            `16 xonali raqam kiriting:\n` +
            `<i>Masalan: 8600 1234 5678 9012</i>`
        );
      }
      ctx.session.data.number = v;
      ctx.session.state = STATES.CARD_ADD_OWNER;

      return ctx.reply(
        `📍 Qadam <b>2/5</b>\n\n` +
          `👤 <b>Karta egasining ism-familiyasini kiriting:</b>\n\n` +
          `<i>Masalan: Ali Valiyev</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CARDS)],
            ],
          },
        }
      );
    }

    // ---------- 2. EGASI ----------
    if (s === STATES.CARD_ADD_OWNER) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_CARD_OWNER_LEN);
      if (v.length < 3) {
        return ctx.reply('❗ Ism juda qisqa. Qayta kiriting:');
      }
      ctx.session.data.owner = v;
      ctx.session.state = STATES.CARD_ADD_PHONE;

      return ctx.reply(
        `📍 Qadam <b>3/5</b>\n\n` +
          `📱 <b>Kartaga ulangan telefon raqamini kiriting:</b>\n\n` +
          `<i>Masalan: +998 90 123 45 67</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('⏭ O\'tkazib yuborish', 'card:phone_skip')],
              [Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_CARDS)],
            ],
          },
        }
      );
    }

    // ---------- 3. BANK ----------
    if (s === STATES.CARD_ADD_BANK) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_BANK_LEN);
      ctx.session.data.bank = v.toLowerCase() === '/skip' ? null : v;
      return showCardConfirm(ctx);
    }

    return next();
  });

  // ============================================================
  // TELEFONNI O'TKAZIB YUBORISH
  // ============================================================
  bot.action('card:phone_skip', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    ctx.session.data.phone = null;
    ctx.session.state = STATES.CARD_ADD_TYPE;

    await ctx.editMessageText(
      `📍 Qadam <b>4/5</b>\n\n` +
        `💳 <b>Karta turini tanlang:</b>`,
      { parse_mode: 'HTML', ...cardTypeKeyboard() }
    );
  });

  // Eslatma: card type tanlash `ctype:` action orqali ishlaydi (yuqorida)
};

// ============================================================
// YORDAMCHI: TASDIQLASHNI KO'RSATISH
// ============================================================
async function showCardConfirm(ctx) {
  const d = ctx.session.data;

  if (!d.type) {
    // Agar tur tanlanmagan bo'lsa — tanlashga o'tamiz
    ctx.session.state = STATES.CARD_ADD_TYPE;
    return ctx.reply(
      `📍 Qadam <b>4/5</b>\n\n` +
        `💳 <b>Karta turini tanlang:</b>`,
      { parse_mode: 'HTML', ...cardTypeKeyboard() }
    );
  }

  ctx.session.state = STATES.CARD_ADD_CONFIRM;

  const typeLabel = CARD_TYPE_LABELS[d.type] || '💳';

  const text =
    `╔══════════════════════╗\n` +
    `   📋 <b>TASDIQLASH</b>\n` +
    `╚══════════════════════╝\n\n` +
    `🔢 <b>Raqami:</b>\n` +
    `<code>${cardService.formatCardNumber(d.number)}</code>\n\n` +
    `👤 <b>Egasi:</b> ${escapeHtml(d.owner)}\n\n` +
    `📱 <b>Telefon:</b> <code>${escapeHtml(d.phone || '-')}</code>\n\n` +
    `💳 <b>Turi:</b> ${typeLabel}\n` +
    (d.bank ? `🏦 <b>Bank:</b> ${escapeHtml(d.bank)}\n` : '');

  await ctx.reply(text, { parse_mode: 'HTML', ...cardConfirmKeyboard() });
}

module.exports.showCardConfirm = showCardConfirm;