// ============================================================
// LIVE SCORE HANDLER — Real-time ball (#23)
// ============================================================
const { Markup } = require('telegraf');
const liveScoreService = require('../services/liveScoreService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, STATES, ROLES } = require('../constants');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
} = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

// ============================================================
// RUXSAT TEKSHIRISH
// ============================================================
async function checkHostAccess(ctx, tId) {
  const t = await tournamentService.getTournament(tId);
  if (!t) return { ok: false, reason: 'not_found' };

  const isHost = Number(t.hostId) === Number(ctx.from.id);
  const isAdmin = hasAnyRole(ctx.state.role, [ROLES.ADMIN]);

  if (!isHost && !isAdmin) return { ok: false, reason: 'access' };

  return { ok: true, tournament: t };
}

module.exports = (bot) => {
  // ============================================================
  // LIVE SESSION BOSHLASH
  // ============================================================
  bot.action(/^ls:start:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);

      if (!res.ok) {
        return ctx.reply(
          res.reason === 'access' ? "⛔ Ruxsat yo'q." : "❗ Turnir topilmadi."
        );
      }

      const t = res.tournament;

      if (!t.registeredTeams.length) {
        return ctx.reply("❗ Turnirda hali komandalar yo'q.");
      }

      await liveScoreService.startSession(tId, ctx.from.id);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   🔴 <b>LIVE SESSION</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ Session boshlandi!\n` +
          `📊 Komandalar: <b>${t.registeredTeams.length}</b>\n\n` +
          `👇 Amalni tanlang:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎯 Kill qo\'shish',
                  callback_data: 'ls:add:' + tId,
                },
              ],
              [
                {
                  text: '📍 O\'rin qo\'yish',
                  callback_data: 'ls:place_menu:' + tId,
                },
              ],
              [
                {
                  text: '👁 Live ko\'rish',
                  callback_data: 'ls:view:' + tId,
                },
              ],
              [
                {
                  text: '✅ Natijalarni yakunlash',
                  callback_data: 'ls:commit:' + tId,
                },
              ],
              [
                {
                  text: '⏹ Sessiyani to\'xtatish',
                  callback_data: 'ls:end:' + tId,
                },
              ],
              [
                {
                  text: '⬅️ Turnirga qaytish',
                  callback_data: CALLBACK.TOUR_OPEN + tId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('ls:start xatosi:', e.message);
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });

  // ============================================================
  // LIVE KO'RISH (barcha uchun)
  // ============================================================
  bot.action(/^ls:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const session = await liveScoreService.getSession(tId);

      if (!session) {
        return ctx.reply("📭 Live session hozircha faol emas.");
      }

      const text = await liveScoreService.formatLiveTable(tId);

      const isHost =
        Number(session.hostId) === Number(ctx.from.id) ||
        hasAnyRole(ctx.state.role, [ROLES.ADMIN]);

      const rows = [];
      rows.push([
        Markup.button.callback('🔄 Yangilash', 'ls:view:' + tId),
      ]);

      if (isHost && session.active) {
        rows.push([
          Markup.button.callback('🎯 Kill qo\'shish', 'ls:add:' + tId),
        ]);
      }

      rows.push([
        Markup.button.callback(
          '⬅️ Turnirga qaytish',
          CALLBACK.TOUR_OPEN + tId
        ),
      ]);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: rows },
        });
      } catch (e) {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: rows },
        });
      }
    } catch (e) {
      console.error('ls:view xatosi:', e.message);
    }
  });

  // ============================================================
  // KILL QO'SHISH — TEAM TANLASH
  // ============================================================
  bot.action(/^ls:add:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const t = res.tournament;

      const rows = [];

      for (const teamId of t.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (!team) continue;

        rows.push([
          Markup.button.callback(
            `🎯 ${team.name.slice(0, 25)} [+1]`,
            'ls:add_k:' + tId + ':' + teamId
          ),
        ]);
      }

      rows.push([
        Markup.button.callback('⬅️ Orqaga', 'ls:view:' + tId),
      ]);

      try {
        await ctx.editMessageText(
          `🎯 <b>Kill qo'shish</b>\n\n🏆 ${escapeHtml(t.title)}\n\nKomandani tanlang:`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      } catch (e) {
        await ctx.reply(
          `🎯 <b>Kill qo'shish</b>\n\nKomandani tanlang:`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      }
    } catch (e) {
      console.error('ls:add xatosi:', e.message);
    }
  });

  // ============================================================
  // KILL +1
  // ============================================================
  bot.action(/^ls:add_k:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const teamId = ctx.match[2];

      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      await liveScoreService.addKills(tId, teamId, 1);

      const text = await liveScoreService.formatLiveTable(tId);

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback('🎯 Yana kill', 'ls:add:' + tId),
        ],
        [
          Markup.button.callback('👁 Live ko\'rish', 'ls:view:' + tId),
        ],
      ]);

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      console.error('ls:add_k xatosi:', e.message);
    }
  });

  // ============================================================
  // KILL AYIRISH (-1)
  // ============================================================
  bot.action(/^ls:rem_k:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const teamId = ctx.match[2];

      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      await liveScoreService.removeKills(tId, teamId, 1);

      const text = await liveScoreService.formatLiveTable(tId);
      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('ls:rem_k xatosi:', e.message);
    }
  });

  // ============================================================
  // O'RIN QO'YISH — TEAM TANLASH
  // ============================================================
  bot.action(/^ls:place_menu:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const t = res.tournament;

      const rows = [];

      for (const teamId of t.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (!team) continue;

        rows.push([
          Markup.button.callback(
            `📍 ${team.name.slice(0, 25)}`,
            'ls:add_p:' + tId + ':' + teamId
          ),
        ]);
      }

      rows.push([
        Markup.button.callback('⬅️ Orqaga', 'ls:view:' + tId),
      ]);

      try {
        await ctx.editMessageText(
          `📍 <b>O'rin qo'yish</b>\n\n🏆 ${escapeHtml(
            t.title
          )}\n\nKomandani tanlang:`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      } catch (e) {
        await ctx.reply(
          `📍 <b>O'rin qo'yish</b>\n\nKomandani tanlang:`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
        );
      }
    } catch (e) {
      console.error('ls:place_menu xatosi:', e.message);
    }
  });

  // ============================================================
  // O'RIN QO'YISH — KIRITISH BOSQICHI
  // ============================================================
  bot.action(/^ls:add_p:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const teamId = ctx.match[2];

      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const team = await teamService.getTeam(teamId);
      if (!team) return ctx.reply("❗ Komanda topilmadi.");

      ctx.session = {
        state: STATES.LIVE_PLACE_INPUT,
        data: { tid: tId, teamId },
      };

      await ctx.reply(
        `📍 <b>O'rin kiriting</b>\n\n` +
          `🏆 Komanda: <b>${escapeHtml(team.name)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Raqam kiriting (1-18):\n\n` +
          `<i>Masalan: 5</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '❌ Bekor qilish',
                  callback_data: 'ls:view:' + tId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('ls:add_p xatosi:', e.message);
    }
  });

  // ============================================================
  // FSM — O'RIN KIRITISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.LIVE_PLACE_INPUT) return next();

    try {
      const { tid, teamId } = ctx.session.data;
      const v = (ctx.message.text || '').trim();

      if (!/^\d+$/.test(v)) {
        return ctx.reply("❗ Faqat raqam kiriting (1-18):");
      }

      const place = parseInt(v, 10);
      if (place < 1 || place > 18) {
        return ctx.reply("❗ O'rin 1-18 orasida bo'lishi kerak:");
      }

      await liveScoreService.setPlacement(tid, teamId, place);
      ctx.session = { state: null, data: {} };

      const text = await liveScoreService.formatLiveTable(tid);
      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('ls:place_input xatosi:', e.message);
      ctx.session = { state: null, data: {} };
    }
  });

  // ============================================================
  // SESSION YAKUNLASH (o'chirish)
  // ============================================================
  bot.action(/^ls:end:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      await liveScoreService.endSession(tId);

      await ctx.reply(
        `⏹ <b>Live session to'xtatildi</b>\n\n<i>Endi natijalar yangilanmaydi.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⬅️ Turnirga qaytish',
                  callback_data: CALLBACK.TOUR_OPEN + tId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('ls:end xatosi:', e.message);
    }
  });

  // ============================================================
  // NATIJALARNI YAKUNLASH VA KARTA SAQLASH
  // ============================================================
  bot.action(/^ls:commit:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const t = res.tournament;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Ha, saqlash',
            'ls:commit_yes:' + tId
          ),
        ],
        [
          Markup.button.callback('❌ Bekor qilish', 'ls:view:' + tId),
        ],
      ]);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   📋 <b>KARTA SAQLASH</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⚠️ <b>Diqqat!</b>\n\n` +
          `Live natijalar karta sifatida saqlanadi.\n` +
          `Barcha o'yinchilarga xabar yuboriladi.\n\n` +
          `<i>Tasdiqlaysizmi?</i>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('ls:commit xatosi:', e.message);
    }
  });

  // ============================================================
  // NATIJALARNI TASDIQLASH VA SAQLASH
  // ============================================================
  bot.action(/^ls:commit_yes:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const t = res.tournament;

      const match = await liveScoreService.commitToMatch(tId, ctx.from.id);

      // O'yinchilarga xabar yuborish
      const memberIds = new Set();
      for (const teamId of t.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (team) team.members.forEach((m) => memberIds.add(m));
      }

      const matchService = require('../services/matchService');
      const pointsService = require('../services/pointsService');

      const teamsMap = {};
      for (const teamId of t.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (team) teamsMap[teamId] = team;
      }

      const cardText = pointsService.formatMatchCard(match, teamsMap);

      let sent = 0;
      for (const uid of memberIds) {
        try {
          await ctx.telegram.sendMessage(
            uid,
            `📊 <b>${escapeHtml(t.title)}</b>\n\n${cardText}`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 60));
      }

      await ctx.reply(
        `✅ <b>Karta №${match.number} saqlandi!</b>\n\n` +
          `📤 ${sent} o'yinchiga yuborildi.\n\n` +
          `<i>Live session yakunlandi.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⬅️ Turnirga qaytish',
                  callback_data: CALLBACK.TOUR_OPEN + tId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      console.error('ls:commit_yes xatosi:', e.message);
      await ctx.reply(`❌ Xatolik: ${e.message}`);
    }
  });

  // ============================================================
  // ACTIVENI TEKSHIRISH VA HOST TUGMASI
  // ============================================================
  bot.action(/^host:live:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const tId = ctx.match[1];
      const res = await checkHostAccess(ctx, tId);
      if (!res.ok) return;

      const t = res.tournament;
      const session = await liveScoreService.getSession(tId);
      const isActive = session?.active || false;

      const rows = [];

      if (isActive) {
        rows.push([
          Markup.button.callback(
            '🎯 Kill qo\'shish',
            'ls:add:' + tId
          ),
        ]);
        rows.push([
          Markup.button.callback(
            '📍 O\'rin qo\'yish',
            'ls:place_menu:' + tId
          ),
        ]);
        rows.push([
          Markup.button.callback(
            '👁 Live ko\'rish',
            'ls:view:' + tId
          ),
        ]);
        rows.push([
          Markup.button.callback(
            '✅ Natijalarni saqlash',
            'ls:commit:' + tId
          ),
        ]);
        rows.push([
          Markup.button.callback(
            '⏹ To\'xtatish',
            'ls:end:' + tId
          ),
        ]);
      } else {
        rows.push([
          Markup.button.callback(
            '🔴 Live boshlash',
            'ls:start:' + tId
          ),
        ]);
      }

      rows.push([
        Markup.button.callback(
          '⬅️ Turnirga qaytish',
          CALLBACK.HOST_OPEN + tId
        ),
      ]);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   📡 <b>LIVE SCORE</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Holat: <b>${isActive ? '🔴 FAOL' : '⚫️ Faol emas'}</b>\n\n` +
          `<i>Live rejimda o'yinchilar killarni real-time ko'radi.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: rows },
        }
      );
    } catch (e) {
      console.error('host:live xatosi:', e.message);
    }
  });
};