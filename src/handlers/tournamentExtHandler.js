// ============================================================
// TOURNAMENT EXT HANDLER — Tarix, Kalendar, Shablonlar, va boshqalar
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const channelService = require('../services/channelService');
const templateService = require('../services/templateService');
const reservationService = require('../services/reservationService');
const matchService = require('../services/matchService');
const pointsService = require('../services/pointsService');
const { CALLBACK, ROLES, TOUR_STATUS, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');
const config = require('../config');

// ============================================================
// YORDAMCHI: ORQAGA TUGMALARI
// ============================================================
function backToAdmin(ctx) {
  const t = ctx.t;
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

function backToTournament(ctx, id) {
  const t = ctx.t;
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('btn_back_tournament'), CALLBACK.TOUR_OPEN + id)],
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. TURNIRLAR TARIXI
  // ============================================================
  bot.action(CALLBACK.TOUR_HISTORY, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const all = await tournamentService.getAllTournaments();
      const now = new Date();

      // Tugagan yoki yakunlangan turnirlar
      const history = all
        .filter((tour) => {
          const d = new Date(`${tour.date}T${tour.startTime}:00+05:00`);
          return d < now || tour.status === TOUR_STATUS.FINISHED;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 15);

      if (!history.length) {
        return safeEdit(
          ctx,
          `📭 <b>${t('tour_history_btn')}</b>\n\n` +
            `<i>${t('tour_empty')}</i>`,
          backToAdmin(ctx)
        );
      }

      const lines = [
        `📚 <b>${t('tour_history_btn')} (${history.length})</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      history.forEach((tour, i) => {
        const typeEmoji = tour.type === 'paid' ? '💳' : '🆓';
        lines.push(
          `<b>${i + 1}. ${escapeHtml(tour.title)}</b> ${typeEmoji}\n` +
            `   📅 ${tour.date}\n` +
            `   👥 ${tour.registeredTeams.length} ${t('admin_teams')}`
        );
        lines.push('');
      });

      const rows = history.slice(0, 10).map((tour) => [
        Markup.button.callback(
          `🏆 ${tour.title.slice(0, 28)}`,
          CALLBACK.TOUR_HISTORY_VIEW + tour.id
        ),
      ]);
      rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

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
    } catch (e) {
      console.error('tour:hist xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 2. TARIXDAN TURNIRNI KO'RISH
  // ============================================================
  bot.action(/^tour:hv:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      // Hisobot
      const matchData = await matchService.getTournamentMatches(tId);
      const teamsMap = {};
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teamsMap[tid] = team;
      }

      const standings = pointsService.calculateStandings(
        tour,
        matchData,
        teamsMap
      );

      const lines = [];
      lines.push(`🏆 <b>${escapeHtml(tour.title)}</b>`);
      lines.push(`📅 ${tour.date} | ⏰ ${tour.startTime}`);
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`👥 ${t('admin_teams')}: ${tour.registeredTeams.length}`);
      lines.push(`🎮 ${t('matches')}: ${matchData.matches.length}`);
      lines.push('');

      if (standings.length) {
        lines.push(`🥇 <b>TOP-3:</b>`);
        lines.push('');
        const medals = ['🥇', '🥈', '🥉'];
        for (let i = 0; i < Math.min(3, standings.length); i++) {
          const s = standings[i];
          lines.push(
            `${medals[i]} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`
          );
          lines.push(
            `   💯 ${s.totalPoints} | 🎯 ${s.totalKills} | 🥇 ${s.wins}`
          );
        }
      } else {
        lines.push(`<i>${t('no_results_yet')}</i>`);
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('tour_report'),
            CALLBACK.TOUR_REPORT + tId
          ),
        ],
        [Markup.button.callback(t('tour_history_btn'), CALLBACK.TOUR_HISTORY)],
        [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
      ]);

      await safeEdit(ctx, lines.join('\n'), { reply_markup: kb.reply_markup });
    } catch (e) {
      console.error('tour:hv xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 3. KALENDAR
  // ============================================================
  bot.action(CALLBACK.TOUR_CALENDAR, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const now = new Date();
      // Toshkent vaqti bo'yicha
      const tashkentDate = new Date(
        now.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })
      );

      await showCalendar(
        ctx,
        tashkentDate.getFullYear(),
        tashkentDate.getMonth() + 1,
        false
      );
    } catch (e) {
      console.error('tour:cal xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 4. KALENDAR — OY O'ZGARTIRISH
  // ============================================================
  bot.action(/^tour:calm:(\d+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    await showCalendar(
      ctx,
      parseInt(ctx.match[1], 10),
      parseInt(ctx.match[2], 10),
      true
    );
  });

  // ============================================================
  // 5. SHABLONLAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.TOUR_TEMPLATE, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
        return ctx.reply(t('error_access'));
      }

      const templates = await templateService.getUserTemplates(ctx.from.id);

      const lines = [
        `📋 <b>${t('tour_template_btn')} (${templates.length})</b>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      const rows = [];

      if (templates.length) {
        templates.slice(0, 10).forEach((tpl, i) => {
          lines.push(
            `<b>${i + 1}. ${escapeHtml(tpl.name)}</b>\n` +
              `   🏆 ${escapeHtml(tpl.data.title || '-')}\n` +
              `   🎮 ${escapeHtml(tpl.data.mode || '-')} | 👥 ${
                tpl.data.maxTeams || 18
              }\n` +
              `   📊 ${t('tour_template_uses')}: ${tpl.uses || 0}`
          );
          lines.push('');

          rows.push([
            Markup.button.callback(
              `📋 ${tpl.name.slice(0, 30)}`,
              CALLBACK.TOUR_TEMPLATE_USE + tpl.id
            ),
            Markup.button.callback(
              '🗑',
              'tour:tpl_del:' + tpl.id
            ),
          ]);
        });
      } else {
        lines.push(`<i>${t('tour_template_empty')}</i>`);
      }

      rows.push([
        Markup.button.callback(
          '➕ ' + t('tour_create_again'),
          CALLBACK.TOUR_CREATE
        ),
      ]);
      rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

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
    } catch (e) {
      console.error('tour:tpl xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 6. SHABLONDAN FOYDALANISH
  // ============================================================
  bot.action(/^tour:tplu:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tplId = ctx.match[1];
      const tpl = await templateService.getTemplate(tplId);
      if (!tpl) return ctx.reply(t('error_not_found'));

      // Shablonni sessiyaga yuklash
      ctx.session = {
        state: 'tour_create_date',
        data: {
          ...tpl.data,
          saveAsTemplate: false,
          fromTemplate: tplId,
        },
      };

      await ctx.reply(
        `📋 <b>${t('tour_template_use')}: ${escapeHtml(tpl.name)}</b>\n\n` +
          `🏆 ${t('name')}: <b>${escapeHtml(tpl.data.title || '-')}</b>\n` +
          `🎮 ${t('mode')}: <b>${escapeHtml(tpl.data.mode || '-')}</b>\n` +
          `👥 ${t('max_teams')}: <b>${tpl.data.maxTeams || 18}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📍 ${t('tour_create_date_prompt')}`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error('tour:tplu xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 7. SHABLONNI O'CHIRISH
  // ============================================================
  bot.action(/^tour:tpl_del:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      await templateService.deleteTemplate(ctx.match[1]);
      await ctx.reply(`✅ ${t('success')}`);

      // Shablonlar ro'yxatiga qaytamiz
      await ctx.telegram.sendMessage(ctx.chat.id, t('tour_template_btn'), {
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                t('tour_template_btn'),
                CALLBACK.TOUR_TEMPLATE
              ),
            ],
          ],
        },
      });
    } catch (e) {
      console.error('tour:tpl_del xatosi:', e.message);
    }
  });

  // ============================================================
  // 8. TURNIRNI YAKUNLASH (#1)
  // ============================================================
  bot.action(/^tf:finish:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      if (tour.status === TOUR_STATUS.FINISHED) {
        return ctx.reply(`ℹ️ ${t('tour_finished_title')}`);
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ ' + t('btn_confirm'),
            'tf:yes:' + tId
          ),
        ],
        [
          Markup.button.callback(
            t('btn_cancel'),
            'tf:no:' + tId
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `⚠️ <b>${t('tour_finish_confirm')}</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n` +
          `👥 ${tour.registeredTeams.length} ${t('admin_teams')}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📌 ${t('tour_finish_hint')}`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tf:finish xatosi:', e.message);
    }
  });

  bot.action(/^tf:yes:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      await tournamentService.setStatus(tId, TOUR_STATUS.FINISHED);
      await tournamentService.updateTournament(tId, {
        finishedAt: new Date().toISOString(),
        finishedBy: ctx.from.id,
      });

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📢 ' + t('tour_publish_channel'),
            'tf:pub:' + tId
          ),
        ],
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `✅ <b>${t('tour_finished_title')}!</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${t('tour_publish_channel')}?`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tf:yes xatosi:', e.message);
    }
  });

  bot.action(/^tf:no:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    await safeEdit(ctx, `❌ ${ctx.t('cancel')}`, backToTournament(ctx, tId));
  });

  // ============================================================
  // 9. KANALGA YAKUNIY HISOBOT
  // ============================================================
  bot.action(/^tf:pub:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const channelId = await channelService.getChannel();
      if (!channelId) {
        return ctx.reply(t('broadcast_no_channel'));
      }

      const matchData = await matchService.getTournamentMatches(tId);
      const teamsMap = {};
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teamsMap[tid] = team;
      }

      const standings = pointsService.calculateStandings(
        tour,
        matchData,
        teamsMap
      );

      if (!standings.length) {
        return ctx.reply(`❗ ${t('no_results_yet')}`);
      }

      // Natijalarni kanalga yuborish
      const result = await channelService.publishTournamentResults(
        bot,
        tour,
        standings
      );

      if (result.ok) {
        await ctx.reply(`✅ ${t('tour_published')}`);
      } else {
        await ctx.reply(
          `❌ ${t('tour_publish_fail')}: ${result.reason}`
        );
      }
    } catch (e) {
      console.error('tf:pub xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 10. BRON QILISH (#20)
  // ============================================================
  bot.action(/^rs:start:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const user = await userService.getUser(ctx.from.id);
      if (!user?.teamId) return ctx.reply(t('error_team_not_member'));

      const team = await teamService.getTeam(user.teamId);
      if (!team) return ctx.reply(t('error_not_found'));

      if (Number(team.captainId) !== Number(ctx.from.id)) {
        return ctx.reply(t('error_not_captain'));
      }

      if (tour.registeredTeams.includes(team.id)) {
        return ctx.reply(t('error_already_registered'));
      }

      if (tour.registeredTeams.length >= tour.maxTeams) {
        return ctx.reply(t('error_tournament_full'));
      }

      // Eski aktiv bron?
      const existing = await reservationService.getReservationByTeam(
        tId,
        team.id
      );

      if (existing) {
        const expires = new Date(existing.expiresAt);
        const secondsLeft = Math.max(
          0,
          Math.floor((expires - new Date()) / 1000)
        );
        return ctx.reply(
          `⏳ <b>${t('reserve_active')}!</b>\n\n` +
            `${t('reserve_time_left')}: <b>${Math.floor(
              secondsLeft / 60
            )}:${String(secondsLeft % 60).padStart(2, '0')}</b>`,
          { parse_mode: 'HTML' }
        );
      }

      const r = await reservationService.createReservation({
        tournamentId: tId,
        teamId: team.id,
        captainId: ctx.from.id,
      });

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ ' + t('reserve_confirm'),
            'rs:ok:' + r.id
          ),
        ],
        [
          Markup.button.callback(
            t('reserve_cancel'),
            'rs:release:' + r.id
          ),
        ],
      ]);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   ⏳ <b>${t('reserve_created')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n` +
          `👥 ${escapeHtml(team.name)} [${escapeHtml(team.tag)}]\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⏰ <b>${t('reserve_timeout')}</b>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('rs:start xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  bot.action(/^rs:ok:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const rId = ctx.match[1];
      const res = await reservationService.confirmReservation(rId);

      if (!res.ok) {
        return ctx.reply(
          `❌ ${t('reserve_expired')}: ${res.reason}`
        );
      }

      const r = res.reservation;
      const tour = await tournamentService.getTournament(r.tournamentId);
      const team = await teamService.getTeam(r.teamId);
      if (!tour || !team) return;

      // Ro'yxatga qo'shish
      const reg = await tournamentService.registerTeam(tour.id, team.id);
      if (!reg.ok) {
        return ctx.reply(`❗ ${reg.reason}`);
      }

      // Hostga xabar
      if (tour.hostId) {
        try {
          await ctx.telegram.sendMessage(
            tour.hostId,
            `ℹ️ <b>${escapeHtml(tour.title)}</b>\n<b>${escapeHtml(
              team.name
            )} [${escapeHtml(team.tag)}]</b>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tour.id
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `╔══════════════════════╗\n` +
          `   🎉 <b>${t('reserve_confirmed')}!</b>\n` +
          `╚══════════════════════╝\n\n` +
          `✅ <b>${escapeHtml(team.name)}</b>\n\n` +
          `🏆 ${escapeHtml(tour.title)}\n` +
          `👥 ${tour.registeredTeams.length + 1}/${tour.maxTeams}`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('rs:ok xatosi:', e.message);
    }
  });

  bot.action(/^rs:release:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      await reservationService.releaseReservation(ctx.match[1]);
      await safeEdit(
        ctx,
        `❌ <b>${t('reserve_released')}</b>`,
        backToAdmin(ctx)
      );
    } catch (e) {
      console.error('rs:release xatosi:', e.message);
    }
  });

  // ============================================================
  // 11. GUEST REJIM (#6)
  // ============================================================
  bot.action(/^gv:tour:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const matchData = await matchService.getTournamentMatches(tId);
      const teamsMap = {};
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teamsMap[tid] = team;
      }

      const standings = pointsService.calculateStandings(
        tour,
        matchData,
        teamsMap
      );

      const lines = [];
      lines.push(`╔══════════════════════╗`);
      lines.push(`   👁 <b>${t('guest_title')}</b>`);
      lines.push(`╚══════════════════════╝`);
      lines.push('');
      lines.push(`🏆 <b>${escapeHtml(tour.title)}</b>`);
      lines.push('');
      lines.push(`📅 ${tour.date} | ⏰ ${tour.startTime}`);
      lines.push(`🎮 ${escapeHtml(tour.mode)}`);
      lines.push(`👥 ${tour.registeredTeams.length}/${tour.maxTeams}`);
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`🎖 <b>${t('standings_title')}:</b>`);
      lines.push('');

      if (!standings.length) {
        lines.push(`<i>${t('no_results_yet')}</i>`);
      } else {
        standings.slice(0, 10).forEach((s, i) => {
          const medal =
            i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          lines.push(
            `${medal} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`
          );
          lines.push(`   💯 ${s.totalPoints} | 🎯 ${s.totalKills} | 🥇 ${s.wins}`);
        });
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🔄 ' + t('btn_refresh'),
            'gv:tour:' + tId
          ),
        ],
        [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
      ]);

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
    } catch (e) {
      console.error('gv:tour xatosi:', e.message);
    }
  });

  bot.action(CALLBACK.GUEST_LIST, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const all = await tournamentService.getAllTournaments();
      const now = new Date();

      const active = all.filter((tour) => {
        const d = new Date(`${tour.date}T${tour.startTime}:00+05:00`);
        return d > now || tour.status === 'open';
      });

      if (!active.length) {
        return safeEdit(ctx, `📭 ${t('guest_no_active')}`, backToAdmin(ctx));
      }

      const rows = active.slice(0, 10).map((tour) => [
        Markup.button.callback(
          `👁 ${tour.title.slice(0, 30)}`,
          'gv:tour:' + tour.id
        ),
      ]);
      rows.push([Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)]);

      await safeEdit(
        ctx,
        `👁 <b>${t('guest_title')}</b>\n\n${t('guest_pick')}`,
        { reply_markup: { inline_keyboard: rows } }
      );
    } catch (e) {
      console.error('gv:list xatosi:', e.message);
    }
  });

  // ============================================================
  // 12. LIVE SCORE — HOST TUGMASI
  // ============================================================
  bot.action(/^host:live:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return;
      if (Number(tour.hostId) !== Number(ctx.from.id)) return;

      const liveScoreService = require('../services/liveScoreService');
      const session = await liveScoreService.getSession(tId);
      const isActive = session?.active || false;

      const rows = [];

      if (isActive) {
        rows.push([
          Markup.button.callback(
            '🎯 ' + t('live_add_kill'),
            'ls:add:' + tId
          ),
        ]);
        rows.push([
          Markup.button.callback(
            '👁 ' + t('live_view'),
            'ls:view:' + tId
          ),
        ]);
        rows.push([
          Markup.button.callback(
            '⏹ ' + t('live_end'),
            'ls:end:' + tId
          ),
        ]);
      } else {
        rows.push([
          Markup.button.callback(
            '🔴 ' + t('live_start'),
            'ls:start:' + tId
          ),
        ]);
      }

      rows.push([
        Markup.button.callback(
          t('btn_back_tournament'),
          CALLBACK.HOST_OPEN + tId
        ),
      ]);

      await ctx.reply(
        `📡 <b>${t('live_title')}</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Holat: <b>${isActive ? '🔴 ' + t('admin_active') : '⚫️'}</b>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
      );
    } catch (e) {
      console.error('host:live xatosi:', e.message);
    }
  });

  // ============================================================
  // 13. TURNIRNI BEKOR QILISH
  // ============================================================
  bot.action(/^tour:cancel:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚫 ' + t('btn_confirm'),
            'tour:cancel_confirm:' + tId
          ),
        ],
        [
          Markup.button.callback(
            t('btn_cancel'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `⚠️ <b>${t('confirm_title')}</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n` +
          `👥 ${tour.registeredTeams.length} ${t('admin_teams')}\n\n` +
          `<i>${t('tour_delete_warning')}</i>`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tour:cancel xatosi:', e.message);
    }
  });

  bot.action(/^tour:cancel_confirm:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return;

      await tournamentService.setStatus(tId, TOUR_STATUS.CANCELLED);

      // A'zolarga xabar
      const memberIds = new Set();
      for (const teamId of tour.registeredTeams) {
        const team = await teamService.getTeam(teamId);
        if (team) team.members.forEach((m) => memberIds.add(m));
      }

      let sent = 0;
      for (const uid of memberIds) {
        try {
          await ctx.telegram.sendMessage(
            uid,
            `🚫 <b>${t('tour_finished_title')}</b>\n\n` +
              `🏆 ${escapeHtml(tour.title)}`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch (e) {}
      }

      await safeEdit(
        ctx,
        `✅ <b>${t('tour_finished_title')}</b>\n\n` +
          `🏆 ${escapeHtml(tour.title)}\n` +
          `📤 ${sent} ${t('admin_users')}`,
        backToAdmin(ctx)
      );
    } catch (e) {
      console.error('tour:cancel_confirm xatosi:', e.message);
    }
  });

  // ============================================================
  // 14. TURNIR HISOBOTI
  // ============================================================
  bot.action(/^tour:rep:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const matchData = await matchService.getTournamentMatches(tId);
      const teamsMap = {};
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teamsMap[tid] = team;
      }

      const standings = pointsService.calculateStandings(
        tour,
        matchData,
        teamsMap
      );

      const lines = [];
      lines.push(`╔══════════════════════╗`);
      lines.push(`  📊 <b>${t('tour_report')}</b>`);
      lines.push(`╚══════════════════════╝`);
      lines.push('');
      lines.push(`🏆 <b>${escapeHtml(tour.title)}</b>`);
      lines.push(`📅 ${tour.date} | ⏰ ${tour.startTime}`);
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}</b>`);
      lines.push(`🎮 ${t('matches')}: <b>${matchData.matches.length}</b>`);
      lines.push('');

      if (standings.length) {
        lines.push(`🥇 <b>TOP-3:</b>`);
        lines.push('');
        const medals = ['🥇', '🥈', '🥉'];
        for (let i = 0; i < Math.min(3, standings.length); i++) {
          const s = standings[i];
          lines.push(
            `${medals[i]} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`
          );
          lines.push(
            `   💯 ${s.totalPoints} pts | 🎯 ${s.totalKills} kill | 🥇 ${s.wins} win`
          );
          lines.push('');
        }
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('tour_publish_channel'),
            'tf:pub:' + tId
          ),
        ],
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      console.error('tour:rep xatosi:', e.message);
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  // ============================================================
  // 15. G'OLIBLAR E'LONI
  // ============================================================
  bot.action(/^tour:win:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const matchData = await matchService.getTournamentMatches(tId);
      const teamsMap = {};
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teamsMap[tid] = team;
      }

      const standings = pointsService.calculateStandings(
        tour,
        matchData,
        teamsMap
      );

      if (!standings.length) {
        return ctx.reply(`❗ ${t('no_results_yet')}`);
      }

      const lines = [];
      lines.push(`╔══════════════════════╗`);
      lines.push(`   🏆 <b>G'OLIBLAR</b>`);
      lines.push(`╚══════════════════════╝`);
      lines.push('');
      lines.push(`🎮 <b>${escapeHtml(tour.title)}</b>`);
      lines.push(`📅 ${tour.date}`);
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      const medals = ['🥇', '🥈', '🥉'];
      const rankNames = ['1-O\'RIN', '2-O\'RIN', '3-O\'RIN'];

      for (let i = 0; i < Math.min(3, standings.length); i++) {
        const s = standings[i];
        lines.push(`${medals[i]} <b>${rankNames[i]}</b>`);
        lines.push(`🏷 <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`);
        lines.push(`💯 <b>${s.totalPoints}</b> ball`);
        lines.push(`🎯 ${s.totalKills} kill`);
        lines.push(`🏆 ${s.wins} win`);
        lines.push('');
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('tour_publish_channel'),
            'tf:pub:' + tId
          ),
        ],
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    } catch (e) {
      console.error('tour:win xatosi:', e.message);
    }
  });

  // ============================================================
  // 16. TURNIRNI NUSXALASH
  // ============================================================
  bot.action(/^tour:clone:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      ctx.session = {
        state: 'tour_clone_date',
        data: { oldId: tId },
      };

      await ctx.reply(
        `📋 <b>${t('tour_clone')}</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n` +
          `📅 ${tour.date} | ⏰ ${tour.startTime}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📅 ${t('tour_create_date_prompt')}\n` +
          `<i>/skip</i>`,
        { parse_mode: 'HTML', reply_markup: backToTournament(ctx, tId).reply_markup }
      );
    } catch (e) {
      console.error('tour:clone xatosi:', e.message);
    }
  });

  // ============================================================
  // 17. TURNIR HAVOLASI
  // ============================================================
  bot.action(/^tour:link:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const link = `https://t.me/${config.BOT_USERNAME}?start=${tId}`;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.url(
            '📤 ' + t('ch_announce_btn'),
            `https://t.me/share/url?url=${encodeURIComponent(link)}`
          ),
        ],
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `🔗 <b>${t('tour_link')}</b>\n\n` +
          `<code>${escapeHtml(link)}</code>`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tour:link xatosi:', e.message);
    }
  });

  // ============================================================
  // 18. TURNIR STATISTIKASI
  // ============================================================
  bot.action(/^tour:stats:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const matchData = await matchService.getTournamentMatches(tId);

      let totalPlayers = 0;
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) totalPlayers += team.members.length;
      }

      let totalKills = 0;
      matchData.matches.forEach((m) => {
        m.results.forEach((r) => {
          totalKills += r.kills || 0;
        });
      });

      const fillRate =
        tour.maxTeams > 0
          ? ((tour.registeredTeams.length / tour.maxTeams) * 100).toFixed(0)
          : 0;

      const avgKills =
        matchData.matches.length > 0
          ? (totalKills / matchData.matches.length).toFixed(1)
          : 0;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `📊 <b>${t('tour_stats')}</b>\n\n` +
          `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}/${tour.maxTeams}</b>\n` +
          `📈 ${t('admin_active')}: <b>${fillRate}%</b>\n` +
          `🎮 ${t('matches')}: <b>${matchData.matches.length}</b>\n` +
          `💥 ${t('bc_stats_sent')}: <b>${totalKills}</b>\n` +
          `📊 ${t('team_stats_avg_kill')}: <b>${avgKills}</b>\n` +
          `👤 ${t('admin_users')}: <b>${totalPlayers}</b>`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tour:stats xatosi:', e.message);
    }
  });

  // ============================================================
  // 19. TURNIR ETAPINI TANLASH
  // ============================================================
  bot.action(/^tour:stage:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const tour = await tournamentService.getTournament(tId);
      if (!tour) return ctx.reply(t('tour_not_found'));

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback('📋 1/4 Final', 'tour:stages:' + tId + ':quarter'),
          Markup.button.callback('🎯 1/2 Final', 'tour:stages:' + tId + ':semi'),
        ],
        [
          Markup.button.callback('🏆 Final', 'tour:stages:' + tId + ':final'),
          Markup.button.callback('📌 Yakka', 'tour:stages:' + tId + ':single'),
        ],
        [
          Markup.button.callback(
            t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + tId
          ),
        ],
      ]);

      await safeEdit(
        ctx,
        `⭐️ <b>${t('tour_stage')}</b>\n\n` +
          `<i>Hozirgi: ${escapeHtml(tour.etapa || '-')}</i>`,
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tour:stage xatosi:', e.message);
    }
  });

  bot.action(/^tour:stages:(.+):(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);

    try {
      const t = ctx.t;
      const tId = ctx.match[1];
      const stage = ctx.match[2];

      const labels = {
        quarter: '1/4 Final',
        semi: '1/2 Final',
        final: 'Final',
        single: 'Yakka',
      };

      await tournamentService.updateTournament(tId, { etapa: labels[stage] });

      await safeEdit(
        ctx,
        `✅ <b>${t('success')}</b>\n\n⭐️ ${labels[stage]}`,
        backToTournament(ctx, tId)
      );
    } catch (e) {
      console.error('tour:stages xatosi:', e.message);
    }
  });
};

