// ============================================================
// PROMOTION HANDLER — Top N (3/4/5) tanlash (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const promotionService = require('../services/promotionService');
const invitationService = require('../services/invitationService');
const stageService = require('../services/stageService');
const stageMatchService = require('../services/stageMatchService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const auditService = require('../services/auditService');
const { qualifiersCountKeyboard } = require('../keyboards/stageKeyboard');
const {
  CALLBACK,
  ROLES,
  PROMOTION_STATUS,
} = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

function canManagePromotion(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.ORGANIZER]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. PROMOTION RO'YXATI
  // ============================================================
  bot.action(/^prm:list:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const stageId = ctx.match[1];
    const stage = await stageService.getStage(stageId);
    if (!stage) return ctx.reply(t('stage_not_found'));

    const tournament = await tournamentService.getTournament(stage.tournamentId);
    const nextStage = stage.nextStageId
      ? await stageService.getStage(stage.nextStageId)
      : null;

    const days = await stageMatchService.getStageDays(stageId);
    const allApproved = await stageMatchService.isStageAllApproved(stageId);

    const dayStatuses = [];
    for (const day of days) {
      const dayApproved = await stageMatchService.isDayAllApproved(stageId, day);
      const dayStandings = await stageMatchService.getDayOverallStandings(stageId, day);
      const dayPromotions = await promotionService.getDayPromotions(stageId, day);
      const dayMatches = await stageMatchService.getMatchesByDay(stageId, day);

      dayStatuses.push({
        dayNumber: day,
        approved: dayApproved,
        matchesCount: dayMatches.length,
        standings: dayStandings,
        promotions: dayPromotions,
      });
    }

    const qualifiersPerDay = stage.rules?.qualifiersPerDay || 3;

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('promotion_menu')}`,
      `╚══════════════════════╝`,
      '',
      `🏆 <b>${escapeHtml(tournament?.title || '-')}</b>`,
      `📊 ${escapeHtml(stage.name)}`,
      nextStage ? `➡️ ${escapeHtml(nextStage.name)}` : '',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📅 ${t('promotion_days')}: <b>${days.length}</b>`,
      `🎮 ${t('stage_matches_per_day')}: <b>${stage.rules?.matchesPerDay || 4}</b>`,
      `🏅 ${t('stage_qualifiers_per_day')}: <b>${qualifiersPerDay}</b>`,
      `📊 ${t('promotion_total_qualify')}: <b>${qualifiersPerDay * days.length}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    for (const ds of dayStatuses) {
      const emoji = ds.approved ? '✅' : '⏳';
      const promoCount = ds.promotions.filter(
        (p) => p.status !== PROMOTION_STATUS.CANCELLED
      ).length;

      lines.push(
        `${emoji} <b>${t('promotion_day')} ${ds.dayNumber}</b> (${ds.matchesCount} match) — ${
          ds.approved ? t('stage_status_completed') : t('payment_status_pending')
        }`
      );
      lines.push(`   📊 ${t('standings_title')}: ${ds.standings.length} | 🎯 ${t('promotion_btn')}: ${promoCount}`);
      lines.push('');
    }

    const rows = [];

    for (const ds of dayStatuses) {
      const emoji = ds.approved ? '✅' : '⏳';
      const promoCount = ds.promotions.filter(
        (p) => p.status !== PROMOTION_STATUS.CANCELLED
      ).length;

      rows.push([
        Markup.button.callback(
          `${emoji} ${t('promotion_day')} ${ds.dayNumber} (${promoCount}/${qualifiersPerDay})`,
          'prm:day:' + stageId + ':' + ds.dayNumber
        ),
      ]);
    }

    if (allApproved) {
      const allPromotions = await promotionService.getStagePromotions(stageId);
      const hasQualified = allPromotions.some(
        (p) => p.status === PROMOTION_STATUS.QUALIFIED
      );

      if (hasQualified) {
        rows.push([
          Markup.button.callback(
            t('promotion_promote_all'),
            CALLBACK.PROMOTION_CONFIRM_ALL + stageId
          ),
        ]);
      }

      rows.push([
        Markup.button.callback(
          t('promotion_send_all_invites'),
          'prm:send_all:' + stageId
        ),
      ]);
    }

    rows.push([
      Markup.button.callback(t('btn_back_tournament'), CALLBACK.STAGE_VIEW + stageId),
    ]);

    const text = lines.filter(Boolean).join('\n');

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
  });

  // ============================================================
  // 2. KUN KO'RINISHI
  // ============================================================
  bot.action(/^prm:day:([^:]+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const stageId = ctx.match[1];
    const dayNumber = parseInt(ctx.match[2], 10);

    const stage = await stageService.getStage(stageId);
    if (!stage) return;

    const dayStandings = await stageMatchService.getDayOverallStandings(stageId, dayNumber);
    const dayPromotions = await promotionService.getDayPromotions(stageId, dayNumber);
    const dayMatches = await stageMatchService.getMatchesByDay(stageId, dayNumber);
    const dayApproved = await stageMatchService.isDayAllApproved(stageId, dayNumber);

    const lines = [
      `╔══════════════════════╗`,
      `   📅 <b>${t('promotion_day')} ${dayNumber}</b>`,
      `╚══════════════════════╝`,
      '',
      `📊 ${escapeHtml(stage.name)}`,
      `🎮 ${t('stage_matches_total')}: <b>${dayMatches.length}</b>`,
      '',
    ];

    lines.push(`🗺 <b>${t('stage_matches_menu')}:</b>`);
    dayMatches.forEach((m) => {
      const statusEmoji = {
        pending: '⏳',
        submitted: '📤',
        approved: '✅',
        rejected: '❌',
      }[m.resultStatus] || '•';
      lines.push(
        `   ${statusEmoji} ${t('stage_match_num')} ${m.dayMatchNumber || m.matchNumber}: <b>${m.map || 'Erangel'}</b>`
      );
    });
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (!dayApproved) {
      lines.push(`⏳ <b>${t('stage_not_all_approved')}</b>`);
      lines.push('');
      lines.push(`Iltimos, ${dayMatches.length} matchni tasdiqlang.`);
    } else if (!dayStandings.length) {
      lines.push(`📭 ${t('no_results_yet')}`);
    } else {
      lines.push(
        `🏅 <b>${t('promotion_rating_today', { n: dayNumber })} (${dayMatches.length} match):</b>`
      );
      lines.push('');

      const showN = Math.min(5, dayStandings.length);
      for (let i = 0; i < showN; i++) {
        const s = dayStandings[i];
        const team = await teamService.getTeam(s.teamId);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        lines.push(
          `${medal} <b>${escapeHtml(team?.name || s.teamName || s.teamId)}</b>`
        );
        lines.push(
          `   💯 ${s.totalPoints} | 💥 ${s.kills} | 🏆 ${s.wins} | 🎮 ${s.matches}`
        );
      }

      if (dayStandings.length > showN) {
        lines.push('');
        lines.push(`<i>... +${dayStandings.length - showN}</i>`);
      }
    }

    const rows = [];

    if (dayApproved && dayStandings.length && dayPromotions.length === 0) {
      rows.push([
        Markup.button.callback(
          t('promotion_create'),
          'prm:picktop:' + stageId + ':' + dayNumber
        ),
      ]);
    } else if (dayPromotions.length > 0) {
      const active = dayPromotions.filter(
        (p) => p.status !== PROMOTION_STATUS.CANCELLED
      );
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`✅ ${t('promotion_btn')}: <b>${active.length}</b>`);

      for (const p of dayPromotions) {
        const emoji = promotionService.statusEmoji(p.status);
        rows.push([
          Markup.button.callback(
            `${emoji} ${p.place}. ${p.teamName}`,
            CALLBACK.PROMOTION_VIEW + p.id
          ),
        ]);
      }
    }

    rows.push([
      Markup.button.callback(t('btn_back'), CALLBACK.PROMOTION_LIST + stageId),
    ]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  });

  // ============================================================
  // 3. TOP N TANLASH (3/4/5)
  // ============================================================
  bot.action(/^prm:picktop:([^:]+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const stageId = ctx.match[1];
    const dayNumber = parseInt(ctx.match[2], 10);

    const stage = await stageService.getStage(stageId);
    if (!stage) return;

    const standings = await stageMatchService.getDayOverallStandings(stageId, dayNumber);

    const lines = [
      `╔══════════════════════╗`,
      `   🏅 <b>${t('promotion_day')} ${dayNumber} — ${t('promotion_top')} N</b>`,
      `╚══════════════════════╝`,
      '',
      `📊 ${escapeHtml(stage.name)}`,
      '',
      `🎯 ${t('stage_teams_total')}: <b>${standings.length}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `👇 ${t('promotion_pick_top')}`,
      '',
      `<i>${t('promotion_create_top', { n: 3 })}</i>`,
    ];

    const kb = qualifiersCountKeyboard(stageId, dayNumber);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // 4. PROMOTION YARATISH (topN bilan)
  // ============================================================
  bot.action(/^prm:createtop:([^:]+):(\d+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const stageId = ctx.match[1];
    const dayNumber = parseInt(ctx.match[2], 10);
    const topN = parseInt(ctx.match[3], 10);

    const stage = await stageService.getStage(stageId);
    if (!stage) return;

    try {
      const res = await promotionService.createPromotionsForDay(
        stageId,
        dayNumber,
        topN,
        ctx.from.id
      );

      const lines = [
        `╔══════════════════════╗`,
        `   ✅ <b>${t('promotion_created')}</b>`,
        `╚══════════════════════╝`,
        '',
        `📊 ${escapeHtml(stage.name)}`,
        `🏅 ${t('promotion_top')} <b>${res.topN}</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `🎯 ${t('promotion_total')}: <b>${res.total}</b> ${t('promotion_teams')}`,
        '',
      ];

      for (const p of res.promotions) {
        const medal =
          p.place === 1
            ? '🥇'
            : p.place === 2
            ? '🥈'
            : p.place === 3
            ? '🥉'
            : `${p.place}.`;
        lines.push(
          `${medal} <b>${escapeHtml(p.teamName)}</b> [${escapeHtml(p.teamTag)}]`
        );
        lines.push(`   💯 ${p.points} | 💥 ${p.kills} | 🏆 ${p.wins}`);
      }

      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`👇 ${t('promotion_send_invite')}:`);

      const rows = [
        [
          Markup.button.callback(
            t('promotion_send_invite'),
            'prm:send_day:' + stageId + ':' + dayNumber
          ),
        ],
        [
          Markup.button.callback(
            t('btn_back'),
            'prm:day:' + stageId + ':' + dayNumber
          ),
        ],
      ];

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`, { parse_mode: 'HTML' });
    }
  });

  // ============================================================
  // 5. PROMOTION KO'RINISHI
  // ============================================================
  bot.action(/^prm:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const promo = await promotionService.getPromotion(ctx.match[1]);
    if (!promo) return ctx.reply(t('promotion_not_found'));

    const fromStage = await stageService.getStage(promo.fromStageId);
    const toStage = await stageService.getStage(promo.toStageId);
    const tournament = await tournamentService.getTournament(promo.tournamentId);

    const statusEmoji = promotionService.statusEmoji(promo.status);
    const statusName = t('promotion_status_' + promo.status) || promo.status;

    const lines = [
      `╔══════════════════════╗`,
      `   ${statusEmoji} <b>${t('promotion_title')}</b>`,
      `╚══════════════════════╝`,
      '',
      `🏆 ${escapeHtml(tournament?.title || '-')}`,
      '',
      `👥 <b>${escapeHtml(promo.teamName)}</b> [${escapeHtml(promo.teamTag)}]`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📅 ${t('promotion_day')}: <b>${promo.fromDayNumber || '-'}</b>`,
      `🏅 ${t('promotion_place')}: <b>${promo.place}</b>`,
      `💯 ${t('promotion_points')}: <b>${promo.points}</b>`,
      `💥 ${t('promotion_kills')}: <b>${promo.kills}</b>`,
      `🏆 ${t('promotion_wins')}: <b>${promo.wins || 0}</b>`,
      `🎮 ${t('promotion_matches')}: <b>${promo.matches || 0}</b>`,
      '',
      `⬅️ ${escapeHtml(fromStage?.name || '-')}`,
      `➡️ ${escapeHtml(toStage?.name || '-')}`,
      '',
      `📊 ${t('promotion_status_label')}: <b>${statusName}</b>`,
    ];

    const rows = [];

    if (promo.status === PROMOTION_STATUS.QUALIFIED) {
      rows.push([
        Markup.button.callback(
          t('promotion_promote_one'),
          CALLBACK.PROMOTION_APPROVE + promo.id
        ),
      ]);
    }

    if (!promo.invitationSent) {
      rows.push([
        Markup.button.callback(
          t('promotion_send_invite'),
          CALLBACK.PROMOTION_SEND_INVITE + promo.id
        ),
      ]);
    } else {
      rows.push([
        Markup.button.callback(
          t('promotion_resend_invite'),
          CALLBACK.PROMOTION_RESEND_INVITE + promo.id
        ),
      ]);
    }

    if (
      promo.status !== PROMOTION_STATUS.CANCELLED &&
      promo.status !== PROMOTION_STATUS.PROMOTED
    ) {
      rows.push([
        Markup.button.callback(
          t('promotion_cancel'),
          CALLBACK.PROMOTION_CANCEL + promo.id
        ),
      ]);
    }

    rows.push([
      Markup.button.callback(
        t('btn_back'),
        CALLBACK.PROMOTION_LIST + promo.fromStageId
      ),
    ]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  });

  // ============================================================
  // 6. PROMOTE / CANCEL
  // ============================================================
  bot.action(/^prm:ap:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    try {
      const promo = await promotionService.promoteTeam(ctx.match[1], ctx.from.id);
      const toStage = await stageService.getStage(promo.toStageId);

      await ctx.reply(
        `✅ <b>${escapeHtml(promo.teamName)}</b> ${escapeHtml(toStage?.name || '')} ${t('promotion_promoted')}!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('promotion_send_invite'),
                  callback_data: CALLBACK.PROMOTION_SEND_INVITE + promo.id,
                },
              ],
              [
                {
                  text: t('btn_back'),
                  callback_data: CALLBACK.PROMOTION_VIEW + promo.id,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  bot.action(/^prm:ca:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const stageId = ctx.match[1];
    const stage = await stageService.getStage(stageId);
    if (!stage) return;

    try {
      const res = await promotionService.promoteAllForStage(stageId, ctx.from.id);
      const nextStage = await stageService.getStage(stage.nextStageId);

      await ctx.reply(
        `✅ <b>${t('promotion_all_promoted')}</b>\n\n` +
          `📊 ${escapeHtml(stage.name)} → ${escapeHtml(nextStage?.name || '')}\n` +
          `✅ ${t('success')}: <b>${res.success}</b>\n` +
          `❌ ${t('error_prefix')}: <b>${res.failed}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('promotion_send_all_invites'),
                  callback_data: 'prm:send_all:' + stageId,
                },
              ],
              [
                {
                  text: t('btn_back'),
                  callback_data: CALLBACK.PROMOTION_LIST + stageId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  bot.action(/^prm:cn:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const promo = await promotionService.getPromotion(ctx.match[1]);
    if (!promo) return;

    try {
      await promotionService.cancelPromotion(promo.id, t('promotion_cancelled'), ctx.from.id);

      await ctx.reply(
        `🗑 <b>${t('promotion_cancelled')}</b>\n\n👥 ${escapeHtml(promo.teamName)}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('btn_back'),
                  callback_data: CALLBACK.PROMOTION_LIST + promo.fromStageId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 7. TAKLIFNOMA (kun uchun)
  // ============================================================
  bot.action(/^prm:send_day:([^:]+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const stageId = ctx.match[1];
    const dayNumber = parseInt(ctx.match[2], 10);

    const promotions = await promotionService.getDayPromotions(stageId, dayNumber);

    if (!promotions.length) {
      return ctx.reply(t('promotion_no_promotions'));
    }

    await sendInvitationsBatch(ctx, bot, promotions, stageId);
  });

  // ============================================================
  // 8. BARCHA KUNLAR
  // ============================================================
  bot.action(/^prm:send_all:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!canManagePromotion(ctx.state.role)) return;

    const stageId = ctx.match[1];
    const promotions = await promotionService.getStagePromotions(stageId);

    if (!promotions.length) return ctx.reply(t('promotion_no_promotions'));

    const pending = promotions.filter(
      (p) =>
        p.status === PROMOTION_STATUS.PROMOTED ||
        p.status === PROMOTION_STATUS.QUALIFIED
    );

    if (!pending.length) return ctx.reply(t('promotion_no_promotions'));

    await sendInvitationsBatch(ctx, bot, pending, stageId);
  });

  // ============================================================
  // YORDAMCHI: BATCH YUBORISH
  // ============================================================
  async function sendInvitationsBatch(ctx, bot, promotions, stageId) {
    const t = ctx.t;

    const loadingMsg = await ctx.reply(
      `⏳ ${promotions.length} ${t('inv_title')}...`
    );

    let sent = 0;
    let failed = 0;

    for (const promo of promotions) {
      try {
        const fromStage = await stageService.getStage(promo.fromStageId);
        const toStage = await stageService.getStage(promo.toStageId);

        const invitation = await invitationService.createInvitation({
          tournamentId: promo.tournamentId,
          fromStageId: promo.fromStageId,
          toStageId: promo.toStageId,
          teamId: promo.teamId,
          captainId: promo.captainId,
          matchId: null,
          roomId: null,
          roomPassword: null,
          createdBy: ctx.from.id,
        });

        try {
          const tournament = await tournamentService.getTournament(promo.tournamentId);
          const team = await teamService.getTeam(promo.teamId);

          const imageGenerator = require('../utils/invitationImageGenerator');
          const imgPath = await imageGenerator.generateInvitationImage({
            tournament,
            team,
            fromStage,
            toStage,
            match: null,
            invitation,
            stageType: toStage?.stageType,
            rank: promo.place,
          });

          const photo = await bot.telegram.sendPhoto(promo.captainId, {
            source: imgPath,
          });
          const imageFileId = photo.photo[photo.photo.length - 1].file_id;

          await invitationService.updateInvitation(invitation.id, {
            imageFileId,
          });
        } catch (e) {}

        await invitationService.sendInvitationToCaptain(bot, invitation.id);
        await invitationService.sendInvitationToMembers(bot, invitation.id);

        sent++;
      } catch (e) {
        failed++;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        null,
        `✅ <b>${t('promotion_invitation_sent')}</b>\n\n` +
          `📤 ${t('bc_stats_sent')}: <b>${sent}</b>\n` +
          `❌ ${t('bc_stats_failed')}: <b>${failed}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t('btn_back'),
                  callback_data: CALLBACK.PROMOTION_LIST + stageId,
                },
              ],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply(`✅ ${sent} / ❌ ${failed}`, { parse_mode: 'HTML' });
    }
  }

  // ============================================================
  // 9. MENING TAKLIFNOMALARIM
  // ============================================================
  bot.action(CALLBACK.INV_MY, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const invitations = await invitationService.getCaptainInvitations(ctx.from.id);

    if (!invitations.length) {
      return safeEdit(ctx, `📭 ${t('inv_no_invitations')}`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
          ],
        },
      });
    }

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('inv_my')} (${invitations.length})`,
      `╚══════════════════════╝`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    const rows = [];

    for (const inv of invitations.slice(0, 10)) {
      const statusEmoji = {
        created: '📝',
        sent: '📨',
        accepted: '✅',
        declined: '❌',
        expired: '⌛',
      };
      const emoji = statusEmoji[inv.status] || '•';

      const toStage = await stageService.getStage(inv.toStageId);
      const tournament = await tournamentService.getTournament(inv.tournamentId);

      lines.push(
        `${emoji} <b>${escapeHtml(tournament?.title || '-')}</b>\n` +
          `   ➡️ ${escapeHtml(toStage?.name || '-')}\n` +
          `   🎫 <code>${inv.invitationCode}</code>`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `${emoji} ${tournament?.title?.slice(0, 20) || t('tournaments_title')}`,
          CALLBACK.INV_VIEW + inv.id
        ),
      ]);
    }

    rows.push([Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)]);

    try {
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } catch (e) {
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  });
};