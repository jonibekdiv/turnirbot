// ============================================================
// HOST STAGE HANDLER — Host paneli (3 tilda, OCR bilan)
// Ruxsat: HOST, SUPER_ADMIN, ADMIN
// ============================================================
const { Markup } = require('telegraf');
const stageService = require('../services/stageService');
const stageMatchService = require('../services/stageMatchService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const auditService = require('../services/auditService');
const {
  hostStageMatchesKeyboard,
  hostStageMatchKeyboard,
} = require('../keyboards/stageKeyboard');
const {
  CALLBACK,
  STATES,
  ROLES,
  MATCH_RESULT_STATUS,
  LIMITS,
} = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

// ============================================================
// RUXSAT
// ============================================================
function canAccessStagePanel(role) {
  return [ROLES.HOST, ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(role);
}

function isTopAdmin(role) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

function canAccessMatch(ctx, match) {
  if (isTopAdmin(ctx.state.role)) return true;
  return Number(match.hostId) === Number(ctx.from.id);
}

module.exports = (bot) => {
  // ============================================================
  // 1. HOST STAGE PANEL
  // ============================================================
  bot.action(CALLBACK.HOST_STAGE_TOURS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canAccessStagePanel(ctx.state.role)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const topAdmin = isTopAdmin(ctx.state.role);

    const allTournaments = await tournamentService.getAllTournaments();
    const myTournaments = allTournaments.filter((tour) =>
      topAdmin ? true : Number(tour.hostId) === Number(ctx.from.id)
    );

    const data = await require('../storage/jsonStore').read('stageMatches.json');
    const myMatches = Object.values(data).filter((m) =>
      topAdmin ? true : Number(m.hostId) === Number(ctx.from.id)
    );

    const byTournament = {};

    for (const tour of myTournaments) {
      byTournament[tour.id] = { tournament: tour, matches: [] };
    }

    for (const m of myMatches) {
      if (!byTournament[m.tournamentId]) {
        const tour = allTournaments.find((x) => x.id === m.tournamentId);
        byTournament[m.tournamentId] = { tournament: tour, matches: [] };
      }
      byTournament[m.tournamentId].matches.push(m);
    }

    const tourIds = Object.keys(byTournament);

    if (!tourIds.length) {
      return safeEdit(ctx, `📭 ${t('host_stage_no_matches')}`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
          ],
        },
      });
    }

    const totalMatches = myMatches.length;

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('host_stage_title')}`,
      `╚══════════════════════╝`,
      '',
      `🏆 ${t('host_stage_tours_total')}: <b>${tourIds.length}</b>`,
      `🎮 ${t('stage_matches_total')}: <b>${totalMatches}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const rows = [];

    tourIds
      .sort((a, b) => {
        const ta = byTournament[a].tournament;
        const tb = byTournament[b].tournament;
        return new Date(tb?.createdAt || 0) - new Date(ta?.createdAt || 0);
      })
      .forEach((tid) => {
        const { tournament, matches } = byTournament[tid];
        const title = tournament?.title || tid;

        lines.push(`🏆 <b>${escapeHtml(title)}</b>`);
        lines.push(
          `   🎮 ${matches.length} ${t('stage_match_num')}` +
            (tournament?.roomId
              ? ` • 🆔 ${t('host_room_id')}: ✅`
              : ` • 🆔 ${t('host_room_id')}: ❌`)
        );
        lines.push('');

        rows.push([
          Markup.button.callback(
            `🏆 ${title.slice(0, 28)} (${matches.length})`,
            CALLBACK.HOST_STAGE_LIST + tid
          ),
        ]);
      });

    rows.push([Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)]);

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
  // 2. TURNIR MATCHLARI
  // ============================================================
  bot.action(/^hst:list:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canAccessStagePanel(ctx.state.role)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const tournamentId = ctx.match[1];
    const tour = await tournamentService.getTournament(tournamentId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const topAdmin = isTopAdmin(ctx.state.role);

    const data = await require('../storage/jsonStore').read('stageMatches.json');
    const myMatches = Object.values(data)
      .filter(
        (m) =>
          m.tournamentId === tournamentId &&
          (topAdmin || Number(m.hostId) === Number(ctx.from.id))
      )
      .sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        return a.matchNumber - b.matchNumber;
      });

    if (!myMatches.length) {
      const roomStatus =
        tour.roomId && tour.roomPassword
          ? `✅ ${t('success')}`
          : tour.roomId || tour.roomPassword
          ? `⚠️ ${t('payment_status_pending')}`
          : `❌ ${t('no')}`;

      const lines = [
        `╔══════════════════════╗`,
        `   ${t('host_stage_matches')}`,
        `╚══════════════════════╝`,
        '',
        `🏆 <b>${escapeHtml(tour.title)}</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}/${tour.maxTeams}</b>`,
        `🆔 Room ID: <code>${escapeHtml(tour.roomId || '-')}</code>`,
        `🔒 ${t('password')}: <code>${escapeHtml(tour.roomPassword || '-')}</code>`,
        `📤 ${t('promo_status_label')}: <b>${roomStatus}</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `📭 ${t('host_stage_no_matches')}`,
        `⏳ <i>${t('host_stage_wait_matches')}</i>`,
      ];

      const backRows = [
        [
          Markup.button.callback(
            `🎯 ${t('host_results')}`,
            CALLBACK.HOST_OPEN + tour.id
          ),
        ],
        [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_TOURS)],
        [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
      ];

      return ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: backRows },
      });
    }

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('host_stage_matches')}`,
      `╚══════════════════════╝`,
      '',
      `🏆 <b>${escapeHtml(tour.title)}</b>`,
      '',
      `📊 ${t('stage_matches_total')}: <b>${myMatches.length}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    myMatches.forEach((m) => {
      const statusEmoji = {
        pending: '⏳',
        submitted: '📤',
        approved: '✅',
        rejected: '❌',
      };
      const emoji = statusEmoji[m.resultStatus] || '•';
      const roomLabel = m.roomId ? '🆔✅' : '🆔❌';

      lines.push(
        `${emoji} <b>${t('promotion_day')} ${m.dayNumber} — #${m.dayMatchNumber || m.matchNumber}</b>\n` +
          `   🗺 ${m.map || 'Erangel'}\n` +
          `   📅 ${m.date} | ⏰ ${m.startTime}\n` +
          `   👥 ${(m.teams || []).length}/${m.teamsPerMatch}\n` +
          `   ${roomLabel}`
      );
      lines.push('');
    });

    const kb = hostStageMatchesKeyboard(myMatches, ctx.from.id);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // 3. BITTA MATCH
  // ============================================================
  bot.action(/^hst:m:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return ctx.reply(t('stage_not_found'));

    if (!canAccessMatch(ctx, match)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const stage = await stageService.getStage(match.stageId);
    const tournament = await tournamentService.getTournament(match.tournamentId);

    const lines = [
      `╔══════════════════════╗`,
      `   🎮 <b>${t('host_stage_match')}</b>`,
      `╚══════════════════════╝`,
      '',
      `🏆 ${escapeHtml(tournament?.title || '-')}`,
      `📊 ${escapeHtml(stage?.name || '-')}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📅 <b>${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}</b>`,
      `🗺 <b>${match.map || 'Erangel'}</b>`,
      `📆 ${match.date} | ⏰ ${match.startTime}`,
      '',
      `👥 ${t('stage_match_teams')}: <b>${(match.teams || []).length}/${match.teamsPerMatch}</b>`,
      '',
    ];

    if (match.teams?.length) {
      lines.push(`<b>${t('stage_match_teams')}:</b>`);
      for (let i = 0; i < match.teams.length; i++) {
        const team = await teamService.getTeam(match.teams[i]);
        lines.push(
          `${i + 1}. ${
            team
              ? escapeHtml(team.name) + ' [' + escapeHtml(team.tag) + ']'
              : match.teams[i]
          }`
        );
      }
      lines.push('');
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    if (match.roomId && match.roomPassword) {
      lines.push(`🆔 ${t('tour_room_info')}: <code>${escapeHtml(match.roomId)}</code>`);
      lines.push(`🔒 ${t('password')}: <code>${escapeHtml(match.roomPassword)}</code>`);
      lines.push('✅');
    } else {
      lines.push(`🆔 ${t('tour_room_info')}: <i>${t('stage_match_no_host')}</i>`);
    }

    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    const statusEmoji = {
      pending: '⏳',
      submitted: '📤',
      approved: '✅',
      rejected: '❌',
    };
    const statusName = {
      pending: t('payment_status_pending'),
      submitted: t('stage_status_waiting_results'),
      approved: t('stage_match_results_approved'),
      rejected: t('stage_match_results_rejected'),
    };

    lines.push(
      `${statusEmoji[match.resultStatus] || '•'} <b>${statusName[match.resultStatus] || match.resultStatus}</b>`
    );

    const kb = hostStageMatchKeyboard(match, match.stageId);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // 4. ROOM INFO
  // ============================================================
  bot.action(/^hst:room:(.+):(id|pass|both)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const matchId = ctx.match[1];
    const kind = ctx.match[2];

    const match = await stageMatchService.getMatch(matchId);
    if (!match) return;

    if (!canAccessMatch(ctx, match)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    if (kind === 'id') {
      ctx.session = { state: 'host_stage_room_id', data: { matchId } };
      return ctx.reply(`🆔 <b>${t('stage_match_room_input')}:</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + matchId)],
          ],
        },
      });
    }

    if (kind === 'pass') {
      ctx.session = { state: 'host_stage_room_pass', data: { matchId } };
      return ctx.reply(`🔒 <b>${t('password')}:</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + matchId)],
          ],
        },
      });
    }

    ctx.session = { state: 'host_stage_room_both', data: { matchId } };
    return ctx.reply(
      `📨 <b>${t('stage_room_input_prompt')}</b>\n\n` +
        `${t('stage_room_format')}: <code>ID: 123456 PASS: ABC123</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + matchId)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 5. FSM — ROOM INFO
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('host_stage_room_')) return next();

    const t = ctx.t;
    const matchId = ctx.session.data.matchId;
    const match = await stageMatchService.getMatch(matchId);
    if (!match) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(t('stage_not_found'));
    }

    if (!canAccessMatch(ctx, match)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const v = cleanText(ctx.message.text, 40);
    if (!v) return ctx.reply(`❗ ${t('error_only_digits')}`);

    if (s === 'host_stage_room_id') {
      await stageMatchService.setRoom(matchId, { roomId: v });
      const updated = await stageMatchService.getMatch(matchId);
      ctx.session = { state: null, data: {} };

      if (updated.roomPassword) {
        return await sendRoomToTeams(ctx, bot, updated);
      }

      return ctx.reply(
        `✅ <b>Room ID</b>: <code>${escapeHtml(v)}</code>\n\n` +
          `<i>${t('stage_room_input_prompt')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback(
                  t('host_stage_room_pass'),
                  CALLBACK.HOST_STAGE_ROOM + matchId + ':pass'
                ),
              ],
              [
                Markup.button.callback(
                  t('btn_back'),
                  CALLBACK.HOST_STAGE_MATCH + matchId
                ),
              ],
            ],
          },
        }
      );
    }

    if (s === 'host_stage_room_pass') {
      await stageMatchService.setRoom(matchId, { roomPassword: v });
      const updated = await stageMatchService.getMatch(matchId);
      ctx.session = { state: null, data: {} };

      if (updated.roomId) {
        return await sendRoomToTeams(ctx, bot, updated);
      }

      return ctx.reply(
        `✅ <b>${t('password')}</b>: <code>${escapeHtml(v)}</code>\n\n` +
          `<i>${t('stage_room_input_prompt')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback(
                  t('host_stage_room_id'),
                  CALLBACK.HOST_STAGE_ROOM + matchId + ':id'
                ),
              ],
              [
                Markup.button.callback(
                  t('btn_back'),
                  CALLBACK.HOST_STAGE_MATCH + matchId
                ),
              ],
            ],
          },
        }
      );
    }

    if (s === 'host_stage_room_both') {
      const idMatch = v.match(/ID[:=\s]+([^\s]+)/i);
      const passMatch = v.match(/PASS(?:WORD)?[:=\s]+([^\s]+)/i);

      let roomId, roomPassword;

      if (idMatch && passMatch) {
        roomId = idMatch[1];
        roomPassword = passMatch[1];
      } else {
        const parts = v.split(/\s+/);
        if (parts.length >= 2) {
          roomId = parts[0];
          roomPassword = parts[1];
        } else {
          return ctx.reply(
            `❗ ${t('stage_room_format')}: <code>ID: 123456 PASS: ABC123</code>`,
            { parse_mode: 'HTML' }
          );
        }
      }

      await stageMatchService.setRoom(matchId, { roomId, roomPassword });
      const updated = await stageMatchService.getMatch(matchId);
      ctx.session = { state: null, data: {} };

      return await sendRoomToTeams(ctx, bot, updated);
    }

    return next();
  });

  // ============================================================
  // 6. ROOM INFO YUBORISH
  // ============================================================
  async function sendRoomToTeams(ctx, bot, match) {
    const t = ctx.t;

    const stage = await stageService.getStage(match.stageId);
    const tournament = await tournamentService.getTournament(match.tournamentId);

    const memberIds = new Set();
    for (const tid of match.teams || []) {
      const team = await teamService.getTeam(tid);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    const text =
      `╔══════════════════════╗\n` +
      `   🆔 <b>${t('host_stage_room_info')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 ${escapeHtml(tournament?.title || '-')}\n` +
      `📊 ${escapeHtml(stage?.name || '-')}\n` +
      `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🆔 <b>Room ID:</b>\n` +
      `<code>${escapeHtml(match.roomId)}</code>\n\n` +
      `🔒 <b>${t('password')}:</b>\n` +
      `<code>${escapeHtml(match.roomPassword)}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚡️ <i>PUBG Mobile'ni ochib, xonaga kiring!</i>`;

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await bot.telegram.sendMessage(uid, text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('btn_copy_room_id'),
                  copy_text: { text: String(match.roomId) },
                },
              ],
              [
                {
                  text: t('btn_copy_password'),
                  copy_text: { text: String(match.roomPassword) },
                },
              ],
            ],
          },
        });
        sent++;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 60));
    }

    await auditService.log({
      action: 'SEND_ROOM_INFO',
      actorId: ctx.from.id,
      tournamentId: match.tournamentId,
      stageId: match.stageId,
      matchId: match.id,
      details: { sent, total: memberIds.size },
    });

    return ctx.reply(
      `╔══════════════════════╗\n` +
        `   ✅ <b>${t('host_stage_room_saved')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🆔 <code>${escapeHtml(match.roomId)}</code>\n` +
        `🔒 <code>${escapeHtml(match.roomPassword)}</code>\n\n` +
        `📤 ${t('stage_room_sent_to')}: <b>${sent}</b> ${t('stage_room_players')}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                t('btn_back'),
                CALLBACK.HOST_STAGE_MATCH + match.id
              ),
            ],
          ],
        },
      }
    );
  }

  // ============================================================
  // 7. NATIJALARNI KIRITISH — OCR yoki qo'lda tanlash
  // ============================================================
  bot.action(/^hst:res:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    if (!canAccessMatch(ctx, match)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    // Agar tasdiqlangan bo'lsa
    if (match.resultStatus === MATCH_RESULT_STATUS.APPROVED) {
      const teamsMap = {};
      for (const tid of match.teams || []) {
        const tm = await teamService.getTeam(tid);
        if (tm) teamsMap[tid] = tm;
      }
      const resultText = stageMatchService.formatMatchResults(match, teamsMap, t);
      return ctx.reply(
        `✅ <b>${t('stage_match_results_approved')}</b>\n\n${resultText}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + match.id)],
            ],
          },
        }
      );
    }

    // Agar yuborilgan bo'lsa
    if (match.resultStatus === MATCH_RESULT_STATUS.SUBMITTED) {
      const teamsMap = {};
      for (const tid of match.teams || []) {
        const tm = await teamService.getTeam(tid);
        if (tm) teamsMap[tid] = tm;
      }
      const resultText = stageMatchService.formatMatchResults(match, teamsMap, t);
      return ctx.reply(
        `📤 <b>${t('stage_status_waiting_results')}</b>\n\n${resultText}\n\n` +
          `<i>${t('stage_result_wait_approval')}</i>`,
        { parse_mode: 'HTML' }
      );
    }

    // ✅ PENDING — usul tanlash
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📸 Skrinshot yuborish', `hst:ocr_start:${match.id}`)],
      [Markup.button.callback('✏️ Qo\'lda kiritish', `hst:manual:${match.id}`)],
      [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + match.id)],
    ]);

    return ctx.reply(
      `📊 <b>Natija kiritish usuli</b>\n\n` +
        `🎮 ${t('promotion_day')} ${match.dayNumber} — #${match.dayMatchNumber || match.matchNumber}\n` +
        `🗺 ${match.map || 'Erangel'}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📸 <b>Skrinshot</b> — tez va oson (OCR)\n` +
        `✏️ <b>Qo'lda</b> — aniq nazorat`,
      {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      }
    );
  });

  // ============================================================
  // 7.1 QO'LDA KIRITISH (stage match uchun)
  // ============================================================
  bot.action(/^hst:manual:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    if (!canAccessMatch(ctx, match)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    ctx.session = {
      state: 'host_stage_match_result',
      data: { matchId: match.id },
    };

    const teamLines = [];
    for (const tid of match.teams || []) {
      const tm = await teamService.getTeam(tid);
      if (tm) teamLines.push(`• <b>${escapeHtml(tm.tag)}</b> — ${escapeHtml(tm.name)}`);
    }

    await ctx.reply(
      `📊 <b>${t('host_stage_results_input')}</b>\n\n` +
        `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>${t('stage_match_teams')}:</b>\n${teamLines.join('\n')}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 ${t('stage_result_format')}: <code>TAG - KILL</code>\n\n` +
        `<i>Tartib = o'rin (1-chi qator = 1-o'rin)</i>\n\n` +
        `${t('stage_result_example')}:\n<code>UP - 5\nN1 - 3\nS7 - 2</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + match.id)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 8. FSM — NATIJALAR (qo'lda)
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'host_stage_match_result') return next();
    const t = ctx.t;

    const matchId = ctx.session.data.matchId;
    const match = await stageMatchService.getMatch(matchId);
    if (!match) {
      ctx.session = { state: null, data: {} };
      return next();
    }

    if (!canAccessMatch(ctx, match)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    try {
      const lines = ctx.message.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const teamsMap = {};
      for (const tid of match.teams || []) {
        const tm = await teamService.getTeam(tid);
        if (tm) teamsMap[tm.tag.toUpperCase()] = tm;
      }

      const parsed = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let m = line.match(/^([A-Za-z0-9_]+)\s*[-|:]\s*(\d+)$/);
        if (!m) m = line.match(/^([A-Za-z0-9_]+)\s+(\d+)$/);

        if (!m) {
          return ctx.reply(
            `❌ ${i + 1} ${t('stage_result_wrong_format')}:\n<code>${escapeHtml(line)}</code>\n\n` +
              `${t('stage_room_format')}: <code>TAG - KILL</code>`,
            { parse_mode: 'HTML' }
          );
        }

        const tag = m[1].toUpperCase();
        const kills = parseInt(m[2], 10);
        const team = teamsMap[tag];

        if (!team) {
          return ctx.reply(`❌ "${tag}" ${t('stage_result_tag_not_found')}`);
        }

        parsed.push({
          teamId: team.id,
          teamName: team.name,
          place: i + 1,
          kills,
          penalty: 0,
        });
      }

      await stageMatchService.setResults(match.id, parsed, ctx.from.id);
      ctx.session = { state: null, data: {} };

      await auditService.log({
        action: 'HOST_SUBMIT_RESULTS',
        actorId: ctx.from.id,
        tournamentId: match.tournamentId,
        stageId: match.stageId,
        matchId: match.id,
        details: { count: parsed.length },
      });

      const teamsMapEnriched = {};
      for (const tid of match.teams || []) {
        const tm = await teamService.getTeam(tid);
        if (tm) teamsMapEnriched[tid] = tm;
      }

      const resultText = stageMatchService.formatMatchResults(
        { ...match, results: parsed },
        teamsMapEnriched,
        t
      );

      await ctx.reply(
        `✅ <b>${t('stage_result_sent')}</b>\n\n${resultText}\n\n` +
          `⏳ ${t('stage_result_wait_approval')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + match.id)],
            ],
          },
        }
      );

      const tour = await tournamentService.getTournament(match.tournamentId);
      if (tour?.organizerId) {
        try {
          await bot.telegram.sendMessage(
            tour.organizerId,
            `📤 <b>${t('stage_result_sent')}</b>\n\n` +
              `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}\n\n` +
              `${resultText}`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: t('stage_match_results_view'),
                      callback_data: CALLBACK.STAGE_MATCH_RESULTS_VIEW + match.id,
                    },
                  ],
                  [
                    {
                      text: t('stage_match_results_approve'),
                      callback_data: CALLBACK.STAGE_RESULTS_APPROVE + match.id,
                    },
                  ],
                ],
              },
            }
          );
        } catch (e) {}
      }
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 9. KIM O'TDI?
  // ============================================================
  bot.action(/^hst:qf:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    if (!canAccessMatch(ctx, match)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const teamsMap = {};
    for (const tid of match.teams || []) {
      const tm = await teamService.getTeam(tid);
      if (tm) teamsMap[tid] = tm;
    }

    if (match.resultStatus !== MATCH_RESULT_STATUS.APPROVED) {
      return ctx.reply(`⏳ <b>${t('stage_not_all_approved')}</b>`, {
        parse_mode: 'HTML',
      });
    }

    if (!match.topTeams || !match.topTeams.length) {
      return ctx.reply(`📭 ${t('no_results_yet')}`);
    }

    const lines = [
      `╔══════════════════════╗`,
      `   ✅ <b>${t('host_stage_qualified')}</b>`,
      `╚══════════════════════╝`,
      '',
      `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    match.topTeams.forEach((tid, i) => {
      const tm = teamsMap[tid];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lines.push(
        `${medal} <b>${escapeHtml(tm?.name || tid)}</b> [${escapeHtml(tm?.tag || '')}]`
      );
    });

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback(t('btn_back'), CALLBACK.HOST_STAGE_MATCH + match.id)],
        ],
      },
    });
  });
};