// ============================================================
// YORDAMCHI: KALENDAR KO'RSATISH
// ============================================================
async function showCalendar(ctx, year, month, isEdit) {
  const t = ctx.t;
  const all = await tournamentService.getAllTournaments();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const tours = all
    .filter((tour) => tour.date && tour.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));

  const monthNames = [
    '',
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ];

  const lines = [];
  lines.push(`📅 <b>${monthNames[month]} ${year}</b>`);
  lines.push(`📊 ${t('admin_tournaments')}: <b>${tours.length}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (!tours.length) {
    lines.push(`<i>${t('tour_empty')}</i>`);
  } else {
    // Kunlar bo'yicha guruhlash
    const byDay = {};
    tours.forEach((tour) => {
      const day = tour.date.slice(8, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(tour);
    });

    Object.keys(byDay)
      .sort()
      .forEach((day) => {
        lines.push(`📌 <b>${day}-${t('date')}:</b>`);
        byDay[day].forEach((tour) => {
          const typeEmoji = tour.type === 'paid' ? '💳' : '🆓';
          lines.push(
            `   ⏰ ${tour.startTime} — ${typeEmoji} <b>${escapeHtml(
              tour.title
            )}</b>`
          );
        });
        lines.push('');
      });
  }

  // Oldingi / Keyingi oy
  let prevM = month - 1;
  let prevY = year;
  if (prevM < 1) {
    prevM = 12;
    prevY--;
  }
  let nextM = month + 1;
  let nextY = year;
  if (nextM > 12) {
    nextM = 1;
    nextY++;
  }

  const rows = [
    [
      Markup.button.callback(
        `⬅️ ${prevM}-${t('date').slice(0, 3)}`,
        `tour:calm:${prevY}:${prevM}`
      ),
      Markup.button.callback(
        `${nextM}-${t('date').slice(0, 3)} ➡️`,
        `tour:calm:${nextY}:${nextM}`
      ),
    ],
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ];

  const text = lines.join('\n');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } else {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  } catch (e) {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    });
  }
}