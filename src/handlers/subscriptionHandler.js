// ============================================================
// SUBSCRIPTION HANDLER — Obuna + ro'yxatdan o'tish (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const channelService = require('../services/channelService');
const subscriptionService = require('../services/subscriptionService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, ROLES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { subscriptionKeyboard } = require('../keyboards/paymentKeyboard');

module.exports = (bot) => {
  // ============================================================
  // 1. BEPUL TURNIRGA RO'YXATDAN O'TISH
  // ============================================================
  bot.action(/^tour:reg_free:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    if (tour.type !== 'free') return ctx.reply(`❗ ${t('tour_type_free')}`);

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply(t('error_team_not_member'), {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tId }]],
        },
      });
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(t('error_not_found'));

    if (team.captainId !== ctx.from.id) {
      return ctx.reply(t('error_not_captain'), {
        reply_markup: {
          inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tId }]],
        },
      });
    }

    if (tour.registeredTeams.includes(team.id)) {
      return ctx.reply(t('error_already_registered'));
    }

    if (tour.registeredTeams.length >= tour.maxTeams) {
      return ctx.reply(t('error_tournament_full'));
    }

    const channels = tour.requiredChannels || [];

    if (!channels.length) {
      return registerTeamForFree(ctx, tour, team);
    }

    await showSubscriptionPage(ctx, tour, channels, 'captain');
  });

  // ============================================================
  // 2. OBUNANI TEKSHIRISH
  // ============================================================
  bot.action(/^chv:all:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(t('tour_not_found'));
    if (tour.type !== 'free') return;

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply(t('error_team_not_member'));

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(t('error_not_found'));

    const channels = tour.requiredChannels || [];
    if (!channels.length) {
      if (team.captainId === ctx.from.id) {
        return registerTeamForFree(ctx, tour, team);
      }
      return ctx.reply(`✅ ${t('sub_all_ok')}`);
    }

    const results = await channelService.checkAllSubscriptions(bot, ctx.from.id, channels);
    const notSubscribed = results.filter((r) => !r.subscribed);

    if (notSubscribed.length > 0) {
      return showMissingChannels(ctx, tour, channels, notSubscribed);
    }

    await subscriptionService.markVerified(tour.id, team.id, ctx.from.id);

    const isCaptain = team.captainId === ctx.from.id;

    if (isCaptain) return registerTeamForFree(ctx, tour, team);

    return showMemberSuccess(ctx, tour, team);
  });

  // ============================================================
  // 3. ORQAGA
  // ============================================================
  bot.action(/^chv:back:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    const tId = ctx.match[1];
    return ctx.reply(`⬅️`, {
      reply_markup: {
        inline_keyboard: [[{ text: t('btn_back'), callback_data: CALLBACK.TOUR_OPEN + tId }]],
      },
    });
  });
};

// ============================================================
// YORDAMCHI: OBUNA SAHIFASI
// ============================================================
async function showSubscriptionPage(ctx, tournament, channels, role = 'captain') {
  const t = ctx.t;

  const lines = [];
  lines.push(`📢 <b>${t('sub_required_channels')}</b>`);
  lines.push('');
  lines.push(
    role === 'captain' ? `<i>${t('sub_captain_needs')}</i>` : `<i>${t('sub_member_needs')}</i>`
  );
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  channels.forEach((ch, i) => {
    lines.push(`${i + 1}. <b>${escapeHtml(ch.channelTitle || t('ch_list_title'))}</b>`);
    if (ch.channelUsername) {
      lines.push(`   ${escapeHtml(ch.channelUsername)}`);
    }
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`<i>${t('sub_checking')}</i>`);

  const kb = subscriptionKeyboard(ctx, tournament.id, channels);

  try {
    await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', ...kb });
  } catch (e) {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', ...kb });
  }
}

// ============================================================
// YORDAMCHI: OBUNA BO'LMAGAN
// ============================================================
async function showMissingChannels(ctx, tournament, channels, notSubscribed) {
  const t = ctx.t;

  const list = notSubscribed
    .map((r, i) => `${i + 1}. <b>${escapeHtml(r.channel.channelTitle || t('ch_list_title'))}</b>`)
    .join('\n');

  const text =
    `❌ <b>${t('sub_some_missing')}</b>\n\n` +
    `${list}\n\n` +
    `<i>${t('sub_checking')}</i>`;

  const kb = subscriptionKeyboard(ctx, tournament.id, channels);

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
  } catch (e) {
    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  }
}

