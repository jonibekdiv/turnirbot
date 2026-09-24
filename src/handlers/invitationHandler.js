// ============================================================
// INVITATION HANDLER — Captain javobi (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const invitationService = require('../services/invitationService');
const promotionService = require('../services/promotionService');
const stageService = require('../services/stageService');
const stageMatchService = require('../services/stageMatchService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const auditService = require('../services/auditService');
const {
  CALLBACK,
  STATES,
  INVITATION_STATUS,
} = require('../constants');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
  displayName,
} = require('../utils/telegramUtils');
const { cleanText } = require('../utils/validation');

module.exports = (bot) => {
  // ============================================================
  // 1. TAKLIFNOMANI KO'RISH
  // ============================================================
  bot.action(/^inv:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const inv = await invitationService.getInvitation(ctx.match[1]);
    if (!inv) return ctx.reply(t('promo_not_found'));

    const team = await teamService.getTeam(inv.teamId);
    if (!team) return ctx.reply(t('error_not_found'));

    const isCaptain = Number(team.captainId) === Number(ctx.from.id);
    const isMember = team.members.includes(ctx.from.id);

    if (!isCaptain && !isMember) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const fromStage = await stageService.getStage(inv.fromStageId);
    const toStage = await stageService.getStage(inv.toStageId);
    const tournament = await tournamentService.getTournament(inv.tournamentId);
    const match = inv.matchId ? await stageMatchService.getMatch(inv.matchId) : null;

    const statusEmoji = {
      created: '📝',
      sent: '📨',
      accepted: '✅',
      declined: '❌',
      expired: '⌛',
    };
    const emoji = statusEmoji[inv.status] || '•';

    const lines = [
      `╔══════════════════════╗`,
      `   ${emoji} <b>${t('inv_title')}</b>`,
      `╚══════════════════════╝`,
      '',
      `🏆 <b>${escapeHtml(tournament?.title || '-')}</b>`,
      `👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `⬅️ ${escapeHtml(fromStage?.name || '-')}`,
      `➡️ <b>${escapeHtml(toStage?.name || '-')}</b>`,
      '',
      `📅 ${t('date')}: <b>${toStage?.date || '-'}</b>`,
      `⏰ ${t('time')}: <b>${toStage?.startTime || '-'}</b>`,
    ];

    if (match) {
      lines.push(
        `🎮 ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.matchNumber}`
      );
    }

    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (inv.roomId) {
      lines.push(`🆔 ${t('tour_room_info')}: <code>${escapeHtml(inv.roomId)}</code>`);
    }
    if (inv.roomPassword) {
      lines.push(`🔒 ${t('password')}: <code>${escapeHtml(inv.roomPassword)}</code>`);
    }

    lines.push(`🎫 ${t('inv_code_label')}: <code>${inv.invitationCode}</code>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    if (inv.accepted) {
      lines.push(`✅ <b>${t('inv_accepted')}</b>`);
      lines.push('');
      lines.push(`📅 ${new Date(inv.acceptedAt).toLocaleString('uz-UZ')}`);
    } else if (inv.declined) {
      lines.push(`❌ <b>${t('inv_declined')}</b>`);
      if (inv.declinedReason) {
        lines.push(`📌 ${escapeHtml(inv.declinedReason)}`);
      }
    } else if (isCaptain) {
      lines.push(`👇 ${t('support_choose_type')}`);
    } else {
      lines.push(`ℹ️ <i>${t('payment_status_pending')}</i>`);
    }

    const rows = [];

    if (isCaptain && !inv.accepted && !inv.declined) {
      rows.push([
        Markup.button.callback(t('inv_accept'), CALLBACK.INV_ACCEPT + inv.id),
      ]);
      rows.push([
        Markup.button.callback(t('inv_decline'), CALLBACK.INV_DECLINE + inv.id),
      ]);
    }

    rows.push([
      Markup.button.callback(t('inv_contact_host'), CALLBACK.INV_CONTACT_HOST + inv.id),
    ]);

    rows.push([
      Markup.button.callback(t('btn_back'), CALLBACK.INV_MY),
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
  // 2. CAPTAIN TASDIQLASH
  // ============================================================
  bot.action(/^inv:a:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    try {
      const inv = await invitationService.acceptInvitation(ctx.match[1], ctx.from.id);

      const toStage = await stageService.getStage(inv.toStageId);
      const tournament = await tournamentService.getTournament(inv.tournamentId);
      const team = await teamService.getTeam(inv.teamId);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   ✅ <b>${t('inv_accepted')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 ${escapeHtml(tournament?.title || '-')}\n` +
          `👥 ${escapeHtml(team?.name || '-')}\n` +
          `➡️ ${escapeHtml(toStage?.name || '-')}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📅 ${toStage?.date || '-'} | ⏰ ${toStage?.startTime || '-'}\n\n` +
          (inv.roomId
            ? `🆔 ${t('tour_room_info')}: <code>${escapeHtml(inv.roomId)}</code>\n` +
              (inv.roomPassword
                ? `🔒 ${t('password')}: <code>${escapeHtml(inv.roomPassword)}</code>\n`
                : '')
            : `⚠️ <i>${t('promotion_room_pending')}</i>\n`) +
          `\n📌 <i>${t('inv_accepted_desc')}</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback(
                  t('tour_open'),
                  CALLBACK.TOUR_OPEN + inv.tournamentId
                ),
              ],
            ],
          },
        }
      );

      const tour = await tournamentService.getTournament(inv.tournamentId);
      if (tour?.organizerId) {
        try {
          await bot.telegram.sendMessage(
            tour.organizerId,
            `✅ <b>${t('inv_sent_to_captain')}</b>\n\n` +
              `👥 ${escapeHtml(team?.name || '-')}\n` +
              `📊 ${escapeHtml(toStage?.name || '-')}`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 3. CAPTAIN RAD ETISH
  // ============================================================
  bot.action(/^inv:d:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const inv = await invitationService.getInvitation(ctx.match[1]);
    if (!inv) return;

    ctx.session = {
      state: STATES.STAGE_DECLINE_REASON,
      data: { invitationId: inv.id },
    };

    await ctx.reply(
      `❌ <b>${t('inv_decline_reason_prompt')}</b>\n\n` +
        `<i>${t('inv_decline_example')}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(t('btn_back'), CALLBACK.INV_VIEW + inv.id),
            ],
          ],
        },
      }
    );
  });

  // FSM — rad etish sababi
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.STAGE_DECLINE_REASON) return next();
    const t = ctx.t;

    const reason = cleanText(ctx.message.text, 200);
    if (reason.length < 3) {
      return ctx.reply(`❗ ${t('team_name_short')}`);
    }

    const invId = ctx.session.data.invitationId;

    try {
      const inv = await invitationService.declineInvitation(invId, ctx.from.id, reason);

      ctx.session = { state: null, data: {} };

      const team = await teamService.getTeam(inv.teamId);
      const toStage = await stageService.getStage(inv.toStageId);

      await ctx.reply(
        `✅ <b>${t('inv_declined')}</b>\n\n` +
          `👥 ${escapeHtml(team?.name || '-')}\n` +
          `📊 ${escapeHtml(toStage?.name || '-')}\n\n` +
          `📌 ${escapeHtml(reason)}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
            ],
          },
        }
      );

      const tour = await tournamentService.getTournament(inv.tournamentId);
      if (tour?.organizerId) {
        try {
          await bot.telegram.sendMessage(
            tour.organizerId,
            `🚫 <b>${t('inv_captain_declined')}</b>\n\n` +
              `👥 ${escapeHtml(team?.name || '-')}\n` +
              `📊 ${escapeHtml(toStage?.name || '-')}\n` +
              `📌 ${escapeHtml(reason)}\n\n` +
              `<i>${t('inv_decline_notify')}</i>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: t('promotion_menu'),
                      callback_data: CALLBACK.PROMOTION_LIST + inv.fromStageId,
                    },
                  ],
                ],
              },
            }
          );
        } catch (e) {}
      }
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 4. KEYINGI ETAP HAQIDA
  // ============================================================
  bot.action(/^inv:i:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const inv = await invitationService.getInvitation(ctx.match[1]);
    if (!inv) return;

    const toStage = await stageService.getStage(inv.toStageId);
    const tournament = await tournamentService.getTournament(inv.tournamentId);
    const match = inv.matchId ? await stageMatchService.getMatch(inv.matchId) : null;

    const lines = [
      `╔══════════════════════╗`,
      `   ℹ️ <b>${t('inv_next_stage')}</b>`,
      `╚══════════════════════╝`,
      '',
      `🏆 <b>${escapeHtml(tournament?.title || '-')}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `📊 <b>${escapeHtml(toStage?.name || '-')}</b>`,
      `📅 ${t('date')}: <b>${toStage?.date || '-'}</b>`,
      `⏰ ${t('time')}: <b>${toStage?.startTime || '-'}</b>`,
      `📆 ${t('stage_days_label')}: <b>${toStage?.numberOfDays || 1}</b>`,
    ];

    if (match) {
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`🎮 <b>${t('inv_your_match')}:</b>`);
      lines.push(
        `   ${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.matchNumber}`
      );
      lines.push(`   📅 ${match.date} | ⏰ ${match.startTime}`);
    }

    if (inv.roomId) {
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`🆔 ${t('tour_room_info')}: <code>${escapeHtml(inv.roomId)}</code>`);
      if (inv.roomPassword) {
        lines.push(`🔒 ${t('password')}: <code>${escapeHtml(inv.roomPassword)}</code>`);
      }
    }

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            Markup.button.callback(t('btn_back'), CALLBACK.INV_VIEW + inv.id),
          ],
        ],
      },
    });
  });

  // ============================================================
  // 5. HOSTGA YOZISH
  // ============================================================
  bot.action(/^inv:h:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const inv = await invitationService.getInvitation(ctx.match[1]);
    if (!inv) return;

    const match = inv.matchId ? await stageMatchService.getMatch(inv.matchId) : null;

    if (!match?.hostId) {
      return ctx.reply(`⚠️ <b>${t('stage_match_no_host')}</b>`, {
        parse_mode: 'HTML',
      });
    }

    const team = await teamService.getTeam(inv.teamId);
    const toStage = await stageService.getStage(inv.toStageId);
    const tournament = await tournamentService.getTournament(inv.tournamentId);

    const message =
      `📩 <b>${t('support_menu')}</b>\n\n` +
      `🏆 ${escapeHtml(tournament?.title || '-')}\n` +
      `📊 ${escapeHtml(toStage?.name || '-')}\n` +
      `👥 ${escapeHtml(team?.name || '-')}\n\n` +
      `👤 ${t('team_captain')}: ${escapeHtml(displayName(ctx.from))}\n` +
      `🆔 ID: <code>${ctx.from.id}</code>\n` +
      `🎫 ${t('inv_code_label')}: <code>${inv.invitationCode}</code>`;

    try {
      await bot.telegram.sendMessage(match.hostId, message, {
        parse_mode: 'HTML',
      });

      await ctx.reply(`✅ <b>${t('inv_sent')}</b>`, {
        parse_mode: 'HTML',
      });
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });
};