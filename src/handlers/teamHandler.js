// ============================================================
// TEAM HANDLER — Ko'p tilli (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const {
  teamMenu,
  confirmTeam,
  cancelKeyboard,
} = require('../keyboards/teamKeyboard');
const { mainKeyboard } = require('../keyboards/mainKeyboard');
const { CALLBACK, STATES, LIMITS } = require('../constants');
const { cleanText } = require('../utils/validation');
const {
  escapeHtml,
  displayName,
  safeEdit,
  safeAnswer,
} = require('../utils/telegramUtils');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // 1. KOMANDAM MENYUSI
  // ============================================================
  bot.action(CALLBACK.MENU_TEAM, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    await safeEdit(
      ctx,
      `👥 <b>${t('team_title')}</b>\n\n${t('team_subtitle')}`,
      teamMenu(ctx)
    );
  });

  // ============================================================
  // 2. KOMANDA YARATISH
  // ============================================================
  bot.action(CALLBACK.TEAM_CREATE, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const user = await userService.getUser(ctx.from.id);
    if (user?.teamId) {
      return safeEdit(ctx, `❗ ${t('team_already_member')}`);
    }

    ctx.session = { state: STATES.TEAM_CREATE_NAME, data: {} };

    await safeEdit(
      ctx,
      `1️⃣ ${t('team_ask_name')}`,
      cancelKeyboard(ctx)
    );
  });

  bot.action(CALLBACK.TEAM_RETRY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    ctx.session = { state: STATES.TEAM_CREATE_NAME, data: {} };
    await safeEdit(
      ctx,
      `1️⃣ ${t('team_ask_name_again')}`,
      cancelKeyboard(ctx)
    );
  });

  // ============================================================
  // 3. TASDIQLASH
  // ============================================================
  bot.action(CALLBACK.TEAM_CONFIRM, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const d = ctx.session?.data || {};
    if (!d.name) {
      return safeEdit(ctx, `❗ ${t('error_no_data')}`);
    }

    try {
      const team = await teamService.createTeam({
        name: d.name,
        tag: d.tag,
        avatarFileId: d.avatarFileId,
        managerUsername: d.managerUsername,
        creatorId: ctx.from.id,
      });
      ctx.session = { state: null, data: {} };

      const deepLink = `https://t.me/${config.BOT_USERNAME}?start=join_${team.joinCode}`;

      const role = ctx.state.role || 'player';
      const lang = ctx.state.lang || 'uz';

      await safeEdit(
        ctx,
        `✅ <b>${t('team_created')}</b>\n\n` +
          `${t('name')}: <b>${escapeHtml(team.name)}</b>\n` +
          `${t('team_tag_label')}: <b>${escapeHtml(team.tag)}</b>\n` +
          `${t('team_join_code')}: <code>${team.joinCode}</code>\n\n` +
          `${t('team_invite_link')}:\n${deepLink}`,
        mainKeyboard(role, lang)
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${t('error_prefix')} ${e.message || t('error_generic')}`);
    }
  });

  bot.action(CALLBACK.TEAM_CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    ctx.session = { state: null, data: {} };
    await safeEdit(ctx, `❌ ${t('cancel')}`);
  });

  // ============================================================
  // 4. KOMANDAGA QO'SHILISH
  // ============================================================
  bot.action(CALLBACK.TEAM_JOIN, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const user = await userService.getUser(ctx.from.id);
    if (user?.teamId) {
      return safeEdit(ctx, `❗ ${t('team_already_member')}`);
    }

    ctx.session = { state: STATES.TEAM_JOIN_CODE, data: {} };
    await safeEdit(
      ctx,
      `🔑 ${t('team_ask_join_code')}`,
      cancelKeyboard(ctx)
    );
  });

  // ============================================================
  // 5. MENING KOMANDAM
  // ============================================================
  bot.action(CALLBACK.TEAM_MY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return safeEdit(ctx, `❗ ${t('team_no_team')}`);
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return safeEdit(ctx, `❗ ${t('error_not_found')}`);
    }

    const captain = await userService.getUser(team.captainId);
    const lines = [];
    lines.push(
      `👥 <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>`
    );
    lines.push(`👑 ${t('team_captain')}: <b>${escapeHtml(displayName(captain))}</b>`);
    lines.push(`🔑 ${t('team_join_code')}: <code>${team.joinCode}</code>`);
    lines.push(
      `👥 ${t('team_members_title')} (${team.members.length}/${LIMITS.MAX_PLAYERS_PER_TEAM}):`
    );

    for (let i = 0; i < team.members.length; i++) {
      const u = await userService.getUser(team.members[i]);
      const isCaptain = team.members[i] === team.captainId ? '👑 ' : '🎮 ';
      lines.push(` ${i + 1}. ${isCaptain}${escapeHtml(displayName(u))}`);
    }

    if (team.avatarFileId) {
      try {
        return await ctx.replyWithPhoto(team.avatarFileId, {
          caption: lines.join('\n'),
          parse_mode: 'HTML',
        });
      } catch (e) {}
    }

    await safeEdit(ctx, lines.join('\n'), teamMenu(ctx));
  });

  // ============================================================
  // 6. KOMANDANI TARK ETISH
  // ============================================================
  bot.action(CALLBACK.TEAM_LEAVE, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return safeEdit(ctx, `❗ ${t('team_no_team')}`);
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return safeEdit(ctx, `❗ ${t('error_not_found')}`);
    }

    const result = await teamService.removeMember(team.id, user.id);
    let msg = `✅ ${t('team_left')}`;

    if (result?.captainTransferred) {
      try {
        await ctx.telegram.sendMessage(
          result.captainTransferred,
          `ℹ️ ${t('team_you_new_captain')}`
        );
      } catch (e) {}
    }

    if (result?.deleted) {
      msg = `✅ ${t('team_deleted')}`;
    }

    if (!result?.deleted && team.captainId !== user.id) {
      try {
        await ctx.telegram.sendMessage(
          team.captainId,
          `ℹ️ <b>${escapeHtml(displayName(user))}</b> ${t('team_left_notify')}`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }

    const role = ctx.state.role || 'player';
    const lang = ctx.state.lang || 'uz';
    await safeEdit(ctx, msg, mainKeyboard(role, lang));
  });

  // ============================================================
  // 7. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    const t = ctx.t;

    // ---------- NOM ----------
    if (s === STATES.TEAM_CREATE_NAME) {
      const name = cleanText(ctx.message.text, LIMITS.MAX_NAME_LEN);
      if (name.length < 2) {
        return ctx.reply(`❗ ${t('team_name_short')}`, cancelKeyboard(ctx));
      }
      ctx.session.data.name = name;
      ctx.session.state = STATES.TEAM_CREATE_TAG;
      return ctx.reply(`2️⃣ ${t('team_ask_tag')}`, cancelKeyboard(ctx));
    }

    // ---------- TEG ----------
    if (s === STATES.TEAM_CREATE_TAG) {
      const tag = cleanText(ctx.message.text, 5)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      if (tag.length < 2) {
        return ctx.reply(`❗ ${t('team_tag_short')}`, cancelKeyboard(ctx));
      }
      ctx.session.data.tag = tag;
      ctx.session.state = STATES.TEAM_CREATE_AVATAR;
      return ctx.reply(`3️⃣ ${t('team_ask_avatar')}`, cancelKeyboard(ctx));
    }

    // ---------- MANAGER ----------
    if (s === STATES.TEAM_CREATE_MANAGER) {
      const m = cleanText(ctx.message.text, 40).replace(/^@/, '');
      ctx.session.data.managerUsername = m;
      ctx.session.state = STATES.TEAM_CREATE_CONFIRM;

      const d = ctx.session.data;
      const summary =
        `📋 <b>${t('confirm_title')}</b>\n\n` +
        `${t('name')}: <b>${escapeHtml(d.name)}</b>\n` +
        `${t('team_tag_label')}: <b>${escapeHtml(d.tag)}</b>\n` +
        `${t('image')}: <b>${d.avatarFileId ? '✅' : '—'}</b>\n` +
        `${t('team_manager')}: <b>@${escapeHtml(d.managerUsername || '-')}</b>\n` +
        `${t('team_creator')}: <b>${escapeHtml(displayName(ctx.from))}</b>`;
      return ctx.reply(summary, {
        parse_mode: 'HTML',
        ...confirmTeam(ctx),
      });
    }

    // ---------- QO'SHILISH KODI ----------
    if (s === STATES.TEAM_JOIN_CODE) {
      const code = cleanText(ctx.message.text, 20).toUpperCase();
      ctx.session = { state: null, data: {} };

      const team = await teamService.getTeamByCode(code);
      if (!team) return ctx.reply(`❗ ${t('team_code_invalid')}`);

      const user = await userService.getUser(ctx.from.id);
      if (user?.teamId) return ctx.reply(`❗ ${t('team_already_member')}`);
      if (!(await teamService.canAddMember(team.id))) {
        return ctx.reply(`❗ ${t('team_full')}`);
      }

      await teamService.addMember(team.id, user.id);
      await userService.setUserTeam(user.id, team.id);

      await ctx.reply(
        `✅ <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> — ${t('team_joined')}`,
        { parse_mode: 'HTML' }
      );

      try {
        await ctx.telegram.sendMessage(
          team.captainId,
          `ℹ️ ${t('team_new_member')}: <b>${escapeHtml(displayName(ctx.from))}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
      return;
    }

    return next();
  });

  // ============================================================
  // 8. FSM — RASM (avatar)
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s === STATES.TEAM_CREATE_AVATAR) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.session.data.avatarFileId = fileId;
      ctx.session.state = STATES.TEAM_CREATE_MANAGER;
      const t = ctx.t;
      return ctx.reply(`4️⃣ ${t('team_ask_manager')}`, cancelKeyboard(ctx));
    }
    return next();
  });
};