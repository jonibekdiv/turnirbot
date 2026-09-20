// ============================================================
// START HANDLER — Ko'p tilli (/start, profil, yordam)
// ============================================================
const { Markup } = require('telegraf');
const { mainKeyboard } = require('../keyboards/mainKeyboard');
const userService = require('../services/userService');
const teamService = require('../services/teamService');
const tournamentService = require('../services/tournamentService');
const langService = require('../services/langService');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { resolveRole } = require('../middlewares/auth');
const { CALLBACK, ROLES } = require('../constants');

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

    // ctx.state.lang ni yangilaymiz
    ctx.state.lang = lang;
    const t = (key, vars) => langService.t(lang, key, vars);

    // ---------- Deep-link: join_TEAMCODE ----------
    if (payload.startsWith('join_')) {
      const code = payload.slice(5).toUpperCase();
      return handleJoinByCode(ctx, code, user, lang);
    }

    // ---------- Deep-link: tour_TOURID ----------
    if (payload.startsWith('tour_')) {
      let id = payload;
      // tour_tour_xxx → tour_xxx
      if (payload.startsWith('tour_tour_')) id = payload.slice(5);
      return handleTournamentDeepLink(ctx, id, role, lang);
    }

    // ---------- Standart welcome ----------
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
  // ASOSIY MENYU
  // ============================================================
  bot.action(CALLBACK.MENU_MAIN, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.state.role || (await resolveRole(ctx.from.id));
    const lang = ctx.state.lang || langService.DEFAULT_LANG;
    await safeEdit(ctx, `🏠 ${ctx.t('menu_main')}`, mainKeyboard(role, lang));
  });

  // ============================================================
  // PROFIL
  // ============================================================
  bot.action(CALLBACK.MENU_PROFILE, async (ctx) => {
    await safeAnswer(ctx);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u) {
      return ctx.reply('❗ /start', {
        reply_markup: { inline_keyboard: [[{ text: '/start', url: 'https://t.me/' + require('../config').BOT_USERNAME }]] },
      });
    }

    const team = u.teamId ? await teamService.getTeam(u.teamId) : null;
    const lang = ctx.state.lang || 'uz';
    const t = (key, vars) => langService.t(lang, key, vars);

    // Rol nomini tarjima qilish
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
  // YORDAM
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
  // /cancel buyrug'i
  // ============================================================
  bot.command('cancel', async (ctx) => {
    ctx.session = { state: null, data: {} };
    await ctx.reply(ctx.t('cancel'), {
      parse_mode: 'HTML',
      ...mainKeyboard(ctx.state.role, ctx.state.lang),
    });
  });

  // ============================================================
  // Umumiy "Bekor qilish" tugmasi
  // ============================================================
  bot.action(CALLBACK.CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    await safeEdit(ctx, `❌ <b>${ctx.t('cancel')}</b>`);
  });

  // ============================================================
  // /help buyrug'i
  // ============================================================
  bot.command('help', async (ctx) => {
    const role = ctx.state.role || 'player';
    const lang = ctx.state.lang || 'uz';
    await ctx.reply(ctx.t('menu_help'), {
      parse_mode: 'HTML',
      ...mainKeyboard(role, lang),
    });
  });
};

