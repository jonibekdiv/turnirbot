// Qidiruv va filtrlar
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const searchUtils = require('../utils/searchUtils');
const { CALLBACK, STATES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

module.exports = (bot) => {
  // ============================================================
  // 52. QIDIRUV MENYUSI
  // ============================================================
  bot.action(CALLBACK.SEARCH_START, async (ctx) => {
    await safeAnswer(ctx);
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🏆 Turnirlarni qidirish', CALLBACK.SEARCH_TOUR)],
      [Markup.button.callback('👥 Komandalarni qidirish', CALLBACK.SEARCH_TEAM)],
      [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TOURNAMENTS)],
    ]);
    await safeEdit(ctx, '🔍 <b>Qidiruv</b>\n\nNimani qidirmoqchisiz?', { reply_markup: kb.reply_markup });
  });

  bot.action(CALLBACK.SEARCH_TOUR, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.SEARCH_QUERY, data: { type: 'tour' } };
    await safeEdit(ctx, '🏆 <b>Turnir nomini kiriting:</b>');
  });

  bot.action(CALLBACK.SEARCH_TEAM, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.SEARCH_QUERY, data: { type: 'team' } };
    await safeEdit(ctx, '👥 <b>Komanda nomi yoki tegini kiriting:</b>');
  });

  // ============================================================
  // 53. FILTRLAR
  // ============================================================
  bot.action(CALLBACK.FILTER_TOUR, async (ctx) => {
    await safeAnswer(ctx);
    const modes = searchUtils.getFilterModes();
    const maps = searchUtils.getFilterMaps();

    const rows = [];
    rows.push([
      Markup.button.callback('🎮 Barcha rejim', 'filter:mode:all'),
      Markup.button.callback('🎯 Solo', 'filter:mode:solo'),
      Markup.button.callback('👥 Duo', 'filter:mode:duo'),
      Markup.button.callback('⚔️ Squad', 'filter:mode:squad'),
    ]);
    rows.push([
      Markup.button.callback('🗺 Barcha xarita', 'filter:map:all'),
      Markup.button.callback('Erangel', 'filter:map:erangel'),
      Markup.button.callback('Miramar', 'filter:map:miramar'),
    ]);
    rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TOURNAMENTS)]);

    await safeEdit(ctx, '🎛 <b>Filtrlash</b>\n\nTanlang:', { reply_markup: { inline_keyboard: rows } });
  });

  bot.action(/^filter:mode:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const mode = ctx.match[1];
    const all = await tournamentService.getAllTournaments();
    const filtered = mode === 'all' ? all : all.filter((t) => (t.mode || '').toLowerCase() === mode);
    await showFiltered(ctx, filtered, `🎮 Rejim: <b>${mode}</b>`);
  });

  bot.action(/^filter:map:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const map = ctx.match[1];
    const all = await tournamentService.getAllTournaments();
    const filtered = map === 'all' ? all : all.filter((t) => (t.map || '').toLowerCase().includes(map));
    await showFiltered(ctx, filtered, `🗺 Xarita: <b>${map}</b>`);
  });

  // ============================================================
  // FSM — SEARCH QUERY
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.SEARCH_QUERY) return next();
    const type = ctx.session.data.type;
    const query = cleanText(ctx.message.text, 50);
    ctx.session = { state: null, data: {} };

    if (type === 'tour') {
      const all = await tournamentService.getAllTournaments();
      const found = searchUtils.searchTournaments(all, query);

      if (!found.length) return ctx.reply('📭 Turnir topilmadi.');

      const lines = [`🔍 <b>Natijalar: ${found.length}</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
      const rows = [];
      found.slice(0, 10).forEach((t, i) => {
        lines.push(`<b>${i + 1}. ${escapeHtml(t.title)}</b>`);
        lines.push(`   📅 ${t.date} | ⏰ ${t.startTime}`);
        lines.push('');
        rows.push([Markup.button.callback(`🔍 ${t.title.slice(0, 25)}`, CALLBACK.TOUR_OPEN + t.id)]);
      });
      rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.SEARCH_START)]);

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }

    if (type === 'team') {
      const all = await teamService.getAllTeams();
      const found = searchUtils.searchTeams(all, query);

      if (!found.length) return ctx.reply('📭 Komanda topilmadi.');

      const lines = [`🔍 <b>Natijalar: ${found.length}</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
      found.slice(0, 10).forEach((t, i) => {
        lines.push(`<b>${i + 1}. ${escapeHtml(t.name)} [${escapeHtml(t.tag)}]</b>`);
        lines.push(`   👥 ${t.members.length}/8 a'zo`);
        lines.push('');
      });

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Orqaga', CALLBACK.SEARCH_START)]] },
      });
    }
  });
};

async function showFiltered(ctx, list, title) {
  if (!list.length) return ctx.reply(`📭 ${title}\n\nNatija yo\'q.`);

  const lines = [title, `📊 Jami: <b>${list.length}</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
  const rows = [];
  list.slice(0, 10).forEach((t, i) => {
    lines.push(`<b>${i + 1}. ${escapeHtml(t.title)}</b>`);
    lines.push(`   📅 ${t.date} | 🎮 ${escapeHtml(t.mode)}`);
    lines.push('');
    rows.push([Markup.button.callback(`🔍 ${t.title.slice(0, 25)}`, CALLBACK.TOUR_OPEN + t.id)]);
  });
  rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.FILTER_TOUR)]);

  try {
    await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
  } catch {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
  }
}