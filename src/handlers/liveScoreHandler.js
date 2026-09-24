// ============================================================
// LIVE SCORE HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const liveScoreService = require('../services/liveScoreService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const { CALLBACK, STATES, ROLES } = require('../constants');
const { escapeHtml, safeAnswer } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

async function checkHostAccess(ctx, tId) {
  const tour = await tournamentService.getTournament(tId);
  if (!tour) return { ok: false, reason: 'not_found' };

  const isHost = Number(tour.hostId) === Number(ctx.from.id);
  const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);

  if (!isHost && !isAdmin) return { ok: false, reason: 'access' };

  return { ok: true, tournament: tour };
}

module.exports = (bot) => {
  // ============================================================
  // 1. LIVE SESSION BOSHLASH
  // ============================================================
  bot.action(/^ls:start:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);

      if (!res.ok) {
        return ctx.reply(res.reason === 'access' ? `⛔ ${t('error_access')}` : `❗ ${t('tour_not_found')}`);
      }

      const tour = res.tournament;

      if (!tour.registeredTeams.length) return ctx.reply(`❗ ${t('stage_teams_menu')}`);

      await liveScoreService.startSession(tId, ctx.from.id);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   🔴 <b>${t('live_started')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ ${t('live_start')}\n` +
          `📊 ${t('stage_match_teams')}: <b>${tour.registeredTeams.length}</b>\n\n` +
          `👇 ${t('support_choose_type')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t('live_add_kill'), callback_data: 'ls:add:' + tId }],
              [{ text: t('live_add_place'), callback_data: 'ls:place_menu:' + tId }],
              [{ text: t('live_view'), callback_data: 'ls:view:' + tId }],
              [{ text: t('stage_match_results_approve'), callback_data: 'ls:commit:' + tId }],
              [{ text: t('live_end'), callback_data: 'ls:end:' + tId }],
              [{ text: t('btn_back_tournament'), callback_data: CALLBACK.TOUR_OPEN + tId }],
            ],
          },
        }
      );
    } catch (e) {
      console.error('ls:start xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });

  // ============================================================
  // 2. LIVE KO'RISH
  // ============================================================
  bot.action(/^ls:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const session = await liveScoreService.getSession(tId);

      if (!session) return ctx.reply(`📭 ${t('live_not_active')}`);

      const text = await liveScoreService.formatLiveTable(tId);

      const isHost =
        Number(session.hostId) === Number(ctx.from.id) ||
        hasAnyRole(ctx.state.role, [ROLES.ADMIN]);

      const rows = [];
      rows.push([Markup.button.callback(t('btn_refresh'), 'ls:view:' + tId)]);

      if (isHost && session.active) {
        rows.push([Markup.button.callback(t('live_add_kill'), 'ls:add:' + tId)]);
      }

      rows.push([Markup.button.callback(t('btn_back_tournament'), CALLBACK.TOUR_OPEN + tId)]);

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
      } catch (e) {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
      }
    } catch (e) {
      console.error('ls:view xatosi:', e.message);
    }
  });

  // ============================================================
  // 3. KILL QO'SHISH — TEAM TANLASH
  // ============================================================
  bot.action(/^ls:add:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const tour = res.tournament;

      const rows = [];

      for (const teamId of tour.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (!team) continue;

        rows.push([
          Markup.button.callback(
            `🎯 ${team.name.slice(0, 25)} [+1]`,
            'ls:add_k:' + tId + ':' + teamId
          ),
        ]);
      }

      rows.push([Markup.button.callback(t('btn_back'), 'ls:view:' + tId)]);

      try {
        await ctx.editMessageText(
          `🎯 <b>${t('live_add_kill')}</b>\n\n🏆 ${escapeHtml(tour.title)}\n\n${t('support_choose_type')}`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      } catch (e) {
        await ctx.reply(
          `🎯 <b>${t('live_add_kill')}</b>\n\n${t('support_choose_type')}`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      }
    } catch (e) {
      console.error('ls:add xatosi:', e.message);
    }
  });

  // ============================================================
  // 4. KILL +1
  // ============================================================
  bot.action(/^ls:add_k:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const teamId = ctx.match[2];

      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      await liveScoreService.addKills(tId, teamId, 1);

      const text = await liveScoreService.formatLiveTable(tId);

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('live_add_kill'), 'ls:add:' + tId)],
        [Markup.button.callback(t('live_view'), 'ls:view:' + tId)],
      ]);

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      console.error('ls:add_k xatosi:', e.message);
    }
  });

  // ============================================================
  // 5. KILL -1
  // ============================================================
  bot.action(/^ls:rem_k:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const teamId = ctx.match[2];

      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      await liveScoreService.removeKills(tId, teamId, 1);

      const text = await liveScoreService.formatLiveTable(tId);
      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('ls:rem_k xatosi:', e.message);
    }
  });

  // ============================================================
  // 6. O'RIN QO'YISH — TEAM TANLASH
  // ============================================================
  bot.action(/^ls:place_menu:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const tour = res.tournament;
      const rows = [];

      for (const teamId of tour.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (!team) continue;

        rows.push([
          Markup.button.callback(
            `📍 ${team.name.slice(0, 25)}`,
            'ls:add_p:' + tId + ':' + teamId
          ),
        ]);
      }

      rows.push([Markup.button.callback(t('btn_back'), 'ls:view:' + tId)]);

      try {
        await ctx.editMessageText(
          `📍 <b>${t('live_add_place')}</b>\n\n🏆 ${escapeHtml(tour.title)}\n\n${t('support_choose_type')}`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      } catch (e) {
        await ctx.reply(
          `📍 <b>${t('live_add_place')}</b>\n\n${t('support_choose_type')}`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      }
    } catch (e) {
      console.error('ls:place_menu xatosi:', e.message);
    }
  });

  // ============================================================
  // 7. O'RIN KIRITISH BOSQICHI
  // ============================================================
  bot.action(/^ls:add_p:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const teamId = ctx.match[2];

      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const team = await teamService.getTeam(teamId);
      if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);

      ctx.session = { state: STATES.LIVE_PLACE_INPUT, data: { tid: tId, teamId } };

      await ctx.reply(
        `📍 <b>${t('live_place_input')}</b>\n\n` +
          `🏆 ${t('admin_teams')}: <b>${escapeHtml(team.name)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${t('wallet_admin_adjust_example')} (1-18):\n\n` +
          `<i>${t('wallet_admin_adjust_example')}: 5</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: t('btn_cancel'), callback_data: 'ls:view:' + tId }]],
          },
        }
      );
    } catch (e) {
      console.error('ls:add_p xatosi:', e.message);
    }
  });

  // ============================================================
  // 8. FSM — O'RIN KIRITISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.LIVE_PLACE_INPUT) return next();
    const t = ctx.t;

    try {
      const { tid, teamId } = ctx.session.data;
      const v = (ctx.message.text || '').trim();

      if (!/^\d+$/.test(v)) return ctx.reply(`❗ ${t('error_only_digits')} (1-18):`);

      const place = parseInt(v, 10);
      if (place < 1 || place > 18) return ctx.reply(`❗ 1-18:`);

      await liveScoreService.setPlacement(tid, teamId, place);
      ctx.session = { state: null, data: {} };

      const text = await liveScoreService.formatLiveTable(tid);
      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('ls:place_input xatosi:', e.message);
      ctx.session = { state: null, data: {} };
    }
  });

  // ============================================================
  // 9. SESSION YAKUNLASH
  // ============================================================
  bot.action(/^ls:end:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      await liveScoreService.endSession(tId);

      await ctx.reply(`⏹ <b>${t('live_ended')}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back_tournament'), callback_data: CALLBACK.TOUR_OPEN + tId }]],
        },
      });
    } catch (e) {
      console.error('ls:end xatosi:', e.message);
    }
  });

  // ============================================================
  // 10. NATIJALARNI SAQLASH
  // ============================================================
  bot.action(/^ls:commit:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const tour = res.tournament;

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('✅ ' + t('btn_confirm'), 'ls:commit_yes:' + tId)],
        [Markup.button.callback(t('btn_cancel'), 'ls:view:' + tId)],
      ]);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   📋 <b>${t('stage_match_results_approve')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⚠️ <b>${t('confirm_title')}</b>\n\n` +
          `${t('stage_result_wait_approval')}\n\n` +
          `<i>${t('wallet_pay_confirm_question')}</i>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('ls:commit xatosi:', e.message);
    }
  });

  bot.action(/^ls:commit_yes:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const tour = res.tournament;
      const match = await liveScoreService.commitToMatch(tId, ctx.from.id);

      const memberIds = new Set();
      for (const teamId of tour.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (team) team.members.forEach((m) => memberIds.add(m));
      }

      const pointsService = require('../services/pointsService');
      const teamsMap = {};
      for (const teamId of tour.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (team) teamsMap[teamId] = team;
      }

      const cardText = pointsService.formatMatchCard(match, teamsMap);

      let sent = 0;
      for (const uid of memberIds) {
        try {
          await ctx.telegram.sendMessage(
            uid,
            `📊 <b>${escapeHtml(tour.title)}</b>\n\n${cardText}`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 60));
      }

      await ctx.reply(
        `✅ <b>${t('stage_match_results_approved')} #${match.number}</b>\n\n` +
          `📤 ${t('stage_room_sent_to')}: <b>${sent}</b> ${t('stage_room_players')}\n\n` +
          `<i>${t('live_ended')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: t('btn_back_tournament'), callback_data: CALLBACK.TOUR_OPEN + tId }]],
          },
        }
      );
    } catch (e) {
      console.error('ls:commit_yes xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 11. HOST LIVE
  // ============================================================
  bot.action(/^host:live:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const tour = res.tournament;
      const session = await liveScoreService.getSession(tId);
      const isActive = session?.active || false;

      const rows = [];

      if (isActive) {
        rows.push([Markup.button.callback(t('live_add_kill'), 'ls:add:' + tId)]);
        rows.push([Markup.button.callback(t('live_add_place'), 'ls:place_menu:' + tId)]);
        rows.push([Markup.button.callback(t('live_view'), 'ls:view:' + tId)]);
        rows.push([Markup.button.callback(t('stage_match_results_approve'), 'ls:commit:' + tId)]);
        rows.push([Markup.button.callback(t('live_end'), 'ls:end:' + tId)]);
      } else {
        rows.push([Markup.button.callback(t('live_start'), 'ls:start:' + tId)]);
      }

      rows.push([Markup.button.callback(t('btn_back_tournament'), CALLBACK.HOST_OPEN + tId)]);

      await ctx.reply(
        `📡 <b>${t('live_title')}</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${t('promo_status_label')}: <b>${isActive ? '🔴 ' + t('admin_active') : '⚫️'}</b>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
      );
    } catch (e) {
      console.error('host:live xatosi:', e.message);
    }
  });
};