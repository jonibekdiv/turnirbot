// ============================================================
// WAITLIST HANDLER — Kutish ro'yxati (#3)
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
  // KUTISH RO'YXATIGA QO'SHILISH
  // ============================================================
  bot.action(/^wl:join:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply(ctx.t('error_team_not_member'));
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(ctx.t('error_not_found'));

    if (team.captainId !== ctx.from.id) {
      return ctx.reply(ctx.t('error_not_captain'));
    }

    // Turnirda to'lgan bo'lishi kerak
    if (t.registeredTeams.length < t.maxTeams) {
      return ctx.reply(
        `ℹ️ <b>Turnirda hali joy bor!</b>\n\n` +
          `Iltimos, avval ro'yxatdan o'ting.`,
        { parse_mode: 'HTML' }
      );
    }

    // Allaqachon ro'yxatdan o'tgan?
    if (t.registeredTeams.includes(team.id)) {
      return ctx.reply(ctx.t('error_already_registered'));
    }

    const res = await waitlistService.addToWaitlist(t.id, team.id, ctx.from.id);

    if (!res.ok) {
      if (res.reason === 'already') {
        return ctx.reply(
          `ℹ️ <b>Komandangiz allaqachon navbatda</b>\n\n` +
            `Navbatdagi o'rningizni quyidagi tugmadan ko'ring.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '👁 Mening navbatim',
                    callback_data: CALLBACK.WAITLIST_OWN,
                  },
                ],
              ],
            },
          }
        );
      }
      if (res.reason === 'full') {
        return ctx.reply(
          `❌ <b>Kutish ro'yxati to'lgan</b>\n\n` +
            `Iltimos, keyingi turnirni kuting.`,
          { parse_mode: 'HTML' }
        );
      }
      return ctx.reply(ctx.t('error_generic'));
    }

    await ctx.reply(
      `╔══════════════════════╗\n` +
        `   ✅ <b>NAVBATDA</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(t.title)}</b>\n` +
        `👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <b>Navbatdagi o'rin:</b> <b>#${res.position}</b>\n\n` +
        `<i>Joy bo'shashi bilan sizga xabar yuboriladi.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '👁 Mening navbatim',
                callback_data: CALLBACK.WAITLIST_OWN,
              },
            ],
            [
              {
                text: "🚪 Navbatdan chiqish",
                callback_data: CALLBACK.WAITLIST_LEAVE + t.id,
              },
            ],
          ],
        },
      }
    );
  });

  // ============================================================
  // NAVBATDAN CHIQISH
  // ============================================================
  bot.action(/^wl:leave:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply(ctx.t('error_team_not_member'));

    const res = await waitlistService.removeFromWaitlist(tId, user.teamId);

    if (!res.ok) {
      return ctx.reply(`❗ Siz bu turnirda navbatda emassiz.`);
    }

    await safeEdit(
      ctx,
      `✅ <b>Navbatdan chiqdingiz</b>\n\n` +
        `<i>Xohlagan vaqtda qayta yozilishingiz mumkin.</i>`
    );
  });

  // ============================================================
  // MENING NAVBATLARIM
  // ============================================================
  bot.action(CALLBACK.WAITLIST_OWN, async (ctx) => {
    await safeAnswer(ctx);

    const list = await waitlistService.getUserWaitlist(ctx.from.id);

    if (!list.length) {
      return safeEdit(
        ctx,
        `📭 <b>Siz hech qaysi navbatda emassiz</b>`,
        {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
            ],
          },
        }
      );
    }

    const lines = [`📋 <b>Mening navbatlarim (${list.length})</b>`, ''];
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const item of list) {
      const t = await tournamentService.getTournament(item.tournamentId);
      lines.push(
        `<b>${escapeHtml(t?.title || item.tournamentId)}</b>\n` +
          `   📌 Navbat: <b>#${item.position}</b>\n` +
          `   📅 ${new Date(item.joinedAt).toLocaleString('uz-UZ')}`
      );
      lines.push('');
    }

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
        ],
      },
    });
  });

  // ============================================================
  // KUTISH RO'YXATINI KO'RISH (admin / organizer)
  // ============================================================
  bot.action(/^wl:view:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    const list = await waitlistService.getWaitlist(tId);

    if (!list.length) {
      return ctx.reply(`📭 <b>Kutish ro'yxati bo'sh</b>`, {
        parse_mode: 'HTML',
      });
    }

    const lines = [`📋 <b>Kutish ro'yxati (${list.length})</b>`, ''];
    lines.push(`🏆 ${escapeHtml(t.title)}`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    for (const entry of list.slice(0, 20)) {
      const team = await teamService.getTeam(entry.teamId);
      lines.push(
        `<b>#${entry.position}</b> — ${escapeHtml(
          team?.name || entry.teamId
        )} [${escapeHtml(team?.tag || '?')}]`
      );
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // ============================================================
  // NAVBATDAGI KEYINGI KOMANDANI TAKLIF QILISH
  // ============================================================
  bot.action(/^wl:accept:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const teamId = ctx.match[2];

    // Kutishdan olib tashlash
    await waitlistService.removeFromWaitlist(tId, teamId);

    // Ro'yxatga qo'shish
    const res = await tournamentService.registerTeam(tId, teamId);
    if (!res.ok) {
      return ctx.reply(`❗ Xatolik: ${res.reason}`);
    }

    await safeEdit(
      ctx,
      `✅ <b>Komanda turnirga qo'shildi!</b>`
    );
  });

  bot.action(/^wl:decline:(.+):(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const teamId = ctx.match[2];

    await waitlistService.removeFromWaitlist(tId, teamId);

    await safeEdit(
      ctx,
      `❌ <b>Taklif rad etildi.</b>`
    );
  });

  // ============================================================
  // NO ACTION (bo'sh tugma)
  // ============================================================
  bot.action(CALLBACK.NO_ACTION, async (ctx) => {
    await safeAnswer(ctx);
  });
};