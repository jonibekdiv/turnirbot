const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const roleService = require('../services/roleService');
const messageRelayService = require('../services/messageRelayService');
const broadcastService = require('../services/broadcastService');
const matchService = require('../services/matchService');
const pointsService = require('../services/pointsService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');
const { mainKeyboard } = require('../keyboards/mainKeyboard');

module.exports = (bot) => {
  // ============================================================
  // 1. HOST PANEL — TURNIRLAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.HOST_TOURS, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.HOST) return ctx.reply('⛔ Ruxsat yo\'q.');
    const all = await tournamentService.getAllTournaments();
    const mine = all.filter((t) => Number(t.hostId) === Number(ctx.from.id));
    if (!mine.length) {
      return safeEdit(ctx, '📭 Sizga hali turnir biriktirilmagan.', mainKeyboard(ctx.state.role));
    }
    const rows = mine.map((t) => [
      Markup.button.callback(`🎯 ${t.title.slice(0, 30)}`, CALLBACK.HOST_OPEN + t.id),
    ]);
    rows.push([Markup.button.callback('⬅️ Asosiy menyu', CALLBACK.MENU_MAIN)]);
    await safeEdit(ctx, '🎙 <b>Host panel</b>\n\nTurnirni tanlang:', {
      reply_markup: { inline_keyboard: rows },
    });
  });

  // ============================================================
  // 2. TURNIR BOSHQARUV PANELI
  // ============================================================
  bot.action(/^host:open:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.');

    const matchData = await matchService.getTournamentMatches(t.id);
    const matchCount = matchData.matches.length;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Natijalar / Kartalar', CALLBACK.HOST_RESULTS + t.id)],
      [Markup.button.callback('🆔 Room ID yuborish', CALLBACK.HOST_ROOM_ID + t.id)],
      [Markup.button.callback('🔒 Room Password yuborish', CALLBACK.HOST_ROOM_PASS + t.id)],
      [Markup.button.callback('📨 ID va parolni birga', CALLBACK.HOST_ROOM_BOTH + t.id)],
      [Markup.button.callback('💬 Ishtirokchilarga xabar', CALLBACK.HOST_MSG + t.id)],
      [Markup.button.callback('⬅️ Orqaga', CALLBACK.HOST_TOURS)],
    ]);

    await safeEdit(
      ctx,
      `🎯 <b>${escapeHtml(t.title)}</b>\n` +
        `👥 Komandalar: <b>${t.registeredTeams.length}/${t.maxTeams}</b>\n` +
        `🎮 Kartalar: <b>${matchCount}</b>\n` +
        `🆔 Room ID: <code>${escapeHtml(t.roomId || '-')}</code>\n` +
        `🔒 Room Pass: <code>${escapeHtml(t.roomPassword || '-')}</code>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 3. NATIJALAR MENYUSI
  // ============================================================
  bot.action(/^host:res:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.');

    const matchData = await matchService.getTournamentMatches(t.id);
    const count = matchData.matches.length;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Yangi karta qo\'shish', CALLBACK.HOST_MATCH_NEW + t.id)],
      [Markup.button.callback(`📋 Kartalar ro'yxati (${count})`, CALLBACK.HOST_MATCH_LIST + t.id)],
      [Markup.button.callback('🏆 Joriy natijalar', CALLBACK.HOST_STANDINGS + t.id)],
      [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.HOST_OPEN + t.id)],
    ]);

    await safeEdit(
      ctx,
      `📊 <b>Natijalar — ${escapeHtml(t.title)}</b>\n\n` +
        `🎮 Kartalar: <b>${count}</b>\n` +
        `👥 Komandalar: <b>${t.registeredTeams.length}</b>\n\n` +
        `👇 Amalni tanlang:`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 4. YANGI KARTA — BOSHLASH
  // ============================================================
  bot.action(/^host:mn:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.');

    if (!t.registeredTeams.length) {
      return ctx.reply('❗ Turnirda hali komandalar yo\'q.');
    }

    // Komandalar ro'yxatini tayyorlash
    const teams = [];
    for (const tid of t.registeredTeams) {
      const team = await teamService.getTeam(tid);
      if (team) teams.push(team);
    }

    ctx.session = {
      state: STATES.HOST_MATCH_INPUT,
      data: { tid: t.id },
    };

    const teamLines = teams
      .map((team, i) => `${i + 1}. <b>${escapeHtml(team.tag)}</b> — ${escapeHtml(team.name)}`)
      .join('\n');

    await ctx.reply(
      `🎮 <b>Yangi karta — ${escapeHtml(t.title)}</b>\n\n` +
        `📋 <b>Komandalar (${teams.length}):</b>\n\n${teamLines}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>Natijalarni yuboring</b> (har qatorda):\n\n` +
        `<code>TAG - KILL</code>\n\n` +
        `<b>Tartib = o'rin</b> (1-chi qator = 1-o'rin, 2-chi qator = 2-o'rin, ...)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <b>Misol:</b>\n` +
        `<code>UP - 5\nN1 - 3\nS7 - 2\nFOOL - 1</code>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 5. KARTA TASDIQLASH
  // ============================================================
  bot.action(/^host:mc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.');

    const results = ctx.session?.data?.pendingResults;
    if (!results) return ctx.reply('❗ Ma\'lumot yo\'q. Qaytadan boshlang.');

    try {
      const match = await matchService.addMatch(t.id, results, ctx.from.id);
      ctx.session = { state: null, data: {} };

      // Komandalar map
      const teamsMap = {};
      for (const tid of t.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teamsMap[tid] = team;
      }

      const cardText = pointsService.formatMatchCard(match, teamsMap);

      // Ishtirokchilarga xabar
      let sent = 0;
      for (const tid of t.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (!team) continue;
        for (const uid of team.members) {
          try {
            await ctx.telegram.sendMessage(
              uid,
              `📊 <b>${escapeHtml(t.title)}</b>\n\n${cardText}`,
              { parse_mode: 'HTML' }
            );
            sent++;
          } catch (e) { /* bloklangan */ }
        }
      }

      await ctx.reply(
        `✅ <b>Karta №${match.number} saqlandi!</b>\n\n` +
          `📤 <i>${sent} o'yinchiga yuborildi</i>`,
        { parse_mode: 'HTML' }
      );

      // Natijalar menyusiga qaytamiz
      const matchData = await matchService.getTournamentMatches(t.id);
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Yana karta qo\'shish', CALLBACK.HOST_MATCH_NEW + t.id)],
        [Markup.button.callback(`📋 Kartalar (${matchData.matches.length})`, CALLBACK.HOST_MATCH_LIST + t.id)],
        [Markup.button.callback('🏆 Joriy natijalar', CALLBACK.HOST_STANDINGS + t.id)],
        [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.HOST_OPEN + t.id)],
      ]);
      await ctx.reply('👇 Keyingi amal:', { reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });

  // ============================================================
  // 6. KARTALAR RO'YXATI
  // ============================================================
  bot.action(/^host:ml:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');

    const matchData = await matchService.getTournamentMatches(t.id);
    if (!matchData.matches.length) {
      return ctx.reply('📭 Hozircha kartalar yo\'q.');
    }

    const rows = matchData.matches.map((m) => [
      Markup.button.callback(
        `🎮 Karta №${m.number} — ${m.results.length} komanda`,
        CALLBACK.HOST_MATCH_VIEW + t.id + ':' + m.id
      ),
    ]);
    rows.push([Markup.callback ? Markup.button.callback('⬅️ Orqaga', CALLBACK.HOST_RESULTS + t.id) : null].filter(Boolean));

    await ctx.reply(
      `📋 <b>Kartalar (${matchData.matches.length})</b>\n\nOchish uchun tanlang:`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
    );
  });

  // ============================================================
  // 7. KARTANI KO'RISH
  // ============================================================
  bot.action(/^host:mv:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const mId = ctx.match[2];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');

    const match = await matchService.getMatch(tId, mId);
    if (!match) return ctx.reply('❗ Karta topilmadi.');

    const teamsMap = {};
    for (const tid of t.registeredTeams) {
      const team = await teamService.getTeam(tid);
      if (team) teamsMap[tid] = team;
    }

    const cardText = pointsService.formatMatchCard(match, teamsMap);
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🗑 Kartani o\'chirish', CALLBACK.HOST_MATCH_DELETE + tId + ':' + mId)],
      [Markup.button.callback('⬅️ Kartalar', CALLBACK.HOST_MATCH_LIST + tId)],
    ]);

    await ctx.reply(cardText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 8. KARTANI O'CHIRISH — TASDIQLASH
  // ============================================================
  bot.action(/^host:mdel:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const mId = ctx.match[2];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');

    const match = await matchService.getMatch(tId, mId);
    if (!match) return ctx.reply('❗ Karta topilmadi.');

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback('🗑 Ha, o\'chirish', CALLBACK.HOST_MATCH_DEL_CONFIRM + tId + ':' + mId),
        Markup.button.callback('❌ Bekor qilish', CALLBACK.HOST_MATCH_LIST + tId),
      ],
    ]);

    await ctx.reply(
      `⚠️ <b>Karta №${match.number} ni o'chirmoqchimisiz?</b>\n\n` +
        `Bu amalni qaytarib bo'lmaydi. Ballar qayta hisoblanadi.`,
      { parse_mode: 'HTML', reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 9. KARTANI O'CHIRISH — BAJARISH
  // ============================================================
  bot.action(/^host:mdc:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const mId = ctx.match[2];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');

    await matchService.deleteMatch(tId, mId);
    await ctx.reply('✅ Karta o\'chirildi.');
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Kartalar', CALLBACK.HOST_MATCH_LIST + tId)],
      [Markup.button.callback('🏆 Joriy natijalar', CALLBACK.HOST_STANDINGS + tId)],
    ]);
    await ctx.reply('👇 Keyingi amal:', { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 10. JORIY NATIJALAR (STANDINGS)
  // ============================================================
  bot.action(/^host:st:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');

    const matchData = await matchService.getTournamentMatches(t.id);
    const teamsMap = {};
    for (const tid of t.registeredTeams) {
      const team = await teamService.getTeam(tid);
      if (team) teamsMap[tid] = team;
    }

    const standings = pointsService.calculateStandings(t, matchData, teamsMap);
    const text = pointsService.formatStandings(standings, t);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Yangilash', CALLBACK.HOST_STANDINGS + t.id)],
      [Markup.button.callback('⬅️ Natijalar menyusi', CALLBACK.HOST_RESULTS + t.id)],
    ]);

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 11. HOST — ROOM ID/PASS YUBORISH
  // ============================================================
  bot.action(/^host:(rid|rpass|rboth):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const kind = ctx.match[1];
    const tId = ctx.match[2];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');

    if (kind === 'rid') {
      ctx.session = { state: STATES.HOST_SEND_ROOM_ID, data: { tid: tId } };
      return ctx.reply('🆔 Room ID ni kiriting:');
    }
    if (kind === 'rpass') {
      ctx.session = { state: STATES.HOST_SEND_ROOM_PASS, data: { tid: tId } };
      return ctx.reply('🔒 Room Password ni kiriting:');
    }
    ctx.session = { state: STATES.HOST_SEND_ROOM_BOTH, data: { tid: tId } };
    return ctx.reply('📨 Room ID va parolni "ID:xxxx PASS:yyyy" formatda kiriting:');
  });

  // ============================================================
  // 12. HOST — XABAR TARQATISH
  // ============================================================
  bot.action(/^host:msg:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return ctx.reply('⛔');
    ctx.session = { state: STATES.HOST_SEND_BROADCAST, data: { tid: tId } };
    await ctx.reply('💬 Ishtirokchilarga yubormoqchi bo\'lgan matn yoki rasmni yuboring.');
  });

  // ============================================================
  // 13. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('host_')) return next();

    const tid = ctx.session.data.tid;
    const t = await tournamentService.getTournament(tid);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply('⛔ Ruxsat yo\'q.');
    }

    // ---------- ROOM ID ----------
    if (s === STATES.HOST_SEND_ROOM_ID) {
      const v = cleanText(ctx.message.text, 40);
      await tournamentService.setRoom(tid, { roomId: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply('✅ Room ID saqlandi.');
    }

    // ---------- ROOM PASS ----------
    if (s === STATES.HOST_SEND_ROOM_PASS) {
      const v = cleanText(ctx.message.text, 40);
      await tournamentService.setRoom(tid, { roomPassword: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply('✅ Room Password saqlandi.');
    }

    // ---------- ROOM BOTH ----------
    if (s === STATES.HOST_SEND_ROOM_BOTH) {
      const text = ctx.message.text;
      const idMatch = text.match(/ID[:=\s]+([^\s]+)/i);
      const passMatch = text.match(/PASS(?:WORD)?[:=\s]+([^\s]+)/i);
      if (!idMatch || !passMatch) return ctx.reply('❗ Format: ID:xxxx PASS:yyyy');
      await tournamentService.setRoom(tid, { roomId: idMatch[1], roomPassword: passMatch[1] });
      ctx.session = { state: null, data: {} };
      return ctx.reply('✅ Room ID va Password saqlandi.');
    }

    // ---------- BROADCAST ----------
    if (s === STATES.HOST_SEND_BROADCAST) {
      const text = cleanText(ctx.message.text, 2000);
      ctx.session = { state: null, data: {} };
      const res = await broadcastService.sendToTournamentParticipants(bot, t, teamService, {
        text: `📣 <b>${escapeHtml(t.title)}</b>\n\n${escapeHtml(text)}`,
      });
      return ctx.reply(`✅ Yuborildi: ${res.sent}, xato: ${res.failed}`);
    }

    // ---------- MATCH INPUT ----------
    if (s === STATES.HOST_MATCH_INPUT) {
      try {
        // Komandalarni yig'amiz
        const teams = [];
        for (const teamId of t.registeredTeams) {
          const team = await teamService.getTeam(teamId);
          if (team) teams.push(team);
        }

        // Parse
        const results = pointsService.parseMatchInput(ctx.message.text, teams);

        // Tasdiqlash oynasini tayyorlash
        const teamsMap = {};
        teams.forEach((team) => { teamsMap[team.id] = team; });

        const lines = [];
        lines.push(`╔══════════════════════╗`);
        lines.push(`   📋 <b>KARTA TASDIQLASH</b>`);
        lines.push(`╚══════════════════════╝`);
        lines.push('');

        const W_NO = 4;
        const W_TEAM = 18;
        const W_KILL = 5;
        const W_PTS = 5;

        function pad(str, len) {
          str = String(str);
          if (str.length >= len) return str.slice(0, len - 1) + ' ';
          return str + ' '.repeat(len - str.length);
        }

        const header =
          pad('#', W_NO) + pad('Team', W_TEAM) + pad('Kill', W_KILL) + pad('Pts', W_PTS);
        const divider = '─'.repeat(header.length);

        const rows = results.map((r) => {
          const team = teamsMap[r.teamId];
          const pts = pointsService.calculateTotal(r.placement, r.kills);
          return (
            pad(r.placement, W_NO) +
            pad((team?.name || '?').slice(0, W_TEAM - 1), W_TEAM) +
            pad(r.kills, W_KILL) +
            pad(pts, W_PTS)
          );
        });

        lines.push('<pre>' + header + '\n' + divider + '\n' + rows.join('\n') + '</pre>');
        lines.push('');
        lines.push('❗️ <b>Ma\'lumotlar to\'g\'rimi?</b>');

        ctx.session.data.pendingResults = results;

        const kb = Markup.inlineKeyboard([
          [Markup.button.callback('✅ Tasdiqlash', CALLBACK.HOST_MATCH_CONFIRM + t.id)],
          [Markup.button.callback('❌ Bekor qilish', CALLBACK.HOST_RESULTS + t.id)],
        ]);

        return ctx.reply(lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      } catch (e) {
        return ctx.reply(
          `❌ <b>Xatolik:</b>\n\n${e.message}\n\n` +
            `<i>Qaytadan yuboring yoki /cancel bilan bekor qiling.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    }

    return next();
  });

  // ============================================================
  // 14. FSM — RASM (broadcast uchun)
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
    const caption = ctx.message.caption ? cleanText(ctx.message.caption, LIMITS.MAX_CAPTION_LEN) : '';
    ctx.session = { state: null, data: {} };
    const res = await broadcastService.sendToTournamentParticipants(bot, t, teamService, {
      text: `📣 <b>${escapeHtml(t.title)}</b>${caption ? '\n\n' + escapeHtml(caption) : ''}`,
      image: fileId,
    });
    await ctx.reply(`✅ Yuborildi: ${res.sent}, xato: ${res.failed}`);
  });

  // ============================================================
  // 15. O'YINCHI → HOST
  // ============================================================
  bot.action(/^tour:contact_host:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');
    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply('❗ Avval komandaga qo\'shiling.');
    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply('❗ Komanda topilmadi.');
    if (!t.registeredTeams.includes(team.id)) return ctx.reply('❗ Komandangiz ro\'yxatdan o\'tmagan.');
    if (!t.hostId) return ctx.reply('❗ Bu turnirga host biriktirilmagan.');

    ctx.session = { state: STATES.PLAYER_SEND_TO_HOST, data: { tid: tId, teamId: team.id } };
    await ctx.reply('✉️ Hostga yubormoqchi bo\'lgan matn yoki rasmni yuboring:');
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
        fromUser: ctx.from, tournament: t, team,
        playerNumber: team.members.indexOf(ctx.from.id) + 1,
        message: ctx.message,
      });
      await ctx.reply('✅ Xabar hostga yuborildi.');
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
        fromUser: ctx.from, tournament: t, team,
        playerNumber: team.members.indexOf(ctx.from.id) + 1,
        message: ctx.message,
      });
      await ctx.reply('✅ Rasm hostga yuborildi.');
    } catch (e) {
      await ctx.reply('❌ ' + (e.message || 'xato'));
    }
  });
};