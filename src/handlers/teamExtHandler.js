// Komanda qo'shimcha handlerlari (14, 16, 17, 19, 20, 21, 22)
const { Markup } = require('telegraf');
const teamService = require('../services/teamService');
const teamExtService = require('../services/teamExtService');
const userService = require('../services/userService');
const { CALLBACK, STATES, LIMITS } = require('../constants');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

// ============================================================
// YORDAMCHI: Orqaga tugmasi bilan klaviatura
// ============================================================
function backTo(callback, label = "⬅️ Orqaga") {
  return Markup.inlineKeyboard([
    [Markup.button.callback(label, callback)],
  ]);
}

function backToTeamEdit() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⬅️ Tahrirlashga qaytish", CALLBACK.TEAM_EDIT)],
    [Markup.button.callback("🏠 Komandam", CALLBACK.MENU_TEAM)],
  ]);
}

function backToTeam() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⬅️ Komandam", CALLBACK.MENU_TEAM)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 14. KOMANDANI TAHRIRLASH — ASOSIY MENYU
  // ============================================================
  bot.action(CALLBACK.TEAM_EDIT, async (ctx) => {
    await safeAnswer(ctx);

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply("❗ Komanda topilmadi.");
    if (team.captainId !== ctx.from.id) {
      return ctx.reply("❗ Faqat captain tahrirlay oladi.");
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("🏷 Nom", CALLBACK.TEAM_EDIT_FIELD + "name")],
      [Markup.button.callback("🔖 Teg", CALLBACK.TEAM_EDIT_FIELD + "tag")],
      [Markup.button.callback("🖼 Avatar", CALLBACK.TEAM_EDIT_FIELD + "avatar")],
      [Markup.button.callback("📝 Bio", CALLBACK.TEAM_EDIT_FIELD + "bio")],
      [Markup.button.callback("👑 Manager", CALLBACK.TEAM_EDIT_FIELD + "manager")],
      [Markup.button.callback("⬅️ Komandam", CALLBACK.MENU_TEAM)],
    ]);

    await safeEdit(
      ctx,
      `✏️ <b>Komandani tahrirlash</b>\n\n` +
        `🏷 Nom: <b>${escapeHtml(team.name)}</b>\n` +
        `🔖 Teg: <b>${escapeHtml(team.tag)}</b>\n` +
        `🖼 Avatar: <b>${team.avatarFileId ? "✅" : "yo'q"}</b>\n` +
        `📝 Bio: <b>${escapeHtml(team.bio || "-")}</b>\n` +
        `👑 Manager: <b>@${escapeHtml(team.managerUsername || "-")}</b>\n\n` +
        `👇 Nimani o'zgartirmoqchisiz?`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 14.1 MAYDON TANLASH
  // ============================================================
  bot.action(/^team:editf:(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);

    const field = ctx.match[1];
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply("❗ Komanda topilmadi.");
    if (team.captainId !== ctx.from.id) {
      return ctx.reply("❗ Faqat captain tahrirlay oladi.");
    }

    const prompts = {
      name: [STATES.TEAM_EDIT_NAME, "🏷 Yangi nomni kiriting:"],
      tag: [STATES.TEAM_EDIT_TAG, "🔖 Yangi tegni kiriting (2-5 belgi):"],
      avatar: [STATES.TEAM_EDIT_AVATAR, "🖼 Yangi avatar rasmini yuboring:"],
      bio: [STATES.TEAM_EDIT_BIO, "📝 Qisqa bio kiriting (150 belgi):"],
      manager: [STATES.TEAM_EDIT_MANAGER, "👑 Manager username kiriting:"],
    };

    const [state, prompt] = prompts[field] || [];
    if (!state) return ctx.reply("❗ Noto'g'ri maydon.");

    ctx.session = { state, data: { field } };
    await ctx.reply(prompt, backToTeamEdit());
  });

  // ============================================================
  // 16. KOMANDA STATISTIKASI
  // ============================================================
  bot.action(CALLBACK.TEAM_STATS, async (ctx) => {
    await safeAnswer(ctx);

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const stats = await teamExtService.getTeamStats(u.teamId);
    if (!stats) return ctx.reply("❗ Statistikani olishda xatolik.");

    const text =
      `📊 <b>${escapeHtml(stats.team.name)} [${escapeHtml(stats.team.tag)}]</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎮 O'yinlar: <b>${stats.matches}</b>\n` +
      `🏆 G'alabalar: <b>${stats.wins}</b> (${stats.winRate}%)\n` +
      `💥 Kill'lar: <b>${stats.kills}</b>\n` +
      `💯 Ballar: <b>${stats.points}</b>\n` +
      `📊 O'rtacha o'rin: <b>${stats.avgPlacement}</b>\n` +
      `🎯 O'rtacha kill: <b>${stats.avgKills}</b>`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📜 Tarix", CALLBACK.TEAM_HISTORY)],
      [Markup.button.callback("👥 A'zolar", CALLBACK.TEAM_MEMBERS)],
      [Markup.button.callback("⬅️ Komandam", CALLBACK.MENU_TEAM)],
    ]);

    await safeEdit(ctx, text, { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 17. KOMANDA TARIXI
  // ============================================================
  bot.action(CALLBACK.TEAM_HISTORY, async (ctx) => {
    await safeAnswer(ctx);

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const history = await teamExtService.getTeamHistory(u.teamId);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Statistika", CALLBACK.TEAM_STATS)],
      [Markup.button.callback("⬅️ Komandam", CALLBACK.MENU_TEAM)],
    ]);

    if (!history.length) {
      return safeEdit(ctx, "📭 Hali tarix yo'q.", { reply_markup: kb.reply_markup });
    }

    const lines = [];
    lines.push(`📜 <b>Komanda tarixi</b>`);
    lines.push(`📊 Jami: <b>${history.length}</b> ta turnir`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("");

    history.forEach((h, i) => {
      lines.push(`<b>${i + 1}. ${escapeHtml(h.tournament.title)}</b>`);
      lines.push(`   📅 ${h.tournament.date}`);
      lines.push(
        `   🎮 ${h.matches} karta | 💯 ${h.points} pts | 🎯 ${h.kills} kill | 🏆 ${h.wins} win`
      );
      lines.push("");
    });

    await safeEdit(ctx, lines.join("\n"), { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 19. CAPTAIN O'ZGARTIRISH — A'ZO TANLASH
  // ============================================================
  bot.action(CALLBACK.TEAM_CAPTAIN_CHANGE, async (ctx) => {
    await safeAnswer(ctx);

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const team = await teamService.getTeam(u.teamId);
    if (!team) return ctx.reply("❗ Komanda topilmadi.");
    if (team.captainId !== ctx.from.id) {
      return ctx.reply("❗ Faqat captain o'zgartira oladi.");
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

    rows.push([Markup.button.callback("⬅️ Komandam", CALLBACK.MENU_TEAM)]);

    if (team.members.length <= 1) {
      return safeEdit(
        ctx,
        "❗ Komandada sizdan boshqa a'zo yo'q.\n\n" +
          "<i>Captain o'zgartirish uchun avval a'zo qo'shing.</i>",
        { reply_markup: { inline_keyboard: rows } }
      );
    }

    await safeEdit(ctx, "👑 <b>Yangi captain'ni tanlang:</b>", {
      reply_markup: { inline_keyboard: rows },
    });
  });

  // ============================================================
  // 19.1 CAPTAIN TANLANGANDA
  // ============================================================
  bot.action(/^team:ccp:(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);

    const newCap = parseInt(ctx.match[1], 10);
    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const team = await teamService.getTeam(u.teamId);
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("👥 Komandam", CALLBACK.TEAM_MY)],
      [Markup.button.callback("🏠 Asosiy menyu", CALLBACK.MENU_MAIN)],
    ]);

    try {
      await teamExtService.changeCaptain(u.teamId, newCap, ctx.from.id);

      await ctx.reply(
        `✅ <b>Captain o'zgartirildi!</b>\n\n` +
          `👑 Yangi captain: <b>${escapeHtml(displayName(await userService.getUser(newCap)))}</b>`,
        { parse_mode: "HTML", reply_markup: kb.reply_markup }
      );

      try {
        await bot.telegram.sendMessage(
          newCap,
          "👑 Siz komandaning yangi captain'isiz!",
          backToTeam()
        );
      } catch (e) {
        // Bloklangan
      }
    } catch (e) {
      await ctx.reply("❌ " + (e.message || "Xatolik"), {
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // 22. A'ZOLAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.TEAM_MEMBERS, async (ctx) => {
    await safeAnswer(ctx);

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) return ctx.reply("❗ Siz komandada emassiz.");

    const data = await teamExtService.getTeamMembersDetailed(u.teamId);
    if (!data) return ctx.reply("❗ Ma'lumot topilmadi.");

    const lines = [];
    lines.push(
      `👥 <b>${escapeHtml(data.team.name)} [${escapeHtml(data.team.tag)}]</b>`
    );
    lines.push(`👤 A'zolar: <b>${data.members.length}/8</b>`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("");

    for (const m of data.members) {
      const cap = m.isCaptain ? "👑 " : "🎮 ";
      lines.push(`${m.number}. ${cap}<b>${escapeHtml(displayName(m.user))}</b>`);
      if (m.pubgId) {
        lines.push(`     🎯 PUBG ID: <code>${m.pubgId}</code>`);
      }
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Statistika", CALLBACK.TEAM_STATS)],
      [Markup.button.callback("👑 Captain o'zgartirish", CALLBACK.TEAM_CAPTAIN_CHANGE)],
      [Markup.button.callback("⬅️ Komandam", CALLBACK.MENU_TEAM)],
    ]);

    await safeEdit(ctx, lines.join("\n"), { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // FSM — MATN (komanda tahrirlash)
  // ============================================================
  bot.on("text", async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s || !s.startsWith("team_edit_")) return next();

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("❗ Siz komandada emassiz.", backToTeam());
    }

    const team = await teamService.getTeam(u.teamId);
    if (!team || team.captainId !== ctx.from.id) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("❗ Ruxsat yo'q.", backToTeam());
    }

    // ---------- NOM ----------
    if (s === STATES.TEAM_EDIT_NAME) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_NAME_LEN);
      if (v.length < 2) {
        return ctx.reply("❗ Nom juda qisqa. Qayta kiriting:", backToTeamEdit());
      }

      await teamExtService.editTeam(team.id, { name: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>Nom o'zgartirildi!</b>\n\n🏷 Yangi nom: <b>${escapeHtml(v)}</b>`,
        { parse_mode: "HTML", reply_markup: backToTeamEdit().reply_markup }
      );
    }

    // ---------- TEG ----------
    if (s === STATES.TEAM_EDIT_TAG) {
      const v = cleanText(ctx.message.text, 5)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (v.length < 2) {
        return ctx.reply(
          "❗ Teg kamida 2 belgi bo'lishi kerak:",
          backToTeamEdit()
        );
      }

      await teamExtService.editTeam(team.id, { tag: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>Teg o'zgartirildi!</b>\n\n🔖 Yangi teg: <b>${escapeHtml(v)}</b>`,
        { parse_mode: "HTML", reply_markup: backToTeamEdit().reply_markup }
      );
    }

    // ---------- BIO ----------
    if (s === STATES.TEAM_EDIT_BIO) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_BIO_LEN);
      await teamExtService.setTeamBio(team.id, v, ctx.from.id);
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>Bio o'zgartirildi!</b>`,
        { parse_mode: "HTML", reply_markup: backToTeamEdit().reply_markup }
      );
    }

    // ---------- MANAGER ----------
    if (s === STATES.TEAM_EDIT_MANAGER) {
      const v = cleanText(ctx.message.text, 40).replace(/^@/, "");
      await teamExtService.editTeam(team.id, { managerUsername: v });
      ctx.session = { state: null, data: {} };
      return ctx.reply(
        `✅ <b>Manager o'zgartirildi!</b>\n\n👑 Yangi manager: @${escapeHtml(v)}`,
        { parse_mode: "HTML", reply_markup: backToTeamEdit().reply_markup }
      );
    }

    return next();
  });

  // ============================================================
  // FSM — RASM (avatar)
  // ============================================================
  bot.on("photo", async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.TEAM_EDIT_AVATAR) return next();

    const u = ctx.state.user || (await userService.getUser(ctx.from.id));
    if (!u?.teamId) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("❗ Siz komandada emassiz.", backToTeam());
    }

    const team = await teamService.getTeam(u.teamId);
    if (!team || team.captainId !== ctx.from.id) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("❗ Ruxsat yo'q.", backToTeam());
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    await teamExtService.editTeam(team.id, { avatarFileId: fileId });
    ctx.session = { state: null, data: {} };

    // Yangi avatarni ko'rsatish
    try {
      await ctx.replyWithPhoto(fileId, {
        caption: "✅ <b>Avatar o'zgartirildi!</b>",
        parse_mode: "HTML",
        reply_markup: backToTeamEdit().reply_markup,
      });
    } catch (e) {
      await ctx.reply("✅ Avatar o'zgartirildi!", backToTeamEdit());
    }
  });
};