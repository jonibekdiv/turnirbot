// ============================================================
// TEAM STATS HANDLER — Komanda statistikasi va tarixi (#10, #15)
// ============================================================
const { Markup } = require('telegraf');
const teamStatsService = require('../services/teamStatsService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');

module.exports = (bot) => {
  // ============================================================
  // #10 TO'LIQ STATISTIKA
  // ============================================================
  bot.action(CALLBACK.TEAM_STATS_FULL, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const u = ctx.state.user || (await userService.getUser(ctx.from.id));
      if (!u?.teamId) {
        return ctx.reply("❗ Siz komandada emassiz.");
      }

      const stats = await teamStatsService.getTeamFullStats(u.teamId);
      if (!stats) {
        return ctx.reply("❗ Komanda topilmadi.");
      }

      const rankInfo = await teamStatsService.getTeamRank(u.teamId);

      const text =
        `╔══════════════════════╗\n` +
        `   📊 <b>STATISTIKA</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(stats.team.name)}</b> [${escapeHtml(
          stats.team.tag
        )}]\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎮 O'yinlar: <b>${stats.matches}</b>\n` +
        `🥇 G'alabalar: <b>${stats.wins}</b> (${stats.winRate}%)\n` +
        `🏅 Top-3: <b>${stats.top3}</b>\n` +
        `💥 Kill'lar: <b>${stats.kills}</b>\n` +
        `💯 Ballar: <b>${stats.points}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📈 O'rtacha o'rin: <b>${stats.avgPlacement}</b>\n` +
        `🎯 O'rtacha kill: <b>${stats.avgKills}</b>\n` +
        `🏆 Eng yaxshi o'rin: <b>${
          stats.bestPlacement ? '#' + stats.bestPlacement : '—'
        }</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 Reyting: <b>#${rankInfo.rank || '?'}/${rankInfo.total}</b>`;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback('🏆 Reyting', CALLBACK.TEAM_LEADERBOARD),
          Markup.button.callback('📜 Tarix', CALLBACK.TEAM_HISTORY_FULL),
        ],
        [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TEAM)],
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
    } catch (e) {
      console.error('team:stats_full xatosi:', e.message);
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });

  // ============================================================
  // #15 TO'LIQ TARIX
  // ============================================================
  bot.action(CALLBACK.TEAM_HISTORY_FULL, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const u = ctx.state.user || (await userService.getUser(ctx.from.id));
      if (!u?.teamId) {
        return ctx.reply("❗ Siz komandada emassiz.");
      }

      const history = await teamStatsService.getTeamFullHistory(u.teamId, 20);

      if (!history.length) {
        const kb = Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Orqaga', CALLBACK.TEAM_STATS_FULL)],
        ]);
        return ctx.editMessageText(
          "📭 <b>Hali turnirlarda qatnashmadingiz</b>",
          { parse_mode: 'HTML', reply_markup: kb.reply_markup }
        );
      }

      const lines = [
        `📜 <b>Turnirlar tarixi (${history.length})</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      history.slice(0, 10).forEach((h, i) => {
        const t = h.tournament;
        const status = t.type === 'paid' ? '💳' : '🆓';
        lines.push(
          `<b>${i + 1}. ${escapeHtml(t.title)}</b> ${status}\n` +
            `   📅 ${t.date}\n` +
            `   🎮 ${h.matches} karta | 🎯 ${h.kills} kill | 💯 ${h.points} pts\n` +
            `   🥇 ${h.wins} win | 🏆 Best: ${
              h.bestPlacement ? '#' + h.bestPlacement : '—'
            }`
        );
        lines.push('');
      });

      if (history.length > 10) {
        lines.push(`<i>... va yana ${history.length - 10} ta</i>`);
        lines.push('');
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Statistika', CALLBACK.TEAM_STATS_FULL),
          Markup.button.callback('🏆 Reyting', CALLBACK.TEAM_LEADERBOARD),
        ],
        [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TEAM)],
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
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });

  // ============================================================
  // LEADERBOARD — TOP 10
  // ============================================================
  bot.action(CALLBACK.TEAM_LEADERBOARD, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const list = await teamStatsService.getLeaderboard(10);

      if (!list.length) {
        const kb = Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TEAM)],
        ]);
        return ctx.editMessageText("📭 <b>Reyting yo'q</b>", {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }

      const lines = [`🏆 <b>TOP-10 KOMANDALAR</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      list.forEach((s, i) => {
        const medal =
          i === 0
            ? '🥇'
            : i === 1
            ? '🥈'
            : i === 2
            ? '🥉'
            : `${i + 1}.`;
        lines.push(
          `${medal} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]\n` +
            `   💯 <b>${s.points}</b> pts | 🎯 ${s.kills} kill | 🥇 ${s.wins} win\n` +
            `   🎮 ${s.matches} o'yin (${s.winRate}% win)`
        );
        lines.push('');
      });

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Statistika', CALLBACK.TEAM_STATS_FULL),
          Markup.button.callback('📜 Tarix', CALLBACK.TEAM_HISTORY_FULL),
        ],
        [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TEAM)],
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
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });

  // ============================================================
  // TAKLIF QILINGAN: Boshqa jamoani ko'rish
  // ============================================================
  bot.action(/^ts:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const teamId = ctx.match[1];
      const stats = await teamStatsService.getTeamFullStats(teamId);

      if (!stats) {
        return ctx.reply("❗ Komanda topilmadi.");
      }

      const text =
        `╔══════════════════════╗\n` +
        `   📊 <b>KOMANDA STATISTIKASI</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(stats.team.name)}</b> [${escapeHtml(
          stats.team.tag
        )}]\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎮 O'yinlar: <b>${stats.matches}</b>\n` +
        `🥇 G'alabalar: <b>${stats.wins}</b>\n` +
        `🎯 Kill'lar: <b>${stats.kills}</b>\n` +
        `💯 Ballar: <b>${stats.points}</b>`;

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TOURNAMENTS)],
      ]);

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      console.error('team:view xatosi:', e.message);
    }
  });
};