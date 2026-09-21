// ============================================================
// START HANDLER — Ko'p tilli (/start + buyruqlar)
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
  // /start buyrug'i
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
  // /tournaments — Turnirlar
  // ============================================================
  bot.command('tournaments', async (ctx) => {
    const lang = ctx.state.lang || 'uz';
    const t = (key) => langService.t(lang, key);

    await ctx.reply(t('tournaments_title'), {
      parse_mode: 'HTML',
      ...tournamentsMenu(),
    });
  });

  // ============================================================
  // /team — Komandam
  // ============================================================
  bot.command('team', async (ctx) => {
    const lang = ctx.state.lang || 'uz';
    const t = (key) => langService.t(lang, key);

    await ctx.reply(t('team_title'), {
      parse_mode: 'HTML',
      ...teamMenu,
    });
  });

  // ============================================================
  // /profile — Profil
  // ============================================================
  bot.command('profile', async (ctx) => {
    const u = await userService.getUser(ctx.from.id);
    if (!u) return ctx.reply('❗ /start bosing');

    const team = u.teamId ? await teamService.getTeam(u.teamId) : null;
    const lang = ctx.state.lang || 'uz';
    const t = (key, vars) => langService.t(lang, key, vars);

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

    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...kb,
    });
  });

  // ============================================================
  // /language — Til tanlash
  // ============================================================
  bot.command('language', async (ctx) => {
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("🇺🇿 O'zbek", 'lang:set:uz')],
      [Markup.button.callback('🇬🇧 English', 'lang:set:en')],
      [Markup.button.callback('🇷🇺 Русский', 'lang:set:ru')],
      [Markup.button.callback('⬅️ ' + ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    const current = ctx.state.lang || 'uz';
    const currentName = langService.getLangName(current);

    await ctx.reply(
      `🌐 <b>Tilni tanlang / Select language / Выберите язык</b>\n\n` +
        `${ctx.t('language_current', { lang: currentName })}`,
      { parse_mode: 'HTML', ...kb }
    );
  });

  // ============================================================
  // /leaderboard — Reyting jadvali
  // ============================================================
  bot.command('leaderboard', async (ctx) => {
    let userExtService;
    try {
      userExtService = require('../services/userExtService');
    } catch (e) {
      return ctx.reply('❌ Leaderboard xizmati yuklanmagan');
    }

    const list = await userExtService.getLeaderboard(10);
    const text = userExtService.formatLeaderboard(list);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ ' + ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...kb,
    });
  });

  // ============================================================
  // /search — Qidiruv
  // ============================================================
  bot.command('search', async (ctx) => {
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🏆 ' + ctx.t('menu_tournaments'), CALLBACK.SEARCH_TOUR)],
      [Markup.button.callback('👥 ' + ctx.t('menu_team'), CALLBACK.SEARCH_TEAM)],
      [Markup.button.callback('⬅️ ' + ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(`🔍 <b>${ctx.t('menu_search')}</b>`, {
      parse_mode: 'HTML',
      ...kb,
    });
  });

  // ============================================================
  // /help — Yordam
  // ============================================================
  bot.command('help', async (ctx) => {
    const role = ctx.state.role || 'player';
    const lang = ctx.state.lang || 'uz';
    const t = (key) => langService.t(lang, key);

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
      `🇺🇿 O'zbek · 🇬🇧 English · 🇷🇺 Русский\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 /start · /cancel · /help`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...mainKeyboard(role, lang),
    });
  });

  // ============================================================
  // /cancel — Jarayonni bekor qilish
  // ============================================================
  bot.command('cancel', async (ctx) => {
    ctx.session = { state: null, data: {} };
    await ctx.reply(`❌ <b>${ctx.t('cancel')}</b>`, {
      parse_mode: 'HTML',
      ...mainKeyboard(ctx.state.role, ctx.state.lang),
    });
  });

  // ============================================================
  // ASOSIY MENYU (callback)
  // ============================================================
  bot.action(CALLBACK.MENU_MAIN, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.state.role || (await resolveRole(ctx.from.id));
    const lang = ctx.state.lang || langService.DEFAULT_LANG;
    await safeEdit(ctx, `🏠 ${ctx.t('menu_main')}`, mainKeyboard(role, lang));
  });

  // ============================================================
  // PROFIL (callback)
  // ============================================================
  bot.action(CALLBACK.MENU_PROFILE, async (ctx) => {
    await safeAnswer(ctx);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u) return ctx.reply('❗ /start bosing');

    const team = u.teamId ? await teamService.getTeam(u.teamId) : null;
    const lang = ctx.state.lang || 'uz';
    const t = (key, vars) => langService.t(lang, key, vars);

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
  });

  // ============================================================
  // YORDAM (callback)
  // ============================================================
  bot.action(CALLBACK.MENU_HELP, async (ctx) => {
    await safeAnswer(ctx);
    const lang = ctx.state.lang || 'uz';
    const t = (key) => langService.t(lang, key);

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
      `🇺🇿 O'zbek · 🇬🇧 English · 🇷🇺 Русский\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 /start · /cancel · /help`;

    await safeEdit(ctx, text, mainKeyboard(ctx.state.role, lang));
  });

  // ============================================================
  // "Bekor qilish" tugmasi
  // ============================================================
  bot.action(CALLBACK.CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    await safeEdit(ctx, `❌ <b>${ctx.t('cancel')}</b>`);
  });
};

