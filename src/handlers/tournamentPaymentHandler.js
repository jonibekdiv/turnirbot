// ============================================================
// TOURNAMENT PAYMENT HANDLER — Turnir turi, to'lov, kanallar
// (TUZATILGAN: rasm qadami qo'shildi)
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const channelService = require('../services/channelService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');
const {
  tournamentTypeKeyboard,
  currencyKeyboard,
  channelsPickerKeyboard,
} = require('../keyboards/paymentKeyboard');

module.exports = (bot) => {
  // ============================================================
  // TURNIR TURI TANLASH — FREE
  // ============================================================
  bot.action(CALLBACK.TOUR_TYPE_FREE, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return ctx.reply(ctx.t('error_no_data'));

    ctx.session.data.type = 'free';
    ctx.session.data.payment = null;

    // Kanal tanlashga o'tish
    ctx.session.state = STATES.TOUR_CREATE_CHANNELS;
    ctx.session.data.selectedChannels = [];

    return showChannelPicker(ctx);
  });

  // ============================================================
  // TURNIR TURI TANLASH — PAID
  // ============================================================
  bot.action(CALLBACK.TOUR_TYPE_PAID, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return ctx.reply(ctx.t('error_no_data'));

    ctx.session.data.type = 'paid';
    ctx.session.state = STATES.TOUR_CREATE_AMOUNT;

    await safeEdit(
      ctx,
      `💳 <b>Pullik turnir — Ishtirok narxi</b>\n\n` +
        `Narxni kiriting (faqat raqam):\n\n` +
        `<i>Masalan: 50000 yoki 5</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // VALYUTA TANLASH
  // ============================================================
  bot.action(/^tcurr:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    const currency = ctx.match[1];
    ctx.session.data.currency = currency;
    ctx.session.state = STATES.TOUR_CREATE_CARD_NUMBER;

    await safeEdit(
      ctx,
      `💳 <b>Karta raqami</b>\n\n` +
        `To'lov qabul qiladigan karta raqamini kiriting:\n\n` +
        `<i>Masalan: 8600 1234 5678 9012</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // KANAL TANLASH — Toggle
  // ============================================================
  bot.action(/^tch:p:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    const chId = ctx.match[1];
    const selected = ctx.session.data.selectedChannels || [];

    const idx = selected.indexOf(chId);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(chId);
    }
    ctx.session.data.selectedChannels = selected;

    return showChannelPicker(ctx);
  });

  // ============================================================
  // KANALLARNI TASDIQLASH — TUZATILGAN: rasmga o'tish
  // ============================================================
  bot.action(CALLBACK.TOUR_CH_DONE, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    const selectedIds = ctx.session.data.selectedChannels || [];
    const allChannels = await channelService.listChannels();

    const requiredChannels = allChannels
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => ({
        channelId: c.channelId,
        channelTitle: c.title,
        channelUsername: c.username,
        channelInviteLink: c.inviteLink,
        isRequired: true,
      }));

    ctx.session.data.requiredChannels = requiredChannels;

    // ✅ TUZATILDI: DATE emas — IMAGE ga o'tamiz
    ctx.session.state = STATES.TOUR_CREATE_IMAGE;

    await safeEdit(
      ctx,
      `✅ <b>${requiredChannels.length} ta kanal tanlandi</b>\n\n` +
        `📍 Qadam: Rasm\n\n` +
        `🖼 Turnir rasmini yuboring yoki /skip:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⏭ O\'tkazib yuborish', 'tour:img_skip')],
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  });

  // ============================================================
  // KANALSIZ DAVOM ETISH — TUZATILGAN: rasmga o'tish
  // ============================================================
  bot.action(CALLBACK.TOUR_CH_SKIP, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    ctx.session.data.requiredChannels = [];

    // ✅ TUZATILDI: DATE emas — IMAGE ga o'tamiz
    ctx.session.state = STATES.TOUR_CREATE_IMAGE;

    await safeEdit(
      ctx,
      `⏭ <b>Kanalsiz davom etamiz</b>\n\n` +
        `📍 Qadam: Rasm\n\n` +
        `🖼 Turnir rasmini yuboring yoki /skip:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⏭ O\'tkazib yuborish', 'tour:img_skip')],
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  });

  // ============================================================
  // RASMNI O'TKAZIB YUBORISH
  // ============================================================
  bot.action('tour:img_skip', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    ctx.session.data.imageFileId = null;
    ctx.session.state = STATES.TOUR_CREATE_DATE;

    await safeEdit(
      ctx,
      `📅 <b>Sana kiriting (YYYY-MM-DD):</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  });

  // ============================================================
  // FSM — PULLIK TURNIR MAYDONLARI
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return next();

    // ---------- AMOUNT ----------
    if (s === STATES.TOUR_CREATE_AMOUNT) {
      const v = cleanText(ctx.message.text, 15);
      if (!isPositiveInt(v)) {
        return ctx.reply('❗ Faqat musbat raqam kiriting:');
      }
      const amount = Number(v);
      if (amount > LIMITS.MAX_PAYMENT_AMOUNT) {
        return ctx.reply(`❗ Juda katta summa. Maks: ${LIMITS.MAX_PAYMENT_AMOUNT}`);
      }
      ctx.session.data.amount = amount;
      ctx.session.state = STATES.TOUR_CREATE_CURRENCY;

      return ctx.reply(
        `💱 <b>Valyuta tanlang</b>\n\nIshtirok narxi: <b>${amount}</b>`,
        { parse_mode: 'HTML', ...currencyKeyboard() }
      );
    }

    // ---------- CARD NUMBER (qo'lda) ----------
    if (s === STATES.TOUR_CREATE_CARD_NUMBER) {
      const v = cleanText(ctx.message.text, 30);
      if (v.length < 10) {
        return ctx.reply('❗ Karta raqami juda qisqa:');
      }
      ctx.session.data.cardNumber = v;
      ctx.session.data.cardId = null;
      ctx.session.state = STATES.TOUR_CREATE_CARD_OWNER;

      return ctx.reply(
        `👤 <b>Karta egasining ismi</b>\n\nKarta egasining to'liq ismini kiriting:`,
        { parse_mode: 'HTML' }
      );
    }

    // ---------- CARD OWNER ----------
    if (s === STATES.TOUR_CREATE_CARD_OWNER) {
      const v = cleanText(ctx.message.text, 60);
      if (v.length < 3) {
        return ctx.reply('❗ Ism juda qisqa:');
      }
      ctx.session.data.cardOwner = v;
      ctx.session.state = STATES.TOUR_CREATE_PAYMENT_INSTR;

      return ctx.reply(
        `📝 <b>Qo'shimcha ko'rsatma</b>\n\n` +
          `To'lov qilish uchun qo'shimcha izoh (yoki /skip):`,
        { parse_mode: 'HTML' }
      );
    }

    // ---------- PAYMENT INSTRUCTION ----------
    if (s === STATES.TOUR_CREATE_PAYMENT_INSTR) {
      const v = cleanText(ctx.message.text, 300);
      ctx.session.data.instruction = v.toLowerCase() === '/skip' ? '' : v;
      ctx.session.state = STATES.TOUR_CREATE_PAYMENT_DEADLINE;

      return ctx.reply(
        `⏳ <b>To'lov chekini qabul qilish oxirgi vaqti</b>\n\n` +
          `Format: YYYY-MM-DD HH:mm yoki /skip:`,
        { parse_mode: 'HTML' }
      );
    }

    // ---------- PAYMENT DEADLINE ----------
    if (s === STATES.TOUR_CREATE_PAYMENT_DEADLINE) {
      const v = cleanText(ctx.message.text, 20);
      if (v.toLowerCase() !== '/skip') {
        const parts = v.split(' ');
        if (parts.length === 2) {
          ctx.session.data.paymentDeadline = v;
        } else {
          return ctx.reply('❗ Format: YYYY-MM-DD HH:mm yoki /skip:');
        }
      } else {
        ctx.session.data.paymentDeadline = null;
      }

      // ✅ RASMGA O'TISH
      ctx.session.state = STATES.TOUR_CREATE_IMAGE;

      return ctx.reply(
        `✅ <b>To'lov ma'lumotlari saqlandi</b>\n\n` +
          `📍 Keyingi qadam: Rasm\n\n` +
          `🖼 Turnir rasmini yuboring yoki /skip:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('⏭ O\'tkazib yuborish', 'tour:img_skip')],
              [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
            ],
          },
        }
      );
    }

    return next();
  });
};

// ============================================================
// YORDAMCHI: KANAL TANLASH
// ============================================================
async function showChannelPicker(ctx) {
  const channels = await channelService.listChannels();
  const selected = ctx.session.data.selectedChannels || [];

  if (!channels.length) {
    // Kanal yo'q — avtomatik rasmga o'tamiz (DATE emas!)
    ctx.session.data.requiredChannels = [];
    ctx.session.state = STATES.TOUR_CREATE_IMAGE;

    return safeEdit(
      ctx,
      `📭 <b>Kanallar ro'yxati bo'sh</b>\n\n` +
        `<i>Admin panel → 📢 Kanallar orqali kanal qo'shing.</i>\n\n` +
        `📍 Keyingi qadam: Rasm\n\n` +
        `🖼 Turnir rasmini yuboring yoki /skip:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⏭ O\'tkazib yuborish', 'tour:img_skip')],
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  }

  const text =
    `📢 <b>Majburiy kanallar</b>\n\n` +
    `Bepul turnirda qatnashish uchun qaysi kanallarga obuna bo'lish kerakligini tanlang.\n\n` +
    `Tanlangan: <b>${selected.length}</b> ta\n\n` +
    `<i>Kanallar bosilganda ✅ belgilanadi. Keyin "Tayyor" bosing.</i>`;

  const kb = channelsPickerKeyboard(channels, selected);

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
  } catch (e) {
    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  }
}