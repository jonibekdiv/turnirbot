// ============================================================
// HOST EXT HANDLER — 3 tilda
// ============================================================
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

function backToHostTours(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('host_title'), CALLBACK.HOST_TOURS)],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

function backToHostOpen(t, tid) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_back_tournament'), CALLBACK.HOST_OPEN + tid)],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. HOST PANEL
  // ============================================================
  bot.action(CALLBACK.HOST_TOURS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.HOST) {
      return ctx.reply(`⛔ ${t('error_access')}`, backToHostTours(t));
    }

    const all = await tournamentService.getAllTournaments();
    const mine = all.filter((tour) => Number(tour.hostId) === Number(ctx.from.id));

    if (!mine.length) {
      return safeEdit(ctx, `📭 ${t('host_no_tours')}`, mainKeyboard(ctx.state.role, ctx.state.lang));
    }

    const rows = mine.map((tour) => [
      Markup.button.callback(`🎯 ${tour.title.slice(0, 30)}`, CALLBACK.HOST_OPEN + tour.id),
    ]);
    rows.push([Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)]);

    await safeEdit(ctx, `🎙 <b>${t('host_title')}</b>\n\n${t('support_choose_type')}`, {
      reply_markup: { inline_keyboard: rows },
    });
  });

  // ============================================================
  // 2. TURNIR BOSHQARUV
  // ============================================================
  bot.action(/^host:open:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tour = await tournamentService.getTournament(ctx.match[1]);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) {
      return ctx.reply(`⛔ ${t('error_access')}`, backToHostTours(t));
    }

    const matchData = await matchService.getTournamentMatches(tour.id);
    const matchCount = matchData.matches.length;

    const roomStatus =
      tour.roomId && tour.roomPassword
        ? `✅ ${t('success')}`
        : tour.roomId || tour.roomPassword
        ? `⚠️ ${t('payment_status_pending')}`
        : `❌ ${t('no')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('host_results'), CALLBACK.HOST_RESULTS + tour.id)],
      [Markup.button.callback(t('host_room_id'), CALLBACK.HOST_ROOM_ID + tour.id)],
      [Markup.button.callback(t('host_room_pass'), CALLBACK.HOST_ROOM_PASS + tour.id)],
      [Markup.button.callback(t('host_room_both'), CALLBACK.HOST_ROOM_BOTH + tour.id)],
      [Markup.button.callback(t('host_room_resend'), 'host:room_resend:' + tour.id)],
      [Markup.button.callback(t('host_msg'), CALLBACK.HOST_MSG + tour.id)],
      [Markup.button.callback(t('host_title'), CALLBACK.HOST_TOURS)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await safeEdit(
      ctx,
      `🎯 <b>${escapeHtml(tour.title)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}/${tour.maxTeams}</b>\n` +
        `🎮 ${t('stage_matches_menu')}: <b>${matchCount}</b>\n` +
        `🆔 Room ID: <code>${escapeHtml(tour.roomId || '-')}</code>\n` +
        `🔒 Room Pass: <code>${escapeHtml(tour.roomPassword || '-')}</code>\n` +
        `📤 ${t('promo_status_label')}: <b>${roomStatus}</b>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 3. ROOM QAYTA YUBORISH
  // ============================================================
  bot.action(/^host:room_resend:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return ctx.reply(`⛔ ${t('error_access')}`);

    if (!tour.roomId || !tour.roomPassword) {
      return ctx.reply(`❗ ${t('host_room_both')}`, backToHostOpen(t, tId));
    }

    if (!tour.registeredTeams.length) {
      return ctx.reply(`❗ ${t('stage_teams_menu')}`, backToHostOpen(t, tId));
    }

    const progressMsg = await ctx.reply(`⏳ ${t('loading')}`);

    try {
      const res = await roomNotifyService.sendRoomInfo(bot, tour, { isUpdate: true });

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `✅ <b>${t('host_room_resend')}!</b>\n\n` +
          `📤 ${t('bc_stats_sent')}: <b>${res.sent}</b>\n` +
          `❌ ${t('bc_stats_failed')}: <b>${res.failed}</b>\n` +
          `👥 ${t('wallet_admin_total_users')}: <b>${res.total}</b>`,
        { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tId).reply_markup }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `❌ ${t('error_prefix')} ${e.message || t('error_generic')}`,
        { reply_markup: backToHostOpen(t, tId).reply_markup }
      );
    }
  });

  // ============================================================
  // 4. ROOM BOSHLASH
  // ============================================================
  bot.action(/^host:(rid|rpass|rboth):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const kind = ctx.match[1];
    const tId = ctx.match[2];
    const tour = await tournamentService.getTournament(tId);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return ctx.reply(`⛔ ${t('error_access')}`);

    const backKb = backToHostOpen(t, tId).reply_markup;

    if (kind === 'rid') {
      ctx.session = { state: STATES.HOST_SEND_ROOM_ID, data: { tid: tId } };
      return ctx.reply(
        `🆔 <b>${t('host_room_id')}:</b>\n\n<i>${t('wallet_admin_adjust_example')}: 8734521</i>`,
        { parse_mode: 'HTML', reply_markup: backKb }
      );
    }
    if (kind === 'rpass') {
      ctx.session = { state: STATES.HOST_SEND_ROOM_PASS, data: { tid: tId } };
      return ctx.reply(
        `🔒 <b>${t('host_room_pass')}:</b>\n\n<i>${t('wallet_admin_adjust_example')}: pubg2025</i>`,
        { parse_mode: 'HTML', reply_markup: backKb }
      );
    }
    ctx.session = { state: STATES.HOST_SEND_ROOM_BOTH, data: { tid: tId } };
    return ctx.reply(
      `📨 <b>${t('host_room_both')}</b>\n\n${t('stage_room_format')}:\n<code>ID: 8734521\nPASS: pubg2025</code>\n\n<i>${t('wallet_admin_adjust_example')}:</i>\n<code>ID:8734521 PASS:pubg2025</code>`,
      { parse_mode: 'HTML', reply_markup: backKb }
    );
  });

  // ============================================================
  // 5. NATIJALAR
  // ============================================================
  bot.action(/^host:res:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tour = await tournamentService.getTournament(ctx.match[1]);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return ctx.reply(`⛔ ${t('error_access')}`);

    const matchData = await matchService.getTournamentMatches(tour.id);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('promotion_create'), CALLBACK.HOST_MATCH_NEW + tour.id)],
      [
        Markup.button.callback(
          `${t('stage_matches_menu')} (${matchData.matches.length})`,
          CALLBACK.HOST_MATCH_LIST + tour.id
        ),
      ],
      [Markup.button.callback(t('stage_match_results_view'), CALLBACK.HOST_STANDINGS + tour.id)],
      [Markup.button.callback(t('btn_back'), CALLBACK.HOST_OPEN + tour.id)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await safeEdit(
      ctx,
      `📊 <b>${t('host_results')} — ${escapeHtml(tour.title)}</b>\n\n` +
        `🎮 ${t('stage_matches_menu')}: <b>${matchData.matches.length}</b>\n` +
        `👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}</b>\n\n` +
        `👇 ${t('support_choose_type')}`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 6. XABAR TARQATISH
  // ============================================================
  bot.action(/^host:msg:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return ctx.reply(`⛔ ${t('error_access')}`);

    ctx.session = { state: STATES.HOST_SEND_BROADCAST, data: { tid: tId } };
    await ctx.reply(
      `💬 <b>${t('host_msg')}</b>\n\n${t('support_enter_text')}`,
      { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tId).reply_markup }
    );
  });

  // ============================================================
  // 7. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('host_')) return next();
    const t = ctx.t;

    const tid = ctx.session.data.tid;
    const tour = await tournamentService.getTournament(tid);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`⛔ ${t('error_access')}`, backToHostTours(t));
    }

    // ROOM ID
    if (s === STATES.HOST_SEND_ROOM_ID) {
      const v = cleanText(ctx.message.text, 40);
      if (!v) return ctx.reply(`❗ ${t('host_room_id')}`, backToHostOpen(t, tid));

      await tournamentService.setRoom(tid, { roomId: v });
      const updated = await tournamentService.getTournament(tid);
      ctx.session = { state: null, data: {} };

      if (updated.roomPassword) return await autoSendRoomInfo(ctx, bot, updated, t('success'));

      return ctx.reply(
        `✅ <b>${t('host_room_id')}</b>\n\n` +
          `🆔 <code>${escapeHtml(v)}</code>\n\n` +
          `<i>${t('host_room_pass')}</i>`,
        { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
      );
    }

    // ROOM PASS
    if (s === STATES.HOST_SEND_ROOM_PASS) {
      const v = cleanText(ctx.message.text, 40);
      if (!v) return ctx.reply(`❗ ${t('host_room_pass')}`, backToHostOpen(t, tid));

      await tournamentService.setRoom(tid, { roomPassword: v });
      const updated = await tournamentService.getTournament(tid);
      ctx.session = { state: null, data: {} };

      if (updated.roomId) return await autoSendRoomInfo(ctx, bot, updated, t('success'));

      return ctx.reply(
        `✅ <b>${t('host_room_pass')}</b>\n\n` +
          `🔒 <code>${escapeHtml(v)}</code>\n\n` +
          `<i>${t('host_room_id')}</i>`,
        { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
      );
    }

    // ROOM BOTH
    if (s === STATES.HOST_SEND_ROOM_BOTH) {
      const text = ctx.message.text;
      const idMatch = text.match(/ID[:=\s]+([^\s\n]+)/i);
      const passMatch = text.match(/PASS(?:WORD)?[:=\s]+([^\s\n]+)/i);

      if (!idMatch || !passMatch) {
        return ctx.reply(
          `❗ ${t('stage_room_format')}: <code>ID:xxxx PASS:yyyy</code>`,
          { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
        );
      }

      const roomId = cleanText(idMatch[1], 40);
      const roomPassword = cleanText(passMatch[1], 40);

      await tournamentService.setRoom(tid, { roomId, roomPassword });
      const updated = await tournamentService.getTournament(tid);
      ctx.session = { state: null, data: {} };

      return await autoSendRoomInfo(ctx, bot, updated, t('success'));
    }

    // BROADCAST
    if (s === STATES.HOST_SEND_BROADCAST) {
      const text = cleanText(ctx.message.text, 2000);
      ctx.session = { state: null, data: {} };

      const res = await broadcastService.sendToTournamentParticipants(bot, tour, teamService, {
        text: `📣 <b>${escapeHtml(tour.title)}</b>\n\n${escapeHtml(text)}`,
      });

      return ctx.reply(
        `✅ <b>${t('ch_announced')}</b>\n\n` +
          `📤 ${t('bc_stats_sent')}: <b>${res.sent}</b>\n` +
          `❌ ${t('bc_stats_failed')}: <b>${res.failed}</b>`,
        { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
      );
    }

    return next();
  });

  // ============================================================
  // 8. FSM — RASM
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.HOST_SEND_BROADCAST) return next();
    const t = ctx.t;

    const tid = ctx.session.data.tid;
    const tour = await tournamentService.getTournament(tid);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = ctx.message.caption ? cleanText(ctx.message.caption, LIMITS.MAX_CAPTION_LEN) : '';

    ctx.session = { state: null, data: {} };

    const res = await broadcastService.sendToTournamentParticipants(bot, tour, teamService, {
      text: `📣 <b>${escapeHtml(tour.title)}</b>${caption ? '\n\n' + escapeHtml(caption) : ''}`,
      image: fileId,
    });

    await ctx.reply(
      `✅ <b>${t('ch_announced')}</b>\n\n` +
        `📤 ${t('bc_stats_sent')}: <b>${res.sent}</b>\n` +
        `❌ ${t('bc_stats_failed')}: <b>${res.failed}</b>`,
      { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
    );
  });

  // ============================================================
  // 9. O'YINCHI → HOST
  // ============================================================
  bot.action(/^tour:contact_host:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(`❗ ${t('tour_not_found')}`);

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply(`❗ ${t('error_team_not_member')}`);
    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);
    if (!tour.registeredTeams.includes(team.id)) return ctx.reply(`❗ ${t('error_not_registered')}`);
    if (!tour.hostId) return ctx.reply(`❗ ${t('host_no_tours')}`);

    ctx.session = { state: STATES.PLAYER_SEND_TO_HOST, data: { tid: tId, teamId: team.id } };

    await ctx.reply(`✉️ <b>${t('host_msg')}</b>\n\n${t('support_enter_text')}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tId }]],
      },
    });
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PLAYER_SEND_TO_HOST) return next();
    const t = ctx.t;

    const { tid, teamId } = ctx.session.data;
    const tour = await tournamentService.getTournament(tid);
    const team = await teamService.getTeam(teamId);
    ctx.session = { state: null, data: {} };

    if (!tour || !team) return ctx.reply(`❗ ${t('error_generic')}`);

    try {
      await messageRelayService.relayToHost(bot, {
        fromUser: ctx.from,
        tournament: tour,
        team,
        playerNumber: team.members.indexOf(ctx.from.id) + 1,
        message: ctx.message,
      });
      await ctx.reply(`✅ ${t('success')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tid }]],
        },
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PLAYER_SEND_TO_HOST) return next();
    const t = ctx.t;

    const { tid, teamId } = ctx.session.data;
    const tour = await tournamentService.getTournament(tid);
    const team = await teamService.getTeam(teamId);
    ctx.session = { state: null, data: {} };

    if (!tour || !team) return ctx.reply(`❗ ${t('error_generic')}`);

    try {
      await messageRelayService.relayToHost(bot, {
        fromUser: ctx.from,
        tournament: tour,
        team,
        playerNumber: team.members.indexOf(ctx.from.id) + 1,
        message: ctx.message,
      });
      await ctx.reply(`✅ ${t('success')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tid }]],
        },
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });
};

// ============================================================
// AUTO SEND ROOM INFO
// ============================================================
async function autoSendRoomInfo(ctx, bot, tournament, savedText) {
  const t = ctx.t;
  const tid = tournament.id;

  if (!tournament.registeredTeams.length) {
    return ctx.reply(
      `✅ <b>${savedText}</b>\n\n<i>${t('stage_teams_menu')}</i>`,
      { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
    );
  }

  const progressMsg = await ctx.reply(`✅ <b>${savedText}</b>\n\n⏳ ${t('loading')}`, {
    parse_mode: 'HTML',
  });

  try {
    const res = await roomNotifyService.sendRoomInfo(bot, tournament, { isUpdate: false });

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      progressMsg.message_id,
      null,
      `╔══════════════════════╗\n` +
        `   ✅ <b>${t('host_stage_room_saved')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🆔 Room ID: <code>${escapeHtml(tournament.roomId)}</code>\n` +
        `🔒 ${t('password')}: <code>${escapeHtml(tournament.roomPassword)}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📤 ${t('stage_room_sent_to')}: <b>${res.sent}</b> ${t('stage_room_players')}\n` +
        `❌ ${t('bc_stats_failed')}: <b>${res.failed}</b>\n` +
        `👥 ${t('wallet_admin_total_users')}: <b>${res.total}</b>`,
      { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
    );
  } catch (e) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      progressMsg.message_id,
      null,
      `⚠️ <b>${savedText}, ${t('error_generic')}</b>\n\n${e.message}`,
      { parse_mode: 'HTML', reply_markup: backToHostOpen(t, tid).reply_markup }
    );
  }
}