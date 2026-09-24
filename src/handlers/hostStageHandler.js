// ============================================================
// HOST STAGE HANDLER — Host paneli (3 tilda)
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

module.exports = (bot) => {
  // ============================================================
  // 1. HOST TURNIRLARI
  // ============================================================
  bot.action(CALLBACK.HOST_STAGE_TOURS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (
      ctx.state.role !== ROLES.HOST &&
      ctx.state.role !== ROLES.SUPER_ADMIN &&
      ctx.state.role !== ROLES.ADMIN
    ) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const data = await require('../storage/jsonStore').read('stageMatches.json');
    const myMatches = Object.values(data).filter(
      (m) => Number(m.hostId) === Number(ctx.from.id)
    );

    if (!myMatches.length) {
      return safeEdit(ctx, `📭 ${t('host_stage_no_matches')}`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
          ],
        },
      });
    }

    const byTournament = {};
    for (const m of myMatches) {
      if (!byTournament[m.tournamentId]) {
        byTournament[m.tournamentId] = [];
      }
      byTournament[m.tournamentId].push(m);
    }

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('host_stage_title')}`,
      `╚══════════════════════╝`,
      '',
      `📊 ${t('stage_matches_total')}: <b>${myMatches.length}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const rows = [];

    for (const [tournamentId, matches] of Object.entries(byTournament)) {
      const tour = await tournamentService.getTournament(tournamentId);
      const title = tour?.title || tournamentId;

      lines.push(`🏆 <b>${escapeHtml(title)}</b>`);
      lines.push(`   🎮 ${matches.length} ${t('stage_match_num')}`);
      lines.push('');

      rows.push([
        Markup.button.callback(
          `🏆 ${title.slice(0, 30)} (${matches.length})`,
          CALLBACK.HOST_STAGE_LIST + tournamentId
        ),
      ]);
    }

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

    if (
      ctx.state.role !== ROLES.HOST &&
      ctx.state.role !== ROLES.SUPER_ADMIN &&
      ctx.state.role !== ROLES.ADMIN
    ) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const tournamentId = ctx.match[1];
    const tour = await tournamentService.getTournament(tournamentId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const data = await require('../storage/jsonStore').read('stageMatches.json');
    const myMatches = Object.values(data)
      .filter(
        (m) =>
          m.tournamentId === tournamentId &&
          Number(m.hostId) === Number(ctx.from.id)
      )
      .sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        return a.matchNumber - b.matchNumber;
      });

    if (!myMatches.length) {
      return ctx.reply(`📭 ${t('host_stage_no_matches')}`);
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

    if (
      Number(match.hostId) !== Number(ctx.from.id) &&
      ctx.state.role !== ROLES.ADMIN
    ) {
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
    if (Number(match.hostId) !== Number(ctx.from.id)) return;

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

    if (Number(match.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const v = cleanText(ctx.message.text, 40);
    if (!v) return ctx.reply(`❗ ${t('error_only_digits')}`);

    // ROOM ID
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

    // ROOM PASS
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

    // BOTH
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
  // 7. NATIJALARNI KIRITISH
  // ============================================================
  bot.action(/^hst:res:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;
    if (Number(match.hostId) !== Number(ctx.from.id)) return;

    if (match.resultStatus === MATCH_RESULT_STATUS.APPROVED) {
      const teamsMap = {};
      for (const tid of match.teams || []) {
        const tm = await teamService.getTeam(tid);
        if (tm) teamsMap[tid] = tm;
      }
      const resultText = stageMatchService.formatMatchResults(match, teamsMap);
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

    if (match.resultStatus === MATCH_RESULT_STATUS.SUBMITTED) {
      const teamsMap = {};
      for (const tid of match.teams || []) {
        const tm = await teamService.getTeam(tid);
        if (tm) teamsMap[tid] = tm;
      }
      const resultText = stageMatchService.formatMatchResults(match, teamsMap);
      return ctx.reply(
        `📤 <b>${t('stage_status_waiting_results')}</b>\n\n${resultText}\n\n` +
          `<i>${t('stage_result_wait_approval')}</i>`,
        { parse_mode: 'HTML' }
      );
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
  // 8. FSM — NATIJALAR
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

    if (Number(match.hostId) !== Number(ctx.from.id)) {
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
        teamsMapEnriched
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
    if (Number(match.hostId) !== Number(ctx.from.id)) return;

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