// ============================================================
// YORDAMCHI: BEPUL RO'YXATDAN O'TKAZISH
// ============================================================
async function registerTeamForFree(ctx, tournament, team) {
  const t = ctx.t;

  const res = await tournamentService.registerTeam(tournament.id, team.id);

  if (!res.ok) {
    if (res.reason === 'already') return ctx.reply(t('error_already_registered'));
    if (res.reason === 'full') return ctx.reply(t('error_tournament_full'));
    return ctx.reply(`❌ ${res.reason}`);
  }

  let sentCount = 0;
  const failedIds = [];

  for (const memberId of team.members) {
    if (memberId === ctx.from.id) continue;

    try {
      const alreadyVerified = await require('../services/subscriptionService').isVerified(
        tournament.id,
        team.id,
        memberId
      );

      if (alreadyVerified) {
        await ctx.telegram.sendMessage(
          memberId,
          `📢 <b>${t('sub_registered')}</b>\n\n` +
            `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
            `👥 ${escapeHtml(team.name)}\n\n` +
            `✅ ${t('sub_already_verified')}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: t('tour_open'),
                    callback_data: CALLBACK.TOUR_OPEN + tournament.id,
                  },
                ],
              ],
            },
          }
        );
      } else {
        const channels = tournament.requiredChannels || [];
        await ctx.telegram.sendMessage(
          memberId,
          `📢 <b>${t('sub_registered')}</b>\n\n` +
            `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
            `👥 ${escapeHtml(team.name)}\n` +
            `👑 ${t('team_captain')}: ${escapeHtml(displayName(await userService.getUser(team.captainId)) || '-')}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📌 <b>${t('sub_room_locked')}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: subscriptionKeyboard(tournament.id, channels).reply_markup,
          }
        );
      }

      sentCount++;
    } catch (e) {
      failedIds.push(memberId);
    }
  }

  const totalMembers = team.members.length;
  const pendingCount = totalMembers - 1 - (sentCount - failedIds.length);

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        t('tour_teamlist'),
        CALLBACK.TOUR_TEAMLIST + tournament.id
      ),
    ],
    [
      Markup.button.callback(
        t('btn_back_tournament'),
        CALLBACK.TOUR_OPEN + tournament.id
      ),
    ],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);

  await safeEdit(
    ctx,
    `╔══════════════════════╗\n` +
      `   🎉 <b>${t('team_created')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `✅ <b>${escapeHtml(team.name)}</b>\n\n` +
      `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
      `💳 ${t('tour_type_free')}\n` +
      `👥 ${t('stage_match_teams')}: <b>${tournament.registeredTeams.length + 1}/${tournament.maxTeams}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📤 <b>${sentCount}</b> ${t('captain_notified')}\n` +
      (failedIds.length ? `⚠️ ${failedIds.length} ❌\n` : '') +
      `\n📌 <i>${t('sub_wait_room')}</i>`,
    { parse_mode: 'HTML', reply_markup: kb.reply_markup }
  );
}

// ============================================================
// YORDAMCHI: A'ZO MUVAFFAQIYATI
// ============================================================
async function showMemberSuccess(ctx, tournament, team) {
  const t = ctx.t;

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        t('tour_room_info'),
        CALLBACK.TOUR_ROOM_INFO + tournament.id
      ),
    ],
    [
      Markup.button.callback(
        t('btn_back_tournament'),
        CALLBACK.TOUR_OPEN + tournament.id
      ),
    ],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);

  await safeEdit(
    ctx,
    `╔══════════════════════╗\n` +
      `   ✅ <b>${t('sub_member_verified')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
      `👥 ${escapeHtml(team.name)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ ${t('sub_all_ok')}\n\n` +
      `📌 <i>${t('sub_room_locked')}</i>`,
    { parse_mode: 'HTML', reply_markup: kb.reply_markup }
  );
}