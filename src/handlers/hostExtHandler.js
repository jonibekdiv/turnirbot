// Host handler — Room saqlanganda avtomatik xabar yuboradi
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const roleService = require('../services/roleService');
const messageRelayService = require('../services/messageRelayService');
const broadcastService = require('../services/broadcastService');
const matchService = require('../services/matchService');
const pointsService = require('../services/pointsService');
const roomNotifyService = require('../services/roomNotifyService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { mainKeyboard } = require('../keyboards/mainKeyboard');

// ============================================================
// YORDAMCHI: ORQAGA TUGMALARI
// ============================================================
function backToHostTours() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirlarim', CALLBACK.HOST_TOURS)],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

function backToHostOpen(tid) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnir boshqaruviga', CALLBACK.HOST_OPEN + tid)],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. HOST PANEL — TURNIRLAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.HOST_TOURS, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.HOST) {
      return ctx.reply("⛔ Ruxsat yo'q.", {
        reply_markup: backToHostTours().reply_markup,
      });
    }
    const all = await tournamentService.getAllTournaments();
    const mine = all.filter((t) => Number(t.hostId) === Number(ctx.from.id));

    if (!mine.length) {
      return safeEdit(ctx, "📭 Sizga hali turnir biriktirilmagan.", mainKeyboard(ctx.state.role));
    }

    const rows = mine.map((t) => [
      Markup.button.callback(`🎯 ${t.title.slice(0, 30)}`, CALLBACK.HOST_OPEN + t.id),
    ]);
    rows.push([Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)]);

    await safeEdit(ctx, "🎙 <b>Host panel</b>\n\nTurnirni tanlang:", {
      reply_markup: { inline_keyboard: rows },
    });
  });

  // ============================================================
  // 2. TURNIR BOSHQARUV PANELI
  // ============================================================
  bot.action(/^host:open:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      return ctx.reply("⛔ Ruxsat yo'q.", {
        reply_markup: backToHostTours().reply_markup,
      });
    }

    const matchData = await matchService.getTournamentMatches(t.id);
    const matchCount = matchData.matches.length;

    const roomStatus =
      t.roomId && t.roomPassword
        ? '✅ tayyor'
        : t.roomId || t.roomPassword
        ? '⚠️ qisman'
        : "❌ yo'q";

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Natijalar / Kartalar', CALLBACK.HOST_RESULTS + t.id)],
      [Markup.button.callback('🆔 Room ID yuborish', CALLBACK.HOST_ROOM_ID + t.id)],
      [Markup.button.callback('🔒 Room Password yuborish', CALLBACK.HOST_ROOM_PASS + t.id)],
      [Markup.button.callback('📨 ID va parolni birga yuborish', CALLBACK.HOST_ROOM_BOTH + t.id)],
      [Markup.button.callback('📤 Room info qayta yuborish', 'host:room_resend:' + t.id)],
      [Markup.button.callback('💬 Ishtirokchilarga xabar', CALLBACK.HOST_MSG + t.id)],
      [Markup.button.callback('⬅️ Turnirlarim', CALLBACK.HOST_TOURS)],
      [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
    ]);

    await safeEdit(
      ctx,
      `🎯 <b>${escapeHtml(t.title)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👥 Komandalar: <b>${t.registeredTeams.length}/${t.maxTeams}</b>\n` +
        `🎮 Kartalar: <b>${matchCount}</b>\n` +
        `🆔 Room ID: <code>${escapeHtml(t.roomId || '-')}</code>\n` +
        `🔒 Room Pass: <code>${escapeHtml(t.roomPassword || '-')}</code>\n` +
        `📤 Yuborilgan: <b>${roomStatus}</b>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 3. ROOM INFO QAYTA YUBORISH (yangi tugma)
  // ============================================================
  bot.action(/^host:room_resend:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    if (!t.roomId || !t.roomPassword) {
      return ctx.reply(
        "❗ Avval Room ID va Parolni to'liq kiriting!",
        { reply_markup: backToHostOpen(tId).reply_markup }
      );
    }

    if (!t.registeredTeams.length) {
      return ctx.reply("❗ Turnirda hali komandalar yo'q.", {
        reply_markup: backToHostOpen(tId).reply_markup,
      });
    }

    const progressMsg = await ctx.reply('⏳ Yuborilmoqda...');

    try {
      const res = await roomNotifyService.sendRoomInfo(bot, t, { isUpdate: true });

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `✅ <b>Qayta yuborildi!</b>\n\n` +
          `📤 Yuborildi: <b>${res.sent}</b>\n` +
          `❌ Xato: <b>${res.failed}</b>\n` +
          `👥 Jami: <b>${res.total}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: backToHostOpen(tId).reply_markup,
        }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        '❌ Xatolik: ' + (e.message || 'xato'),
        { reply_markup: backToHostOpen(tId).reply_markup }
      );
    }
  });

  // ============================================================
  // 4. ROOM ID/PASS/IKKISI — BOSHLASH
  // ============================================================
  bot.action(/^host:(rid|rpass|rboth):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const kind = ctx.match[1];
    const tId = ctx.match[2];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    const backKb = backToHostOpen(tId).reply_markup;

    if (kind === 'rid') {
      ctx.session = { state: STATES.HOST_SEND_ROOM_ID, data: { tid: tId } };
      return ctx.reply(
        `🆔 <b>Room ID ni kiriting:</b>\n\n` +
          `<i>Masalan: 8734521</i>`,
        { parse_mode: 'HTML', reply_markup: backKb }
      );
    }
    if (kind === 'rpass') {
      ctx.session = { state: STATES.HOST_SEND_ROOM_PASS, data: { tid: tId } };
      return ctx.reply(
        `🔒 <b>Room Password ni kiriting:</b>\n\n` +
          `<i>Masalan: pubg2025</i>`,
        { parse_mode: 'HTML', reply_markup: backKb }
      );
    }
    ctx.session = { state: STATES.HOST_SEND_ROOM_BOTH, data: { tid: tId } };
    return ctx.reply(
      `📨 <b>Room ID va Parolni birga yuboring</b>\n\n` +
        `Format:\n` +
        `<code>ID: 8734521\nPASS: pubg2025</code>\n\n` +
        `<i>Yoki bir qatorda:</i>\n` +
        `<code>ID:8734521 PASS:pubg2025</code>`,
      { parse_mode: 'HTML', reply_markup: backKb }
    );
  });

  // ============================================================
  // 5. NATIJALAR MENYUSI
  // ============================================================
  bot.action(/^host:res:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    const matchData = await matchService.getTournamentMatches(t.id);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("➕ Yangi karta qo'shish", CALLBACK.HOST_MATCH_NEW + t.id)],
      [Markup.button.callback(`📋 Kartalar (${matchData.matches.length})`, CALLBACK.HOST_MATCH_LIST + t.id)],
      [Markup.button.callback('🏆 Joriy natijalar', CALLBACK.HOST_STANDINGS + t.id)],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.HOST_OPEN + t.id)],
      [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
    ]);

    await safeEdit(
      ctx,
      `📊 <b>Natijalar — ${escapeHtml(t.title)}</b>\n\n` +
        `🎮 Kartalar: <b>${matchData.matches.length}</b>\n` +
        `👥 Komandalar: <b>${t.registeredTeams.length}</b>\n\n` +
        `👇 Amalni tanlang:`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 6. XABAR TARQATISH (host → ishtirokchilar)
  // ============================================================
  bot.action(/^host:msg:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    ctx.session = { state: STATES.HOST_SEND_BROADCAST, data: { tid: tId } };
    await ctx.reply(
      "💬 <b>Xabar yuboring</b>\n\nMatn yoki rasm yuboring (caption bilan):",
      {
        parse_mode: 'HTML',
        reply_markup: backToHostOpen(tId).reply_markup,
      }
    );
  });

  // ============================================================
  // 7. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('host_')) return next();

    const tid = ctx.session.data.tid;
    const t = await tournamentService.getTournament(tid);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("⛔ Ruxsat yo'q.", backToHostTours());
    }

    // ---------- ROOM ID SAQLASH ----------
    if (s === STATES.HOST_SEND_ROOM_ID) {
      const v = cleanText(ctx.message.text, 40);
      if (!v) {
        return ctx.reply('❗ Room ID kiriting:', backToHostOpen(tid));
      }

      await tournamentService.setRoom(tid, { roomId: v });
      const updated = await tournamentService.getTournament(tid);
      ctx.session = { state: null, data: {} };

      // Ikkalasi ham bor bo'lsa — avtomatik yuborish
      if (updated.roomPassword) {
        return await autoSendRoomInfo(ctx, bot, updated, 'ID saqlandi');
      }

      return ctx.reply(
        `✅ <b>Room ID saqlandi!</b>\n\n` +
          `🆔 <code>${escapeHtml(v)}</code>\n\n` +
          `<i>Parolni ham kiriting — keyin avtomatik o'yinchilarga yuboriladi.</i>`,
        { parse_mode: 'HTML', reply_markup: backToHostOpen(tid).reply_markup }
      );
    }

    // ---------- ROOM PASS SAQLASH ----------
    if (s === STATES.HOST_SEND_ROOM_PASS) {
      const v = cleanText(ctx.message.text, 40);
      if (!v) {
        return ctx.reply('❗ Parol kiriting:', backToHostOpen(tid));
      }

      await tournamentService.setRoom(tid, { roomPassword: v });
      const updated = await tournamentService.getTournament(tid);
      ctx.session = { state: null, data: {} };

      // Ikkalasi ham bor bo'lsa — avtomatik yuborish
      if (updated.roomId) {
        return await autoSendRoomInfo(ctx, bot, updated, 'Parol saqlandi');
      }

      return ctx.reply(
        `✅ <b>Parol saqlandi!</b>\n\n` +
          `🔒 <code>${escapeHtml(v)}</code>\n\n` +
          `<i>Room ID ni ham kiriting — keyin avtomatik o'yinchilarga yuboriladi.</i>`,
        { parse_mode: 'HTML', reply_markup: backToHostOpen(tid).reply_markup }
      );
    }

    // ---------- ROOM BOTH SAQLASH ----------
    if (s === STATES.HOST_SEND_ROOM_BOTH) {
      const text = ctx.message.text;
      const idMatch = text.match(/ID[:=\s]+([^\s\n]+)/i);
      const passMatch = text.match(/PASS(?:WORD)?[:=\s]+([^\s\n]+)/i);

      if (!idMatch || !passMatch) {
        return ctx.reply(
          '❗ Format: <code>ID:xxxx PASS:yyyy</code>\n\nQayta kiriting:',
          { parse_mode: 'HTML', reply_markup: backToHostOpen(tid).reply_markup }
        );
      }

      const roomId = cleanText(idMatch[1], 40);
      const roomPassword = cleanText(passMatch[1], 40);

      await tournamentService.setRoom(tid, { roomId, roomPassword });
      const updated = await tournamentService.getTournament(tid);
      ctx.session = { state: null, data: {} };

      return await autoSendRoomInfo(ctx, bot, updated, 'ID va parol saqlandi');
    }

    // ---------- BROADCAST (host → ishtirokchilar) ----------
    if (s === STATES.HOST_SEND_BROADCAST) {
      const text = cleanText(ctx.message.text, 2000);
      ctx.session = { state: null, data: {} };

      const res = await broadcastService.sendToTournamentParticipants(bot, t, teamService, {
        text: `📣 <b>${escapeHtml(t.title)}</b>\n\n${escapeHtml(text)}`,
      });

      return ctx.reply(
        `✅ <b>Xabar yuborildi</b>\n\n` +
          `📤 Yuborildi: <b>${res.sent}</b>\n` +
          `❌ Xato: <b>${res.failed}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: backToHostOpen(tid).reply_markup,
        }
      );
    }

    return next();
  });

  // ============================================================
  // 8. FSM — RASM (broadcast)
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.HOST_SEND_BROADCAST) return next();

    const tid = ctx.session.data.tid;
    const t = await tournamentService.getTournament(tid);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = ctx.message.caption
      ? cleanText(ctx.message.caption, LIMITS.MAX_CAPTION_LEN)
      : '';

    ctx.session = { state: null, data: {} };

    const res = await broadcastService.sendToTournamentParticipants(bot, t, teamService, {
      text: `📣 <b>${escapeHtml(t.title)}</b>${caption ? '\n\n' + escapeHtml(caption) : ''}`,
      image: fileId,
    });

    await ctx.reply(
      `✅ <b>Rasm yuborildi</b>\n\n` +
        `📤 Yuborildi: <b>${res.sent}</b>\n` +
        `❌ Xato: <b>${res.failed}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: backToHostOpen(tid).reply_markup,
      }
    );
  });

  // ============================================================
  // 9. O'YINCHI → HOST XABAR YUBORISH
  // ============================================================
  bot.action(/^tour:contact_host:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply("❗ Avval komandaga qo'shiling.");
    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply('❗ Komanda topilmadi.');
    if (!t.registeredTeams.includes(team.id)) {
      return ctx.reply("❗ Komandangiz ro'yxatdan o'tmagan.");
    }
    if (!t.hostId) return ctx.reply("❗ Bu turnirga host biriktirilmagan.");

    ctx.session = {
      state: STATES.PLAYER_SEND_TO_HOST,
      data: { tid: tId, teamId: team.id },
    };

    await ctx.reply(
      "✉️ <b>Hostga xabar yuboring</b>\n\nMatn yoki rasm yuboring:",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("⬅️ Turnirga qaytish", CALLBACK.TOUR_OPEN + tId)],
          ],
        },
      }
    );
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PLAYER_SEND_TO_HOST) return next();

    const { tid, teamId } = ctx.session.data;
    const t = await tournamentService.getTournament(tid);
    const team = await teamService.getTeam(teamId);
    ctx.session = { state: null, data: {} };

    if (!t || !team) return ctx.reply('❗ Xatolik.');

    try {
      await messageRelayService.relayToHost(bot, {
        fromUser: ctx.from,
        tournament: t,
        team,
        playerNumber: team.members.indexOf(ctx.from.id) + 1,
        message: ctx.message,
      });
      await ctx.reply('✅ Xabar hostga yuborildi.', {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("⬅️ Turnirga qaytish", CALLBACK.TOUR_OPEN + tid)],
          ],
        },
      });
    } catch (e) {
      await ctx.reply('❌ ' + (e.message || 'xato'));
    }
  });

  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PLAYER_SEND_TO_HOST) return next();

    const { tid, teamId } = ctx.session.data;
    const t = await tournamentService.getTournament(tid);
    const team = await teamService.getTeam(teamId);
    ctx.session = { state: null, data: {} };

    if (!t || !team) return ctx.reply('❗ Xatolik.');

    try {
      await messageRelayService.relayToHost(bot, {
        fromUser: ctx.from,
        tournament: t,
        team,
        playerNumber: team.members.indexOf(ctx.from.id) + 1,
        message: ctx.message,
      });
      await ctx.reply('✅ Rasm hostga yuborildi.', {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("⬅️ Turnirga qaytish", CALLBACK.TOUR_OPEN + tid)],
          ],
        },
      });
    } catch (e) {
      await ctx.reply('❌ ' + (e.message || 'xato'));
    }
  });
};

