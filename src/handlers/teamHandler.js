const { Markup } = require('telegraf');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { teamMenu, confirmTeam, cancelKeyboard } = require('../keyboards/teamKeyboard');
const { mainKeyboard } = require('../keyboards/mainKeyboard');
const { CALLBACK, STATES, LIMITS } = require('../constants');
const { cleanText } = require('../utils/validation');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // 1. KOMANDAM MENYUSI
  // ============================================================
  bot.action(CALLBACK.MENU_TEAM, async (ctx) => {
    await safeAnswer(ctx);
    await safeEdit(ctx, '👥 <b>Komandam</b>\n\nKerakli amalni tanlang:', teamMenu);
  });

  // ============================================================
  // 2. KOMANDA YARATISH — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.TEAM_CREATE, async (ctx) => {
    await safeAnswer(ctx);
    const user = await userService.getUser(ctx.from.id);
    if (user?.teamId) {
      return safeEdit(ctx, '❗ Siz allaqachon komandadasiz.');
    }
    ctx.session = { state: STATES.TEAM_CREATE_NAME, data: {} };
    await safeEdit(ctx, '1️⃣ Komanda nomini kiriting:', cancelKeyboard);
  });

  bot.action(CALLBACK.TEAM_RETRY, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: STATES.TEAM_CREATE_NAME, data: {} };
    await safeEdit(ctx, '1️⃣ Komanda nomini qayta kiriting:', cancelKeyboard);
  });

  // ============================================================
  // 3. TASDIQLASH
  // ============================================================
  bot.action(CALLBACK.TEAM_CONFIRM, async (ctx) => {
    await safeAnswer(ctx);
    const d = ctx.session?.data || {};
    if (!d.name) {
      return safeEdit(ctx, '❗ Ma\'lumot yo\'q. Qaytadan boshlang.');
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
      await safeEdit(
        ctx,
        `✅ <b>Komanda yaratildi!</b>\n\n` +
        `🏷 Nom: <b>${escapeHtml(team.name)}</b>\n` +
        `🔖 Teg: <b>${escapeHtml(team.tag)}</b>\n` +
        `🔑 Qo'shilish kodi: <code>${team.joinCode}</code>\n\n` +
        `🔗 Do'stlarni taklif qilish havolasi:\n${deepLink}`,
        mainKeyboard(ctx.state.role)
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });

  bot.action(CALLBACK.TEAM_CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    await safeEdit(ctx, '❌ Bekor qilindi.');
  });

  // ============================================================
  // 4. KOMANDAGA QO'SHILISH
  // ============================================================
  bot.action(CALLBACK.TEAM_JOIN, async (ctx) => {
    await safeAnswer(ctx);
    const user = await userService.getUser(ctx.from.id);
    if (user?.teamId) {
      return safeEdit(ctx, '❗ Siz allaqachon komandadasiz.');
    }
    ctx.session = { state: STATES.TEAM_JOIN_CODE, data: {} };
    await safeEdit(ctx, '🔑 Komanda qo\'shilish kodini yuboring:', cancelKeyboard);
  });

  // ============================================================
  // 5. MENING KOMANDAM
  // ============================================================
  bot.action(CALLBACK.TEAM_MY, async (ctx) => {
    await safeAnswer(ctx);
    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return safeEdit(ctx, '❗ Siz komandada emassiz.');
    }
    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return safeEdit(ctx, '❗ Komanda topilmadi.');
    }

    const captain = await userService.getUser(team.captainId);
    const lines = [];
    lines.push(`👥 <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>`);
    lines.push(`👑 Captain: <b>${escapeHtml(displayName(captain))}</b>`);
    lines.push(`🔑 Kod: <code>${team.joinCode}</code>`);
    lines.push(`👥 A'zolar (${team.members.length}/${LIMITS.MAX_PLAYERS_PER_TEAM}):`);

    for (let i = 0; i < team.members.length; i++) {
      const u = await userService.getUser(team.members[i]);
      const isCaptain = team.members[i] === team.captainId ? '👑 ' : '🎮 ';
      lines.push(` ${i + 1}. ${isCaptain}${escapeHtml(displayName(u))}`);
    }

    // Rasm mavjud bo'lsa — rasm bilan yuboramiz
    if (team.avatarFileId) {
      try {
        return await ctx.replyWithPhoto(team.avatarFileId, {
          caption: lines.join('\n'),
          parse_mode: 'HTML',
        });
      } catch (e) { /* rasm yo'q */ }
    }
    await safeEdit(ctx, lines.join('\n'));
  });

  // ============================================================
  // 6. KOMANDANI TARK ETISH
  // ============================================================
  bot.action(CALLBACK.TEAM_LEAVE, async (ctx) => {
    await safeAnswer(ctx);
    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return safeEdit(ctx, '❗ Siz komandada emassiz.');
    }
    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return safeEdit(ctx, '❗ Komanda topilmadi.');
    }

    const result = await teamService.removeMember(team.id, user.id);
    let msg = '✅ Siz komandani tark etdingiz.';

    if (result?.captainTransferred) {
      try {
        await ctx.telegram.sendMessage(
          result.captainTransferred,
          'ℹ️ Siz komandaning yangi captain\'i bo\'ldingiz.'
        );
      } catch (e) { /* foydalanuvchi bloklagan */ }
    }
    if (result?.deleted) {
      msg = '✅ Komanda o\'chirildi (siz yagona a\'zo edingiz).';
    }

    // Captain'ga xabar
    if (!result?.deleted && team.captainId !== user.id) {
      try {
        await ctx.telegram.sendMessage(
          team.captainId,
          `ℹ️ <b>${escapeHtml(displayName(user))}</b> komandani tark etdi.`,
          { parse_mode: 'HTML' }
        );
      } catch (e) { /* bloklangan */ }
    }

    await safeEdit(ctx, msg, mainKeyboard(ctx.state.role));
  });

  // ============================================================
  // 7. FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();

    // ---------- KOMANDA NOMI ----------
    if (s === STATES.TEAM_CREATE_NAME) {
      const name = cleanText(ctx.message.text, LIMITS.MAX_NAME_LEN);
      if (name.length < 2) {
        return ctx.reply('❗ Nom juda qisqa. Qayta kiriting:');
      }
      ctx.session.data.name = name;
      ctx.session.state = STATES.TEAM_CREATE_TAG;
      return ctx.reply('2️⃣ Komanda tegini kiriting (2-5 belgi, faqat harflar va raqamlar):');
    }

    // ---------- KOMANDA TEGI ----------
    if (s === STATES.TEAM_CREATE_TAG) {
      const tag = cleanText(ctx.message.text, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (tag.length < 2) {
        return ctx.reply('❗ Teg kamida 2 belgi (harflar va raqamlar):');
      }
      ctx.session.data.tag = tag;
      ctx.session.state = STATES.TEAM_CREATE_AVATAR;
      return ctx.reply('3️⃣ Komanda avatarini rasm sifatida yuboring:');
    }

    // ---------- MANAGER USERNAME ----------
    if (s === STATES.TEAM_CREATE_MANAGER) {
      const m = cleanText(ctx.message.text, 40).replace(/^@/, '');
      ctx.session.data.managerUsername = m;
      ctx.session.state = STATES.TEAM_CREATE_CONFIRM;

      const d = ctx.session.data;
      const summary =
        `📋 <b>Tasdiqlash</b>\n\n` +
        `🏷 Nom: <b>${escapeHtml(d.name)}</b>\n` +
        `🔖 Teg: <b>${escapeHtml(d.tag)}</b>\n` +
        `🖼 Avatar: <b>${d.avatarFileId ? '✅ yuklangan' : 'yo\'q'}</b>\n` +
        `👑 Manager: <b>@${escapeHtml(d.managerUsername || '-')}</b>\n` +
        `👤 Yaratuvchi: <b>${escapeHtml(displayName(ctx.from))}</b>`;
      return ctx.reply(summary, { parse_mode: 'HTML', ...confirmTeam });
    }

    // ---------- QO'SHILISH KODI ----------
    if (s === STATES.TEAM_JOIN_CODE) {
      const code = cleanText(ctx.message.text, 20).toUpperCase();
      ctx.session = { state: null, data: {} };

      const team = await teamService.getTeamByCode(code);
      if (!team) return ctx.reply('❗ Kod noto\'g\'ri yoki eskirgan.');

      const user = await userService.getUser(ctx.from.id);
      if (user?.teamId) return ctx.reply('❗ Siz allaqachon komandadasiz.');
      if (!(await teamService.canAddMember(team.id))) {
        return ctx.reply('❗ Komanda to\'lgan (maksimal 8 o\'yinchi).');
      }

      await teamService.addMember(team.id, user.id);
      await userService.setUserTeam(user.id, team.id);

      await ctx.reply(
        `✅ <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b> komandasiga qo'shildingiz!`,
        { parse_mode: 'HTML' }
      );

      // Captain'ga xabar
      try {
        await ctx.telegram.sendMessage(
          team.captainId,
          `ℹ️ Yangi a'zo komandaga qo'shildi:\n<b>${escapeHtml(displayName(ctx.from))}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) { /* bloklangan */ }
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
      return ctx.reply('4️⃣ Komanda manager yoki captain Telegram username\'ini yuboring (@ belgisisiz ham bo\'ladi):');
    }
    return next();
  });
};