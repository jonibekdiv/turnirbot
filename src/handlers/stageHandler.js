// ============================================================
// STAGE HANDLER — Etaplar UI (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const stageService = require('../services/stageService');
const stageMatchService = require('../services/stageMatchService');
const bracketService = require('../services/bracketService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const roleService = require('../services/roleService');
const auditService = require('../services/auditService');
const {
  stageListKeyboard,
  bracketSetupKeyboard,
  bracketConfirmKeyboard,
  stageViewKeyboard,
  teamDistributionKeyboard,
  matchesListKeyboard,
  matchActionsKeyboard,
  hostPickerKeyboard,
} = require('../keyboards/stageKeyboard');
const {
  CALLBACK,
  STATES,
  ROLES,
  STAGE_STATUS,
  DEFAULT_BRACKET,
  LIMITS,
} = require('../constants');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
  displayName,
} = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

function canManageStages(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. ETAPLAR MENYUSI
  // ============================================================
  bot.action(/^stg:list:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const tournamentId = ctx.match[1];
    const tour = await tournamentService.getTournament(tournamentId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const stages = await stageService.getTournamentStages(tournamentId);

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('stage_title')}`,
      `╚══════════════════════╝`,
      '',
      `🏆 <b>${escapeHtml(tour.title)}</b>`,
      '',
    ];

    if (!stages.length) {
      lines.push(`📭 ${t('stage_no_stages')}`);
      lines.push('');
      lines.push(`➕ ${t('stage_create')}:`);

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('stage_create'), CALLBACK.STAGE_CREATE + tournamentId)],
        [Markup.button.callback(t('btn_back_tournament'), CALLBACK.TOUR_OPEN + tournamentId)],
      ]);

      try {
        await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      } catch (e) {
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
      return;
    }

    const firstDate = stages[0].date;
    const lastStage = stages[stages.length - 1];
    const lastDate = stageService.addDays(lastStage.date, (lastStage.numberOfDays || 1) - 1);
    const totalDays = stages.reduce((sum, s) => sum + (s.numberOfDays || 1), 0);

    lines.push(`📊 ${t('stage_total_matches')}: <b>${stages.length}</b>`);
    lines.push(`📅 <b>${firstDate}</b> — <b>${lastDate}</b>`);
    lines.push(`📆 ${t('stage_total_days_label')}: <b>${totalDays}</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const s of stages) {
      const statusEmoji = {
        planned: '📋',
        registration_open: '🟢',
        in_progress: '🔴',
        waiting_results: '⏳',
        completed: '✅',
        cancelled: '❌',
      };
      const emoji = statusEmoji[s.status] || '•';

      const stageEndDate = stageService.addDays(s.date, (s.numberOfDays || 1) - 1);
      const dateStr = s.numberOfDays > 1 ? `${s.date} — ${stageEndDate}` : s.date;

      lines.push(
        `${emoji} <b>${escapeHtml(s.name)}</b>\n` +
          `   📅 ${dateStr}\n` +
          `   🎮 ${(s.matches || []).length} ${t('stage_matches_short')} | 👥 ${(s.teams || []).length} ${t('stage_teams_short')}`
      );
      lines.push('');
    }

    const kb = stageListKeyboard(stages, tournamentId);

    try {
      await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 2. BITTA ETAP
  // ============================================================
  bot.action(/^stg:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return ctx.reply(ctx.t('stage_not_found'));

    const stageText = stageService.formatStageText(stage);
    const kb = stageViewKeyboard(stage, stage.tournamentId);

    try {
      await ctx.editMessageText(stageText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(stageText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 3. YARATISH — BOSHLASH
  // ============================================================
  bot.action(/^stg:create:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const tournamentId = ctx.match[1];
    const tour = await tournamentService.getTournament(tournamentId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const stages = await stageService.getTournamentStages(tournamentId);
    if (stages.length) {
      return ctx.reply(
        `⚠️ <b>${t('stage_has_stages_label')}: ${stages.length}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    ctx.session = {
      state: 'stage_bracket_setup',
      data: { tournamentId, config: { ...DEFAULT_BRACKET } },
    };

    const defaultText = bracketService.formatBracketText(DEFAULT_BRACKET);
    const validation = bracketService.validateBracket(DEFAULT_BRACKET);

    const text =
      `╔══════════════════════╗\n` +
      `   ${t('stage_bracket_title')}\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      defaultText +
      `\n\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      (validation.warnings.length
        ? `⚠️ <b>${t('stage_bracket_warnings')}</b>\n${validation.warnings.join('\n')}\n\n`
        : '') +
      `👇 ${t('support_choose_type')}`;

    const kb = bracketSetupKeyboard(tournamentId);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 4. DEFAULT BRACKET
  // ============================================================
  bot.action(/^stg:def:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const tournamentId = ctx.match[1];
    const tour = await tournamentService.getTournament(tournamentId);
    if (!tour) return;

    ctx.session = {
      state: 'stage_bracket_confirm',
      data: { tournamentId, config: { ...DEFAULT_BRACKET } },
    };

    const text = bracketService.formatBracketText(DEFAULT_BRACKET);
    const kb = bracketConfirmKeyboard(tournamentId);

    const fullText =
      `╔══════════════════════╗\n` +
      `   ⚡️ <b>${t('stage_bracket_default')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 ${escapeHtml(tour.title)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      text +
      `\n\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${t('stage_bracket_confirm_q')}`;

    try {
      await ctx.editMessageText(fullText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(fullText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 5. QO'LDA SETUP
  // ============================================================
  bot.action(/^stg:step:(.+):(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const tournamentId = ctx.match[1];
    const step = ctx.match[2];

    if (!ctx.session?.data?.config) {
      ctx.session = {
        state: 'stage_bracket_setup',
        data: { tournamentId, config: { ...DEFAULT_BRACKET } },
      };
    }

    const stepMap = {
      start: { state: STATES.STAGE_BRACKET_DAYS_QF, text: t('stage_days_input') },
      qf_days: { state: STATES.STAGE_BRACKET_DAYS_QF, text: t('stage_days_input') },
      qf_matches: { state: STATES.STAGE_BRACKET_MATCHES_QF, text: t('stage_matches_input') },
      qf_teams: { state: STATES.STAGE_BRACKET_TEAMS_QF, text: t('stage_teams_input') },
      qf_qualifiers: { state: STATES.STAGE_BRACKET_QUALIFIERS_QF, text: t('stage_qualifiers_input') },
      sf_days: { state: STATES.STAGE_BRACKET_DAYS_SF, text: t('stage_days_input') },
      sf_matches: { state: STATES.STAGE_BRACKET_MATCHES_SF, text: t('stage_matches_input') },
      sf_teams: { state: STATES.STAGE_BRACKET_TEAMS_SF, text: t('stage_teams_input') },
      sf_qualifiers: { state: STATES.STAGE_BRACKET_QUALIFIERS_SF, text: t('stage_qualifiers_input') },
      f_days: { state: STATES.STAGE_BRACKET_DAYS_F, text: t('stage_days_input') },
      f_matches: { state: STATES.STAGE_BRACKET_MATCHES_F, text: t('stage_matches_input') },
      f_teams: { state: STATES.STAGE_BRACKET_TEAMS_F, text: t('stage_teams_input') },
    };

    const stepInfo = stepMap[step];
    if (!stepInfo) return ctx.reply(`❗ ${t('error_wrong_field')}`);

    ctx.session.state = stepInfo.state;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('btn_cancel'), CALLBACK.STAGE_LIST + tournamentId)],
    ]);

    await ctx.reply(
      `⚙️ <b>${t('stage_bracket_manual')}</b>\n\n📍 ${stepInfo.text}\n\n` +
        `<i>${LIMITS.STAGE_MIN_TEAMS_PER_MATCH}-${LIMITS.STAGE_MAX_TEAMS_PER_MATCH}</i>`,
      { parse_mode: 'HTML', reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 6. ETAPLARNI YARATISH
  // ============================================================
  bot.action(/^stg:confirm:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const tournamentId = ctx.match[1];
    const config = ctx.session?.data?.config || DEFAULT_BRACKET;

    const tour = await tournamentService.getTournament(tournamentId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const validation = bracketService.validateBracket(config);
    if (!validation.ok) {
      return ctx.reply(`❌ <b>${t('stage_bracket_warnings')}</b>\n\n${validation.errors.join('\n')}`, {
        parse_mode: 'HTML',
      });
    }

    try {
      const baseDate = tour.date || new Date().toISOString().slice(0, 10);
      const baseTime = tour.startTime || '20:00';

      const stages = await stageService.createDefaultStages(tournamentId, config, baseDate, baseTime);

      for (const stage of stages) {
        await stageMatchService.createMatchesForStage(stage.id);
      }

      const firstStageDate = stages[0].date;
      const lastStage = stages[stages.length - 1];
      const lastStageEndDate = stageService.addDays(lastStage.date, (lastStage.numberOfDays || 1) - 1);
      const totalDays = stages.reduce((sum, s) => sum + (s.numberOfDays || 1), 0);

      await tournamentService.updateTournament(tournamentId, {
        bracketConfig: config,
        hasStages: true,
        stagesCreatedAt: new Date().toISOString(),
        startDate: firstStageDate,
        endDate: lastStageEndDate,
        firstStageDate,
        lastStageDate: lastStageEndDate,
        totalStageDays: totalDays,
      });

      await auditService.log({
        action: 'CREATE_STAGES',
        actorId: ctx.from.id,
        tournamentId,
        details: { stagesCount: stages.length, firstStageDate, lastStageEndDate, totalDays },
      });

      ctx.session = { state: null, data: {} };

      const dateRangeText =
        totalDays > 1
          ? `📅 <b>${firstStageDate}</b> — <b>${lastStageEndDate}</b>`
          : `📅 <b>${firstStageDate}</b>`;

      const lines = [
        `╔══════════════════════╗`,
        `   ✅ <b>${t('stage_created_title')}</b>`,
        `╚══════════════════════╝`,
        '',
        `🏆 <b>${escapeHtml(tour.title)}</b>`,
        '',
        dateRangeText,
        `📆 ${t('stage_total_days_label')}: <b>${totalDays}</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      for (const s of stages) {
        const matchCount = (s.matches || []).length;
        const sEndDate = stageService.addDays(s.date, (s.numberOfDays || 1) - 1);
        const sDateStr = s.numberOfDays > 1 ? `${s.date} — ${sEndDate}` : s.date;

        lines.push(
          `📊 <b>${escapeHtml(s.name)}</b>\n` +
            `   📅 ${sDateStr}\n` +
            `   🎮 ${t('stage_matches_short')}: <b>${matchCount}</b>`
        );
        lines.push('');
      }

      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`👇 ${t('stage_created_hint')}`);

      const kb = stageListKeyboard(stages, tournamentId);

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      console.error('stg:confirm xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 7. KOMANDALAR MENYUSI
  // ============================================================
  bot.action(/^stg:tm:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return ctx.reply(t('stage_not_found'));

    const tour = await tournamentService.getTournament(stage.tournamentId);
    const totalRegistered = (tour?.registeredTeams || []).length;
    const totalInStage = (stage.teams || []).length;

    const text =
      `╔══════════════════════╗\n` +
      `   👥 ${t('stage_teams_menu')}\n` +
      `╚══════════════════════╝\n\n` +
      `📊 <b>${escapeHtml(stage.name)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 ${t('stage_teams_in_stage')}: <b>${totalInStage}</b>\n` +
      `🏆 ${t('stage_teams_total')}: <b>${totalRegistered}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎯 <b>${t('stage_distribute_title')}</b>`;

    const kb = teamDistributionKeyboard(stage.id);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 8. RANDOM TAQSIMLASH
  // ============================================================
  bot.action(/^stg:tr:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return ctx.reply(t('stage_not_found'));

    const tour = await tournamentService.getTournament(stage.tournamentId);
    const allTeams = tour?.registeredTeams || [];

    if (!allTeams.length) return ctx.reply(`❌ ${t('stage_teams_menu')}`);

    await stageService.addTeamsToStage(stage.id, allTeams);

    try {
      const res = await stageMatchService.distributeTeamsRandomly(stage.id);

      await auditService.log({
        action: 'DISTRIBUTE_TEAMS_RANDOM',
        actorId: ctx.from.id,
        tournamentId: stage.tournamentId,
        stageId: stage.id,
        details: res,
      });

      const text =
        `╔══════════════════════╗\n` +
        `   🎲 <b>${t('stage_distributed_random')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `📊 ${escapeHtml(stage.name)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👥 ${t('stage_distributed_count')}: <b>${res.distributed}</b>\n` +
        `📦 ${t('stage_distributed_total')}: <b>${res.total}</b>`;

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('stage_matches_menu'), CALLBACK.STAGE_MATCHES_LIST + stage.id)],
        [Markup.button.callback(t('btn_back'), CALLBACK.STAGE_VIEW + stage.id)],
      ]);

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      } catch (e) {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 9. REYTING TAQSIMLASH
  // ============================================================
  bot.action(/^stg:trat:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return ctx.reply(t('stage_not_found'));

    const tour = await tournamentService.getTournament(stage.tournamentId);
    const allTeams = tour?.registeredTeams || [];

    if (!allTeams.length) return ctx.reply(`❌ ${t('stage_teams_menu')}`);

    await stageService.addTeamsToStage(stage.id, allTeams);

    try {
      const res = await stageMatchService.distributeTeamsRandomly(stage.id);

      await auditService.log({
        action: 'DISTRIBUTE_TEAMS_RATING',
        actorId: ctx.from.id,
        tournamentId: stage.tournamentId,
        stageId: stage.id,
        details: res,
      });

      await ctx.reply(`✅ <b>${t('stage_distributed_random')}</b>\n\n👥 ${res.distributed}`, {
        parse_mode: 'HTML',
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 10. MATCHLAR RO'YXATI
  // ============================================================
  bot.action(/^stg:ml:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return ctx.reply(t('stage_not_found'));

    const matches = await stageMatchService.getStageMatches(stage.id);
    if (!matches.length) return ctx.reply(`📭 ${t('stage_matches_menu')}`);

    const lines = [
      `╔══════════════════════╗`,
      `   🎮 ${t('stage_matches_menu')}`,
      `╚══════════════════════╝`,
      '',
      `📊 <b>${escapeHtml(stage.name)}</b>`,
      `📅 ${stage.date}`,
      '',
      `📦 ${t('stage_matches_total')}: <b>${matches.length}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    matches.forEach((m) => {
      const statusEmoji = { pending: '⏳', submitted: '📤', approved: '✅', rejected: '❌' };
      const emoji = statusEmoji[m.resultStatus] || '•';
      const hostLabel = m.hostId ? `🎙 <code>${m.hostId}</code>` : `⚠️ ${t('stage_match_no_host')}`;
      const roomLabel = m.roomId ? `🆔 ${m.roomId}` : `🆔 ${t('stage_match_no_host')}`;

      lines.push(
        `${emoji} <b>${t('promotion_day')} ${m.dayNumber} — #${m.dayMatchNumber || m.matchNumber}</b>\n` +
          `   🗺 ${m.map || 'Erangel'}\n` +
          `   👥 ${(m.teams || []).length}/${m.teamsPerMatch}\n` +
          `   ${hostLabel}\n` +
          `   ${roomLabel}`
      );
      lines.push('');
    });

    const kb = matchesListKeyboard(matches, stage.id);

    try {
      await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 11. BITTA MATCH
  // ============================================================
  bot.action(/^stg:mv:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return ctx.reply(t('stage_not_found'));

    const stage = await stageService.getStage(match.stageId);
    const teamsMap = {};
    for (const tid of match.teams || []) {
      const tm = await teamService.getTeam(tid);
      if (tm) teamsMap[tid] = tm;
    }

    const matchText = stageMatchService.formatMatchText(match, teamsMap);

    const teamLines = [];
    if (match.teams?.length) {
      teamLines.push('');
      teamLines.push(`<b>${t('stage_match_teams')}:</b>`);
      match.teams.forEach((tid, i) => {
        const tm = teamsMap[tid];
        teamLines.push(
          `${i + 1}. ${tm ? escapeHtml(tm.name) + ' [' + escapeHtml(tm.tag) + ']' : tid}`
        );
      });
    } else {
      teamLines.push('');
      teamLines.push(`<i>${t('stage_match_no_host')}</i>`);
    }

    const fullText = matchText + '\n' + teamLines.join('\n');
    const kb = matchActionsKeyboard(match, stage?.id || match.stageId);

    try {
      await ctx.editMessageText(fullText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(fullText, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 12. HOST BIRIKTIRISH
  // ============================================================
  bot.action(/^stg:mh:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return ctx.reply(t('stage_not_found'));

    const hosts = await roleService.list('host');
    if (!hosts.length) return ctx.reply(`❌ ${t('host_no_hosts')}`);

    const text =
      `🎙 <b>${t('stage_match_assign_host')}</b>\n\n` +
      `🎮 ${t('promotion_day')} ${match.dayNumber} — #${match.dayMatchNumber || match.matchNumber}\n` +
      `🗺 ${match.map || 'Erangel'}\n` +
      `👥 ${t('stage_match_teams')}: ${(match.teams || []).length}\n\n` +
      `👇 ${t('host_pick_new')}`;

    const kb = hostPickerKeyboard(hosts, match.id);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  bot.action(/^stg:mhs:(.+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const matchId = ctx.match[1];
    const hostId = Number(ctx.match[2]);

    await stageMatchService.assignHost(matchId, hostId);

    try {
      const match = await stageMatchService.getMatch(matchId);
      const stage = await stageService.getStage(match.stageId);
      const tournament = await tournamentService.getTournament(match.tournamentId);

      await bot.telegram.sendMessage(
        hostId,
        `╔══════════════════════╗\n` +
          `   🎙 <b>${t('stage_match_new_assigned')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 ${escapeHtml(tournament?.title || '-')}\n` +
          `📊 ${escapeHtml(stage?.name || '-')}\n\n` +
          `📅 ${t('promotion_day')}: <b>${match.dayNumber}</b>\n` +
          `🎮 ${t('stage_match_num')}: <b>#${match.dayMatchNumber || match.matchNumber}</b>\n` +
          `🗺 ${t('stage_match_map')}: <b>${match.map || 'Erangel'}</b>\n` +
          `📆 ${match.date} | ⏰ ${match.startTime}\n` +
          `👥 ${t('stage_match_teams')}: <b>${(match.teams || []).length}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('stage_match_open'),
                  callback_data: CALLBACK.HOST_STAGE_MATCH + match.id,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {}

    await auditService.log({ action: 'ASSIGN_HOST', actorId: ctx.from.id, matchId, details: { hostId } });

    await ctx.reply(`✅ ${t('stage_match_host_assigned')}: <code>${hostId}</code>`, {
      parse_mode: 'HTML',
    });
  });

  // ============================================================
  // 13. NATIJALARNI TASDIQLASH
  // ============================================================
  bot.action(/^stg:ra:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    try {
      await stageMatchService.approveResults(match.id, ctx.from.id);

      await auditService.log({
        action: 'APPROVE_RESULTS',
        actorId: ctx.from.id,
        tournamentId: match.tournamentId,
        stageId: match.stageId,
        matchId: match.id,
      });

      await ctx.reply(
        `✅ <b>${t('stage_match_results_approved')}</b>\n\n` +
          `🗺 ${match.map || 'Erangel'}\n\n` +
          `<i>${t('stage_result_wait_approval')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t('btn_back'), callback_data: CALLBACK.STAGE_MATCH_VIEW + match.id }],
              [{ text: t('stage_matches_menu'), callback_data: CALLBACK.STAGE_MATCHES_LIST + match.stageId }],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 14. QAYTA OCHISH
  // ============================================================
  bot.action(/^stg:ro:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    try {
      await stageMatchService.reopenResults(match.id);

      await auditService.log({
        action: 'REOPEN_RESULTS',
        actorId: ctx.from.id,
        matchId: match.id,
      });

      await ctx.reply(`🔓 <b>${t('stage_reopened_results')}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: t('btn_back'), callback_data: CALLBACK.STAGE_MATCH_VIEW + match.id }],
          ],
        },
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 15. RAD ETISH
  // ============================================================
  bot.action(/^stg:rr:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    try {
      await stageMatchService.rejectResults(match.id, t('stage_rejected_results'));

      await ctx.reply(`❌ <b>${t('stage_rejected_results')}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 16. BOSHLASH
  // ============================================================
  bot.action(/^stg:start:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return;

    try {
      await stageService.setStageStatus(stage.id, STAGE_STATUS.IN_PROGRESS);

      await auditService.log({
        action: 'START_STAGE',
        actorId: ctx.from.id,
        tournamentId: stage.tournamentId,
        stageId: stage.id,
      });

      await ctx.reply(`▶️ <b>${escapeHtml(stage.name)} ${t('stage_started')}</b>`, {
        parse_mode: 'HTML',
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 17. YAKUNLASH
  // ============================================================
  bot.action(/^stg:fin:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const stage = await stageService.getStage(ctx.match[1]);
    if (!stage) return;

    const allApproved = await stageMatchService.isStageAllApproved(stage.id);

    if (!allApproved) {
      return ctx.reply(`⚠️ <b>${t('stage_not_all_approved')}</b>`, { parse_mode: 'HTML' });
    }

    try {
      await stageService.setStageStatus(stage.id, STAGE_STATUS.COMPLETED);

      await auditService.log({
        action: 'FINISH_STAGE',
        actorId: ctx.from.id,
        tournamentId: stage.tournamentId,
        stageId: stage.id,
      });

      await ctx.reply(`✅ <b>${escapeHtml(stage.name)} ${t('stage_finished')}</b>`, {
        parse_mode: 'HTML',
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 18. FSM — BRACKET QADAMLARI
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('stage_bracket_')) return next();
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) {
      ctx.session = { state: null, data: {} };
      return next();
    }

    const v = cleanText(ctx.message.text, 5);
    if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);

    const num = Number(v);
    const cfg = ctx.session.data.config || { ...DEFAULT_BRACKET };

    // QF
    if (s === STATES.STAGE_BRACKET_DAYS_QF) {
      if (num < 1 || num > LIMITS.STAGE_MAX_DAYS) return ctx.reply(`❗ 1-${LIMITS.STAGE_MAX_DAYS}`);
      cfg.quarter_final.numberOfDays = num;
      ctx.session.state = STATES.STAGE_BRACKET_MATCHES_QF;
      return ctx.reply(`✅ ${t('stage_days_label')}: <b>${num}</b>\n\n📍 <b>${t('stage_matches_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_MATCHES_QF) {
      if (num < 1 || num > LIMITS.STAGE_MAX_MATCHES_PER_DAY) return ctx.reply(`❗ 1-${LIMITS.STAGE_MAX_MATCHES_PER_DAY}`);
      cfg.quarter_final.matchesPerDay = num;
      ctx.session.state = STATES.STAGE_BRACKET_TEAMS_QF;
      return ctx.reply(`✅ ${t('stage_matches_per_day')}: <b>${num}</b>\n\n📍 <b>${t('stage_teams_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_TEAMS_QF) {
      if (num < LIMITS.STAGE_MIN_TEAMS_PER_MATCH || num > LIMITS.STAGE_MAX_TEAMS_PER_MATCH) {
        return ctx.reply(`❗ ${LIMITS.STAGE_MIN_TEAMS_PER_MATCH}-${LIMITS.STAGE_MAX_TEAMS_PER_MATCH}`);
      }
      cfg.quarter_final.teamsPerMatch = num;
      ctx.session.state = STATES.STAGE_BRACKET_QUALIFIERS_QF;
      return ctx.reply(`✅ ${t('stage_teams_per_match')}: <b>${num}</b>\n\n📍 <b>${t('stage_qualifiers_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_QUALIFIERS_QF) {
      if (num < 1 || num > cfg.quarter_final.teamsPerMatch) return ctx.reply(`❗ 1-${cfg.quarter_final.teamsPerMatch}`);
      cfg.quarter_final.qualifiersPerDay = num;
      ctx.session.state = STATES.STAGE_BRACKET_DAYS_SF;
      const qfTotal = cfg.quarter_final.numberOfDays * num;
      return ctx.reply(
        `✅ ${t('stage_qualifiers_per_day')}: <b>${num}</b>\n\n📊 ${t('stage_total_qualify')}: <b>${qfTotal}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n📍 <b>1/2 ${t('stage_days_input')}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    // SF
    if (s === STATES.STAGE_BRACKET_DAYS_SF) {
      if (num < 1 || num > LIMITS.STAGE_MAX_DAYS) return ctx.reply(`❗ 1-${LIMITS.STAGE_MAX_DAYS}`);
      cfg.semi_final.numberOfDays = num;
      ctx.session.state = STATES.STAGE_BRACKET_MATCHES_SF;
      return ctx.reply(`✅ ${t('stage_days_label')}: <b>${num}</b>\n\n📍 <b>${t('stage_matches_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_MATCHES_SF) {
      if (num < 1 || num > LIMITS.STAGE_MAX_MATCHES_PER_DAY) return ctx.reply(`❗ 1-${LIMITS.STAGE_MAX_MATCHES_PER_DAY}`);
      cfg.semi_final.matchesPerDay = num;
      ctx.session.state = STATES.STAGE_BRACKET_TEAMS_SF;
      return ctx.reply(`✅ ${t('stage_matches_per_day')}: <b>${num}</b>\n\n📍 <b>${t('stage_teams_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_TEAMS_SF) {
      if (num < LIMITS.STAGE_MIN_TEAMS_PER_MATCH || num > LIMITS.STAGE_MAX_TEAMS_PER_MATCH) {
        return ctx.reply(`❗ ${LIMITS.STAGE_MIN_TEAMS_PER_MATCH}-${LIMITS.STAGE_MAX_TEAMS_PER_MATCH}`);
      }
      cfg.semi_final.teamsPerMatch = num;
      ctx.session.state = STATES.STAGE_BRACKET_QUALIFIERS_SF;
      return ctx.reply(`✅ ${t('stage_teams_per_match')}: <b>${num}</b>\n\n📍 <b>${t('stage_qualifiers_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_QUALIFIERS_SF) {
      if (num < 1 || num > cfg.semi_final.teamsPerMatch) return ctx.reply(`❗ 1-${cfg.semi_final.teamsPerMatch}`);
      cfg.semi_final.qualifiersPerDay = num;
      ctx.session.state = STATES.STAGE_BRACKET_DAYS_F;
      const sfTotal = cfg.semi_final.numberOfDays * num;
      return ctx.reply(
        `✅ ${t('stage_qualifiers_per_day')}: <b>${num}</b>\n\n📊 ${t('stage_total_qualify')}: <b>${sfTotal}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n📍 <b>Final ${t('stage_days_input')}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    // FINAL
    if (s === STATES.STAGE_BRACKET_DAYS_F) {
      if (num < 1 || num > LIMITS.STAGE_MAX_DAYS) return ctx.reply(`❗ 1-${LIMITS.STAGE_MAX_DAYS}`);
      cfg.final.numberOfDays = num;
      ctx.session.state = STATES.STAGE_BRACKET_MATCHES_F;
      return ctx.reply(`✅ ${t('stage_days_label')}: <b>${num}</b>\n\n📍 <b>${t('stage_matches_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_MATCHES_F) {
      if (num < 1 || num > LIMITS.STAGE_MAX_MATCHES_PER_DAY) return ctx.reply(`❗ 1-${LIMITS.STAGE_MAX_MATCHES_PER_DAY}`);
      cfg.final.matchesPerDay = num;
      ctx.session.state = STATES.STAGE_BRACKET_TEAMS_F;
      return ctx.reply(`✅ ${t('stage_matches_per_day')}: <b>${num}</b>\n\n📍 <b>${t('stage_teams_input')}</b>`, { parse_mode: 'HTML' });
    }

    if (s === STATES.STAGE_BRACKET_TEAMS_F) {
      if (num < LIMITS.STAGE_MIN_TEAMS_PER_MATCH || num > LIMITS.STAGE_MAX_TEAMS_PER_MATCH) {
        return ctx.reply(`❗ ${LIMITS.STAGE_MIN_TEAMS_PER_MATCH}-${LIMITS.STAGE_MAX_TEAMS_PER_MATCH}`);
      }
      cfg.final.teamsPerMatch = num;
      cfg.final.qualifiersPerDay = 0;

      const validation = bracketService.validateBracket(cfg);
      ctx.session.data.config = cfg;
      ctx.session.state = 'stage_bracket_confirm';

      const summaryText = bracketService.formatBracketText(cfg);

      const lines = [
        `╔══════════════════════╗`,
        `   📋 <b>${t('stage_bracket_summary')}</b>`,
        `╚══════════════════════╝`,
        '',
        summaryText,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      if (validation.warnings.length) {
        lines.push(`⚠️ <b>${t('stage_bracket_warnings')}</b>`);
        lines.push('');
        lines.push(validation.warnings.join('\n'));
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
      }

      lines.push(`${t('stage_bracket_confirm_q')}`);

      return ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: bracketConfirmKeyboard(ctx.session.data.tournamentId).reply_markup,
      });
    }

    return next();
  });

  // ============================================================
  // 19. FSM — MATCH RESULT INPUT
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.STAGE_MATCH_RESULT_INPUT) return next();
    const t = ctx.t;

    const matchId = ctx.session.data.matchId;
    const match = await stageMatchService.getMatch(matchId);
    if (!match) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(t('stage_not_found'));
    }

    const isHost = Number(match.hostId) === Number(ctx.from.id);
    const isOrg = canManageStages(ctx.state.role);
    if (!isHost && !isOrg) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    try {
      const lines = ctx.message.text.split('\n').map((l) => l.trim()).filter(Boolean);

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
            `❌ ${i + 1} ${t('stage_result_wrong_format')}:\n<code>${escapeHtml(line)}</code>\n\n${t('stage_room_format')}: <code>TAG - KILL</code>`,
            { parse_mode: 'HTML' }
          );
        }

        const tag = m[1].toUpperCase();
        const kills = parseInt(m[2], 10);
        const team = teamsMap[tag];

        if (!team) return ctx.reply(`❌ "${tag}" ${t('stage_result_tag_not_found')}`);

        parsed.push({ teamId: team.id, teamName: team.name, place: i + 1, kills });
      }

      await stageMatchService.setResults(match.id, parsed, ctx.from.id);
      ctx.session = { state: null, data: {} };

      await auditService.log({
        action: 'SUBMIT_RESULTS',
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

      const resultText = stageMatchService.formatMatchResults({ ...match, results: parsed }, teamsMapEnriched);

      await ctx.reply(
        `✅ <b>${t('stage_result_saved')}</b>\n\n${resultText}\n\n⏳ ${t('stage_result_wait_approval')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t('btn_back'), callback_data: CALLBACK.STAGE_MATCH_VIEW + match.id }],
            ],
          },
        }
      );

      const tour = await tournamentService.getTournament(match.tournamentId);
      if (tour?.organizerId && Number(tour.organizerId) !== Number(ctx.from.id)) {
        try {
          await bot.telegram.sendMessage(
            tour.organizerId,
            `📤 <b>${t('stage_result_sent')}</b>\n\n🎮 ${t('promotion_day')} ${match.dayNumber} — #${match.dayMatchNumber || match.matchNumber}\n\n${resultText}`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: t('stage_match_results_view'), callback_data: CALLBACK.STAGE_MATCH_RESULTS_VIEW + match.id }],
                  [{ text: t('stage_match_results_approve'), callback_data: CALLBACK.STAGE_RESULTS_APPROVE + match.id }],
                ],
              },
            }
          );
        } catch (e) {}
      }
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 20. FSM — ROOM INPUT
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'stage_match_room_input') return next();
    const t = ctx.t;

    const matchId = ctx.session.data.matchId;
    const match = await stageMatchService.getMatch(matchId);
    if (!match) {
      ctx.session = { state: null, data: {} };
      return next();
    }

    const v = cleanText(ctx.message.text, 40);
    if (!v) return ctx.reply(`❗ ${t('error_only_digits')}`);

    try {
      let roomId, roomPassword;
      const idMatch = v.match(/ID[:=\s]+([^\s]+)/i);
      const passMatch = v.match(/PASS(?:WORD)?[:=\s]+([^\s]+)/i);

      if (idMatch && passMatch) {
        roomId = idMatch[1];
        roomPassword = passMatch[1];
      } else {
        const parts = v.split(/\s+/);
        if (parts.length >= 2) {
          roomId = parts[0];
          roomPassword = parts[1];
        } else {
          return ctx.reply(`❗ ${t('stage_room_format')}: <code>ID: 123456 PASS: ABC123</code>`, { parse_mode: 'HTML' });
        }
      }

      await stageMatchService.setRoom(match.id, { roomId, roomPassword });
      ctx.session = { state: null, data: {} };

      let sent = 0;
      try {
        const tournament = await tournamentService.getTournament(match.tournamentId);
        const stage = await stageService.getStage(match.stageId);
        const memberIds = new Set();

        for (const tid of match.teams || []) {
          const team = await teamService.getTeam(tid);
          if (team) team.members.forEach((m) => memberIds.add(m));
        }

        for (const uid of memberIds) {
          try {
            await bot.telegram.sendMessage(
              uid,
              `🆔 <b>${t('host_stage_room_info')}</b>\n\n` +
                `🏆 ${escapeHtml(tournament.title)}\n` +
                `📊 ${escapeHtml(stage.name)}\n` +
                `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🆔 ${t('tour_room_info')}: <code>${escapeHtml(roomId)}</code>\n` +
                `🔒 ${t('password')}: <code>${escapeHtml(roomPassword)}</code>`,
              {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: t('btn_copy_room_id'), copy_text: { text: String(roomId) } }],
                    [{ text: t('btn_copy_password'), copy_text: { text: String(roomPassword) } }],
                  ],
                },
              }
            );
            sent++;
          } catch (e) {}
        }
      } catch (e) {}

      await ctx.reply(
        `✅ <b>${t('stage_room_saved')}</b>\n\n` +
          `🆔 <code>${escapeHtml(roomId)}</code>\n` +
          `🔒 <code>${escapeHtml(roomPassword)}</code>\n\n` +
          `📤 ${t('stage_room_sent_to')}: <b>${sent}</b> ${t('stage_room_players')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t('btn_back'), callback_data: CALLBACK.STAGE_MATCH_VIEW + match.id }],
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
  // 21. ROOM INPUT BOSHLASH
  // ============================================================
  bot.action(/^stg:mri:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    ctx.session = { state: 'stage_match_room_input', data: { matchId: match.id } };

    await ctx.reply(
      `🆔 <b>${t('stage_room_input_prompt')}</b>\n\n` +
        `🎮 ${t('promotion_day')} ${match.dayNumber} — #${match.dayMatchNumber || match.matchNumber}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 ${t('stage_room_format')}:\n<code>ID: 123456 PASS: ABC123</code>\n\n` +
        `<i>${t('wallet_admin_add_example')}</i>\n\n` +
        `<code>123456 ABC123</code>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 22. ROOM QAYTA YUBORISH
  // ============================================================
  bot.action(/^stg:mrs:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManageStages(ctx.state.role)) return;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;
    if (!match.roomId || !match.roomPassword) return ctx.reply(`❗ ${t('stage_match_no_host')}`);

    try {
      const tournament = await tournamentService.getTournament(match.tournamentId);
      const stage = await stageService.getStage(match.stageId);
      const memberIds = new Set();

      for (const tid of match.teams || []) {
        const team = await teamService.getTeam(tid);
        if (team) team.members.forEach((m) => memberIds.add(m));
      }

      let sent = 0;
      for (const uid of memberIds) {
        try {
          await bot.telegram.sendMessage(
            uid,
            `🔄 <b>${t('host_stage_room_info')}</b>\n\n` +
              `🏆 ${escapeHtml(tournament.title)}\n` +
              `📊 ${escapeHtml(stage.name)}\n` +
              `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}\n\n` +
              `🆔 ${t('tour_room_info')}: <code>${escapeHtml(match.roomId)}</code>\n` +
              `🔒 ${t('password')}: <code>${escapeHtml(match.roomPassword)}</code>`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 60));
      }

      await ctx.reply(`✅ ${t('stage_room_sent_to')}: <b>${sent}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 23. NATIJALARNI KO'RISH
  // ============================================================
  bot.action(/^stg:mrv:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    const teamsMap = {};
    for (const tid of match.teams || []) {
      const tm = await teamService.getTeam(tid);
      if (tm) teamsMap[tid] = tm;
    }

    const resultText = stageMatchService.formatMatchResults(match, teamsMap);
    await ctx.reply(resultText, { parse_mode: 'HTML' });
  });

  // ============================================================
  // 24. NATIJALARNI KIRITISH BOSHLASH
  // ============================================================
  bot.action(/^stg:mres:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const match = await stageMatchService.getMatch(ctx.match[1]);
    if (!match) return;

    const isHost = Number(match.hostId) === Number(ctx.from.id);
    const isOrg = canManageStages(ctx.state.role);

    if (!isHost && !isOrg) return ctx.reply(`⛔ ${t('error_access')}`);

    ctx.session = { state: STATES.STAGE_MATCH_RESULT_INPUT, data: { matchId: match.id } };

    const teamLines = [];
    for (let i = 0; i < (match.teams || []).length; i++) {
      const tm = await teamService.getTeam(match.teams[i]);
      if (tm) teamLines.push(`${i + 1}. <b>${escapeHtml(tm.tag)}</b> — ${escapeHtml(tm.name)}`);
    }

    await ctx.reply(
      `📊 <b>${t('stage_match_results_input')}</b>\n\n` +
        `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>${t('stage_match_teams')}:</b>\n${teamLines.join('\n')}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>${t('stage_result_format')}:</b>\n\n` +
        `<code>TAG - KILL</code>\n\n` +
        `<i>Tartib = o'rin (1-chi qator = 1-o'rin)</i>\n\n` +
        `${t('stage_result_example')}:\n<code>UP - 5\nN1 - 3\nS7 - 2</code>`,
      { parse_mode: 'HTML' }
    );
  });
};