// ============================================================
// START HANDLER — Ko'p tilli (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const { mainKeyboard } = require('../keyboards/mainKeyboard');
const { tournamentsMenu } = require('../keyboards/tournamentKeyboard');
const { teamMenu } = require('../keyboards/teamKeyboard');
const userService = require('../services/userService');
const teamService = require('../services/teamService');
const tournamentService = require('../services/tournamentService');
const langService = require('../services/langService');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { resolveRole } = require('../middlewares/auth');
const { CALLBACK } = require('../constants');

module.exports = (bot) => {
  // ============================================================
  // /start
  // ============================================================
  bot.start(async (ctx) => {
    const payload = ctx.startPayload || '';
    const tg = ctx.from;

    const user = await userService.upsertUser(tg);
    const role = await resolveRole(tg.id);
    const lang = await langService.getUserLang(tg.id);

    ctx.state.lang = lang;
    const t = (key, vars) => langService.t(lang, key, vars);

    // Deep-link: join_TEAMCODE
    if (payload.startsWith('join_')) {
      const code = payload.slice(5).toUpperCase();
      return handleJoinByCode(ctx, code, user, lang);
    }

    // Deep-link: tour_TOURID
    if (payload.startsWith('tour_')) {
      let id = payload;
      if (payload.startsWith('tour_tour_')) id = payload.slice(5);
      return handleTournamentDeepLink(ctx, id, role, lang);
    }

    // Standart welcome
    let text = t('welcome', { name: escapeHtml(tg.first_name || 'Player') });
    if (!tg.username) {
      text = t('welcome_no_username') + text;
    }

    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...mainKeyboard(role, lang),
    });
  });

  // ============================================================
  // /tournaments
  // ============================================================
  bot.command('tournaments', async (ctx) => {
    const t = ctx.t;
    await ctx.reply(t('tournaments_title'), {
      parse_mode: 'HTML',
      ...tournamentsMenu(ctx),
    });
  });

  // ============================================================
  // /team
  // ============================================================
  bot.command('team', async (ctx) => {
    const t = ctx.t;
    await ctx.reply(`👥 <b>${t('team_title')}</b>\n\n${t('team_subtitle')}`, {
      parse_mode: 'HTML',
      ...teamMenu(ctx),
    });
  });

  // ============================================================
  // /profile
  // ============================================================
  bot.command('profile', async (ctx) => {
    const t = ctx.t;

    const u = await userService.getUser(ctx.from.id);
    if (!u) return ctx.reply(`❗ /start`);

    const team = u.teamId ? await teamService.getTeam(u.teamId) : null;

    const roleKey = 'role_' + (ctx.state.role || 'player');
    const roleName = t(roleKey);

    const text =
      `╔══════════════════════╗\n` +
      `      ${t('profile_title')}\n` +
      `╚══════════════════════╝\n\n` +
      `${t('profile_id')}:\n   <code>${u.id}</code>\n\n` +
      `${t('profile_name')}:\n   <b>${escapeHtml([u.firstName, u.lastName].filter(Boolean).join(' ') || '-')}</b>\n\n` +
      `${t('profile_username')}:\n   ${u.username ? '@' + escapeHtml(u.username) : '❌'}\n\n` +
      `${t('profile_pubg_id')}:\n   <code>${escapeHtml(u.pubgId || '-')}</code>\n\n` +
      `${t('profile_role')}:\n   <b>${roleName}</b>\n\n` +
      `${t('profile_team')}:\n   ${team ? '🔥 <b>' + escapeHtml(team.name) + ' [' + escapeHtml(team.tag) + ']</b>' : '❌'}\n\n` +
      `${t('profile_registered')}:\n   ${new Date(u.createdAt).toLocaleDateString('uz-UZ')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('profile_stats'), CALLBACK.USER_STATS)],
      [Markup.button.callback(t('profile_achievements'), CALLBACK.USER_ACHIEVEMENTS)],
      [Markup.button.callback(t('profile_leaderboard'), CALLBACK.USER_LEADERBOARD)],
      [Markup.button.callback(t('profile_set_pubg'), CALLBACK.USER_PUBG_ID)],
      [Markup.button.callback(t('menu_language'), CALLBACK.MENU_LANGUAGE)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  });

  // ============================================================
  // /language
  // ============================================================
  bot.command('language', async (ctx) => {
    const t = ctx.t;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('language_uz'), 'lang:set:uz')],
      [Markup.button.callback(t('language_en'), 'lang:set:en')],
      [Markup.button.callback(t('language_ru'), 'lang:set:ru')],
      [Markup.button.callback('⬅️ ' + t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    const current = ctx.state.lang || 'uz';
    const currentName = langService.getLangName(current);

    await ctx.reply(
      `${t('language_title')}\n\n` +
        `${t('language_current', { lang: currentName })}`,
      { parse_mode: 'HTML', ...kb }
    );
  });

  // ============================================================
  // /leaderboard
  // ============================================================
  bot.command('leaderboard', async (ctx) => {
    const t = ctx.t;

    let userExtService;
    try {
      userExtService = require('../services/userExtService');
    } catch (e) {
      return ctx.reply(`❌ ${t('error_generic')}`);
    }

    const list = await userExtService.getLeaderboard(10);
    const text = userExtService.formatLeaderboard(list);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ ' + t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  });

  // ============================================================
  // /search
  // ============================================================
  bot.command('search', async (ctx) => {
    const t = ctx.t;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🏆 ' + t('menu_tournaments'), CALLBACK.SEARCH_TOUR)],
      [Markup.button.callback('👥 ' + t('menu_team'), CALLBACK.SEARCH_TEAM)],
      [Markup.button.callback('⬅️ ' + t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(`🔍 <b>${t('menu_search')}</b>`, { parse_mode: 'HTML', ...kb });
  });

  // ============================================================
  // /help
  // ============================================================
  bot.command('help', async (ctx) => {
    const t = ctx.t;
    const role = ctx.state.role || 'player';
    const lang = ctx.state.lang || 'uz';

    const text =
      `╔══════════════════════╗\n` +
      `         ℹ️ <b>${t('menu_help')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${t('menu_tournaments')}\n` +
      `${t('menu_team')}\n` +
      `${t('menu_profile')}\n` +
      `${t('menu_search')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>${t('menu_language')}:</b>\n` +
      `${t('language_uz')} · ${t('language_en')} · ${t('language_ru')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 /start · /cancel · /help`;

    await ctx.reply(text, { parse_mode: 'HTML', ...mainKeyboard(role, lang) });
  });

  // ============================================================
  // /cancel
  // ============================================================
  bot.command('cancel', async (ctx) => {
    const t = ctx.t;
    ctx.session = { state: null, data: {} };
    await ctx.reply(`❌ <b>${t('cancel')}</b>`, {
      parse_mode: 'HTML',
      ...mainKeyboard(ctx.state.role, ctx.state.lang),
    });
  });

  // ============================================================
  // ASOSIY MENYU
  // ============================================================
  bot.action(CALLBACK.MENU_MAIN, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    const role = ctx.state.role || (await resolveRole(ctx.from.id));
    const lang = ctx.state.lang || langService.DEFAULT_LANG;
    await safeEdit(ctx, `🏠 ${t('menu_main')}`, mainKeyboard(role, lang));
  });

  // ============================================================
  // PROFIL (callback)
  // ============================================================
  bot.action(CALLBACK.MENU_PROFILE, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u) return ctx.reply(`❗ /start`);

    const team = u.teamId ? await teamService.getTeam(u.teamId) : null;
    const lang = ctx.state.lang || 'uz';

    const roleKey = 'role_' + (ctx.state.role || 'player');
    const roleName = t(roleKey);

    const text =
      `╔══════════════════════╗\n` +
      `      ${t('profile_title')}\n` +
      `╚══════════════════════╝\n\n` +
      `${t('profile_id')}:\n   <code>${u.id}</code>\n\n` +
      `${t('profile_name')}:\n   <b>${escapeHtml([u.firstName, u.lastName].filter(Boolean).join(' ') || '-')}</b>\n\n` +
      `${t('profile_username')}:\n   ${u.username ? '@' + escapeHtml(u.username) : '❌'}\n\n` +
      `${t('profile_pubg_id')}:\n   <code>${escapeHtml(u.pubgId || '-')}</code>\n\n` +
      `${t('profile_role')}:\n   <b>${roleName}</b>\n\n` +
      `${t('profile_team')}:\n   ${team ? '🔥 <b>' + escapeHtml(team.name) + ' [' + escapeHtml(team.tag) + ']</b>' : '❌'}\n\n` +
      `${t('profile_registered')}:\n   ${new Date(u.createdAt).toLocaleDateString('uz-UZ')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('profile_stats'), CALLBACK.USER_STATS)],
      [Markup.button.callback(t('profile_achievements'), CALLBACK.USER_ACHIEVEMENTS)],
      [Markup.button.callback(t('profile_leaderboard'), CALLBACK.USER_LEADERBOARD)],
      [Markup.button.callback(t('profile_set_pubg'), CALLBACK.USER_PUBG_ID)],
      [Markup.button.callback(t('menu_language'), CALLBACK.MENU_LANGUAGE)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // YORDAM (callback)
    // ============================================================
  // YORDAM (callback) — 4 ta rol uchun
  // ============================================================
  bot.action(CALLBACK.MENU_HELP, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const text =
      `╔══════════════════════╗\n` +
      `   ℹ️ <b>${t('help_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${t('help_pick_role')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎮 <b>${t('help_btn_player')}</b>\n` +
      `   <i>${t('help_btn_player_desc')}</i>\n\n` +
      `🎙 <b>${t('help_btn_host')}</b>\n` +
      `   <i>${t('help_btn_host_desc')}</i>\n\n` +
      `🎯 <b>${t('help_btn_organizer')}</b>\n` +
      `   <i>${t('help_btn_organizer_desc')}</i>\n\n` +
      `🛡 <b>${t('help_btn_admin')}</b>\n` +
      `   <i>${t('help_btn_admin_desc')}</i>`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('help_btn_player'), CALLBACK.HELP_PLAYER)],
      [Markup.button.callback(t('help_btn_host'), CALLBACK.HELP_HOST)],
      [Markup.button.callback(t('help_btn_organizer'), CALLBACK.HELP_ORGANIZER)],
      [Markup.button.callback(t('help_btn_admin'), CALLBACK.HELP_ADMIN)],
      [Markup.button.callback(t('btn_back'), CALLBACK.MENU_MAIN)],
    ]);

    await safeEdit(ctx, text, { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // YORDAM — PLAYER
  // ============================================================
  bot.action(CALLBACK.HELP_PLAYER, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const text =
      `╔══════════════════════╗\n` +
      `   🎮 <b>${t('help_player_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${t('help_player_body')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('btn_back'), CALLBACK.MENU_HELP)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // YORDAM — HOST
  // ============================================================
  bot.action(CALLBACK.HELP_HOST, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const text =
      `╔══════════════════════╗\n` +
      `   🎙 <b>${t('help_host_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${t('help_host_body')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('btn_back'), CALLBACK.MENU_HELP)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // YORDAM — ORGANIZER
  // ============================================================
  bot.action(CALLBACK.HELP_ORGANIZER, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const text =
      `╔══════════════════════╗\n` +
      `   🎯 <b>${t('help_organizer_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${t('help_organizer_body')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('btn_back'), CALLBACK.MENU_HELP)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // YORDAM — ADMIN
  // ============================================================
  bot.action(CALLBACK.HELP_ADMIN, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const text =
      `╔══════════════════════╗\n` +
      `   🛡 <b>${t('help_admin_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `${t('help_admin_body')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('btn_back'), CALLBACK.MENU_HELP)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });
  // ============================================================
  // BEKOR QILISH
  // ============================================================
  bot.action(CALLBACK.CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    ctx.session = { state: null, data: {} };
    await safeEdit(ctx, `❌ <b>${t('cancel')}</b>`);
  });
};

// ============================================================
// DEEP-LINK: join_CODE
// ============================================================
async function handleJoinByCode(ctx, code, user, lang) {
  const t = (key, vars) => require('../services/langService').t(lang, key, vars);

  if (user.teamId) {
    const existingTeam = await teamService.getTeam(user.teamId);

    return ctx.reply(
      `❗ <b>${t('team_already_member')}</b>\n\n` +
        `👥 ${t('admin_teams')}: <b>${
          existingTeam
            ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']'
            : t('error_not_found')
        }</b>`,
      { parse_mode: 'HTML' }
    );
  }

  const team = await teamService.getTeamByCode(code);
  if (!team) {
    return ctx.reply(
      `❌ <b>${t('team_code_invalid')}</b>\n\n${t('inv_code_label')}: <code>${escapeHtml(code)}</code>`,
      { parse_mode: 'HTML' }
    );
  }

  if (!(await teamService.canAddMember(team.id))) {
    return ctx.reply(`⚠️ <b>${t('team_full')}</b>`, { parse_mode: 'HTML' });
  }

  await teamService.addMember(team.id, user.id);
  await userService.setUserTeam(user.id, team.id);

  await ctx.reply(
    `✅ ${t('team_joined')} <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>!\n` +
      `👥 ${t('team_members_count')}: <b>${team.members.length + 1}/8</b>`,
    { parse_mode: 'HTML' }
  );

  try {
    await ctx.telegram.sendMessage(
      team.captainId,
      `ℹ️ <b>${escapeHtml(displayName(user))}</b> ${t('team_new_member')}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}
}

// ============================================================
// DEEP-LINK: tour_TOURID
// ============================================================
async function handleTournamentDeepLink(ctx, tournamentId, role, lang) {
  const t = (key, vars) => require('../services/langService').t(lang, key, vars);

  let id = tournamentId;
  if (!id.startsWith('tour_')) id = 'tour_' + id;

  const tour = await tournamentService.getTournament(id);
  if (!tour) {
    return ctx.reply(t('tour_not_found'), {
      parse_mode: 'HTML',
      ...mainKeyboard(role, lang),
    });
  }

  const user = await userService.getUser(ctx.from.id);
  const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
  const isRegistered = team && tour.registeredTeams.includes(team.id);

  const text =
    `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
    `📅 ${tour.date} | ⏰ ${tour.startTime}\n` +
    `🎮 ${escapeHtml(tour.mode)}\n` +
    `👥 ${tour.registeredTeams.length}/${tour.maxTeams}\n` +
    (tour.prize ? `💲 ${escapeHtml(tour.prize)}\n` : '');

  const buttons = [
    [{ text: t('tour_standings'), callback_data: 'tour:st:' + tour.id }],
    [{ text: t('tour_teamlist'), callback_data: 'tour:tl:' + tour.id }],
    [{ text: t('tour_register'), callback_data: 'tour:reg:' + tour.id }],
  ];

  if (isRegistered) {
    if (tour.roomId && tour.roomPassword) {
      buttons.push([{ text: t('tour_room_info'), callback_data: 'tour:room_info:' + tour.id }]);
    } else {
      buttons.push([{ text: t('tour_room_waiting'), callback_data: 'tour:room_info:' + tour.id }]);
    }
  }

  buttons.push([{ text: t('tour_contact_host'), callback_data: 'tour:contact_host:' + tour.id }]);
  buttons.push([{ text: t('menu_main'), callback_data: 'menu:main' }]);

  if (tour.imageFileId) {
    try {
      return await ctx.replyWithPhoto(tour.imageFileId, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {}
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}