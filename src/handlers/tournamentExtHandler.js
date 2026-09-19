// Turnir qo'shimcha handlerlari (2, 4, 5, 6, 7, 10, 11, 13, 33, 34, 35)
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const tournamentExtService = require('../services/tournamentExtService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const channelService = require('../services/channelService');
const { CALLBACK, ROLES, STATES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');
const { cleanText } = require('../utils/validation');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // 2. TURNIRNI NUSXALASH
  // ============================================================
  bot.action(/^tour:clone:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    ctx.session = {
      state: STATES.TOUR_CLONE_DATE,
      data: { oldId: tId },
    };

    await ctx.reply(
      `📋 <b>Turnirni nusxalash</b>\n\n` +
        `🏆 Eski: <b>${escapeHtml(t.title)}</b>\n` +
        `📅 ${t.date} | ⏰ ${t.startTime}\n\n` +
        `📅 Yangi sanani kiriting (YYYY-MM-DD):\n` +
        `<i>Yoki /skip — eski sanani saqlash</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 4. TURNIRNI BEKOR QILISH
  // ============================================================
  bot.action(/^tour:cancel_confirm:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    try {
      const { tournament, memberIds } = await tournamentExtService.cancelTournament(
        tId,
        'Admin tomonidan bekor qilindi'
      );

      // Barcha a'zolarga xabar
      let sent = 0;
      for (const uid of memberIds) {
        try {
          await bot.telegram.sendMessage(
            uid,
            `🚫 <b>Turnir bekor qilindi!</b>\n\n` +
              `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
              `📅 ${tournament.date}\n\n` +
              `<i>Kechirasiz, turnir bekor qilindi.</i>`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch (e) { /* bloklangan */ }
      }

      await safeEdit(
        ctx,
        `✅ <b>Turnir bekor qilindi</b>\n\n` +
          `🏆 ${escapeHtml(tournament.title)}\n` +
          `📤 ${sent} o'yinchiga xabar yuborildi.`,
        { reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Turnirlar', CALLBACK.ADMIN_TOURNAMENTS)]] } }
      );
    } catch (e) {
      await ctx.reply('❌ Xatolik: ' + e.message);
    }
  });

  bot.action(/^tour:cancel:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Turnir topilmadi.');

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🚫 Ha, bekor qilish', 'tour:cancel_confirm:' + tId)],
      [Markup.button.callback('❌ Yo\'q', CALLBACK.TOUR_OPEN + tId)],
    ]);

    await safeEdit(
      ctx,
      `⚠️ <b>Turnirni bekor qilmoqchimisiz?</b>\n\n` +
        `🏆 <b>${escapeHtml(t.title)}</b>\n` +
        `👥 Komandalar: ${t.registeredTeams.length}\n\n` +
        `<i>Barcha ishtirokchilarga xabar yuboriladi.</i>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 5. TURNIR TARIXI
  // ============================================================
  bot.action(CALLBACK.TOUR_HISTORY, async (ctx) => {
    await safeAnswer(ctx);
    const history = await tournamentExtService.getTournamentHistory(15);

    if (!history.length) {
      return safeEdit(ctx, '📭 Tugagan turnirlar yo\'q.', {
        reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TOURNAMENTS)]] },
      });
    }

    const lines = [];
    lines.push(`📚 <b>TURNIRLAR TARIXI</b>`);
    lines.push(`📊 Jami: <b>${history.length}</b> ta`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    history.forEach((t, i) => {
      lines.push(`<b>${i + 1}. ${escapeHtml(t.title)}</b>`);
      lines.push(`   📅 ${t.date} | ⏰ ${t.startTime}`);
      lines.push(`   👥 ${t.registeredTeams.length} komanda`);
      lines.push('');
    });

    const buttons = history.slice(0, 10).map((t) => [
      Markup.button.callback(`🏆 ${t.title.slice(0, 25)}`, CALLBACK.TOUR_HISTORY_VIEW + t.id),
    ]);
    buttons.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TOURNAMENTS)]);

    await safeEdit(ctx, lines.join('\n'), { reply_markup: { inline_keyboard: buttons } });
  });

  bot.action(/^tour:hv:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    try {
      const report = await tournamentExtService.buildTournamentReport(tId);
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('🏅 G\'oliblar', CALLBACK.TOUR_WINNERS + tId)],
        [Markup.button.callback('⬅️ Tarix', CALLBACK.TOUR_HISTORY)],
      ]);
      await safeEdit(ctx, report, { reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply('❌ ' + e.message);
    }
  });

  // ============================================================
  // 6. TURNIR HAVOLASI
  // ============================================================
  bot.action(/^tour:link:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const link = tournamentExtService.buildTournamentLink(tId, config.BOT_USERNAME);

    await safeEdit(
      ctx,
      `🔗 <b>Turnir havolasi</b>\n\n` +
        `<code>${escapeHtml(link)}</code>\n\n` +
        `💡 <i>Ushbu havolani do'stlaringizga yuboring</i>`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.url('📤 Ulashish', `https://t.me/share/url?url=${encodeURIComponent(link)}`)],
            [Markup.button.callback('⬅️ Orqaga', CALLBACK.TOUR_OPEN + tId)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 7. TURNIR STATISTIKASI
  // ============================================================
  bot.action(/^tour:stats:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const stats = await tournamentExtService.getTournamentStats(ctx.match[1]);
    if (!stats) return ctx.reply('❗ Topilmadi.');

    const text =
      `📊 <b>Turnir statistikasi</b>\n\n` +
      `🏆 <b>${escapeHtml(stats.tournament.title)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 Komandalar: <b>${stats.teams}/${stats.maxTeams}</b>\n` +
      `📈 To'ldirilish: <b>${stats.fillRate}%</b>\n` +
      `🎮 Kartalar: <b>${stats.matches}</b>\n` +
      `💥 Jami kill: <b>${stats.totalKills}</b>\n` +
      `📊 O'rtacha kill/karta: <b>${stats.avgKills}</b>`;

    await safeEdit(ctx, text, {
      reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Orqaga', CALLBACK.TOUR_OPEN + stats.tournament.id)]] },
    });
  });

  // ============================================================
  // 10. SHABLONLAR
  // ============================================================
  bot.action(CALLBACK.TOUR_TEMPLATE, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const templates = await tournamentExtService.listTemplates();

    const rows = templates.slice(0, 10).map((tpl) => [
      Markup.button.callback(`📋 ${tpl.name.slice(0, 30)}`, CALLBACK.TOUR_TEMPLATE_USE + tpl.id),
    ]);
    rows.push([Markup.button.callback('➕ Yangi turnirdan shablon', CALLBACK.TOUR_TEMPLATE_NEW)]);
    rows.push([Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]);

    await safeEdit(
      ctx,
      `📋 <b>Turnir shablonlari (${templates.length})</b>\n\n` +
        (templates.length ? 'Tanlang:' : '<i>Hozircha shablonlar yo\'q</i>'),
      { reply_markup: { inline_keyboard: rows } }
    );
  });

  bot.action(/^tour:tplu:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tpl = await tournamentExtService.getTemplate(ctx.match[1]);
    if (!tpl) return ctx.reply('❗ Shablon topilmadi.');

    ctx.session = {
      state: STATES.TOUR_CREATE_DATE,
      data: { ...tpl.data, imageFileId: tpl.data.imageFileId },
    };

    await ctx.reply(
      `📋 <b>Shablon: ${escapeHtml(tpl.name)}</b>\n\n` +
        `📍 Yangi sana kiriting (YYYY-MM-DD):`,
      { parse_mode: 'HTML' }
    );
  });

  bot.action(CALLBACK.TOUR_TEMPLATE_NEW, async (ctx) => {
    await safeAnswer(ctx);
    // Turnir yaratish jarayonini boshlash (keyin saqlash tugmasi bilan)
    ctx.session = { state: STATES.TOUR_CREATE_TITLE, data: { saveAsTemplate: true } };
    await ctx.reply('✍️ Turnir nomini kiriting (shablon saqlanadi):');
  });

  // ============================================================
  // 11. KO'P ETAP
  // ============================================================
  bot.action(/^tour:stage:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 1/4 Final', 'tour:stages:' + tId + ':quarter'),
        Markup.button.callback('🎯 1/2 Final', 'tour:stages:' + tId + ':semi'),
      ],
      [
        Markup.button.callback('🏆 Final', 'tour:stages:' + tId + ':final'),
        Markup.button.callback('📌 Yakka', 'tour:stages:' + tId + ':single'),
      ],
      [Markup.button.callback('⬅️ Orqaga', CALLBACK.TOUR_OPEN + tId)],
    ]);

    await safeEdit(ctx, `⭐️ <b>Etap turini tanlang:</b>`, { reply_markup: kb.reply_markup });
  });

  bot.action(/^tour:stages:(.+):(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const stage = ctx.match[2];

    const labels = {
      quarter: '1/4 Final',
      semi: '1/2 Final',
      final: 'Final',
      single: 'Yakka',
    };

    await tournamentExtService.setTournamentStage(tId, stage);
    await safeEdit(
      ctx,
      `✅ Etap o'rnatildi: <b>${labels[stage]}</b>`,
      { reply_markup: { inline_keyboard: [[Markup.button.callback('⬅️ Turnir', CALLBACK.TOUR_OPEN + tId)]] } }
    );
  });

  // ============================================================
  // 13. TURNIR KALENDARI
  // ============================================================
  bot.action(CALLBACK.TOUR_CALENDAR, async (ctx) => {
    await safeAnswer(ctx);
    const now = new Date();
    await showCalendar(ctx, now.getFullYear(), now.getMonth() + 1);
  });

  bot.action(/^tour:calm:(\d+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    await showCalendar(ctx, parseInt(ctx.match[1]), parseInt(ctx.match[2]));
  });

  // ============================================================
  // 9, 59. KANALGA E'LON
  // ============================================================
  bot.action(/^tour:anc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t) return ctx.reply('❗ Topilmadi.');

    await ctx.reply('📤 Kanalga yuborilmoqda...');
    const res = await channelService.announceToChannel(bot, t);

    if (res.ok) {
      await ctx.reply('✅ Kanalga muvaffaqiyatli e\'lon qilindi!');
    } else {
      await ctx.reply(`❌ Yuborilmadi: ${res.reason}`);
    }
  });

  // ============================================================
  // 33. TURNIR HISOBOTI
  // ============================================================
  bot.action(/^tour:rep:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    try {
      const report = await tournamentExtService.buildTournamentReport(ctx.match[1]);
      await ctx.reply(report, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply('❌ ' + e.message);
    }
  });

  // ============================================================
  // 34. G'OLIBLARNI E'LON QILISH
  // ============================================================
  bot.action(/^tour:win:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER, ROLES.HOST])) return;

    try {
      const tId = ctx.match[1];
      const res = await tournamentExtService.buildWinnersAnnouncement(tId);
      if (!res) return ctx.reply('❗ Natijalar yo\'q.');

      // Tasdiqlash
      ctx.session = { state: null, data: { pendingAnnouncement: tId } };

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('📢 Barchaga e\'lon qilish', 'tour:win_send:' + tId)],
        [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_OPEN + tId)],
      ]);

      await ctx.reply(res.text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply('❌ ' + e.message);
    }
  });

  bot.action(/^tour:win_send:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER, ROLES.HOST])) return;

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply('❗ Topilmadi.');

    const res = await tournamentExtService.buildWinnersAnnouncement(tId);
    if (!res) return ctx.reply('❗ Natijalar yo\'q.');

    // Barcha ishtirokchilarga
    const memberIds = new Set();
    for (const teamId of t.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await bot.telegram.sendMessage(uid, res.text, { parse_mode: 'HTML' });
        sent++;
      } catch (e) { /* bloklangan */ }
    }

    await ctx.reply(`✅ E'lon ${sent} o'yinchiga yuborildi!`);
  });

  // ============================================================
  // 35. SOVRIN TARQATISH
  // ============================================================
  bot.action(/^tour:prize:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const res = await tournamentExtService.buildWinnersAnnouncement(tId);
    if (!res) return ctx.reply('❗ Natijalar yo\'q.');

    ctx.session = { state: STATES.HOST_PRIZE_INPUT, data: { tid: tId } };
    await ctx.reply(
      `💰 <b>Sovrin matnini kiriting:</b>\n\n` +
        `<i>Masalan: "1-o'rin: 200.000, 2-o'rin: 100.000, 3-o'rin: 50.000"</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();

    // ---------- CLONE DATE ----------
    if (s === STATES.TOUR_CLONE_DATE) {
      const v = cleanText(ctx.message.text, 10);
      if (v.toLowerCase() === '/skip') {
        ctx.session.state = STATES.TOUR_CLONE_TIME;
        return ctx.reply('⏰ Yangi vaqtni kiriting (HH:mm) yoki /skip:');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return ctx.reply('❗ Format: YYYY-MM-DD:');
      ctx.session.data.date = v;
      ctx.session.state = STATES.TOUR_CLONE_TIME;
      return ctx.reply('⏰ Yangi vaqtni kiriting (HH:mm) yoki /skip:');
    }

    // ---------- CLONE TIME ----------
    if (s === STATES.TOUR_CLONE_TIME) {
      const v = cleanText(ctx.message.text, 5);
      const { oldId } = ctx.session.data;
      let newTime = null;
      if (v.toLowerCase() !== '/skip') {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return ctx.reply('❗ Format: HH:mm:');
        newTime = v;
      }
      try {
        const cloned = await tournamentExtService.cloneTournament(
          oldId,
          ctx.session.data.date || null,
          newTime,
          ctx.from.id
        );
        ctx.session = { state: null, data: {} };
        await ctx.reply(
          `✅ <b>Turnir nusxalandi!</b>\n\n` +
            `🆔 Yangi ID: <code>${cloned.id}</code>\n` +
            `🏆 Nom: <b>${escapeHtml(cloned.title)}</b>\n` +
            `📅 ${cloned.date} | ⏰ ${cloned.startTime}`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        ctx.session = { state: null, data: {} };
        await ctx.reply('❌ Xatolik: ' + e.message);
      }
      return;
    }

    // ---------- PRIZE DISTRIBUTION ----------
    if (s === STATES.HOST_PRIZE_INPUT) {
      const prizeText = cleanText(ctx.message.text, 300);
      const tId = ctx.session.data.tid;
      try {
        const res = await tournamentExtService.buildWinnersAnnouncement(tId);
        await tournamentExtService.distributePrize(tId, res.winners, prizeText);

        // G'oliblarga xabar
        let sent = 0;
        for (const w of res.winners) {
          try {
            await bot.telegram.sendMessage(
              w.captainId,
              `🎉 <b>SOVRIN!</b>\n\n` +
                `🏆 <b>${escapeHtml(w.teamName)}</b>\n\n` +
                `💰 <b>${escapeHtml(prizeText)}</b>`,
              { parse_mode: 'HTML' }
            );
            sent++;
          } catch (e) { /* bloklangan */ }
        }

        ctx.session = { state: null, data: {} };
        await ctx.reply(`✅ Sovrin tarqatildi! ${sent} captain'ga xabar yuborildi.`);
      } catch (e) {
        ctx.session = { state: null, data: {} };
        await ctx.reply('❌ ' + e.message);
      }
      return;
    }

    return next();
  });
};

// ============================================================
// KALENDAR FUNKSIYASI
// ============================================================
async function showCalendar(ctx, year, month) {
  const tours = await tournamentExtService.getTournamentCalendar(year, month);
  const text = tournamentExtService.buildCalendarText(tours, year, month);

  // Pagination: oldingi/keyingi oy
  let prevM = month - 1, prevY = year;
  if (prevM < 1) { prevM = 12; prevY--; }
  let nextM = month + 1, nextY = year;
  if (nextM > 12) { nextM = 1; nextY++; }

  const rows = [
    [
      Markup.button.callback(`⬅️ ${prevM}`, `tour:calm:${prevY}:${prevM}`),
      Markup.button.callback(`${nextM} ➡️`, `tour:calm:${nextY}:${nextM}`),
    ],
    [Markup.button.callback('⬅️ Orqaga', CALLBACK.MENU_TOURNAMENTS)],
  ];

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
}