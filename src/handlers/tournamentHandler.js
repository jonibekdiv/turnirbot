// ============================================================
// TURNIR HANDLERLARI — To'liq
// ============================================================

const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const roleService = require('../services/roleService');
const teamListService = require('../services/teamListService');
const matchService = require('../services/matchService');
const pointsService = require('../services/pointsService');
const {
  tournamentsMenu,
  tournamentItemButtons,
  confirmTournament,
} = require('../keyboards/tournamentKeyboard');
const { CALLBACK, STATES, LIMITS, ROLES, DEFAULT_MAP } = require('../constants');
const { cleanText, isValidDate, isValidTime, isPositiveInt } = require('../utils/validation');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { parseDateTime, isSameDayTashkent } = require('../utils/dateUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

const PAGE_SIZE = 5;

// ============================================================
// YORDAMCHI: ORQAGA TUGMALARI
// ============================================================
function backToMain() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

function backToTournaments() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirlar menyusi', CALLBACK.MENU_TOURNAMENTS)],
  ]);
}

function backToTournament(id) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + id)],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

function backToList() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirlar menyusi', CALLBACK.MENU_TOURNAMENTS)],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

// ============================================================
// ASOSIY MODUL
// ============================================================
module.exports = (bot) => {
  // ============================================================
  // 1. TURNIRLAR MENYUSI
  // ============================================================
  bot.action(CALLBACK.MENU_TOURNAMENTS, async (ctx) => {
    await safeAnswer(ctx);
    try {
      await safeEdit(ctx, '🏆 <b>Turnirlar</b>\n\nBo\'limni tanlang:', tournamentsMenu());
    } catch (e) {
      await ctx.reply('🏆 <b>Turnirlar</b>\n\nBo\'limni tanlang:', {
        parse_mode: 'HTML',
        ...tournamentsMenu(),
      });
    }
  });

  // ============================================================
  // 2. BO'LIM TANLANGANDA (Bugungi / Kelgusi / Tugagan)
  // ============================================================
  bot.action([CALLBACK.TOUR_TODAY, CALLBACK.TOUR_UPCOMING, CALLBACK.TOUR_FINISHED], async (ctx) => {
    await safeAnswer(ctx);
    const key = ctx.callbackQuery.data;
    await showTournamentList(ctx, key, 0);
  });

  // ============================================================
  // 3. SAHIFALASH
  // ============================================================
  bot.action(/^tour:page:(today|upcoming|finished):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const section = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const key =
      section === 'today' ? CALLBACK.TOUR_TODAY :
      section === 'upcoming' ? CALLBACK.TOUR_UPCOMING :
      CALLBACK.TOUR_FINISHED;
    await showTournamentList(ctx, key, page);
  });

  // ============================================================
  // 4. TURNIRNI OCHISH (🔑 Room info tugmasi bilan)
  // ============================================================
  bot.action(/^tour:open:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const id = ctx.match[1];
    const t = await tournamentService.getTournament(id);
    if (!t) {
      return ctx.reply('❗ Turnir topilmadi.', {
        reply_markup: backToList().reply_markup,
      });
    }

    // Foydalanuvchi ro'yxatdan o'tganmi?
    const user = await userService.getUser(ctx.from.id);
    const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
    const isRegistered = team && t.registeredTeams.includes(team.id);

    const buttons = [
      [Markup.button.callback('📊 Natijalar', CALLBACK.TOUR_STANDINGS + t.id)],
      [Markup.button.callback("📋 Komandalar ro'yxati", CALLBACK.TOUR_TEAMLIST + t.id)],
      [Markup.button.callback("📝 Ro'yxatdan o'tish", CALLBACK.TOUR_REGISTER + t.id)],
    ];

    // 🔑 Room ma'lumotlari tugmasi — faqat ro'yxatdan o'tganlar va room tayyor bo'lsa
    if (isRegistered) {
      if (t.roomId && t.roomPassword) {
        buttons.push([
          Markup.button.callback('🔑 Room ma\'lumotlari', 'tour:room_info:' + t.id),
        ]);
      } else if (t.roomId || t.roomPassword) {
        buttons.push([
          Markup.button.callback('⏳ Room ma\'lumotlari (kuting)', 'tour:room_info:' + t.id),
        ]);
      } else {
        buttons.push([
          Markup.button.callback('⏳ Room ma\'lumotlari (host yubormadi)', 'tour:room_info:' + t.id),
        ]);
      }
    }

    buttons.push([
      Markup.button.callback('💬 Hostga yozish', CALLBACK.TOUR_CONTACT_HOST + t.id),
    ]);

    // Admin uchun qo'shimcha tugmalar
    if (hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      buttons.push([Markup.button.callback('✏️ Tahrirlash', CALLBACK.TOUR_EDIT + t.id)]);
      buttons.push([Markup.button.callback('📋 Nusxalash', CALLBACK.TOUR_CLONE + t.id)]);
      buttons.push([Markup.button.callback('📊 Hisobot', CALLBACK.TOUR_REPORT + t.id)]);
    }

    buttons.push([Markup.button.callback('⬅️ Turnirlar menyusi', CALLBACK.MENU_TOURNAMENTS)]);
    buttons.push([Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)]);

    const text = formatTournamentText(t, true);

    if (t.imageFileId) {
      try {
        return await ctx.replyWithPhoto(t.imageFileId, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (e) { /* rasm yo'q */ }
    }

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    }
  });

  // ============================================================
  // 4.1 ROOM MA'LUMOTLARINI KO'RSATISH (Copy tugmalari bilan)
  // ============================================================
  bot.action(/^tour:room_info:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) {
      return ctx.reply('❗ Turnir topilmadi.', {
        reply_markup: backToList().reply_markup,
      });
    }

    // Foydalanuvchi komandada va ro'yxatdan o'tganmi?
    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply("❗ Siz komandada emassiz.", {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }
    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return ctx.reply('❗ Komanda topilmadi.', {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }
    if (!t.registeredTeams.includes(team.id)) {
      return ctx.reply(
        "❗ Siz bu turnirda ro'yxatdan o'tmagansiz.",
        { reply_markup: backToTournament(t.id).reply_markup }
      );
    }

    // ---------- Host hali yubormagan ----------
    if (!t.roomId && !t.roomPassword) {
      return ctx.reply(
        `╔══════════════════════╗\n` +
          `   ⏳ <b>KUTILMOQDA</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🕐 Host hali xona ma'lumotlarini yubormadi.\n\n` +
          `<i>Iltimos, kuting. Room ID va parol paydo bo'lishi bilan sizga avtomatik xabar yuboriladi.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: backToTournament(t.id).reply_markup,
        }
      );
    }

    // ---------- Faqat bittasi bor ----------
    if (!t.roomId || !t.roomPassword) {
      return ctx.reply(
        `╔══════════════════════╗\n` +
          `   ⏳ <b>QISMAN TAYYOR</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🆔 Room ID: <code>${escapeHtml(t.roomId || "hali yo'q")}</code>\n` +
          `🔒 Parol: <code>${escapeHtml(t.roomPassword || "hali yo'q")}</code>\n\n` +
          `<i>Host ma'lumotlarni to'liq yuborishi bilan sizga avtomatik xabar boradi.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: backToTournament(t.id).reply_markup,
        }
      );
    }

    // ---------- Ikkalasi ham tayyor — copy tugmalari bilan ----------
    const text =
      `╔══════════════════════╗\n` +
      `   🔑 <b>ROOM MA'LUMOTLARI</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 <b>Sana:</b> ${t.date}\n` +
      `⏰ <b>Vaqt:</b> ${t.startTime}\n` +
      (t.mode ? `🎮 <b>Rejim:</b> ${escapeHtml(t.mode)}\n` : '') +
      (t.etapa ? `⭐️ <b>Etap:</b> ${escapeHtml(t.etapa)}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🆔 <b>Room ID:</b>\n` +
      `<code>${escapeHtml(String(t.roomId))}</code>\n\n` +
      `🔒 <b>Parol:</b>\n` +
      `<code>${escapeHtml(String(t.roomPassword))}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 <i>Quyidagi tugmalar orqali nusxalashingiz mumkin:</i>`;

    const kb = {
      inline_keyboard: [
        [
          {
            text: '📋 Room ID nusxalash',
            copy_text: { text: String(t.roomId) },
          },
        ],
        [
          {
            text: '📋 Parol nusxalash',
            copy_text: { text: String(t.roomPassword) },
          },
        ],
        [
          {
            text: '📋 Hammasini nusxalash',
            copy_text: {
              text: `Room ID: ${t.roomId}\nParol: ${t.roomPassword}`,
            },
          },
        ],
        [
          {
            text: '⬅️ Turnirga qaytish',
            callback_data: CALLBACK.TOUR_OPEN + t.id,
          },
        ],
        [
          {
            text: '🏠 Asosiy menyu',
            callback_data: CALLBACK.MENU_MAIN,
          },
        ],
      ],
    };

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    }
  });

  // ============================================================
  // 5. NATIJALAR (real-time standings)
  // ============================================================
  bot.action(/^tour:st:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) {
      return ctx.reply('❗ Turnir topilmadi.', {
        reply_markup: backToList().reply_markup,
      });
    }

    const matchData = await matchService.getTournamentMatches(t.id);
    const teamsMap = {};
    for (const tid of t.registeredTeams) {
      const team = await teamService.getTeam(tid);
      if (team) teamsMap[tid] = team;
    }

    const standings = pointsService.calculateStandings(t, matchData, teamsMap);
    const text = pointsService.formatStandings(standings, t);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Yangilash', CALLBACK.TOUR_STANDINGS + t.id)],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + t.id)],
      [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
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
  // 6. KOMANDALAR RO'YXATI
  // ============================================================
  bot.action(/^tour:tl:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const id = ctx.match[1];
    const t = await tournamentService.getTournament(id);
    if (!t) {
      return ctx.reply('❗ Turnir topilmadi.', {
        reply_markup: backToList().reply_markup,
      });
    }

    const text = await teamListService.buildTeamList(t);

    const buttons = [
      [Markup.button.callback('🔄 Yangilash', CALLBACK.TOUR_TEAMLIST + t.id)],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + t.id)],
      [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
    ];

    if (t.imageFileId) {
      try {
        return await ctx.replyWithPhoto(t.imageFileId, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (e) { /* rasm yo'q */ }
    }

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    }
  });

  // ============================================================
  // 7. TURNIRGA RO'YXATDAN O'TISH
  // ============================================================
  bot.action(/^tour:reg:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply("❗ Siz komandada emassiz.", {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return ctx.reply('❗ Komanda topilmadi.', {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    if (team.captainId !== ctx.from.id) {
      return ctx.reply("❗ Faqat captain ro'yxatdan o'tkaza oladi.", {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    if (t.registrationDeadline && new Date(t.registrationDeadline) < new Date()) {
      return ctx.reply("❗ Ro'yxatdan o'tish muddati tugagan.", {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    if (t.registeredTeams.includes(team.id)) {
      return ctx.reply("❗ Komandangiz allaqachon ro'yxatdan o'tgan.", {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    if (t.registeredTeams.length >= t.maxTeams) {
      return ctx.reply("❗ Turnir to'lgan.", {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    const res = await tournamentService.registerTeam(t.id, team.id);
    if (!res.ok) {
      return ctx.reply(`❗ Xatolik: ${res.reason}`, {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📋 Komandalar ro'yxati", CALLBACK.TOUR_TEAMLIST + t.id)],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + t.id)],
      [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(
      `╔══════════════════════╗\n` +
        `   🎉 <b>MUVAFFAQIYAT!</b>\n` +
        `╚══════════════════════╝\n\n` +
        `✅ <b>${escapeHtml(team.name)}</b> komandasi turnirga ro'yxatdan o'tdi!\n\n` +
        `🏆 ${escapeHtml(t.title)}\n` +
        `👥 Komandalar: <b>${t.registeredTeams.length + 1}/${t.maxTeams}</b>`,
      { parse_mode: 'HTML', reply_markup: kb.reply_markup }
    );

    if (t.hostId) {
      try {
        await ctx.telegram.sendMessage(
          t.hostId,
          `ℹ️ <b>${escapeHtml(t.title)}</b> turniriga yangi komanda:\n<b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) { /* host bloklagan */ }
    }
  });

  // ============================================================
  // 8. TURNIR YARATISH — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.TOUR_CREATE, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply("⛔ Ruxsat yo'q.", {
        reply_markup: backToMain().reply_markup,
      });
    }

    ctx.session = { state: STATES.TOUR_CREATE_TITLE, data: {} };

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
    ]);

    const text =
      `🆕 <b>Yangi turnir yaratish</b>\n\n` +
      `📍 Qadam <b>1/12</b>\n\n` +
      `✍️ Turnir nomini kiriting:\n\n` +
      `<i>Masalan: SXB SCRIMS S165</i>`;

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
  // 8.1 HOST TANLASH
  // ============================================================
  bot.action(/^tour:ph:(host_.+|\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const hostId = ctx.match[1].replace('host_', '');
    const d = ctx.session?.data || {};
    if (!d.title) {
      return ctx.reply("❗ Ma'lumot yo'q. Qaytadan boshlang.", {
        reply_markup: backToMain().reply_markup,
      });
    }

    d.hostId = Number(hostId) || hostId;
    ctx.session.state = STATES.TOUR_CREATE_CONFIRM;
    const summary = await buildConfirmSummary(d);
    return ctx.reply(summary, { parse_mode: 'HTML', ...confirmTournament() });
  });

  bot.action('tour:ph:skip', async (ctx) => {
    await safeAnswer(ctx);
    const d = ctx.session?.data || {};
    if (!d.title) {
      return ctx.reply("❗ Ma'lumot yo'q.", {
        reply_markup: backToMain().reply_markup,
      });
    }
    d.hostId = null;
    ctx.session.state = STATES.TOUR_CREATE_CONFIRM;
    const summary = await buildConfirmSummary(d);
    return ctx.reply(summary, { parse_mode: 'HTML', ...confirmTournament() });
  });

  // ============================================================
  // 8.2 TASDIQLASH
  // ============================================================
  bot.action(CALLBACK.TOUR_CONFIRM, async (ctx) => {
    await safeAnswer(ctx);
    const d = ctx.session?.data || {};
    if (!d.title) {
      return ctx.reply("❗ Ma'lumot yo'q.", {
        reply_markup: backToMain().reply_markup,
      });
    }

    try {
      const t = await tournamentService.createTournament({
        ...d,
        map: DEFAULT_MAP,
        createdBy: ctx.from.id,
      });

      if (d.hostId) {
        await tournamentService.setHost(t.id, d.hostId);
        try {
          await ctx.telegram.sendMessage(
            d.hostId,
            `🎙 <b>Sizga yangi turnir biriktirildi!</b>\n\n` +
              `🏆 <b>${escapeHtml(t.title)}</b>\n` +
              `📅 ${t.date} | ⏰ ${t.startTime}\n\n` +
              `Room ID va parolni yuborish uchun Host panelga o'ting.`,
            { parse_mode: 'HTML' }
          );
        } catch (e) { /* host bloklagan */ }
      }

      // Shablon saqlash
      if (d.saveAsTemplate) {
        try {
          const tournamentExtService = require('../services/tournamentExtService');
          await tournamentExtService.saveTemplate(t.title, d, ctx.from.id);
        } catch (e) { /* e'tiborsiz */ }
      }

      ctx.session = { state: null, data: {} };

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Turnirni ochish', CALLBACK.TOUR_OPEN + t.id)],
        [Markup.button.callback('➕ Yana turnir', CALLBACK.TOUR_CREATE)],
        [Markup.button.callback('🏠 Admin panel', CALLBACK.ADMIN_PANEL)],
      ]);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   ✅ <b>TURNIR YARATILDI!</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🆔 ID: <code>${t.id}</code>\n` +
          `🏆 Nom: <b>${escapeHtml(t.title)}</b>\n` +
          `📅 ${t.date} | ⏰ ${t.startTime}\n` +
          `🎮 ${escapeHtml(t.mode)}\n` +
          `💲 PRIZ: ${escapeHtml(t.prize || '-')}\n` +
          `🎙 Host: <b>${d.hostId ? '✅ biriktirilgan' : "yo'q"}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 <i>Endi turnir ID sini ishtirokchilarga yuboring.</i>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply('❌ Turnir yaratilmadi: ' + (e.message || 'xato'), {
        reply_markup: backToMain().reply_markup,
      });
    }
  });

  // ============================================================
  // 8.3 BEKOR QILISH
  // ============================================================
  bot.action(CALLBACK.TOUR_CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    try {
      await ctx.editMessageText('❌ <b>Bekor qilindi.</b>', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    } catch (e) {
      await ctx.reply('❌ <b>Bekor qilindi.</b>', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }
  });

  // ============================================================
  // 9. FSM — TURNIR YARATISH QADAMLARI
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('tour_create')) return next();

    // ---------- 1. NOM ----------
    if (s === STATES.TOUR_CREATE_TITLE) {
      const title = cleanText(ctx.message.text, LIMITS.MAX_NAME_LEN);
      if (title.length < 3) {
        return ctx.reply('❗ Nom juda qisqa. Qayta kiriting:', {
          reply_markup: backToMain().reply_markup,
        });
      }
      ctx.session.data.title = title;
      ctx.session.state = STATES.TOUR_CREATE_IMAGE;
      return ctx.reply('📍 Qadam <b>2/12</b>\n\n🖼 Turnir rasmini yuboring yoki /skip:', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 2. RASM ----------
    if (s === STATES.TOUR_CREATE_IMAGE) {
      const v = cleanText(ctx.message.text, 10).toLowerCase();
      if (v === '/skip') {
        ctx.session.data.imageFileId = null;
        ctx.session.state = STATES.TOUR_CREATE_DATE;
        return ctx.reply('📍 Qadam <b>3/12</b>\n\n📅 Sana (YYYY-MM-DD):', {
          parse_mode: 'HTML',
          reply_markup: backToMain().reply_markup,
        });
      }
      return ctx.reply('❗ Rasm yuboring yoki /skip:', {
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 3. SANA ----------
    if (s === STATES.TOUR_CREATE_DATE) {
      const v = cleanText(ctx.message.text, 10);
      if (!isValidDate(v)) {
        return ctx.reply('❗ Format: YYYY-MM-DD. Qayta kiriting:', {
          reply_markup: backToMain().reply_markup,
        });
      }
      ctx.session.data.date = v;
      ctx.session.state = STATES.TOUR_CREATE_TIME;
      return ctx.reply('📍 Qadam <b>4/12</b>\n\n⏰ Vaqt (HH:mm):', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 4. VAQT ----------
    if (s === STATES.TOUR_CREATE_TIME) {
      const v = cleanText(ctx.message.text, 5);
      if (!isValidTime(v)) {
        return ctx.reply('❗ Format: HH:mm. Qayta kiriting:', {
          reply_markup: backToMain().reply_markup,
        });
      }
      ctx.session.data.startTime = v;
      ctx.session.state = STATES.TOUR_CREATE_MODE;
      return ctx.reply('📍 Qadam <b>5/12</b>\n\n🎮 Rejim (Solo/Duo/Squad):', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 5. REJIM ----------
    if (s === STATES.TOUR_CREATE_MODE) {
      const mode = cleanText(ctx.message.text, 20);
      if (!['solo', 'duo', 'squad'].includes(mode.toLowerCase())) {
        return ctx.reply('❗ Faqat Solo, Duo yoki Squad:', {
          reply_markup: backToMain().reply_markup,
        });
      }
      ctx.session.data.mode = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
      ctx.session.state = STATES.TOUR_CREATE_PRIZE;
      return ctx.reply('📍 Qadam <b>6/12</b>\n\n💲 <b>PRIZ</b>:\n\n<i>Masalan: 400.000 MING</i>', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 6. PRIZ ----------
    if (s === STATES.TOUR_CREATE_PRIZE) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_PRIZE_LEN);
      if (!v) return ctx.reply('❗ PRIZ kiriting:', {
        reply_markup: backToMain().reply_markup,
      });
      ctx.session.data.prize = v;
      ctx.session.state = STATES.TOUR_CREATE_MAP_TAG;
      return ctx.reply('📍 Qadam <b>7/12</b>\n\n♾️ <b>MAP</b>:\n\n<i>Masalan: E/M/R/E</i>', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 7. MAP ----------
    if (s === STATES.TOUR_CREATE_MAP_TAG) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_MAP_TAG_LEN);
      if (!v) return ctx.reply('❗ MAP kiriting:', {
        reply_markup: backToMain().reply_markup,
      });
      ctx.session.data.mapTag = v;
      ctx.session.state = STATES.TOUR_CREATE_ETAPA;
      return ctx.reply('📍 Qadam <b>8/12</b>\n\n⭐️ <b>Etap</b>:\n\n<i>Masalan: 1/2</i>', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 8. ETAP ----------
    if (s === STATES.TOUR_CREATE_ETAPA) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_ETAPA_LEN);
      if (!v) return ctx.reply('❗ Etap kiriting:', {
        reply_markup: backToMain().reply_markup,
      });
      ctx.session.data.etapa = v;
      ctx.session.state = STATES.TOUR_CREATE_MAXTEAMS;
      return ctx.reply(
        `📍 Qadam <b>9/12</b>\n\n👥 Maksimal komandalar soni (${LIMITS.MAX_TEAMS_PER_TOURNAMENT}):`,
        { parse_mode: 'HTML', reply_markup: backToMain().reply_markup }
      );
    }

    // ---------- 9. MAKS. KOMANDALAR ----------
    if (s === STATES.TOUR_CREATE_MAXTEAMS) {
      const v = cleanText(ctx.message.text, 3);
      if (!isPositiveInt(v)) return ctx.reply('❗ Musbat son kiriting:', {
        reply_markup: backToMain().reply_markup,
      });
      ctx.session.data.maxTeams = Math.min(Number(v), LIMITS.MAX_TEAMS_PER_TOURNAMENT);
      ctx.session.state = STATES.TOUR_CREATE_DESC;
      return ctx.reply("📍 Qadam <b>10/12</b>\n\n📄 Qo'shimcha izoh (yoki /skip):", {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 10. IZOH ----------
    if (s === STATES.TOUR_CREATE_DESC) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_DESC_LEN);
      ctx.session.data.description = v.toLowerCase() === '/skip' ? '' : v;
      ctx.session.state = STATES.TOUR_CREATE_DEADLINE;
      return ctx.reply("📍 Qadam <b>11/12</b>\n\n⏳ Muddat (YYYY-MM-DD HH:mm yoki /skip):", {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }

    // ---------- 11. MUDDAT ----------
    if (s === STATES.TOUR_CREATE_DEADLINE) {
      const v = cleanText(ctx.message.text, 20);
      if (v.toLowerCase() !== '/skip') {
        const [d, tm] = v.split(' ');
        if (isValidDate(d) && isValidTime(tm)) {
          ctx.session.data.registrationDeadline = parseDateTime(d, tm).toISOString();
        } else {
          return ctx.reply('❗ Format: YYYY-MM-DD HH:mm yoki /skip:', {
            reply_markup: backToMain().reply_markup,
          });
        }
      }
      ctx.session.state = STATES.TOUR_CREATE_HOST;
      return sendHostPicker(ctx);
    }

    return next();
  });

  // ============================================================
  // 10. RASM QABUL QILISH
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s === STATES.TOUR_CREATE_IMAGE) {
      ctx.session.data.imageFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.session.state = STATES.TOUR_CREATE_DATE;
      return ctx.reply('📍 Qadam <b>3/12</b>\n\n📅 Sana (YYYY-MM-DD):', {
        parse_mode: 'HTML',
        reply_markup: backToMain().reply_markup,
      });
    }
    return next();
  });

  // ============================================================
  // 11. TURNIR ID MATN SIFATIDA YUBORILGANDA
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state) return next();

    const text = (ctx.message.text || '').trim();
    const match = text.match(/^(tour_[a-z0-9]+)$/i);
    if (!match) return next();

    const t = await tournamentService.getTournament(match[1]);
    if (!t) {
      return ctx.reply(
        `❗ <b>Bunday ID bilan turnir topilmadi.</b>\n\n` +
          `Yuborilgan ID: <code>${escapeHtml(text)}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: backToMain().reply_markup,
        }
      );
    }

    // Ro'yxatdan o'tganmi?
    const user = await userService.getUser(ctx.from.id);
    const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
    const isRegistered = team && t.registeredTeams.includes(team.id);

    const summary = formatTournamentText(t, true);
    const buttons = [
      [Markup.button.callback('📊 Natijalar', CALLBACK.TOUR_STANDINGS + t.id)],
      [Markup.button.callback("📋 Komandalar ro'yxati", CALLBACK.TOUR_TEAMLIST + t.id)],
      [Markup.button.callback("📝 Ro'yxatdan o'tish", CALLBACK.TOUR_REGISTER + t.id)],
    ];

    // Room info tugmasi
    if (isRegistered) {
      if (t.roomId && t.roomPassword) {
        buttons.push([
          Markup.button.callback('🔑 Room ma\'lumotlari', 'tour:room_info:' + t.id),
        ]);
      } else {
        buttons.push([
          Markup.button.callback('⏳ Room ma\'lumotlari (kuting)', 'tour:room_info:' + t.id),
        ]);
      }
    }

    buttons.push([Markup.button.callback('💬 Hostga yozish', CALLBACK.TOUR_CONTACT_HOST + t.id)]);
    buttons.push([Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)]);

    if (t.imageFileId) {
      try {
        return ctx.replyWithPhoto(t.imageFileId, {
          caption: summary,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (e) { /* rasm yo'q */ }
    }

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  });

  // ============================================================
  // 12. TURNIRNI TAHRIRLASH
  // ============================================================
  bot.action(/^tour:edit:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🏆 Nom', 'tour:editf:' + tId + ':title')],
      [Markup.button.callback('📅 Sana', 'tour:editf:' + tId + ':date')],
      [Markup.button.callback('⏰ Vaqt', 'tour:editf:' + tId + ':time')],
      [Markup.button.callback('💲 PRIZ', 'tour:editf:' + tId + ':prize')],
      [Markup.button.callback('♾️ MAP', 'tour:editf:' + tId + ':mapTag')],
      [Markup.button.callback('⭐️ Etap', 'tour:editf:' + tId + ':etapa')],
      [Markup.button.callback('📄 Izoh', 'tour:editf:' + tId + ':desc')],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + tId)],
    ]);

    await safeEdit(
      ctx,
      `✏️ <b>Turnirni tahrirlash</b>\n\n` +
        `🏆 Nom: <b>${escapeHtml(t.title)}</b>\n` +
        `📅 Sana: <b>${t.date}</b>\n` +
        `⏰ Vaqt: <b>${t.startTime}</b>\n` +
        `💲 PRIZ: <b>${escapeHtml(t.prize || '-')}</b>\n` +
        `♾️ MAP: <b>${escapeHtml(t.mapTag || '-')}</b>\n` +
        `⭐️ Etap: <b>${escapeHtml(t.etapa || '-')}</b>\n\n` +
        `👇 Nimani o'zgartirmoqchisiz?`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action(/^tour:editf:(.+):(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const field = ctx.match[2];

    const prompts = {
      title: '🏆 Yangi nomni kiriting:',
      date: '📅 Yangi sanani kiriting (YYYY-MM-DD):',
      time: '⏰ Yangi vaqtni kiriting (HH:mm):',
      prize: '💲 Yangi PRIZ ni kiriting:',
      mapTag: '♾️ Yangi MAP ni kiriting:',
      etapa: '⭐️ Yangi Etap ni kiriting:',
      desc: '📄 Yangi izohni kiriting:',
    };

    const prompt = prompts[field];
    if (!prompt) return ctx.reply("❗ Noto'g'ri maydon.");

    ctx.session = { state: 'tour_edit_field', data: { tid: tId, field } };

    await ctx.reply(prompt, {
      reply_markup: backToTournament(tId).reply_markup,
    });
  });

  // ============================================================
  // 13. FSM — TURNIR TAHRIRLASH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'tour_edit_field') return next();

    const { tid, field } = ctx.session.data;
    const t = await tournamentService.getTournament(tid);
    if (!t) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('❗ Turnir topilmadi.');
    }

    const v = cleanText(ctx.message.text, 200);
    const patch = {};

    if (field === 'title') {
      if (v.length < 3) return ctx.reply('❗ Nom juda qisqa:');
      patch.title = v;
    } else if (field === 'date') {
      if (!isValidDate(v)) return ctx.reply('❗ Format: YYYY-MM-DD:');
      patch.date = v;
    } else if (field === 'time') {
      if (!isValidTime(v)) return ctx.reply('❗ Format: HH:mm:');
      patch.startTime = v;
    } else if (field === 'prize') {
      patch.prize = v;
    } else if (field === 'mapTag') {
      patch.mapTag = v;
    } else if (field === 'etapa') {
      patch.etapa = v;
    } else if (field === 'desc') {
      patch.description = v;
    } else {
      ctx.session = { state: null, data: {} };
      return ctx.reply("❗ Noto'g'ri maydon.");
    }

    await tournamentService.updateTournament(tid, patch);
    ctx.session = { state: null, data: {} };

    await ctx.reply(
      `✅ <b>Muvaffaqiyatli o'zgartirildi!</b>\n\n` +
        `🏆 <b>${escapeHtml(t.title)}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: backToTournament(tid).reply_markup,
      }
    );
  });
};

// ============================================================
// YORDAMCHI: TURNIRLAR RO'YXATI (pagination)
// ============================================================
async function showTournamentList(ctx, key, page) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();

  let list = [];
  let sectionName = '';
  let sectionEmoji = '';
  let sectionKey = '';

  if (key === CALLBACK.TOUR_TODAY) {
    list = all.filter((t) => {
      const d = parseDateTime(t.date, t.startTime);
      return d && isSameDayTashkent(d, now);
    });
    sectionName = 'Bugungi turnirlar';
    sectionEmoji = '📅';
    sectionKey = 'today';
  } else if (key === CALLBACK.TOUR_UPCOMING) {
    list = all.filter((t) => {
      const d = parseDateTime(t.date, t.startTime);
      return d && d > now && !isSameDayTashkent(d, now);
    });
    sectionName = 'Kelgusi turnirlar';
    sectionEmoji = '⏭';
    sectionKey = 'upcoming';
  } else {
    list = all.filter((t) => {
      const d = parseDateTime(t.date, t.startTime);
      return d && d < now;
    });
    sectionName = 'Tugagan turnirlar';
    sectionEmoji = '✅';
    sectionKey = 'finished';
  }

  list.sort((a, b) => {
    const da = parseDateTime(a.date, a.startTime) || new Date(0);
    const db = parseDateTime(b.date, b.startTime) || new Date(0);
    return sectionKey === 'finished' ? db - da : da - db;
  });

  if (!list.length) {
    return safeEdit(
      ctx,
      `${sectionEmoji} <b>${sectionName}</b>\n\n📭 Bu bo'limda turnir yo'q.`,
      backToList()
    );
  }

  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = currentPage * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const lines = [];
  lines.push(`${sectionEmoji} <b>${sectionName}</b>`);
  lines.push(`📊 Jami: <b>${list.length}</b> ta | Sahifa: <b>${currentPage + 1}/${totalPages}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  pageItems.forEach((t, i) => {
    const num = start + i + 1;
    const regStatus =
      t.registeredTeams.length >= t.maxTeams
        ? '🔴'
        : t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
        ? '⚫️'
        : '🟢';

    lines.push(
      `<b>${num}. ${escapeHtml(t.title)}</b>\n` +
        `   📅 ${t.date} | ⏰ ${t.startTime}\n` +
        `   🎮 ${escapeHtml(t.mode)} | 👥 ${t.registeredTeams.length}/${t.maxTeams} ${regStatus}`
    );
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('💡 <i>Turnirni ochish uchun pastdagi tugmani bosing</i>');

  const buttons = [];
  pageItems.forEach((t, i) => {
    const num = start + i + 1;
    const title = t.title.length > 30 ? t.title.slice(0, 27) + '...' : t.title;
    buttons.push([
      Markup.button.callback(`🔍 ${num}. ${title}`, CALLBACK.TOUR_OPEN + t.id),
    ]);
  });

  const paginationRow = [];
  if (currentPage > 0) {
    paginationRow.push(
      Markup.button.callback('⬅️ Oldingi', `tour:page:${sectionKey}:${currentPage - 1}`)
    );
  }
  if (currentPage < totalPages - 1) {
    paginationRow.push(
      Markup.button.callback('Keyingi ➡️', `tour:page:${sectionKey}:${currentPage + 1}`)
    );
  }
  if (paginationRow.length) buttons.push(paginationRow);

  buttons.push([Markup.button.callback('⬅️ Turnirlar menyusi', CALLBACK.MENU_TOURNAMENTS)]);
  buttons.push([Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)]);

  const text = lines.join('\n');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e) {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

// ============================================================
// YORDAMCHI: HOST TANLASH
// ============================================================
async function sendHostPicker(ctx) {
  const hosts = await roleService.list('host');

  if (!hosts.length) {
    ctx.session.state = STATES.TOUR_CREATE_CONFIRM;
    ctx.session.data.hostId = null;
    const summary = await buildConfirmSummary(ctx.session.data);
    return ctx.reply(
      `⚠️ <i>Hostlar ro'yxati bo'sh. Host biriktirilmadi.</i>\n\n` + summary,
      { parse_mode: 'HTML', ...confirmTournament() }
    );
  }

  const rows = hosts.slice(0, 10).map((h) => [
    Markup.button.callback(`🎙 Host ID: ${h.id}`, CALLBACK.TOUR_PICK_HOST + 'host_' + h.id),
  ]);
  rows.push([Markup.button.callback('⏭ Hostsiz davom etish', 'tour:ph:skip')]);
  rows.push([Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)]);

  await ctx.reply(
    `📍 Qadam <b>12/12</b>\n\n` +
      `🎙 <b>Turnirga host biriktirish</b>\n\n` +
      `Quyidagi hostlardan birini tanlang yoki hostsiz davom eting:`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    }
  );
}

// ============================================================
// YORDAMCHI: TASDIQLASH XULOSASI
// ============================================================
async function buildConfirmSummary(d) {
  let hostName = "❌ yo'q";
  if (d.hostId) {
    const host = await userService.getUser(d.hostId);
    hostName = host ? `🎙 ${escapeHtml(displayName(host))}` : `ID: ${d.hostId}`;
  }

  return (
    `╔══════════════════════╗\n` +
    `   📋 <b>TASDIQLASH</b>\n` +
    `╚══════════════════════╝\n\n` +
    `🏆 Nom: <b>${escapeHtml(d.title)}</b>\n` +
    `🖼 Rasm: <b>${d.imageFileId ? '✅' : "yo'q"}</b>\n` +
    `📅 Sana: <b>${d.date}</b>\n` +
    `⏰ Vaqt: <b>${d.startTime}</b>\n` +
    `🎮 Rejim: <b>${escapeHtml(d.mode)}</b>\n` +
    `💲 PRIZ: <b>${escapeHtml(d.prize || '-')}</b>\n` +
    `♾️ MAP: <b>${escapeHtml(d.mapTag || '-')}</b>\n` +
    `⭐️ Etap: <b>${escapeHtml(d.etapa || '-')}</b>\n` +
    `👥 Maks. komandalar: <b>${d.maxTeams}</b>\n` +
    `📄 Izoh: ${escapeHtml(d.description || '-')}\n` +
    `🎙 Host: ${hostName}`
  );
}

// ============================================================
// YORDAMCHI: TURNIR MATNI
// ============================================================
function formatTournamentText(t, detailed = false) {
  const regStatus =
    t.registeredTeams.length >= t.maxTeams
      ? "🔴 To'lgan"
      : t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
      ? "🔴 Yopilgan"
      : '🟢 Ochiq';

  const lines = [
    `🏆 <b>${escapeHtml(t.title)}</b>`,
    `📅 Sana: <b>${t.date}</b>`,
    `⏰ Vaqt: <b>${t.startTime}</b> (${t.timezone})`,
    `🎮 Rejim: <b>${escapeHtml(t.mode)}</b> | 🗺 <b>${escapeHtml(t.map || DEFAULT_MAP)}</b>`,
  ];

  if (t.prize) lines.push(`💲 PRIZ: <b>${escapeHtml(t.prize)}</b>`);
  if (t.mapTag) lines.push(`♾️ MAP: <b>${escapeHtml(t.mapTag)}</b>`);
  if (t.etapa) lines.push(`⭐️ Etap: <b>${escapeHtml(t.etapa)}</b>`);

  lines.push(`👥 Komandalar: <b>${t.registeredTeams.length}/${t.maxTeams}</b>`);
  lines.push(`📝 Ro'yxatdan o'tish: <b>${regStatus}</b>`);
  lines.push(`🎙 Host: <b>${t.hostId ? 'biriktirilgan ✅' : "yo'q"}</b>`);

  if (detailed && t.description) {
    lines.push(`\n📄 ${escapeHtml(t.description)}`);
  }
  if (detailed) {
    lines.push(`\n🆔 ID: <code>${t.id}</code>`);
  }

  return lines.join('\n');
}