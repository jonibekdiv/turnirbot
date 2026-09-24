// ============================================================
// USER EXT HANDLER — Foydalanuvchi (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const userService = require('../services/userService');
const userExtService = require('../services/userExtService');
const { CALLBACK, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

function backToProfile(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. PUBG ID
  // ============================================================
  bot.action(CALLBACK.USER_PUBG_ID, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = await userService.getUser(ctx.from.id);
    ctx.session = { state: STATES.PLAYER_PUBG_ID, data: {} };

    await safeEdit(
      ctx,
      `🎯 <b>${t('user_pubg_id_title')}</b>\n\n` +
        `${t('user_pubg_current')}: <code>${escapeHtml(u?.pubgId || '-')}</code>\n\n` +
        `${t('user_pubg_id_prompt')}`,
      { parse_mode: 'HTML', reply_markup: backToProfile(t).reply_markup }
    );
  });

  // ============================================================
  // 2. SHAXSIY STATISTIKA
  // ============================================================
  bot.action(CALLBACK.USER_STATS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const stats = await userExtService.getUserStats(ctx.from.id);
    if (!stats) return ctx.reply(`❗ ${t('error_generic')}`);

    const { user, teamStats } = stats;
    let text = `👤 <b>${t('user_stats_title')}</b>\n\n`;
    text += `📛 ${escapeHtml([user.firstName, user.lastName].filter(Boolean).join(' ') || '-')}\n`;
    text += `🆔 <code>${user.id}</code>\n`;
    text += `🎯 PUBG ID: <code>${escapeHtml(user.pubgId || '-')}</code>\n\n`;

    if (teamStats) {
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `🎮 ${t('promotion_matches')}: <b>${teamStats.matches}</b>\n`;
      text += `🏆 ${t('promotion_wins')}: <b>${teamStats.wins}</b>\n`;
      text += `💥 ${t('promotion_kills')}: <b>${teamStats.kills}</b>\n`;
      text += `💯 ${t('promotion_points')}: <b>${teamStats.points}</b>`;
    } else {
      text += `<i>${t('user_no_team')}</i>`;
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('profile_achievements'), CALLBACK.USER_ACHIEVEMENTS)],
      [Markup.button.callback(t('profile_leaderboard'), CALLBACK.USER_LEADERBOARD)],
      [Markup.button.callback(t('profile_set_pubg'), CALLBACK.USER_PUBG_ID)],
      [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
    ]);

    await safeEdit(ctx, text, { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 3. ACHIEVEMENTS
  // ============================================================
  bot.action(CALLBACK.USER_ACHIEVEMENTS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    await userExtService.checkAchievements(ctx.from.id);
    const achs = await userExtService.getUserAchievements(ctx.from.id);

    const lines = [];
    lines.push(`🏅 <b>${t('user_achievements_title')}</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const a of achs) {
      const icon = a.earned ? '✅' : '🔒';
      lines.push(`${icon} <b>${a.name}</b>`);
      lines.push(`   <i>${a.desc}</i>`);
    }

    const earned = achs.filter((a) => a.earned).length;
    lines.push('');
    lines.push(`📊 ${t('user_achievements_count')}: <b>${earned}/${achs.length}</b>`);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('team_stats'), CALLBACK.USER_STATS)],
      [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
    ]);

    await safeEdit(ctx, lines.join('\n'), { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 4. LEADERBOARD
  // ============================================================
  bot.action(CALLBACK.USER_LEADERBOARD, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const list = await userExtService.getLeaderboard(10);
    const text = userExtService.formatLeaderboard(list);

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(t('user_lb_by_points'), 'user:lbm:pts'),
        Markup.button.callback(t('user_lb_by_kills'), 'user:lbm:kills'),
      ],
      [Markup.button.callback(t('user_lb_by_wins'), 'user:lbm:wins')],
      [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  bot.action(/^user:lbm:(pts|kills|wins)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const mode = ctx.match[1];
    let list = await userExtService.getLeaderboard(50);

    if (mode === 'kills') list.sort((a, b) => b.kills - a.kills);
    else if (mode === 'wins') list.sort((a, b) => b.wins - a.wins);

    list = list.slice(0, 10);
    const text = userExtService.formatLeaderboard(list, mode === 'pts' ? 'all' : mode);

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(t('user_lb_by_points'), 'user:lbm:pts'),
        Markup.button.callback(t('user_lb_by_kills'), 'user:lbm:kills'),
      ],
      [Markup.button.callback(t('user_lb_by_wins'), 'user:lbm:wins')],
      [Markup.button.callback(t('menu_profile'), CALLBACK.MENU_PROFILE)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {}
  });

  // ============================================================
  // 5. FSM — PUBG ID
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.PLAYER_PUBG_ID) return next();
    const t = ctx.t;

    const v = cleanText(ctx.message.text, 30);
    if (!v) return ctx.reply(`❗ ${t('user_pubg_id_prompt')}`, backToProfile(t));

    await userExtService.setPubgId(ctx.from.id, v);
    ctx.session = { state: null, data: {} };

    await ctx.reply(
      `✅ <b>${t('user_pubg_id_saved')}</b>\n\n🎯 <code>${escapeHtml(v)}</code>`,
      { parse_mode: 'HTML', reply_markup: backToProfile(t).reply_markup }
    );
  });
};