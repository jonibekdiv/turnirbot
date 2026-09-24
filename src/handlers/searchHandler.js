// ============================================================
// SEARCH HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const searchUtils = require('../utils/searchUtils');
const { CALLBACK, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

module.exports = (bot) => {
  // ============================================================
  // 1. QIDIRUV MENYUSI
  // ============================================================
  bot.action(CALLBACK.SEARCH_START, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('admin_tournaments'), CALLBACK.SEARCH_TOUR)],
      [Markup.button.callback(t('admin_teams'), CALLBACK.SEARCH_TEAM)],
      [Markup.button.callback(t('btn_back'), CALLBACK.MENU_TOURNAMENTS)],
    ]);

    await safeEdit(ctx, `🔍 <b>${t('menu_search')}</b>\n\n${t('support_pick_type')}`, {
      reply_markup: kb.reply_markup,
    });
  });

  bot.action(CALLBACK.SEARCH_TOUR, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    ctx.session = { state: STATES.SEARCH_QUERY, data: { type: 'tour' } };
    await safeEdit(ctx, `🏆 <b>${t('tour_create_name_prompt')}:</b>`);
  });

  bot.action(CALLBACK.SEARCH_TEAM, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    ctx.session = { state: STATES.SEARCH_QUERY, data: { type: 'team' } };
    await safeEdit(ctx, `👥 <b>${t('team_ask_name')}:</b>`);
  });

  // ============================================================
  // 2. FILTRLAR
  // ============================================================
  bot.action(CALLBACK.FILTER_TOUR, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const rows = [];
    rows.push([
      Markup.button.callback(t('promo_status_active'), 'filter:mode:all'),
      Markup.button.callback('🎯 Solo', 'filter:mode:solo'),
      Markup.button.callback('👥 Duo', 'filter:mode:duo'),
      Markup.button.callback('⚔️ Squad', 'filter:mode:squad'),
    ]);
    rows.push([
      Markup.button.callback('🗺 Erangel', 'filter:map:erangel'),
      Markup.button.callback('Miramar', 'filter:map:miramar'),
      Markup.button.callback('Rondo', 'filter:map:rondo'),
    ]);
    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.MENU_TOURNAMENTS)]);

    await safeEdit(ctx, `🎛 <b>${t('support_pick_type')}</b>`, {
      reply_markup: { inline_keyboard: rows },
    });
  });

  bot.action(/^filter:mode:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const mode = ctx.match[1];
    const all = await tournamentService.getAllTournaments();
    const filtered =
      mode === 'all' ? all : all.filter((tour) => (tour.mode || '').toLowerCase() === mode);

    await showFiltered(ctx, filtered, `${t('mode')}: <b>${mode}</b>`);
  });

  bot.action(/^filter:map:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const map = ctx.match[1];
    const all = await tournamentService.getAllTournaments();
    const filtered =
      map === 'all' ? all : all.filter((tour) => (tour.map || '').toLowerCase().includes(map));

    await showFiltered(ctx, filtered, `${t('stage_match_map')}: <b>${map}</b>`);
  });

  // ============================================================
  // 3. FSM — SEARCH QUERY
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.SEARCH_QUERY) return next();
    const t = ctx.t;

    const type = ctx.session.data.type;
    const query = cleanText(ctx.message.text, 50);
    ctx.session = { state: null, data: {} };

    if (type === 'tour') {
      const all = await tournamentService.getAllTournaments();
      const found = searchUtils.searchTournaments(all, query);

      if (!found.length) return ctx.reply(`📭 ${t('no_data')}`);

      const lines = [`🔍 <b>${t('standings_title')}: ${found.length}</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
      const rows = [];

      found.slice(0, 10).forEach((tour, i) => {
        lines.push(`<b>${i + 1}. ${escapeHtml(tour.title)}</b>`);
        lines.push(`   📅 ${tour.date} | ⏰ ${tour.startTime}`);
        lines.push('');
        rows.push([Markup.button.callback(`🔍 ${tour.title.slice(0, 25)}`, CALLBACK.TOUR_OPEN + tour.id)]);
      });
      rows.push([Markup.button.callback(t('btn_back'), CALLBACK.SEARCH_START)]);

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }

    if (type === 'team') {
      const all = await teamService.getAllTeams();
      const found = searchUtils.searchTeams(all, query);

      if (!found.length) return ctx.reply(`📭 ${t('no_data')}`);

      const lines = [`🔍 <b>${t('standings_title')}: ${found.length}</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
      found.slice(0, 10).forEach((tm, i) => {
        lines.push(`<b>${i + 1}. ${escapeHtml(tm.name)} [${escapeHtml(tm.tag)}]</b>`);
        lines.push(`   👥 ${tm.members.length}/${t('team_members_count')}`);
        lines.push('');
      });

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[Markup.button.callback(t('btn_back'), CALLBACK.SEARCH_START)]] },
      });
    }
  });
};

// ============================================================
// YORDAMCHI
// ============================================================
async function showFiltered(ctx, list, title) {
  const t = ctx.t;

  if (!list.length) return ctx.reply(`📭 ${title}\n\n${t('no_data')}`);

  const lines = [title, `📊 ${t('promotion_total')}: <b>${list.length}</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
  const rows = [];
  list.slice(0, 10).forEach((tour, i) => {
    lines.push(`<b>${i + 1}. ${escapeHtml(tour.title)}</b>`);
    lines.push(`   📅 ${tour.date} | 🎮 ${escapeHtml(tour.mode)}`);
    lines.push('');
    rows.push([Markup.button.callback(`🔍 ${tour.title.slice(0, 25)}`, CALLBACK.TOUR_OPEN + tour.id)]);
  });
  rows.push([Markup.button.callback(t('btn_back'), CALLBACK.FILTER_TOUR)]);

  try {
    await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
  } catch {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
  }
}