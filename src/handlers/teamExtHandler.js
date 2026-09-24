// ============================================================
// TEAM EXT HANDLER — Ko'p tilli (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const teamService = require('../services/teamService');
const teamExtService = require('../services/teamExtService');
const userService = require('../services/userService');
const { CALLBACK, STATES, LIMITS } = require('../constants');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

function backToTeamEdit(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_back'), CALLBACK.TEAM_EDIT)],
    [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
  ]);
}

function backToTeam(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. KOMANDANI TAHRIRLASH
  // ============================================================
  bot.action(CALLBACK.TEAM_EDIT, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);
    if (team.captainId !== ctx.from.id) {
      return ctx.reply(`❗ ${t('error_not_captain')}`);
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('team_edit_name_btn'), CALLBACK.TEAM_EDIT_FIELD + 'name')],
      [Markup.button.callback(t('team_edit_tag_btn'), CALLBACK.TEAM_EDIT_FIELD + 'tag')],
      [Markup.button.callback(t('team_edit_avatar_btn'), CALLBACK.TEAM_EDIT_FIELD + 'avatar')],
      [Markup.button.callback(t('team_edit_bio_btn'), CALLBACK.TEAM_EDIT_FIELD + 'bio')],
      [Markup.button.callback(t('team_edit_manager_btn'), CALLBACK.TEAM_EDIT_FIELD + 'manager')],
      [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
    ]);

    await safeEdit(
      ctx,
      `✏️ <b>${t('team_edit_menu_title')}</b>\n\n` +
        `🏷 ${t('name')}: <b>${escapeHtml(team.name)}</b>\n` +
        `🔖 ${t('team_tag_label')}: <b>${escapeHtml(team.tag)}</b>\n` +
        `🖼 ${t('image')}: <b>${team.avatarFileId ? '✅' : "yo'q"}</b>\n` +
        `📝 ${t('description')}: <b>${escapeHtml(team.bio || '-')}</b>\n` +
        `👑 ${t('team_manager')}: <b>@${escapeHtml(team.managerUsername || '-')}</b>\n\n` +
        `👇 ${t('team_edit_hint')}`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 2. MAYDON TANLASH
  // ============================================================
  bot.action(/^team:editf:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const field = ctx.match[1];
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);
    if (team.captainId !== ctx.from.id) {
      return ctx.reply(`❗ ${t('error_not_captain')}`);
    }

    const prompts = {
      name: [STATES.TEAM_EDIT_NAME, t('team_edit_prompt_name')],
      tag: [STATES.TEAM_EDIT_TAG, t('team_edit_prompt_tag')],
      avatar: [STATES.TEAM_EDIT_AVATAR, t('team_edit_prompt_avatar')],
      bio: [STATES.TEAM_EDIT_BIO, t('team_edit_prompt_bio')],
      manager: [STATES.TEAM_EDIT_MANAGER, t('team_edit_prompt_manager')],
    };

    const [state, prompt] = prompts[field] || [];
    if (!state) return ctx.reply(`❗ ${t('error_wrong_field')}`);

    ctx.session = { state, data: { field } };
    await ctx.reply(prompt, backToTeamEdit(t));
  });

  // ============================================================
  // 3. KOMANDA STATISTIKASI
  // ============================================================
  bot.action(CALLBACK.TEAM_STATS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const stats = await teamExtService.getTeamStats(u.teamId);
    if (!stats) return ctx.reply(`❗ ${t('error_generic')}`);

    const text =
      `📊 <b>${escapeHtml(stats.team.name)} [${escapeHtml(stats.team.tag)}]</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎮 ${t('promotion_matches')}: <b>${stats.matches}</b>\n` +
      `🏆 ${t('promotion_wins')}: <b>${stats.wins}</b> (${stats.winRate}%)\n` +
      `💥 ${t('promotion_kills')}: <b>${stats.kills}</b>\n` +
      `💯 ${t('promotion_points')}: <b>${stats.points}</b>\n` +
      `📊 ${t('team_stats_avg_place_short')}: <b>${stats.avgPlacement}</b>\n` +
      `🎯 ${t('team_stats_avg_kill_short')}: <b>${stats.avgKills}</b>`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('team_history'), CALLBACK.TEAM_HISTORY)],
      [Markup.button.callback(t('team_members'), CALLBACK.TEAM_MEMBERS)],
      [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
    ]);

    await safeEdit(ctx, text, { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 4. KOMANDA TARIXI
  // ============================================================
  bot.action(CALLBACK.TEAM_HISTORY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const history = await teamExtService.getTeamHistory(u.teamId);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('team_stats'), CALLBACK.TEAM_STATS)],
      [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
    ]);

    if (!history.length) {
      return safeEdit(ctx, `📭 ${t('team_history_empty')}`, { reply_markup: kb.reply_markup });
    }

    const lines = [];
    lines.push(`📜 <b>${t('team_history_title')}</b>`);
    lines.push(`📊 ${t('team_history_total')}: <b>${history.length}</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    history.forEach((h, i) => {
      lines.push(`<b>${i + 1}. ${escapeHtml(h.tournament.title)}</b>`);
      lines.push(`   📅 ${h.tournament.date}`);
      lines.push(
        `   🎮 ${h.matches} | 💯 ${h.points} pts | 🎯 ${h.kills} kill | 🏆 ${h.wins} win`
      );
      lines.push('');
    });

    await safeEdit(ctx, lines.join('\n'), { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 5. CAPTAIN O'ZGARTIRISH
  // ============================================================
  bot.action(CALLBACK.TEAM_CAPTAIN_CHANGE, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);
    if (team.captainId !== ctx.from.id) {
      return ctx.reply(`❗ ${t('error_not_captain')}`);
    }

    const rows = [];
    for (const mId of team.members) {
      if (mId === ctx.from.id) continue;
      const m = await userService.getUser(mId);
      const name = displayName(m);
      rows.push([
        Markup.button.callback(`👑 ${name}`, CALLBACK.TEAM_CAPTAIN_PICK + mId),
      ]);
    }

    rows.push([Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)]);

    if (team.members.length <= 1) {
      return safeEdit(
        ctx,
        `❗ ${t('team_kick_no_members')}\n\n<i>${t('team_kick_choose')}</i>`,
        { reply_markup: { inline_keyboard: rows } }
      );
    }

    await safeEdit(ctx, `👑 <b>${t('team_captain_pick_prompt')}</b>`, {
      reply_markup: { inline_keyboard: rows },
    });
  });

  bot.action(/^team:ccp:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const newCap = parseInt(ctx.match[1], 10);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const team = await teamService.getTeam(u.teamId);
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('team_my'), CALLBACK.TEAM_MY)],
      [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    try {
      await teamExtService.changeCaptain(u.teamId, newCap, ctx.from.id);

      await ctx.reply(
        `✅ <b>${t('team_captain_new')}</b>\n\n` +
          `👑 <b>${escapeHtml(displayName(await userService.getUser(newCap)))}</b>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );

      try {
        await bot.telegram.sendMessage(newCap, `👑 ${t('team_captain_notified')}`, backToTeam(t));
      } catch (e) {}
    } catch (e) {
      await ctx.reply(`❌ ${e.message || t('error_generic')}`, {
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // 6. A'ZOLAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.TEAM_MEMBERS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const data = await teamExtService.getTeamMembersDetailed(u.teamId);
    if (!data) return ctx.reply(`❗ ${t('error_not_found')}`);

    const lines = [];
    lines.push(`👥 <b>${escapeHtml(data.team.name)} [${escapeHtml(data.team.tag)}]</b>`);
    lines.push(`👤 ${t('team_members_count')}: <b>${data.members.length}/8</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const m of data.members) {
      const cap = m.isCaptain ? '👑 ' : '🎮 ';
      lines.push(`${m.number}. ${cap}<b>${escapeHtml(displayName(m.user))}</b>`);
      if (m.pubgId) {
        lines.push(`     🎯 PUBG ID: <code>${m.pubgId}</code>`);
      }
    }

    const isCaptain = Number(data.team.captainId) === Number(ctx.from.id);

    const rows = [[Markup.button.callback(t('team_stats'), CALLBACK.TEAM_STATS)]];

    if (isCaptain) {
      rows.push([Markup.button.callback(t('team_captain_change'), CALLBACK.TEAM_CAPTAIN_CHANGE)]);
      rows.push([Markup.button.callback(t('team_kick_list_title'), CALLBACK.TEAM_KICK_LIST)]);
    }

    rows.push([Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)]);

    await safeEdit(ctx, lines.join('\n'), { reply_markup: { inline_keyboard: rows } });
  });

  // ============================================================
  // 7. KICK — A'ZOLAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.TEAM_KICK_LIST, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply(`❗ ${t('team_no_team')}`);

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply(`❗ ${t('error_not_found')}`);
    if (Number(team.captainId) !== Number(ctx.from.id)) {
      return ctx.reply(`❗ ${t('error_not_captain')}`);
    }

    const rows = [];
    for (const mId of team.members) {
      if (Number(mId) === Number(ctx.from.id)) continue;
      const m = await userService.getUser(mId);
      const name = displayName(m) || `ID:${mId}`;
      rows.push([
        Markup.button.callback(`❌ ${name.slice(0, 35)}`, CALLBACK.TEAM_KICK + mId),
      ]);
    }

    rows.push([Markup.button.callback(t('team_members'), CALLBACK.TEAM_MEMBERS)]);

    if (rows.length === 1) {
      return safeEdit(
        ctx,
        `❗ ${t('team_kick_no_members')}`,
        { reply_markup: { inline_keyboard: rows } }
      );
    }

    await safeEdit(
      ctx,
      `👥 <b>${t('team_kick_list_title')}</b>\n\n` +
        `🏷 ${t('name')}: <b>${escapeHtml(team.name)}</b>\n` +
        `👤 ${t('team_members_count')}: <b>${team.members.length}/8</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `❌ ${t('team_kick_choose')}`,
      { reply_markup: { inline_keyboard: rows } }
    );
  });

  bot.action(/^team:kick:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const memberId = Number(ctx.match[1]);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return;

    const team = await teamService.getTeam(u.teamId);
    if (!team) return;
    if (Number(team.captainId) !== Number(ctx.from.id)) return ctx.reply(`❗ ${t('error_not_captain')}`);

    const member = await userService.getUser(memberId);
    const name = displayName(member) || `ID:${memberId}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(`✅ ${t('btn_confirm')}`, CALLBACK.TEAM_KICK_CONFIRM + memberId)],
      [Markup.button.callback(t('btn_cancel'), CALLBACK.TEAM_KICK_LIST)],
    ]);

    await safeEdit(
      ctx,
      `⚠️ <b>${t('team_kick_confirm_title')}</b>\n\n` +
        `👤 ${name}\n` +
        `🏷 ${t('name')}: <b>${escapeHtml(team.name)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `❗ <i>${t('team_kick_confirm_hint')}</i>`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action(/^team:kickc:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const memberId = Number(ctx.match[1]);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return;

    try {
      const res = await teamExtService.kickMember(u.teamId, memberId, ctx.from.id);

      const member = await userService.getUser(memberId);
      const name = displayName(member) || `ID:${memberId}`;

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('team_members'), CALLBACK.TEAM_MEMBERS)],
        [Markup.button.callback(t('menu_team'), CALLBACK.MENU_TEAM)],
      ]);

      await safeEdit(
        ctx,
        `✅ <b>${t('team_kick_done')}</b>\n\n` +
          `👤 ${name}\n` +
          `🏷 ${escapeHtml(res.teamName)}`,
        { reply_markup: kb.reply_markup }
      );

      try {
        await bot.telegram.sendMessage(
          memberId,
          `⚠️ <b>${t('team_kick_notify')}</b>\n\n` +
            `🏷 ${escapeHtml(res.teamName)}\n\n` +
            `<i>${t('team_kick_confirm_hint')}</i>`,
          { parse_mode: 'HTML', reply_markup: backToTeam(t).reply_markup }
        );
      } catch (e) {}
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`, backToTeam(t));
    }
  });

  // ============================================================
  // 8. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s || !s.startsWith('team_edit_')) return next();
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`❗ ${t('team_no_team')}`, backToTeam(t));
    }

    const team = await teamService.getTeam(u.teamId);
    if (!team || team.captainId !== ctx.from.id) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`❗ ${t('error_access')}`, backToTeam(t));
    }

    // NOM
    if (s === STATES.TEAM_EDIT_NAME) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_NAME_LEN);
      if (v.length < 2) return ctx.reply(`❗ ${t('team_name_short')}`, backToTeamEdit(t));

      await teamExtService.editTeam(team.id, { name: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>${t('team_edit_saved')}</b>\n\n🏷 ${t('name')}: <b>${escapeHtml(v)}</b>`,
        { parse_mode: 'HTML', reply_markup: backToTeamEdit(t).reply_markup }
      );
    }

    // TEG
    if (s === STATES.TEAM_EDIT_TAG) {
      const v = cleanText(ctx.message.text, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (v.length < 2) return ctx.reply(`❗ ${t('team_tag_short')}`, backToTeamEdit(t));

      await teamExtService.editTeam(team.id, { tag: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>${t('team_edit_saved')}</b>\n\n🔖 ${t('team_tag_label')}: <b>${escapeHtml(v)}</b>`,
        { parse_mode: 'HTML', reply_markup: backToTeamEdit(t).reply_markup }
      );
    }

    // BIO
    if (s === STATES.TEAM_EDIT_BIO) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_BIO_LEN);
      await teamExtService.setTeamBio(team.id, v, ctx.from.id);
      ctx.session = { state: null, data: {} };
      return ctx.reply(`✅ <b>${t('team_edit_saved')}</b>`, {
        parse_mode: 'HTML',
        reply_markup: backToTeamEdit(t).reply_markup,
      });
    }

    // MANAGER
    if (s === STATES.TEAM_EDIT_MANAGER) {
      const v = cleanText(ctx.message.text, 40).replace(/^@/, '');
      await teamExtService.editTeam(team.id, { managerUsername: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>${t('team_edit_saved')}</b>\n\n👑 ${t('team_manager')}: @${escapeHtml(v)}`,
        { parse_mode: 'HTML', reply_markup: backToTeamEdit(t).reply_markup }
      );
    }

    return next();
  });

  // FSM — AVATAR
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.TEAM_EDIT_AVATAR) return next();
    const t = ctx.t;

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`❗ ${t('team_no_team')}`, backToTeam(t));
    }

    const team = await teamService.getTeam(u.teamId);
    if (!team || team.captainId !== ctx.from.id) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(`❗ ${t('error_access')}`, backToTeam(t));
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    await teamExtService.editTeam(team.id, { avatarFileId: fileId });
    ctx.session = { state: null, data: {} };

    try {
      await ctx.replyWithPhoto(fileId, {
        caption: `✅ <b>${t('team_edit_saved')}</b>`,
        parse_mode: 'HTML',
        reply_markup: backToTeamEdit(t).reply_markup,
      });
    } catch (e) {
      await ctx.reply(`✅ ${t('team_edit_saved')}`, backToTeamEdit(t));
    }
  });
};