// ============================================================
// DEEP-LINK: join_CODE
// ============================================================
async function handleJoinByCode(ctx, code, user, lang) {
  if (user.teamId) {
    const existingTeam = await teamService.getTeam(user.teamId);
    const messages = {
      uz:
        `❗ <b>Siz allaqachon komandadasiz</b>\n\n` +
        `👥 Komanda: <b>${
          existingTeam
            ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']'
            : "noma'lum"
        }</b>`,
      en:
        `❗ <b>You are already in a team</b>\n\n` +
        `👥 Team: <b>${
          existingTeam
            ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']'
            : 'unknown'
        }</b>`,
      ru:
        `❗ <b>Вы уже в команде</b>\n\n` +
        `👥 Команда: <b>${
          existingTeam
            ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']'
            : 'неизвестно'
        }</b>`,
    };
    return ctx.reply(messages[lang] || messages.uz, { parse_mode: 'HTML' });
  }

  const team = await teamService.getTeamByCode(code);
  if (!team) {
    const messages = {
      uz: `❌ <b>Kod noto'g'ri yoki eskirgan</b>\n\nKiritilgan kod: <code>${escapeHtml(code)}</code>`,
      en: `❌ <b>Invalid or expired code</b>\n\nEntered code: <code>${escapeHtml(code)}</code>`,
      ru: `❌ <b>Код неверный или устарел</b>\n\nВведённый код: <code>${escapeHtml(code)}</code>`,
    };
    return ctx.reply(messages[lang] || messages.uz, { parse_mode: 'HTML' });
  }

  if (!(await teamService.canAddMember(team.id))) {
    const messages = {
      uz: `⚠️ <b>Komanda to'lgan</b>`,
      en: `⚠️ <b>Team is full</b>`,
      ru: `⚠️ <b>Команда заполнена</b>`,
    };
    return ctx.reply(messages[lang] || messages.uz, { parse_mode: 'HTML' });
  }

  await teamService.addMember(team.id, user.id);
  await userService.setUserTeam(user.id, team.id);

  const successMessages = {
    uz: `✅ Siz <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> komandasiga qo'shildingiz!\n👥 A'zolar: <b>${team.members.length + 1}/8</b>`,
    en: `✅ You joined <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>!\n👥 Members: <b>${team.members.length + 1}/8</b>`,
    ru: `✅ Вы присоединились к <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>!\n👥 Участников: <b>${team.members.length + 1}/8</b>`,
  };
  await ctx.reply(successMessages[lang] || successMessages.uz, { parse_mode: 'HTML' });

  try {
    await ctx.telegram.sendMessage(
      team.captainId,
      `ℹ️ <b>${escapeHtml(displayName(user))}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}
}

// ============================================================
// DEEP-LINK: tour_TOURID
// ============================================================
async function handleTournamentDeepLink(ctx, tournamentId, role, lang) {
  let id = tournamentId;
  if (!id.startsWith('tour_')) id = 'tour_' + id;

  const t = await tournamentService.getTournament(id);
  const tr = (key) => langService.t(lang, key);

  if (!t) {
    return ctx.reply(tr('tour_not_found'), {
      parse_mode: 'HTML',
      ...mainKeyboard(role, lang),
    });
  }

  const user = await userService.getUser(ctx.from.id);
  const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
  const isRegistered = team && t.registeredTeams.includes(team.id);

  const text =
    `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
    `📅 ${t.date} | ⏰ ${t.startTime}\n` +
    `🎮 ${escapeHtml(t.mode)}\n` +
    `👥 ${t.registeredTeams.length}/${t.maxTeams}\n` +
    (t.prize ? `💲 ${escapeHtml(t.prize)}\n` : '');

  const buttons = [
    [{ text: tr('tour_standings'), callback_data: 'tour:st:' + t.id }],
    [{ text: tr('tour_teamlist'), callback_data: 'tour:tl:' + t.id }],
    [{ text: tr('tour_register'), callback_data: 'tour:reg:' + t.id }],
  ];

  if (isRegistered) {
    if (t.roomId && t.roomPassword) {
      buttons.push([{ text: tr('tour_room_info'), callback_data: 'tour:room_info:' + t.id }]);
    } else {
      buttons.push([{ text: tr('tour_room_waiting'), callback_data: 'tour:room_info:' + t.id }]);
    }
  }

  buttons.push([{ text: tr('tour_contact_host'), callback_data: 'tour:contact_host:' + t.id }]);
  buttons.push([{ text: tr('menu_main'), callback_data: 'menu:main' }]);

  if (t.imageFileId) {
    try {
      return await ctx.replyWithPhoto(t.imageFileId, {
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