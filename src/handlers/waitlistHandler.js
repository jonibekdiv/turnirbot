// ============================================================
// WAITLIST HANDLER — Kutish ro'yxati (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const waitlistService = require('../services/waitlistService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, ROLES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 1. KUTISHGA QO'SHILISH
  // ============================================================
  bot.action(/^wl:join:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply(t('error_team_not_member'));

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(t('error_not_found'));

    if (team.captainId !== ctx.from.id) return ctx.reply(t('error_not_captain'));

    if (tour.registeredTeams.length < tour.maxTeams) {
      return ctx.reply(
        `ℹ️ <b>${t('tour_register')}</b>\n\n${t('error_already_registered')}`,
        { parse_mode: 'HTML' }
      );
    }

    if (tour.registeredTeams.includes(team.id)) {
      return ctx.reply(t('error_already_registered'));
    }

    const res = await waitlistService.addToWaitlist(tour.id, team.id, ctx.from.id);

    if (!res.ok) {
      if (res.reason === 'already') {
        return ctx.reply(
          `ℹ️ <b>${t('wl_already')}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: t('wl_my'), callback_data: CALLBACK.WAITLIST_OWN }],
              ],
            },
          }
        );
      }
      if (res.reason === 'full') {
        return ctx.reply(`❌ <b>${t('wl_full')}</b>`, { parse_mode: 'HTML' });
      }
      return ctx.reply(t('error_generic'));
    }

    await ctx.reply(
      `╔══════════════════════╗\n` +
        `   ✅ <b>${t('wl_joined')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(tour.title)}</b>\n` +
        `👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <b>${t('wl_position_label')}:</b> <b>#${res.position}</b>\n\n` +
        `<i>${t('sub_wait_room')}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: t('wl_my'), callback_data: CALLBACK.WAITLIST_OWN }],
            [{ text: t('wl_leave'), callback_data: CALLBACK.WAITLIST_LEAVE + tour.id }],
          ],
        },
      }
    );
  });

  // ============================================================
  // 2. NAVBATDAN CHIQISH
  // ============================================================
  bot.action(/^wl:leave:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply(t('error_team_not_member'));

    const res = await waitlistService.removeFromWaitlist(tId, user.teamId);

    if (!res.ok) return ctx.reply(`❗ ${t('error_not_found')}`);

    await safeEdit(ctx, `✅ <b>${t('wl_left_ok')}</b>`, {
      reply_markup: {
        inline_keyboard: [[{ text: t('menu_main'), callback_data: CALLBACK.MENU_MAIN }]],
      },
    });
  });

  // ============================================================
  // 3. MENING NAVBATLARIM
  // ============================================================
  bot.action(CALLBACK.WAITLIST_OWN, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const list = await waitlistService.getUserWaitlist(ctx.from.id);

    if (!list.length) {
      return safeEdit(ctx, `📭 <b>${t('wl_my_empty')}</b>`, {
        reply_markup: {
          inline_keyboard: [[{ text: t('menu_main'), callback_data: CALLBACK.MENU_MAIN }]],
        },
      });
    }

    const lines = [`📋 <b>${t('wl_my_title')} (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const item of list) {
      const tour = await tournamentService.getTournament(item.tournamentId);
      lines.push(
        `<b>${escapeHtml(tour?.title || item.tournamentId)}</b>\n` +
          `   📌 ${t('wl_position_label')}: <b>#${item.position}</b>\n` +
          `   📅 ${new Date(item.joinedAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: t('menu_main'), callback_data: CALLBACK.MENU_MAIN }]],
      },
    });
  });

  // ============================================================
  // 4. KUTISH RO'YXATINI KO'RISH (admin/organizer)
  // ============================================================
  bot.action(/^wl:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(t('tour_not_found'));

    const list = await waitlistService.getWaitlist(tId);

    if (!list.length) {
      return ctx.reply(`📭 <b>${t('wl_list_empty')}</b>`, { parse_mode: 'HTML' });
    }

    const lines = [`📋 <b>${t('wl_view_title')} (${list.length})</b>`, ''];
    lines.push(`🏆 ${escapeHtml(tour.title)}`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const entry of list.slice(0, 20)) {
      const team = await teamService.getTeam(entry.teamId);
      lines.push(
        `<b>#${entry.position}</b> — ${escapeHtml(team?.name || entry.teamId)} [${escapeHtml(team?.tag || '?')}]`
      );
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // ============================================================
  // 5. KEYINGI KOMANDANI TAKLIF QILISH
  // ============================================================
  bot.action(/^wl:accept:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const teamId = ctx.match[2];

    await waitlistService.removeFromWaitlist(tId, teamId);

    const res = await tournamentService.registerTeam(tId, teamId);
    if (!res.ok) return ctx.reply(`❗ ${res.reason}`);

    await safeEdit(ctx, `✅ <b>${t('wl_accepted_ok')}</b>`, { parse_mode: 'HTML' });
  });

  bot.action(/^wl:decline:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const tId = ctx.match[1];
    const teamId = ctx.match[2];

    await waitlistService.removeFromWaitlist(tId, teamId);
    await safeEdit(ctx, `❌ <b>${t('wl_declined_ok')}</b>`, { parse_mode: 'HTML' });
  });

  // ============================================================
  // 6. NO ACTION
  // ============================================================
  bot.action(CALLBACK.NO_ACTION, async (ctx) => {
    await safeAnswer(ctx);
  });
};