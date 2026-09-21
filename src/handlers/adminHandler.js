// ============================================================
// ADMIN HANDLER — Rolga qarab ruxsatlar
// ============================================================
const { Markup } = require('telegraf');
const userService = require('../services/userService');
const teamService = require('../services/teamService');
const tournamentService = require('../services/tournamentService');
const roleService = require('../services/roleService');
const broadcastService = require('../services/broadcastService');
const settingsService = require('../services/settingsService');
const {
  adminPanel,
  roleManageKeyboard,
  organizerHostsKeyboard,
  organizerOrgsKeyboard,
} = require('../keyboards/adminKeyboard');
const { CALLBACK, ROLES, STATES } = require('../constants');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const {
  hasAnyRole,
  canManageUsers,
  canManageAdmins,
  canBan,
  canEditSettings,
} = require('../middlewares/roleGuard');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // 1. ADMIN PANEL — Bosh menyu
  // ============================================================
  bot.action(CALLBACK.MENU_ADMIN, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    const text =
      `╔══════════════════════╗\n` +
      `   🛠 <b>ADMIN PANEL</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🎭 Rol: <b>${escapeHtml(ctx.state.role)}</b>\n\n` +
      `👇 Bo'limni tanlang:`;

    await safeEdit(ctx, text, adminPanel(ctx.state.role));
  });

  bot.action(CALLBACK.ADMIN_PANEL, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    const text =
      `╔══════════════════════╗\n` +
      `   🛠 <b>ADMIN PANEL</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🎭 Rol: <b>${escapeHtml(ctx.state.role)}</b>\n\n` +
      `👇 Bo'limni tanlang:`;

    await safeEdit(ctx, text, adminPanel(ctx.state.role));
  });

  // ============================================================
  // 2. STATISTIKA
  // ============================================================
  bot.action(CALLBACK.ADMIN_STATS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const users = await userService.getAllUsers();
    const teams = await teamService.getAllTeams();
    const tours = await tournamentService.getAllTournaments();
    const hosts = await roleService.list('host');
    const orgs = await roleService.list('organizer');
    const admins = await roleService.list('admin');

    const active = users.filter((u) => u.status === 'active').length;
    const today = users.filter(
      (u) => new Date(u.createdAt).toDateString() === new Date().toDateString()
    ).length;

    const text =
      `📊 <b>Statistika</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 Foydalanuvchilar: <b>${users.length}</b>\n` +
      `🟢 Aktiv: <b>${active}</b>\n` +
      `📅 Bugun qo'shilgan: <b>${today}</b>\n\n` +
      `👥 Komandalar: <b>${teams.length}</b>\n` +
      `🏆 Turnirlar: <b>${tours.length}</b>\n` +
      `🔥 Faol turnirlar: <b>${tours.filter((t) => t.status === 'open').length}</b>\n\n` +
      `🎙 Hostlar: <b>${hosts.length}</b>\n` +
      `🎯 Organizerlar: <b>${orgs.length}</b>\n` +
      `🛡 Adminlar: <b>${admins.length}</b>`;

    await safeEdit(ctx, text, adminPanel(ctx.state.role));
  });

  // ============================================================
  // 3. FOYDALANUVCHILAR — Faqat Admin/Super Admin
  // ============================================================
  bot.action(CALLBACK.ADMIN_USERS, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageUsers(ctx.state.role)) {
      return ctx.reply("⛔ Faqat Admin foydalanuvchilarni ko'ra oladi.");
    }

    const users = await userService.getAllUsers();
    const sliced = users.slice(0, 30);

    const text =
      `👤 <b>Foydalanuvchilar (${users.length})</b>\n\n` +
      sliced
        .map((u, i) => `${i + 1}. ${escapeHtml(displayName(u))} — <code>${u.id}</code>`)
        .join('\n') +
      (users.length > 30 ? `\n\n<i>... va yana ${users.length - 30} ta</i>` : '');

    await safeEdit(ctx, text, adminPanel(ctx.state.role));
  });

  // ============================================================
  // 4. KOMANDALAR — Admin + Organizer
  // ============================================================
  bot.action(CALLBACK.ADMIN_TEAMS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const teams = await teamService.getAllTeams();
    const text =
      `👥 <b>Komandalar (${teams.length})</b>\n\n` +
      (teams.length === 0
        ? "<i>Hozircha komandalar yo'q</i>"
        : teams
            .slice(0, 30)
            .map(
              (t, i) =>
                `${i + 1}. <b>${escapeHtml(t.name)}</b> [${escapeHtml(t.tag)}] — ${t.members.length} a'zo`
            )
            .join('\n')) +
      (teams.length > 30 ? `\n\n<i>... va yana ${teams.length - 30} ta</i>` : '');

    await safeEdit(ctx, text, adminPanel(ctx.state.role));
  });

  // ============================================================
  // 5. TURNIRLAR — Admin + Organizer
  // ============================================================
  bot.action(CALLBACK.ADMIN_TOURNAMENTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tours = await tournamentService.getAllTournaments();

    if (tours.length === 0) {
      const rows = [
        [Markup.button.callback('➕ Yangi turnir', CALLBACK.TOUR_CREATE)],
        [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
      ];
      return safeEdit(ctx, `🏆 <b>Turnirlar</b>\n\n<i>Hozircha turnirlar yo'q</i>`, {
        reply_markup: { inline_keyboard: rows },
      });
    }

    // Saralash — yangi birinchi
    tours.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const rows = [];
    tours.slice(0, 10).forEach((t) => {
      const titleShort = t.title.length > 20 ? t.title.slice(0, 17) + '...' : t.title;
      const status =
        t.registeredTeams.length >= t.maxTeams ? '🔴' : t.status === 'cancelled' ? '🚫' : '🟢';

      rows.push([
        Markup.button.callback(`📂 ${titleShort} ${status}`, CALLBACK.TOUR_OPEN + t.id),
      ]);

      // Faqat Admin / Super Admin o'chirishi mumkin
      if (ctx.state.role === ROLES.SUPER_ADMIN || ctx.state.role === ROLES.ADMIN) {
        rows[rows.length - 1].push(
          Markup.button.callback('🗑', CALLBACK.TOUR_DELETE + t.id)
        );
      }
    });

    if (tours.length > 10) {
      rows.push([
        Markup.button.callback(`📋 Yana ${tours.length - 10} ta...`, CALLBACK.ADMIN_TOURNAMENTS),
      ]);
    }

    rows.push([Markup.button.callback('➕ Yangi turnir', CALLBACK.TOUR_CREATE)]);
    rows.push([Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]);

    await safeEdit(
      ctx,
      `🏆 <b>Turnirlar (${tours.length})</b>\n\n` +
        `📂 — turnirni ochish\n` +
        (canManageUsers(ctx.state.role) ? `🗑 — o'chirish\n` : '') +
        `\n<i>Eng oxirgi 10 ta</i>`,
      { reply_markup: { inline_keyboard: rows } }
    );
  });

  // ============================================================
  // 6. HOSTLAR — Admin + Organizer
  // ============================================================
  bot.action(CALLBACK.ADMIN_HOSTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const hosts = await roleService.list('host');

    // Har bir hostning username'ini olishga harakat
    const hostsWithNames = [];
    for (const h of hosts.slice(0, 20)) {
      const u = await userService.getUser(h.id);
      const name = u ? displayName(u) : `ID: ${h.id}`;
      hostsWithNames.push(`• <code>${h.id}</code> — ${escapeHtml(name)}`);
    }

    const text =
      `🎙 <b>Hostlar (${hosts.length})</b>\n\n` +
      (hosts.length === 0
        ? "<i>Hozircha hostlar yo'q</i>"
        : hostsWithNames.join('\n'));

    // Admin uchun to'liq keyboard, Organizer uchun faqat orqaga
    const kb =
      ctx.state.role === ROLES.ADMIN || ctx.state.role === ROLES.SUPER_ADMIN
        ? roleManageKeyboard('host')
        : organizerHostsKeyboard();

    await safeEdit(ctx, text, kb);
  });

  // ============================================================
  // 7. ADMINLAR — Faqat Admin/Super Admin
  // ============================================================
  bot.action(CALLBACK.ADMIN_ADMINS, async (ctx) => {
    await safeAnswer(ctx);
    if (!canManageUsers(ctx.state.role)) {
      return ctx.reply('⛔ Faqat Admin.');
    }

    const admins = await roleService.list('admin');
    const text =
      `🛡 <b>Adminlar (${admins.length})</b>\n\n` +
      (admins.length === 0
        ? "<i>Hozircha adminlar yo'q (faqat Super Admin)</i>"
        : admins.map((a) => `• <code>${a.id}</code>`).join('\n'));

    await safeEdit(ctx, text, roleManageKeyboard('admin'));
  });

  // ============================================================
  // 8. ORGANIZERLAR — Ko'rish hamma, qo'shish/o'chirish faqat Admin
  // ============================================================
  bot.action(CALLBACK.ADMIN_ORGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const orgs = await roleService.list('organizer');

    const orgsWithNames = [];
    for (const o of orgs.slice(0, 20)) {
      const u = await userService.getUser(o.id);
      const name = u ? displayName(u) : `ID: ${o.id}`;
      orgsWithNames.push(`• <code>${o.id}</code> — ${escapeHtml(name)}`);
    }

    const text =
      `🎯 <b>Organizerlar (${orgs.length})</b>\n\n` +
      (orgs.length === 0
        ? "<i>Hozircha organizerlar yo'q</i>"
        : orgsWithNames.join('\n'));

    const kb =
      ctx.state.role === ROLES.ADMIN || ctx.state.role === ROLES.SUPER_ADMIN
        ? roleManageKeyboard('organizer')
        : organizerOrgsKeyboard();

    await safeEdit(ctx, text, kb);
  });

  // ============================================================
  // 9. ROL QO'SHISH — Admin + Organizer (host), Admin (org)
  // ============================================================
  bot.action(/^admin:addrole:(admin|organizer|host)$/, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.match[1];

    // Admin qo'shish
    if (role === 'admin') {
      if (!canManageAdmins(ctx.state.role)) {
        const settings = await settingsService.getSettings();
        if (!(ctx.state.role === ROLES.ADMIN && settings.allowAdminAddAdmin)) {
          return ctx.reply("⛔ Faqat Super Admin admin qo'sha oladi.");
        }
      }
    }

    // Organizer qo'shish — faqat Admin/Super Admin
    if (role === 'organizer') {
      if (!canManageUsers(ctx.state.role)) {
        return ctx.reply("⛔ Faqat Admin organizer qo'sha oladi.");
      }
    }

    // Host qo'shish — Admin + Organizer
    if (role === 'host') {
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
        return ctx.reply("⛔ Ruxsat yo'q.");
      }
    }

    ctx.session = { state: STATES.ADMIN_ADD_USER_ID, data: { role } };
    await ctx.reply(
      `➕ Yangi <b>${role}</b> Telegram ID sini yuboring:\n\n` +
        `<i>Masalan: 123456789</i>\n\n` +
        `<i>ID ni @userinfobot dan olishingiz mumkin.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 10. ROL O'CHIRISH — Admin + Organizer (host), Admin (org/admin)
  // ============================================================
  bot.action(/^admin:delrole:(admin|organizer|host)$/, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.match[1];

    if (role === 'admin') {
      if (!canManageAdmins(ctx.state.role)) {
        return ctx.reply("⛔ Faqat Super Admin adminni o'chira oladi.");
      }
    }

    if (role === 'organizer') {
      if (!canManageUsers(ctx.state.role)) {
        return ctx.reply("⛔ Faqat Admin organizer o'chira oladi.");
      }
    }

    if (role === 'host') {
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
        return ctx.reply("⛔ Ruxsat yo'q.");
      }
    }

    ctx.session = { state: STATES.ADMIN_ADD_USER_ID, data: { role, remove: true } };
    await ctx.reply(
      `➖ O'chiriladigan <b>${role}</b> Telegram ID sini yuboring:`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 11. SOZLAMALAR — Faqat Super Admin
  // ============================================================
  bot.action(CALLBACK.ADMIN_SETTINGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!canEditSettings(ctx.state.role)) {
      return ctx.reply('⛔ Faqat Super Admin.');
    }

    const s = await settingsService.getSettings();
    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `Admin Admin qo'sha oladimi: ${s.allowAdminAddAdmin ? '✅' : '❌'}`,
          'admin:toggle:allowAdminAddAdmin'
        ),
      ],
      [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
    ]);

    await safeEdit(
      ctx,
      `⚙️ <b>Sozlamalar</b>\n\n` +
        `👥 Min a'zolar: <b>${s.minTeamMembers}</b>\n` +
        `👥 Max a'zolar: <b>${s.maxTeamMembers}</b>\n` +
        `🏆 Max komandalar: <b>${s.maxTeamsPerTournament}</b>`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action(/^admin:toggle:(.+)$/, async (ctx) => {
    if (!canEditSettings(ctx.state.role)) {
      return safeAnswer(ctx, "⛔ Ruxsat yo'q");
    }
    const key = ctx.match[1];
    const s = await settingsService.getSettings();
    await settingsService.updateSettings({ [key]: !s[key] });
    await safeAnswer(ctx, '✅ Yangilandi');

    const s2 = await settingsService.getSettings();
    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `Admin Admin qo'sha oladimi: ${s2.allowAdminAddAdmin ? '✅' : '❌'}`,
          'admin:toggle:allowAdminAddAdmin'
        ),
      ],
      [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
    ]);
    await safeEdit(
      ctx,
      `⚙️ <b>Sozlamalar</b>\n\n` +
        `👥 Min a'zolar: <b>${s2.minTeamMembers}</b>\n` +
        `👥 Max a'zolar: <b>${s2.maxTeamMembers}</b>\n` +
        `🏆 Max komandalar: <b>${s2.maxTeamsPerTournament}</b>`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 12. REKLAMA YUBORISH — Admin + Organizer
  // ============================================================
  bot.action(CALLBACK.ADMIN_BROADCAST, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tours = await tournamentService.getAllTournaments();
    const rows = tours.slice(0, 15).map((t) => [
      Markup.button.callback(`📢 ${t.title.slice(0, 25)}`, CALLBACK.TOUR_BROADCAST + t.id),
    ]);
    rows.push([Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)]);

    await safeEdit(ctx, '📢 <b>Reklama yuborish</b>\n\nTurnirni tanlang:', {
      reply_markup: { inline_keyboard: rows },
    });
  });

  bot.action(/^tour:bc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const t = await tournamentService.getTournament(ctx.match[1]);
    if (!t) return ctx.reply('❗ Topilmadi.');

    const caption =
      `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
      `📅 ${t.date} | ⏰ ${t.startTime}\n` +
      `🎮 ${escapeHtml(t.mode)} | 🗺 ${escapeHtml(t.map || 'Erangel')}\n` +
      `👥 ${t.registeredTeams.length}/${t.maxTeams}\n` +
      (t.description ? `\n📄 ${escapeHtml(t.description)}\n` : '') +
      `\nRo'yxatdan o'tish uchun turnirga kiring!`;

    const button = Markup.button.url(
      '🎮 Turnirga kirish',
      `https://t.me/${config.BOT_USERNAME}?start=${t.id}`
    );

    await ctx.reply('⏳ Reklama yuborilmoqda...');
    const res = await broadcastService.broadcastToAllUsers(bot, {
      image: t.imageFileId,
      caption,
      button,
    });

    await safeEdit(
      ctx,
      `✅ <b>Reklama yuborildi</b>\n\n` +
        `📌 Jami: <b>${res.total}</b>\n` +
        `✅ Muvaffaqiyatli: <b>${res.sent}</b>\n` +
        `❌ Xato: <b>${res.failed}</b>`,
      adminPanel(ctx.state.role)
    );
  });

  // ============================================================
  // 13. FSM — ROL QO'SHISH/O'CHIRISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.ADMIN_ADD_USER_ID) return next();

    const { role, remove } = ctx.session.data;

    // Ruxsatni qayta tekshirish
    if (role === 'admin' && !canManageAdmins(ctx.state.role)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    if (role === 'organizer' && !canManageUsers(ctx.state.role)) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("⛔ Ruxsat yo'q.");
    }
    if (role === 'host' && !hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    const v = cleanText(ctx.message.text, 20);
    if (!isPositiveInt(v)) {
      return ctx.reply('❗ Faqat raqamli Telegram ID:');
    }
    const targetId = Number(v);
    ctx.session = { state: null, data: {} };

    try {
      if (remove) {
        // Super Admin'ni o'chirib bo'lmaydi
        if (targetId === Number(config.SUPER_ADMIN_ID)) {
          return ctx.reply("⛔ Super Admin'ni o'chirib bo'lmaydi.");
        }

        await roleService.remove(role, targetId);
        await ctx.reply(
          `✅ <b>${role}</b> o'chirildi: <code>${targetId}</code>`,
          { parse_mode: 'HTML' }
        );
      } else {
        await roleService.add(role, targetId, ctx.from.id);
        await ctx.reply(
          `✅ <b>${role}</b> qo'shildi: <code>${targetId}</code>`,
          { parse_mode: 'HTML' }
        );

        // Yangi rol egasiga xabar
        try {
          await ctx.telegram.sendMessage(
            targetId,
            `🎉 Sizga <b>${role}</b> roli berildi!\n\n` +
              `Botni qayta ishga tushirish uchun /start bosing.`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    } catch (e) {
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });
};