// ============================================================
// DEEP-LINK: join_CODE (ko'p tilli)
// ============================================================
async function handleJoinByCode(ctx, code, user, lang) {
  const t = (key, vars) => langService.t(lang, key, vars);

  // Allaqachon komandada
  if (user.teamId) {
    const existingTeam = await teamService.getTeam(user.teamId);
    const messages = {
      uz:
        `❗ <b>Siz allaqachon komandadasiz</b>\n\n` +
        `👥 Komanda: <b>${existingTeam ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']' : "noma'lum"}</b>\n\n` +
        `<i>Boshqa komandaga qo'shilish uchun avval joriy komandadan chiqing.</i>`,
      en:
        `❗ <b>You are already in a team</b>\n\n` +
        `👥 Team: <b>${existingTeam ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']' : 'unknown'}</b>\n\n` +
        `<i>Leave your current team first to join another.</i>`,
      ru:
        `❗ <b>Вы уже в команде</b>\n\n` +
        `👥 Команда: <b>${existingTeam ? escapeHtml(existingTeam.name) + ' [' + escapeHtml(existingTeam.tag) + ']' : 'неизвестно'}</b>\n\n` +
        `<i>Сначала покиньте текущую команду.</i>`,
    };
    return ctx.reply(messages[lang] || messages.uz, { parse_mode: 'HTML' });
  }

  // Kodni tekshirish
  const team = await teamService.getTeamByCode(code);
  if (!team) {
    const messages = {
      uz: `❌ <b>Kod noto'g'ri yoki eskirgan</b>\n\nKiritilgan kod: <code>${escapeHtml(code)}</code>\n\n<i>Captain'dan to'g'ri kodni so'rang.</i>`,
      en: `❌ <b>Invalid or expired code</b>\n\nEntered code: <code>${escapeHtml(code)}</code>\n\n<i>Ask the captain for the correct code.</i>`,
      ru: `❌ <b>Код неверный или устарел</b>\n\nВведённый код: <code>${escapeHtml(code)}</code>\n\n<i>Попросите правильный код у капитана.</i>`,
    };
    return ctx.reply(messages[lang] || messages.uz, { parse_mode: 'HTML' });
  }

  // Komanda to'lganligini tekshirish
  if (!(await teamService.canAddMember(team.id))) {
    const messages = {
      uz: `⚠️ <b>Komanda to'lgan</b>\n\n<b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> komandasida allaqachon 8 ta o'yinchi bor.`,
      en: `⚠️ <b>Team is full</b>\n\n<b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> already has 8 players.`,
      ru: `⚠️ <b>Команда заполнена</b>\n\nВ команде <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> уже 8 игроков.`,
    };
    return ctx.reply(messages[lang] || messages.uz, { parse_mode: 'HTML' });
  }

  // A'zo qo'shish
  await teamService.addMember(team.id, user.id);
  await userService.setUserTeam(user.id, team.id);

  const successMessages = {
    uz:
      `╔══════════════════════╗\n` +
      `   🎉 <b>MUVAFFAQIYAT!</b>\n` +
      `╚══════════════════════╝\n\n` +
      `✅ Siz <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> komandasiga qo'shildingiz!\n\n` +
      `👥 A'zolar: <b>${team.members.length + 1}/8</b>`,
    en:
      `╔══════════════════════╗\n` +
      `   🎉 <b>SUCCESS!</b>\n` +
      `╚══════════════════════╝\n\n` +
      `✅ You joined <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>!\n\n` +
      `👥 Members: <b>${team.members.length + 1}/8</b>`,
    ru:
      `╔══════════════════════╗\n` +
      `   🎉 <b>УСПЕШНО!</b>\n` +
      `╚══════════════════════╝\n\n` +
      `✅ Вы присоединились к <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>!\n\n` +
      `👥 Участников: <b>${team.members.length + 1}/8</b>`,
  };

  await ctx.reply(successMessages[lang] || successMessages.uz, {
    parse_mode: 'HTML',
  });

  // Captain'ga xabar
  try {
    await ctx.telegram.sendMessage(
      team.captainId,
      `ℹ️ <b>${escapeHtml(displayName(user))}</b> — ${escapeHtml(team.name)}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    /* Captain botni bloklagan */
  }
}

// ============================================================
// DEEP-LINK: tour_TOURID (ko'p tilli)
// ============================================================
async function handleTournamentDeepLink(ctx, tournamentId, role, lang) {
  // tour_ prefiksi yo'q bo'lsa qo'shamiz
  let id = tournamentId;
  if (!id.startsWith('tour_')) {
    id = 'tour_' + id;
  }

  const t = await tournamentService.getTournament(id);
  const tr = (key) => langService.t(lang, key);

  if (!t) {
    return ctx.reply(tr('tour_not_found'), {
      parse_mode: 'HTML',
      ...mainKeyboard(role, lang),
    });
  }

  // Foydalanuvchi ro'yxatdan o'tganmi?
  const user = await userService.getUser(ctx.from.id);
  const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;
  const isRegistered = team && t.registeredTeams.includes(team.id);

  // Ro'yxat holati
  const regStatus =
    t.registeredTeams.length >= t.maxTeams
      ? lang === 'uz'
        ? "🔴 To'lgan"
        : lang === 'ru'
        ? '🔴 Заполнено'
        : '🔴 Full'
      : t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
      ? lang === 'uz'
        ? '🔴 Yopilgan'
        : lang === 'ru'
        ? '🔴 Закрыто'
        : '🔴 Closed'
      : lang === 'uz'
      ? '🟢 Ochiq'
      : lang === 'ru'
      ? '🟢 Открыто'
      : '🟢 Open';

  // Sarlavha matni
  const headerText =
    lang === 'uz'
      ? '🏆 TURNIR TAFSILOTI'
      : lang === 'ru'
      ? '🏆 ИНФОРМАЦИЯ О ТУРНИРЕ'
      : '🏆 TOURNAMENT DETAILS';

  const labels = {
    uz: { date: 'Sana', time: 'Vaqt', mode: 'Rejim', map: 'Xarita', teams: 'Командаlar', reg: "Ro'yxatdan o'tish", host: 'Host' },
    en: { date: 'Date', time: 'Time', mode: 'Mode', map: 'Map', teams: 'Teams', reg: 'Registration', host: 'Host' },
    ru: { date: 'Дата', time: 'Время', mode: 'Режим', map: 'Карта', teams: 'Команды', reg: 'Регистрация', host: 'Хост' },
  }[lang] || { date: 'Sana', time: 'Vaqt', mode: 'Rejim', map: 'Xarita', teams: 'Командаlar', reg: "Ro'yxatdan o'tish", host: 'Host' };

  const text =
    `╔══════════════════════╗\n` +
    `   ${headerText}\n` +
    `╚══════════════════════╝\n\n` +
    `🎯 <b>${escapeHtml(t.title)}</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📅 <b>${labels.date}:</b> ${t.date}\n` +
    `⏰ <b>${labels.time}:</b> ${t.startTime} (${t.timezone})\n` +
    `🎮 <b>${labels.mode}:</b> ${escapeHtml(t.mode)}\n` +
    `🗺 <b>${labels.map}:</b> ${escapeHtml(t.map || 'Erangel')}\n` +
    `👥 <b>${labels.teams}:</b> ${t.registeredTeams.length}/${t.maxTeams}\n` +
    `📝 <b>${labels.reg}:</b> ${regStatus}\n` +
    `🎙 <b>${labels.host}:</b> ${t.hostId ? '✅' : '❌'}\n` +
    (t.prize ? `💲 <b>PRIZ:</b> ${escapeHtml(t.prize)}\n` : '') +
    (t.mapTag ? `♾️ <b>MAP:</b> ${escapeHtml(t.mapTag)}\n` : '') +
    (t.etapa ? `⭐️ <b>Etap:</b> ${escapeHtml(t.etapa)}\n` : '') +
    (t.description ? `\n━━━━━━━━━━━━━━━━━━━━\n\n📄 ${escapeHtml(t.description)}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👇 ${lang === 'uz' ? 'Amalni tanlang' : lang === 'ru' ? 'Выберите действие' : 'Choose an action'}:`;

  const buttons = [
    [{ text: tr('tour_standings'), callback_data: 'tour:st:' + t.id }],
    [{ text: tr('tour_teamlist'), callback_data: 'tour:tl:' + t.id }],
    [{ text: tr('tour_register'), callback_data: 'tour:reg:' + t.id }],
  ];

  // Room info (agar ro'yxatdan o'tgan bo'lsa)
  if (isRegistered) {
    if (t.roomId && t.roomPassword) {
      buttons.push([{ text: tr('tour_room_info'), callback_data: 'tour:room_info:' + t.id }]);
    } else {
      buttons.push([{ text: tr('tour_room_waiting'), callback_data: 'tour:room_info:' + t.id }]);
    }
  }

  buttons.push([{ text: tr('tour_contact_host'), callback_data: 'tour:contact_host:' + t.id }]);
  buttons.push([{ text: tr('menu_main'), callback_data: 'menu:main' }]);

  const keyboard = { inline_keyboard: buttons };

  if (t.imageFileId) {
    try {
      return await ctx.replyWithPhoto(t.imageFileId, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (e) {
      /* rasm yuborilmasa matnga o'tamiz */
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}