// ============================================================
// MEDIA HANDLER — Ovoz, video, poll (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, safeAnswer } = require('../utils/telegramUtils');

module.exports = (bot) => {
  // ============================================================
  // 1. OVOZLI XABAR
  // ============================================================
  bot.action(/^host:vc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tour = await tournamentService.getTournament(ctx.match[1]);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return;

    ctx.session = { state: 'host_send_voice', data: { tid: tour.id } };
    await ctx.reply(`🎤 ${t('host_msg')}:`);
  });

  // ============================================================
  // 2. VIDEO
  // ============================================================
  bot.action(/^host:vd:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tour = await tournamentService.getTournament(ctx.match[1]);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return;

    ctx.session = { state: 'host_send_video', data: { tid: tour.id } };
    await ctx.reply(`🎬 ${t('host_msg')}:`);
  });

  // ============================================================
  // 3. POLL
  // ============================================================
  bot.action(/^host:pl:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tour = await tournamentService.getTournament(ctx.match[1]);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) return;

    ctx.session = { state: 'host_send_poll', data: { tid: tour.id } };
    await ctx.reply(
      `📊 <b>${t('host_msg')}</b>\n\n` +
        `${t('stage_room_format')}:\n` +
        `<code>${t('support_enter_text')}?\n${t('promo_top3')}\n${t('promo_top4')}\n${t('promo_top5')}</code>\n\n` +
        `<i>${t('support_enter_text')} — ${t('support_enter_text')}, ${t('promo_top3')} — ${t('promo_top3')}</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 4. VOICE
  // ============================================================
  bot.on('voice', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== 'host_send_voice') return next();
    const t = ctx.t;

    const tid = ctx.session.data.tid;
    const tour = await tournamentService.getTournament(tid);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }
    const fileId = ctx.message.voice.file_id;

    const memberIds = new Set();
    for (const teamId of tour.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await ctx.telegram.sendVoice(uid, fileId, {
          caption: `🎤 <b>${escapeHtml(tour.title)}</b>`,
          parse_mode: 'HTML',
        });
        sent++;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 60));
    }

    ctx.session = { state: null, data: {} };
    await ctx.reply(`✅ ${t('stage_room_sent_to')}: ${sent}`);
  });

  // ============================================================
  // 5. VIDEO
  // ============================================================
  bot.on('video', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== 'host_send_video') return next();
    const t = ctx.t;

    const tid = ctx.session.data.tid;
    const tour = await tournamentService.getTournament(tid);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }
    const fileId = ctx.message.video.file_id;
    const caption = ctx.message.caption || '';

    const memberIds = new Set();
    for (const teamId of tour.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await ctx.telegram.sendVideo(uid, fileId, {
          caption: `🎬 <b>${escapeHtml(tour.title)}</b>${caption ? '\n\n' + escapeHtml(caption) : ''}`,
          parse_mode: 'HTML',
        });
        sent++;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 60));
    }

    ctx.session = { state: null, data: {} };
    await ctx.reply(`✅ ${t('stage_room_sent_to')}: ${sent}`);
  });

  // ============================================================
  // 6. POLL
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== 'host_send_poll') return next();
    const t = ctx.t;

    const tid = ctx.session.data.tid;
    const tour = await tournamentService.getTournament(tid);
    if (!tour || Number(tour.hostId) !== Number(ctx.from.id)) {
      ctx.session = { state: null, data: {} };
      return;
    }

    const lines = ctx.message.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) {
      return ctx.reply(`❗ ${t('support_input_min_len')}`);
    }

    const question = lines[0].slice(0, 250);
    const options = lines.slice(1, 11).map((o) => o.slice(0, 100));

    const memberIds = new Set();
    for (const teamId of tour.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    let sent = 0;
    for (const uid of memberIds) {
      try {
        await ctx.telegram.sendPoll(uid, `📊 ${tour.title}\n\n${question}`, options, {
          is_anonymous: false,
        });
        sent++;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 60));
    }

    ctx.session = { state: null, data: {} };
    await ctx.reply(`✅ ${t('stage_room_sent_to')}: ${sent}`);
  });
};