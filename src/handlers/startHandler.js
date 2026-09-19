const { Markup } = require('telegraf');
const { mainKeyboard } = require('../keyboards/mainKeyboard');
const userService = require('../services/userService');
const teamService = require('../services/teamService');
const tournamentService = require('../services/tournamentService');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { resolveRole } = require('../middlewares/auth');
const { CALLBACK, ROLES } = require('../constants');

module.exports = (bot) => {
  // ============================================================
  // /start buyrug'i
  // ============================================================
  bot.start(async (ctx) => {
    const payload = ctx.startPayload || '';
    const tg = ctx.from;

    const user = await userService.upsertUser(tg);
    const role = await resolveRole(tg.id);

    // ---------- Deep-link: join_TEAMCODE ----------
    if (payload.startsWith('join_')) {
      const code = payload.slice(5).toUpperCase();
      return handleJoinByCode(ctx, code, user);
    }

    // ---------- Deep-link: tour_TOURID ----------
    if (payload.startsWith('tour_')) {
      return handleTournamentDeepLink(ctx, payload, role);
    }

    // ---------- Deep-link: inline_empty ----------
    if (payload === 'inline_empty') {
      // Oddiy start davom etadi
    }

    // ---------- Standart welcome ----------
    let text = `👋 Assalomu alaykum, <b>${escapeHtml(tg.first_name || "o'yinchi")}</b>!\n\n`;

    if (!tg.username) {
      text +=
        `⚠️ <b>Diqqat!</b>\n\n` +
        `Sizda Telegram <b>username</b> yo'q. Boshqa o'yinchilar sizni taniy olishi uchun iltimos, Telegram sozlamalaridan username qo'ying.\n\n` +
        `👉 Sozlamalar → Username\n\n`;
    }

    text +=
      `🎮 <b>Esport Arena</b> botiga xush kelibsiz!\n\n` +
      `🏆 PUBG cyber sport turnirlari boti\n\n` +
      `👇 Kerakli bo'limni tanlang:`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...mainKeyboard(role),
    });
  });

  // ============================================================
  // ASOSIY MENYU
  // ============================================================
  bot.action(CALLBACK.MENU_MAIN, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.state.role || (await resolveRole(ctx.from.id));
    await safeEdit(ctx, '🏠 <b>Asosiy menyu</b>', mainKeyboard(role));
  });

  // ============================================================
  // PROFIL
  // ============================================================
  bot.action(CALLBACK.MENU_PROFILE, async (ctx) => {
    await safeAnswer(ctx);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u) return ctx.reply('❗ /start bosing.');

    const team = u.teamId ? await teamService.getTeam(u.teamId) : null;

    const text =
      `╔══════════════════════╗\n` +
      `      👤 <b>MENING PROFILIM</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🆔 Telegram ID:\n   <code>${u.id}</code>\n\n` +
      `👤 Ism:\n   <b>${escapeHtml([u.firstName, u.lastName].filter(Boolean).join(' ') || '-')}</b>\n\n` +
      `📛 Username:\n   ${u.username ? '@' + escapeHtml(u.username) : "❌ yo'q"}\n\n` +
      `🎯 PUBG ID:\n   <code>${escapeHtml(u.pubgId || '-')}</code>\n\n` +
      `🎭 Rol:\n   <b>${escapeHtml(ctx.state.role || 'player')}</b>\n\n` +
      `👥 Komanda:\n   ${team ? '🔥 <b>' + escapeHtml(team.name) + ' [' + escapeHtml(team.tag) + ']</b>' : "❌ yo'q"}\n\n` +
      `📅 Ro'yxatdan o'tgan:\n   ${new Date(u.createdAt).toLocaleDateString('uz-UZ')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Statistika', CALLBACK.USER_STATS)],
      [Markup.button.callback('🏅 Yutuqlar', CALLBACK.USER_ACHIEVEMENTS)],
      [Markup.button.callback('🏆 Leaderboard', CALLBACK.USER_LEADERBOARD)],
      [Markup.button.callback('🎯 PUBG ID kiritish', CALLBACK.USER_PUBG_ID)],
      [Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // YORDAM
  // ============================================================
  bot.action(CALLBACK.MENU_HELP, async (ctx) => {
    await safeAnswer(ctx);

    const text =
      `╔══════════════════════╗\n` +
      `         ℹ️ <b>YORDAM</b>\n` +
      `╚══════════════════════╝\n\n` +
      `📌 <b>Asosiy bo'limlar:</b>\n\n` +
      `🏆 <b>Turnirlar</b> — mavjud turnirlar ro'yxati\n` +
      `👥 <b>Komandam</b> — komanda yaratish/boshqarish\n` +
      `👤 <b>Profil</b> — sizning ma'lumotlaringiz\n` +
      `🔍 <b>Qidiruv</b> — turnir/komanda qidirish\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔑 <b>Komandaga qo'shilish:</b>\n` +
      `Captain bergan kodni botga yuboring yoki deep-link havolani bosing.\n\n` +
      `🎮 <b>Turnirga ro'yxatdan o'tish:</b>\n` +
      `Faqat komanda Captain'i ro'yxatdan o'tkaza oladi.\n\n` +
      `🎙 <b>Host bilan bog'lanish:</b>\n` +
      `Turnir kartasidagi "Hostga yozish" tugmasini bosing.\n\n` +
      `🏅 <b>Yutuqlar va Reyting:</b>\n` +
      `Har bir o'yinga ko'ra ochko va yutuqlarga ega bo'lasiz.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 <b>Buyruqlar:</b>\n` +
      `/start — botni ishga tushirish\n` +
      `/cancel — jarayonni bekor qilish\n` +
      `/help — yordam`;

    await safeEdit(ctx, text, mainKeyboard(ctx.state.role));
  });

  // ============================================================
  // /cancel — FSM bekor qilish
  // ============================================================
  bot.command('cancel', async (ctx) => {
    ctx.session = { state: null, data: {} };
    await ctx.reply(
      "❌ <b>Jarayon bekor qilindi.</b>\n\nAsosiy menyuga qaytish uchun /start bosing.",
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // Umumiy "Bekor qilish" tugmasi
  // ============================================================
  bot.action(CALLBACK.CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    await safeEdit(ctx, '❌ <b>Bekor qilindi.</b>');
  });

  // ============================================================
  // /help buyrug'i
  // ============================================================
  bot.command('help', async (ctx) => {
    const role = ctx.state.role || 'player';
    await ctx.reply(
      `ℹ️ <b>Yordam</b>\n\n` +
        `Botdan foydalanish uchun /start bosing va menyudan kerakli bo'limni tanlang.`,
      {
        parse_mode: 'HTML',
        ...mainKeyboard(role),
      }
    );
  });
};

// ============================================================
// DEEP-LINK: join_CODE
// ============================================================
async function handleJoinByCode(ctx, code, user) {
  if (user.teamId) {
    const existingTeam = await teamService.getTeam(user.teamId);
    return ctx.reply(
      `❗ <b>Siz allaqachon komandadasiz</b>\n\n` +
        `👥 Komanda: <b>${existingTeam ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']' : "noma'lum"}</b>\n\n` +
        `<i>Boshqa komandaga qo'shilish uchun avval joriy komandadan chiqing.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  const team = await teamService.getTeamByCode(code);
  if (!team) {
    return ctx.reply(
      `❌ <b>Kod noto'g'ri yoki eskirgan</b>\n\n` +
        `Kiritilgan kod: <code>${escapeHtml(code)}</code>\n\n` +
        `<i>Captain'dan to'g'ri kodni so'rang.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  if (!(await teamService.canAddMember(team.id))) {
    return ctx.reply(
      `⚠️ <b>Komanda to'lgan</b>\n\n` +
        `<b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> komandasida allaqachon 8 ta o'yinchi bor.`,
      { parse_mode: 'HTML' }
    );
  }

  await teamService.addMember(team.id, user.id);
  await userService.setUserTeam(user.id, team.id);

  await ctx.reply(
    `╔══════════════════════╗\n` +
      `   🎉 <b>MUVAFFAQIYAT!</b>\n` +
      `╚══════════════════════╝\n\n` +
      `✅ Siz <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> komandasiga qo'shildingiz!\n\n` +
      `👥 A'zolar: <b>${team.members.length + 1}/8</b>\n\n` +
      `<i>Turnirlarda qatnashish uchun Captain turnirga ro'yxatdan o'tkazadi.</i>`,
    { parse_mode: 'HTML' }
  );

  // Captain'ga xabar
  try {
    await ctx.telegram.sendMessage(
      team.captainId,
      `╔══════════════════════╗\n` +
        `   👋 <b>YANGI A'ZO!</b>\n` +
        `╚══════════════════════╝\n\n` +
        `Yangi o'yinchi komandangizga qo'shildi:\n\n` +
        `👤 <b>${escapeHtml([user.firstName, user.lastName].filter(Boolean).join(' ') || "Noma'lum")}</b>\n` +
        `📛 ${user.username ? '@' + escapeHtml(user.username) : "username yo'q"}\n` +
        `🆔 <code>${user.id}</code>\n\n` +
        `👥 A'zolar: <b>${team.members.length + 1}/8</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (e) { /* Captain botni bloklagan */ }
}

// ============================================================
// DEEP-LINK: tour_TOURID
// ============================================================
async function handleTournamentDeepLink(ctx, tournamentId, role) {
  const t = await tournamentService.getTournament(tournamentId);

  if (!t) {
    return ctx.reply(
      `❌ <b>Turnir topilmadi</b>\n\n` +
        `ID: <code>${escapeHtml(tournamentId)}</code>\n\n` +
        `<i>Turnir o'chirilgan yoki ID noto'g'ri.</i>`,
      {
        parse_mode: 'HTML',
        ...mainKeyboard(role),
      }
    );
  }

  const regStatus =
    t.registeredTeams.length >= t.maxTeams
      ? "🔴 To'lgan"
      : t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
        ? "🔴 Yopilgan"
        : '🟢 Ochiq';

  const text =
    `╔══════════════════════╗\n` +
    `   🏆 <b>TURNIR TAFSILOTI</b>\n` +
    `╚══════════════════════╝\n\n` +
    `🎯 <b>${escapeHtml(t.title)}</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📅 <b>Sana:</b> ${t.date}\n` +
    `⏰ <b>Vaqt:</b> ${t.startTime} (${t.timezone})\n` +
    `🎮 <b>Rejim:</b> ${escapeHtml(t.mode)}\n` +
    `🗺 <b>Xarita:</b> ${escapeHtml(t.map || 'Erangel')}\n` +
    `👥 <b>Komandalar:</b> ${t.registeredTeams.length}/${t.maxTeams}\n` +
    `📝 <b>Ro'yxatdan o'tish:</b> ${regStatus}\n` +
    `🎙 <b>Host:</b> ${t.hostId ? '✅ Biriktirilgan' : "❌ yo'q"}\n` +
    (t.prize ? `💲 <b>PRIZ:</b> ${escapeHtml(t.prize)}\n` : '') +
    (t.mapTag ? `♾️ <b>MAP:</b> ${escapeHtml(t.mapTag)}\n` : '') +
    (t.etapa ? `⭐️ <b>Etap:</b> ${escapeHtml(t.etapa)}\n` : '') +
    (t.description ? `\n━━━━━━━━━━━━━━━━━━━━\n\n📄 ${escapeHtml(t.description)}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👇 Amalni tanlang:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📊 Natijalar', callback_data: CALLBACK.TOUR_STANDINGS + t.id }],
      [{ text: "📋 Komandalar ro'yxati", callback_data: CALLBACK.TOUR_TEAMLIST + t.id }],
      [{ text: "📝 Komandamni ro'yxatdan o'tkazish", callback_data: CALLBACK.TOUR_REGISTER + t.id }],
      [{ text: '💬 Hostga yozish', callback_data: CALLBACK.TOUR_CONTACT_HOST + t.id }],
      [{ text: '🏠 Asosiy menyu', callback_data: CALLBACK.MENU_MAIN }],
    ],
  };

  if (t.imageFileId) {
    try {
      return await ctx.replyWithPhoto(t.imageFileId, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (e) { /* rasm yuborilmasa */ }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}