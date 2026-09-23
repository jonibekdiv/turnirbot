// ============================================================
// ADMIN HANDLER — To'liq (ko'p tilli + turnirni o'chirish)
// ============================================================
const { Markup } = require('telegraf');
const userService = require('../services/userService');
const teamService = require('../services/teamService');
const tournamentService = require('../services/tournamentService');
const roleService = require('../services/roleService');
const broadcastService = require('../services/broadcastService');
const settingsService = require('../services/settingsService');
const adminExtService = require('../services/adminExtService');
const { adminPanel, roleManageKeyboard } = require('../keyboards/adminKeyboard');
const { CALLBACK, ROLES, STATES, LIMITS } = require('../constants');
const {
  escapeHtml,
  displayName,
  safeEdit,
  safeAnswer,
} = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const {
  hasAnyRole,
  canManageUsers,
  canManageAdmins,
  canEditSettings,
} = require('../middlewares/roleGuard');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // 1. ADMIN PANEL — BOSH MENYU
  // ============================================================
  bot.action(CALLBACK.MENU_ADMIN, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const t = ctx.t;
    const isOrganizer = ctx.state.role === ROLES.ORGANIZER;
    const title = isOrganizer
      ? `🎯 <b>${t('org_panel_title')}</b>`
      : `🛠 <b>${t('admin_title')}</b>`;

    const text =
      `╔══════════════════════╗\n` +
      `   ${title}\n` +
      `╚══════════════════════╝\n\n` +
      `🎭 ${t('profile_role')}: <b>${escapeHtml(ctx.state.role)}</b>\n\n` +
      `👇 ${t('admin_panel_subtitle')}`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...adminPanel(ctx),
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...adminPanel(ctx),
      });
    }
  });

  bot.action(CALLBACK.ADMIN_PANEL, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const t = ctx.t;
    const isOrganizer = ctx.state.role === ROLES.ORGANIZER;
    const title = isOrganizer
      ? `🎯 <b>${t('org_panel_title')}</b>`
      : `🛠 <b>${t('admin_title')}</b>`;

    const text =
      `╔══════════════════════╗\n` +
      `   ${title}\n` +
      `╚══════════════════════╝\n\n` +
      `🎭 ${t('profile_role')}: <b>${escapeHtml(ctx.state.role)}</b>\n\n` +
      `👇 ${t('admin_panel_subtitle')}`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...adminPanel(ctx),
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...adminPanel(ctx),
      });
    }
  });

  // ============================================================
  // 2. STATISTIKA
  // ============================================================
  bot.action(CALLBACK.ADMIN_STATS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = ctx.t;

    const users = await userService.getAllUsers();
    const teams = await teamService.getAllTeams();
    const tours = await tournamentService.getAllTournaments();
    const hosts = await roleService.list('host');
    const orgs = await roleService.list('organizer');
    const admins = await roleService.list('admin');

    const active = users.filter((u) => u.status === 'active').length;
    const today = users.filter(
      (u) =>
        new Date(u.createdAt).toDateString() === new Date().toDateString()
    ).length;

    const text =
      `📊 <b>${t('admin_stats')}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 ${t('admin_users')}: <b>${users.length}</b>\n` +
      `🟢 ${t('admin_active')}: <b>${active}</b>\n` +
      `📅 ${t('daily_new_users')}: <b>${today}</b>\n\n` +
      `👥 ${t('admin_teams')}: <b>${teams.length}</b>\n` +
      `🏆 ${t('admin_tournaments')}: <b>${tours.length}</b>\n` +
      `🔥 ${t('admin_active_tours')}: <b>${
        tours.filter((x) => x.status === 'open').length
      }</b>\n\n` +
      `🎙 ${t('admin_hosts')}: <b>${hosts.length}</b>\n` +
      `🎯 ${t('admin_orgs')}: <b>${orgs.length}</b>\n` +
      `🛡 ${t('admin_admins')}: <b>${admins.length}</b>`;

    await safeEdit(ctx, text, adminPanel(ctx));
  });

  // ============================================================
  // 3. FOYDALANUVCHILAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_USERS, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageUsers(ctx.state.role)) {
      return ctx.reply(ctx.t('error_only_admin'));
    }

    const t = ctx.t;
    const users = await userService.getAllUsers();
    const sliced = users.slice(0, 30);

    const text =
      `👤 <b>${t('admin_users')} (${users.length})</b>\n\n` +
      sliced
        .map(
          (u, i) =>
            `${i + 1}. ${escapeHtml(displayName(u))} — <code>${u.id}</code>`
        )
        .join('\n') +
      (users.length > 30
        ? `\n\n<i>... +${users.length - 30}</i>`
        : '');

    await safeEdit(ctx, text, adminPanel(ctx));
  });

  // ============================================================
  // 4. KOMANDALAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_TEAMS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = ctx.t;
    const teams = await teamService.getAllTeams();

    const text =
      `👥 <b>${t('admin_teams')} (${teams.length})</b>\n\n` +
      (teams.length === 0
        ? `<i>${t('no_data')}</i>`
        : teams
            .slice(0, 30)
            .map(
              (tm, i) =>
                `${i + 1}. <b>${escapeHtml(tm.name)}</b> [${escapeHtml(
                  tm.tag
                )}] — ${tm.members.length}`
            )
            .join('\n')) +
      (teams.length > 30 ? `\n\n<i>... +${teams.length - 30}</i>` : '');

    await safeEdit(ctx, text, adminPanel(ctx));
  });

  // ============================================================
  // 5. TURNIRLAR — RO'YXAT + O'CHIRISH
  // ============================================================
  bot.action(CALLBACK.ADMIN_TOURNAMENTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = ctx.t;
    const isOrganizer = ctx.state.role === ROLES.ORGANIZER;
    const isAdmin =
      ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN;

    // Organizer — faqat o'z turnirlari
    const tours = isOrganizer
      ? await tournamentService.getOrganizerTournaments(ctx.from.id)
      : await tournamentService.getAllTournaments();

    if (!tours.length) {
      const rows = [
        [
          Markup.button.callback(
            '➕ ' + t('tour_create_again'),
            CALLBACK.TOUR_CREATE
          ),
        ],
        [
          Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL),
        ],
      ];
      return safeEdit(
        ctx,
        `🏆 <b>${t('admin_tournaments')}</b>\n\n<i>${t('tour_empty')}</i>`,
        { reply_markup: { inline_keyboard: rows } }
      );
    }

    // Saralash — yangi birinchi
    tours.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const rows = [];
    tours.slice(0, 10).forEach((tr) => {
      const titleShort =
        tr.title.length > 20 ? tr.title.slice(0, 17) + '...' : tr.title;
      const status =
        tr.registeredTeams.length >= tr.maxTeams
          ? '🔴'
          : tr.status === 'cancelled'
          ? '🚫'
          : tr.status === 'finished'
          ? '✅'
          : '🟢';

      const row = [
        Markup.button.callback(
          `📂 ${titleShort} ${status}`,
          CALLBACK.TOUR_OPEN + tr.id
        ),
      ];

      // Faqat Admin/Super Admin o'chirishi mumkin
      if (isAdmin) {
        row.push(
          Markup.button.callback('🗑', CALLBACK.TOUR_DELETE + tr.id)
        );
      }

      rows.push(row);
    });

    if (tours.length > 10) {
      rows.push([
        Markup.button.callback(
          `📋 +${tours.length - 10}`,
          CALLBACK.ADMIN_TOURNAMENTS
        ),
      ]);
    }

    rows.push([
      Markup.button.callback(
        '➕ ' + t('tour_create_again'),
        CALLBACK.TOUR_CREATE
      ),
    ]);
    rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    const header = isOrganizer
      ? `🏆 <b>${t('org_my_tournaments')} (${tours.length})</b>`
      : `🏆 <b>${t('admin_tournaments')} (${tours.length})</b>`;

    await safeEdit(
      ctx,
      `${header}\n\n` +
        `📂 — ${t('tour_open')}\n` +
        (isAdmin ? `🗑 — ${t('tour_delete')}\n` : '') +
        `\n<i>${t('admin_tour_last_10')}</i>`,
      { reply_markup: { inline_keyboard: rows } }
    );
  });

  // ============================================================
  // 6. TURNIRNI O'CHIRISH — TASDIQLASH
  // ============================================================
  bot.action(/^tour:del:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(ctx.t('tour_not_found'));

    const t = ctx.t;

    const hostInfo = tour.hostId
      ? `🎙 ${t('host_label')}: <code>${tour.hostId}</code>\n`
      : '';
    const teamsInfo = tour.registeredTeams.length
      ? `👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}</b>\n`
      : '';

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🗑 ' + t('btn_confirm'),
          'tour:delc:' + tId
        ),
      ],
      [
        Markup.button.callback(
          t('btn_cancel'),
          CALLBACK.ADMIN_TOURNAMENTS
        ),
      ],
    ]);

    await safeEdit(
      ctx,
      `╔══════════════════════╗\n` +
        `   ⚠️ <b>${t('confirm_title')}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🗑 <b>${t('tour_delete_confirm')}</b>\n\n` +
        `🏆 ${t('name')}: <b>${escapeHtml(tour.title)}</b>\n` +
        `🆔 ID: <code>${tour.id}</code>\n` +
        `📅 ${t('date')}: <b>${tour.date}</b>\n` +
        `⏰ ${t('time')}: <b>${tour.startTime}</b>\n` +
        `🎮 ${t('mode')}: <b>${escapeHtml(tour.mode)}</b>\n` +
        teamsInfo +
        hostInfo +
        `\n⚠️ <i>${t('tour_delete_warning')}</i>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 7. TURNIRNI O'CHIRISH — BAJARISH
  // ============================================================
  bot.action(/^tour:delc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) {
      return ctx.reply(ctx.t('tour_not_found'));
    }

    const t = ctx.t;
    const title = tour.title;
    const hostId = tour.hostId;
    const teamCount = tour.registeredTeams.length;

    try {
      // Turnirni o'chirish
      await tournamentService.deleteTournament(tId);

      // Hostga xabar
      if (hostId) {
        try {
          await ctx.telegram.sendMessage(
            hostId,
            `⚠️ <b>${t('tour_deleted_title')}</b>\n\n` +
              `🏆 <b>${escapeHtml(title)}</b>\n\n` +
              `<i>${t('tour_deleted_notify')}</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }

      // Admin amali log
      try {
        await adminExtService.logAction(ctx.from.id, 'DELETE_TOURNAMENT', {
          target: tId,
          title,
        });
      } catch (e) {}

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            t('admin_tournaments'),
            CALLBACK.ADMIN_TOURNAMENTS
          ),
        ],
        [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
      ]);

      await safeEdit(
        ctx,
        `╔══════════════════════╗\n` +
          `   ✅ <b>${t('tour_deleted_title')}</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🗑 <b>${escapeHtml(title)}</b>\n\n` +
          (teamCount
            ? `👥 ${teamCount} ${t('admin_teams')}\n`
            : '') +
          (hostId ? `🎙 ${t('host_label')} — ${t('tour_deleted_notify')}\n` : ''),
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      console.error('tour:delc xatosi:', e.message);
      await ctx.reply(
        `❌ ${t('error_prefix')} ${e.message || t('error_generic')}`
      );
    }
  });

  // ============================================================
  // 8. HOSTLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_HOSTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = ctx.t;
    const hosts = await roleService.list('host');

    const hostsWithNames = [];
    for (const h of hosts.slice(0, 20)) {
      const u = await userService.getUser(h.id);
      const name = u ? displayName(u) : `ID: ${h.id}`;
      hostsWithNames.push(`• <code>${h.id}</code> — ${escapeHtml(name)}`);
    }

    const text =
      `🎙 <b>${t('admin_hosts')} (${hosts.length})</b>\n\n` +
      (hosts.length === 0
        ? `<i>${t('no_data')}</i>`
        : hostsWithNames.join('\n'));

    // Faqat Admin hostlarni boshqarishi mumkin
    const kb =
      ctx.state.role === ROLES.ADMIN || ctx.state.role === ROLES.SUPER_ADMIN
        ? roleManageKeyboard(ctx, 'host')
        : Markup.inlineKeyboard([
            [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
          ]);

    await safeEdit(ctx, text, kb);
  });

  // ============================================================
  // 9. ADMINLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_ADMINS, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageUsers(ctx.state.role)) {
      return ctx.reply(ctx.t('error_only_admin'));
    }

    const t = ctx.t;
    const admins = await roleService.list('admin');

    const adminsWithNames = [];
    for (const a of admins.slice(0, 20)) {
      const u = await userService.getUser(a.id);
      const name = u ? displayName(u) : `ID: ${a.id}`;
      adminsWithNames.push(`• <code>${a.id}</code> — ${escapeHtml(name)}`);
    }

    const text =
      `🛡 <b>${t('admin_admins')} (${admins.length})</b>\n\n` +
      (admins.length === 0
        ? `<i>${t('admin_only_super')}</i>`
        : adminsWithNames.join('\n'));

    await safeEdit(ctx, text, roleManageKeyboard(ctx, 'admin'));
  });

  // ============================================================
  // 10. ORGANIZERLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_ORGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
      return ctx.reply(ctx.t('error_only_admin'));
    }

    const t = ctx.t;
    const orgs = await roleService.list('organizer');

    const orgsWithNames = [];
    for (const o of orgs.slice(0, 20)) {
      const u = await userService.getUser(o.id);
      const name = u ? displayName(u) : `ID: ${o.id}`;
      orgsWithNames.push(`• <code>${o.id}</code> — ${escapeHtml(name)}`);
    }

    const text =
      `🎯 <b>${t('admin_orgs')} (${orgs.length})</b>\n\n` +
      (orgs.length === 0
        ? `<i>${t('no_data')}</i>`
        : orgsWithNames.join('\n'));

    await safeEdit(ctx, text, roleManageKeyboard(ctx, 'organizer'));
  });

  // ============================================================
  // 11. ROL QO'SHISH
  // ============================================================
  bot.action(/^admin:addrole:(admin|organizer|host)$/, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.match[1];
    const t = ctx.t;

    // Ruxsat tekshiruvi
    if (role === 'admin') {
      if (!canManageAdmins(ctx.state.role)) {
        const settings = await settingsService.getSettings();
        if (!(ctx.state.role === ROLES.ADMIN && settings.allowAdminAddAdmin)) {
          return ctx.reply(`⛔ ${t('error_only_super')}`);
        }
      }
    }

    if (role === 'organizer') {
      if (!canManageUsers(ctx.state.role)) {
        return ctx.reply(`⛔ ${t('error_only_admin')}`);
      }
    }

    if (role === 'host') {
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
        return ctx.reply(`⛔ ${t('error_only_admin')}`);
      }
    }

    ctx.session = { state: STATES.ADMIN_ADD_USER_ID, data: { role } };

    await ctx.reply(
      `➕ <b>${t('admin_add_role')} ${role}</b>\n\n` +
        `${t('admin_send_id')}\n\n` +
        `<i>${t('admin_id_example')}: 123456789</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 12. ROL O'CHIRISH
  // ============================================================
  bot.action(/^admin:delrole:(admin|organizer|host)$/, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.match[1];
    const t = ctx.t;

    if (role === 'admin') {
      if (!canManageAdmins(ctx.state.role)) {
        return ctx.reply(`⛔ ${t('error_only_super')}`);
      }
    }

    if (role === 'organizer') {
      if (!canManageUsers(ctx.state.role)) {
        return ctx.reply(`⛔ ${t('error_only_admin')}`);
      }
    }

    if (role === 'host') {
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
        return ctx.reply(`⛔ ${t('error_only_admin')}`);
      }
    }

    ctx.session = {
      state: STATES.ADMIN_ADD_USER_ID,
      data: { role, remove: true },
    };

    await ctx.reply(
      `➖ <b>${t('admin_delete_role')} ${role}</b>\n\n` +
        `${t('admin_send_id')}`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 13. SOZLAMALAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_SETTINGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!canEditSettings(ctx.state.role)) {
      return ctx.reply(ctx.t('error_only_super'));
    }

    const t = ctx.t;
    const s = await settingsService.getSettings();

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${t('admin_admin_add')}: ${s.allowAdminAddAdmin ? '✅' : '❌'}`,
          'admin:toggle:allowAdminAddAdmin'
        ),
      ],
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(
      ctx,
      `⚙️ <b>${t('admin_settings')}</b>\n\n` +
        `👥 ${t('admin_min_members')}: <b>${s.minTeamMembers}</b>\n` +
        `👥 ${t('admin_max_members')}: <b>${s.maxTeamMembers}</b>\n` +
        `🏆 ${t('admin_max_teams')}: <b>${s.maxTeamsPerTournament}</b>`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action(/^admin:toggle:(.+)$/, async (ctx) => {
    if (!canEditSettings(ctx.state.role)) {
      return safeAnswer(ctx, `⛔ ${ctx.t('error_access')}`);
    }

    const key = ctx.match[1];
    const s = await settingsService.getSettings();
    await settingsService.updateSettings({ [key]: !s[key] });
    await safeAnswer(ctx, `✅ ${ctx.t('success')}`);

    const t = ctx.t;
    const s2 = await settingsService.getSettings();

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${t('admin_admin_add')}: ${s2.allowAdminAddAdmin ? '✅' : '❌'}`,
          'admin:toggle:allowAdminAddAdmin'
        ),
      ],
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(
      ctx,
      `⚙️ <b>${t('admin_settings')}</b>\n\n` +
        `👥 ${t('admin_min_members')}: <b>${s2.minTeamMembers}</b>\n` +
        `👥 ${t('admin_max_members')}: <b>${s2.maxTeamMembers}</b>\n` +
        `🏆 ${t('admin_max_teams')}: <b>${s2.maxTeamsPerTournament}</b>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 14. REKLAMA YUBORISH
  // ============================================================
  bot.action(CALLBACK.ADMIN_BROADCAST, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = ctx.t;
    const isOrganizer = ctx.state.role === ROLES.ORGANIZER;

    const tours = isOrganizer
      ? await tournamentService.getOrganizerTournaments(ctx.from.id)
      : await tournamentService.getAllTournaments();

    const rows = tours.slice(0, 15).map((tr) => [
      Markup.button.callback(
        `📢 ${tr.title.slice(0, 25)}`,
        CALLBACK.TOUR_BROADCAST + tr.id
      ),
    ]);
    rows.push([Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)]);

    const subtitle = isOrganizer
      ? t('org_pick_your_tournament')
      : t('ch_pick_for_reklama');

    await safeEdit(
      ctx,
      `📢 <b>${t('admin_broadcast')}</b>\n\n${subtitle}`,
      { reply_markup: { inline_keyboard: rows } }
    );
  });

  // ============================================================
  // 15. TURNIR REKLAMASINI YUBORISH
  // ============================================================
  bot.action(/^tour:bc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = ctx.t;
    const tr = await tournamentService.getTournament(ctx.match[1]);
    if (!tr) return ctx.reply(ctx.t('tour_not_found'));

    // Organizer — faqat o'z turniri
    if (ctx.state.role === ROLES.ORGANIZER) {
      if (Number(tr.organizerId) !== Number(ctx.from.id)) {
        return ctx.reply(`⛔ ${t('org_not_owner')}`);
      }
    }

    const caption =
      `🏆 <b>${escapeHtml(tr.title)}</b>\n\n` +
      `📅 ${tr.date} | ⏰ ${tr.startTime}\n` +
      `🎮 ${escapeHtml(tr.mode)} | 🗺 ${escapeHtml(tr.map || 'Erangel')}\n` +
      `👥 ${tr.registeredTeams.length}/${tr.maxTeams}\n` +
      (tr.description ? `\n📄 ${escapeHtml(tr.description)}\n` : '') +
      `\n${t('tour_press_to_open')}`;

    const button = Markup.button.url(
      '🎮 ' + t('tour_open'),
      `https://t.me/${config.BOT_USERNAME}?start=${tr.id}`
    );

    await ctx.reply(`⏳ ${t('loading')}`);

    // Broadcast statistikasini boshlash
    const broadcastStatsService = require('../services/broadcastStatsService');

    try {
      const users = await userService.getAllUsers();

      const bcEntry = await broadcastStatsService.startBroadcast({
        adminId: ctx.from.id,
        type: 'all',
        tournamentId: tr.id,
        title: tr.title,
        totalTargets: users.length,
      });

      const res = await broadcastService.broadcastToAllUsers(bot, {
        image: tr.imageFileId,
        caption,
        button,
      });

      await broadcastStatsService.finishBroadcast(bcEntry.id, {
        sent: res.sent,
        failed: res.failed,
        blocked: res.blocked || 0,
      });

      await safeEdit(
        ctx,
        `✅ <b>${t('ch_announced')}</b>\n\n` +
          `📌 ${t('bc_stats_total')}: <b>${res.total}</b>\n` +
          `✅ ${t('bc_stats_sent')}: <b>${res.sent}</b>\n` +
          `❌ ${t('bc_stats_failed')}: <b>${res.failed}</b>`,
        adminPanel(ctx)
      );
    } catch (e) {
      console.error('tour:bc xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_prefix')} ${e.message}`);
    }
  });

  // ============================================================
  // 16. FSM — ROL QO'SHISH/O'CHIRISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.ADMIN_ADD_USER_ID) return next();

    const t = ctx.t;
    const { role, remove } = ctx.session.data;

    // Ruxsatni qayta tekshirish
    if (role === 'admin' && !canManageAdmins(ctx.state.role)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('error_access'));
    }
    if (role === 'organizer' && !canManageUsers(ctx.state.role)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('error_access'));
    }
    if (role === 'host' && !hasAnyRole(ctx.state.role, [ROLES.ADMIN])) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('error_access'));
    }

    const v = cleanText(ctx.message.text, 20);
    if (!isPositiveInt(v)) {
      return ctx.reply(ctx.t('error_only_digits'));
    }

    const targetId = Number(v);
    ctx.session = { state: null, data: {} };

    try {
      if (remove) {
        if (targetId === Number(config.SUPER_ADMIN_ID)) {
          return ctx.reply("⛔ Super Admin'ni o'chirib bo'lmaydi.");
        }

        await roleService.remove(role, targetId);
        await ctx.reply(
          `✅ <b>${role}</b> — <code>${targetId}</code> (${t('btn_delete')})`,
          { parse_mode: 'HTML' }
        );
      } else {
        await roleService.add(role, targetId, ctx.from.id);
        await ctx.reply(
          `✅ <b>${role}</b> — <code>${targetId}</code> (${t('btn_add')})`,
          { parse_mode: 'HTML' }
        );

        try {
          await ctx.telegram.sendMessage(
            targetId,
            `🎉 <b>${role}</b> — ${t('admin_role_granted')}\n\n` +
              `/start`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    } catch (e) {
      await ctx.reply(
        `${ctx.t('error_prefix')} ${e.message || ctx.t('error_generic')}`
      );
    }
  });
};