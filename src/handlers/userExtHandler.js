// Foydalanuvchi qo'shimcha handlerlari (24, 25, 27, 28)
const { Markup } = require('telegraf');
const userService = require('../services/userService');
const userExtService = require('../services/userExtService');
const { CALLBACK, STATES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

function backToProfile() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⬅️ Profil", CALLBACK.MENU_PROFILE)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 24. PUBG ID SAQLASH
  // ============================================================
  bot.action(CALLBACK.USER_PUBG_ID, async (ctx) => {
    await safeAnswer(ctx);
    const u = await userService.getUser(ctx.from.id);
    ctx.session = { state: STATES.PLAYER_PUBG_ID, data: {} };

    await safeEdit(
      ctx,
      `🎯 <b>PUBG ID kiriting</b>\n\n` +
        `Hozirgi: <code>${escapeHtml(u?.pubgId || "yo'q")}</code>\n\n` +
        `PUBG Mobile'dagi ID raqamingizni yuboring:`,
      { parse_mode: "HTML", reply_markup: backToProfile().reply_markup }
    );
  });

  // ============================================================
  // 25. SHAXSIY STATISTIKA
  // ============================================================
  bot.action(CALLBACK.USER_STATS, async (ctx) => {
    await safeAnswer(ctx);
    const stats = await userExtService.getUserStats(ctx.from.id);
    if (!stats) return ctx.reply("❗ Xatolik.");

    const { user, teamStats } = stats;
    let text = `👤 <b>Shaxsiy statistika</b>\n\n`;
    text += `📛 ${escapeHtml([user.firstName, user.lastName].filter(Boolean).join(" ") || "-")}\n`;
    text += `🆔 <code>${user.id}</code>\n`;
    text += `🎯 PUBG ID: <code>${escapeHtml(user.pubgId || "-")}</code>\n\n`;

    if (teamStats) {
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `🎮 O'yinlar: <b>${teamStats.matches}</b>\n`;
      text += `🏆 G'alabalar: <b>${teamStats.wins}</b>\n`;
      text += `💥 Kill'lar: <b>${teamStats.kills}</b>\n`;
      text += `💯 Ballar: <b>${teamStats.points}</b>`;
    } else {
      text += `<i>Komandada emassiz.</i>`;
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("🏅 Yutuqlar", CALLBACK.USER_ACHIEVEMENTS)],
      [Markup.button.callback("🏆 Leaderboard", CALLBACK.USER_LEADERBOARD)],
      [Markup.button.callback("🎯 PUBG ID", CALLBACK.USER_PUBG_ID)],
      [Markup.button.callback("⬅️ Profil", CALLBACK.MENU_PROFILE)],
    ]);

    await safeEdit(ctx, text, { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 27. ACHIEVEMENTS
  // ============================================================
  bot.action(CALLBACK.USER_ACHIEVEMENTS, async (ctx) => {
    await safeAnswer(ctx);
    await userExtService.checkAchievements(ctx.from.id);
    const achs = await userExtService.getUserAchievements(ctx.from.id);

    const lines = [];
    lines.push(`🏅 <b>Yutuqlar</b>`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("");

    for (const a of achs) {
      const icon = a.earned ? "✅" : "🔒";
      lines.push(`${icon} <b>${a.name}</b>`);
      lines.push(`   <i>${a.desc}</i>`);
    }

    const earned = achs.filter((a) => a.earned).length;
    lines.push("");
    lines.push(`📊 Jami: <b>${earned}/${achs.length}</b>`);

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Statistika", CALLBACK.USER_STATS)],
      [Markup.button.callback("⬅️ Profil", CALLBACK.MENU_PROFILE)],
    ]);

    await safeEdit(ctx, lines.join("\n"), { reply_markup: kb.reply_markup });
  });

  // ============================================================
  // 28. LEADERBOARD
  // ============================================================
  bot.action(CALLBACK.USER_LEADERBOARD, async (ctx) => {
    await safeAnswer(ctx);
    const list = await userExtService.getLeaderboard(10);
    const text = userExtService.formatLeaderboard(list);

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback("💯 Ball", "user:lbm:pts"),
        Markup.button.callback("🎯 Kill", "user:lbm:kills"),
      ],
      [Markup.button.callback("🏆 Win", "user:lbm:wins")],
      [Markup.button.callback("⬅️ Profil", CALLBACK.MENU_PROFILE)],
    ]);

    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: kb.reply_markup,
      });
    }
  });

  bot.action(/^user:lbm:(pts|kills|wins)$/, async (ctx) => {
    await safeAnswer(ctx);
    const mode = ctx.match[1];
    let list = await userExtService.getLeaderboard(50);

    if (mode === "kills") list.sort((a, b) => b.kills - a.kills);
    else if (mode === "wins") list.sort((a, b) => b.wins - a.wins);

    list = list.slice(0, 10);
    const text = userExtService.formatLeaderboard(
      list,
      mode === "pts" ? "all" : mode
    );

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback("💯 Ball", "user:lbm:pts"),
        Markup.button.callback("🎯 Kill", "user:lbm:kills"),
      ],
      [Markup.button.callback("🏆 Win", "user:lbm:wins")],
      [Markup.button.callback("⬅️ Profil", CALLBACK.MENU_PROFILE)],
    ]);

    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      // Bir xil matn — e'tiborsiz
    }
  });

  // ============================================================
  // FSM — PUBG ID
  // ============================================================
  bot.on("text", async (ctx, next) => {
    if (ctx.session?.state !== STATES.PLAYER_PUBG_ID) return next();

    const v = cleanText(ctx.message.text, 30);
    if (!v) {
      return ctx.reply("❗ PUBG ID kiriting:", backToProfile());
    }

    await userExtService.setPubgId(ctx.from.id, v);
    ctx.session = { state: null, data: {} };

    await ctx.reply(
      `✅ <b>PUBG ID saqlandi!</b>\n\n🎯 <code>${escapeHtml(v)}</code>`,
      { parse_mode: "HTML", reply_markup: backToProfile().reply_markup }
    );
  });
};