// ============================================================
// AVTOMATIK YUBORISH — Ikkala ma'lumot saqlanganda
// ============================================================
async function autoSendRoomInfo(ctx, bot, tournament, savedText) {
  const tid = tournament.id;

  if (!tournament.registeredTeams.length) {
    return ctx.reply(
      `✅ <b>${savedText}!</b>\n\n` +
        `<i>Turnirda hali komandalar yo'q. Ular qo'shilgach, Room ma'lumotlarini qayta yuboring.</i>`,
      { parse_mode: 'HTML', reply_markup: backToHostOpen(tid).reply_markup }
    );
  }

  const progressMsg = await ctx.reply(
    `✅ <b>${savedText}!</b>\n\n` +
      `⏳ O'yinchilarga yuborilmoqda...`,
    { parse_mode: 'HTML' }
  );

  try {
    const res = await roomNotifyService.sendRoomInfo(bot, tournament, { isUpdate: false });

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      progressMsg.message_id,
      null,
      `╔══════════════════════╗\n` +
        `   ✅ <b>SAQLANDI VA YUBORILDI!</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🆔 Room ID: <code>${escapeHtml(tournament.roomId)}</code>\n` +
        `🔒 Parol: <code>${escapeHtml(tournament.roomPassword)}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📤 Yuborildi: <b>${res.sent}</b> o'yinchiga\n` +
        `❌ Xato: <b>${res.failed}</b>\n` +
        `👥 Jami: <b>${res.total}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: backToHostOpen(tid).reply_markup,
      }
    );
  } catch (e) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      progressMsg.message_id,
      null,
      `⚠️ <b>${savedText}, lekin yuborishda xatolik</b>\n\n${e.message}`,
      {
        parse_mode: 'HTML',
        reply_markup: backToHostOpen(tid).reply_markup,
      }
    );
  }
}