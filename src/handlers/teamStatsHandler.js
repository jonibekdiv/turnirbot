// ============================================================
// TEAM STATS HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const teamStatsService = require('../services/teamStatsService');
const userService = require('../services/userService');
const { CALLBACK } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');

module.exports = (bot) => {
  // ============================================================
  // 1. TO'LIQ STATISTIKA
  // ============================================================
  bot.action(CALLBACK.TEAM_STATS_FULL, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const u = ctx.state.user || (await userService.getUser(ctx.from.id));
      if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

      const stats = await teamStatsService.getTeamFullStats(u.teamId);
      if (!stats) return ctx.reply(`❗ ${t('error_not_found')}`);

      const rankInfo = await teamStatsService.getTeamRank(u.teamId);

      const text =
        `╔══════════════════════╗\n` +
        `   📊 <b>${t('team_stats_full')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(stats.team.name)}</b> [${escapeHtml(stats.team.tag)}]\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎮 ${t('promotion_matches')}: <b>${stats.matches}</b>\n` +
        `🥇 ${t('promotion_wins')}: <b>${stats.wins}</b> (${stats.winRate}%)\n` +
        `🏅 ${t('team_stats_top3')}: <b>${stats.top3}</b>\n` +
        `💥 ${t('promotion_kills')}: <b>${stats.kills}</b>\n` +
        `💯 ${t('promotion_points')}: <b>${stats.points}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📈 ${t('team_stats_avg_place_short')}: <b>${stats.avgPlacement}</b>\n` +
        `🎯 ${t('team_stats_avg_kill_short')}: <b>${stats.avgKills}</b>\n` +
        `🏆 ${t('team_stats_best_place')}: <b>${stats.bestPlacement ? '#' + stats.bestPlacement : '—'}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 ${t('team_stats_rank_position')}: <b>#${rankInfo.rank || '?'}/${rankInfo.total}</b>`;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(t('team_stats_rank'), CALLBACK.TEAM_LEADERBOARD),
          Markup.button.callback(t('team_history_full') || t('team_history'), CALLBACK.TEAM_HISTORY_FULL),
        ],
        [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
      ]);

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      } catch (e) {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
    } catch (e) {
      console.error('team:stats_full xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });

  // ============================================================
  // 2. TO'LIQ TARIX
  // ============================================================
  bot.action(CALLBACK.TEAM_HISTORY_FULL, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const u = ctx.state.user || (await userService.getUser(ctx.from.id));
      if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

      const history = await teamStatsService.getTeamFullHistory(u.teamId, 20);

      if (!history.length) {
        const kb = Markup.inlineKeyboard([
          [Markup.button.callback(t('btn_back'), CALLBACK.TEAM_STATS_FULL)],
        ]);
        return ctx.editMessageText(`📭 <b>${t('team_history_empty')}</b>`, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }

      const lines = [
        `📜 <b>${t('team_history_title')} (${history.length})</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      history.slice(0, 10).forEach((h, i) => {
        const tour = h.tournament;
        const status = tour.type === 'paid' ? '💳' : '🆓';
        lines.push(
          `<b>${i + 1}. ${escapeHtml(tour.title)}</b> ${status}\n` +
            `   📅 ${tour.date}\n` +
            `   🎮 ${h.matches} | 🎯 ${h.kills} kill | 💯 ${h.points} pts\n` +
            `   🥇 ${h.wins} win | 🏆 Best: ${h.bestPlacement ? '#' + h.bestPlacement : '—'}`
        );
        lines.push('');
      });

      if (history.length > 10) {
        lines.push(`<i>... +${history.length - 10}</i>`);
        lines.push('');
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(t('team_stats'), CALLBACK.TEAM_STATS_FULL),
          Markup.button.callback(t('team_stats_rank'), CALLBACK.TEAM_LEADERBOARD),
        ],
        [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
      ]);

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
    } catch (e) {
      console.error('team:history_full xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });

  // ============================================================
  // 3. LEADERBOARD
  // ============================================================
  bot.action(CALLBACK.TEAM_LEADERBOARD, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const list = await teamStatsService.getLeaderboard(10);

      if (!list.length) {
        const kb = Markup.inlineKeyboard([
          [Markup.button.callback(t('btn_back'), CALLBACK.MENU_TEAM)],
        ]);
        return ctx.editMessageText(`📭 <b>${t('team_leaderboard_empty')}</b>`, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }

      const lines = [`🏆 <b>${t('team_leaderboard')}</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      list.forEach((s, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        lines.push(
          `${medal} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]\n` +
            `   💯 <b>${s.points}</b> pts | 🎯 ${s.kills} kill | 🥇 ${s.wins} win\n` +
            `   🎮 ${s.matches} (${s.winRate}% win)`
        );
        lines.push('');
      });

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(t('team_stats'), CALLBACK.TEAM_STATS_FULL),
          Markup.button.callback(t('team_history'), CALLBACK.TEAM_HISTORY_FULL),
        ],
        [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
      ]);

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
    } catch (e) {
      console.error('team:leaderboard xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });

  // ============================================================
  // 4. BOSHQA JAMOANI KO'RISH
  // ============================================================
  bot.action(/^ts:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const teamId = ctx.match[1];
      const stats = await teamStatsService.getTeamFullStats(teamId);

      if (!stats) return ctx.reply(`❗ ${t('error_not_found')}`);

      const text =
        `╔══════════════════════╗\n` +
        `   📊 <b>${t('team_stats_title')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(stats.team.name)}</b> [${escapeHtml(stats.team.tag)}]\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎮 ${t('promotion_matches')}: <b>${stats.matches}</b>\n` +
        `🥇 ${t('promotion_wins')}: <b>${stats.wins}</b>\n` +
        `🎯 ${t('promotion_kills')}: <b>${stats.kills}</b>\n` +
        `💯 ${t('promotion_points')}: <b>${stats.points}</b>`;

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('btn_back'), CALLBACK.MENU_TOURNAMENTS)],
      ]);

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      console.error('team:view xatosi:', e.message);
    }
  });
};