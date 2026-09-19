// Media: ovozli xabar, video, poll
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const broadcastService = require('../services/broadcastService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, safeAnswer } = require('../utils/telegramUtils');

module.exports = (bot) => {
  // ============================================================
  // 36. OVOZLI XABAR
  // ============================================================
  bot.action(/^host:vc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return;
    ctx.session = { state: 'host_send_voice', data: { tid: t.id } };
    await ctx.reply('🎤 Ovozli xabar yuboring:');
  });

  // ============================================================
  // 37. VIDEO
  // ============================================================
  bot.action(/^host:vd:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return;
    ctx.session = { state: 'host_send_video', data: { tid: t.id } };
    await ctx.reply('🎬 Video yuboring (caption bilan yoki usiz):');
  });

  // ============================================================
  // 38. POLL
  // ============================================================
  bot.action(/^host:pl:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) return;

    ctx.session = { state: 'host_send_poll', data: { tid: t.id } };
    await ctx.reply(
      `📊 <b>Poll yuborish</b>\n\n` +
        `Format:\n<code>Savol?\nVariant1\nVariant2\nVariant3</code>\n\n` +
        `<i>Birinchi qator — savol, keyingilari — variantlar</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // VOICE HANDLER
  // ============================================================
  bot.on('voice', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== 'host_send_voice') return next();
    const tid = ctx.session.data.tid;
    const t = await tournamentService.getTournament(tid);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }
    const fileId = ctx.message.voice.file_id;

    const memberIds = new Set();
    for (const teamId of t.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await ctx.telegram.sendVoice(uid, fileId, {
          caption: `🎤 <b>${escapeHtml(t.title)}</b>`,
          parse_mode: 'HTML',
        });
        sent++;
      } catch {}
      await new Promise((r) => setTimeout(r, 60));
    }

    ctx.session = { state: null, data: {} };
    await ctx.reply(`✅ Ovozli xabar yuborildi: ${sent}`);
  });

  // ============================================================
  // VIDEO HANDLER
  // ============================================================
  bot.on('video', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== 'host_send_video') return next();
    const tid = ctx.session.data.tid;
    const t = await tournamentService.getTournament(tid);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }
    const fileId = ctx.message.video.file_id;
    const caption = ctx.message.caption || '';

    const memberIds = new Set();
    for (const teamId of t.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await ctx.telegram.sendVideo(uid, fileId, {
          caption: `🎬 <b>${escapeHtml(t.title)}</b>${caption ? '\n\n' + escapeHtml(caption) : ''}`,
          parse_mode: 'HTML',
        });
        sent++;
      } catch {}
      await new Promise((r) => setTimeout(r, 60));
    }

    ctx.session = { state: null, data: {} };
    await ctx.reply(`✅ Video yuborildi: ${sent}`);
  });

  // ============================================================
  // POLL HANDLER
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== 'host_send_poll') return next();

    const tid = ctx.session.data.tid;
    const t = await tournamentService.getTournament(tid);
    if (!t || Number(t.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }

    const lines = ctx.message.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) {
      return ctx.reply('❗ Kamida 1 savol va 2 variant kerak.');
    }

    const question = lines[0].slice(0, 250);
    const options = lines.slice(1, 11).map((o) => o.slice(0, 100));

    const memberIds = new Set();
    for (const teamId of t.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await ctx.telegram.sendPoll(uid, `📊 ${t.title}\n\n${question}`, options, {
          is_anonymous: false,
        });
        sent++;
      } catch {}
      await new Promise((r) => setTimeout(r, 60));
    }

    ctx.session = { state: null, data: {} };
    await ctx.reply(`✅ Poll yuborildi: ${sent}`);
  });
};