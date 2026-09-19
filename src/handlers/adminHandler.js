const { Markup } = require('telegraf');
const userService = require('../services/userService');
const teamService = require('../services/teamService');
const tournamentService = require('../services/tournamentService');
const roleService = require('../services/roleService');
const broadcastService = require('../services/broadcastService');
const settingsService = require('../services/settingsService');
const { adminPanel, roleManageKeyboard } = require('../keyboards/adminKeyboard');
const { mainKeyboard } = require('../keyboards/mainKeyboard');
const { CALLBACK, ROLES, STATES, LIMITS } = require('../constants');
const { escapeHtml, displayName, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // 1. ADMIN PANEL
  // ============================================================
  bot.action(CALLBACK.MENU_ADMIN, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply('⛔ Ruxsat yo\'q.');
    }
    await safeEdit(ctx, '🛠 <b>Admin panel</b>', adminPanel());
  });

  bot.action(CALLBACK.ADMIN_PANEL, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply('⛔ Ruxsat yo\'q.');
    }
    await safeEdit(ctx, '🛠 <b>Admin panel</b>', adminPanel());
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

    const active = users.filter((u) => u.status === 'active').length;
    const today = users.filter(
      (u) => new Date(u.createdAt).toDateString() === new Date().toDateString()
    ).length;

    const text =
      `📊 <b>Statistika</b>\n\n` +
      `👤 Jami foydalanuvchilar: <b>${users.length}</b>\n` +
      `🟢 Aktiv: <b>${active}</b>\n` +
      `📅 Bugun qo'shilgan: <b>${today}</b>\n\n` +
      `👥 Komandalar: <b>${teams.length}</b>\n` +
      `🏆 Turnirlar: <b>${tours.length}</b>\n` +
      `🔥 Faol turnirlar: <b>${tours.filter((t) => t.status === 'open').length}</b>\n` +
      `🎙 Hostlar: <b>${hosts.length}</b>`;

    await safeEdit(ctx, text, adminPanel());
  });

  // ============================================================
  // 3. FOYDALANUVCHILAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_USERS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const users = await userService.getAllUsers();
    const sliced = users.slice(0, 30);
    const text =
      `👤 <b>Foydalanuvchilar (${users.length})</b>\n\n` +
      sliced
        .map((u, i) => `${i + 1}. ${escapeHtml(displayName(u))} — <code>${u.id}</code>`)
        .join('\n') +
      (users.length > 30 ? `\n\n<i>... va yana ${users.length - 30} ta</i>` : '');

    await safeEdit(ctx, text, adminPanel());
  });

  // ============================================================
  // 4. KOMANDALAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_TEAMS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const teams = await teamService.getAllTeams();
    const text =
      `👥 <b>Komandalar (${teams.length})</b>\n\n` +
      (teams.length === 0
        ? '<i>Hozircha komandalar yo\'q</i>'
        : teams
            .slice(0, 30)
            .map(
              (t, i) =>
                `${i + 1}. <b>${escapeHtml(t.name)}</b> [${escapeHtml(t.tag)}] — ${t.members.length} a'zo`
            )
            .join('\n')) +
      (teams.length > 30 ? `\n\n<i>... va yana ${teams.length - 30} ta</i>` : '');

    await safeEdit(ctx, text, adminPanel());
  });

  // ============================================================
  // 5. TURNIRLAR — RO'YXAT + O'CHIRISH
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
    // Har bir turnir uchun 2 ta tugma: ochish va o'chirish
    tours.slice(0, 10).forEach((t) => {
      const titleShort = t.title.length > 20 ? t.title.slice(0, 17) + '...' : t.title;
      const status = t.registeredTeams.length >= t.maxTeams ? '🔴' : '🟢';

      rows.push([
        Markup.button.callback(
          `📂 ${titleShort} ${status}`,
          CALLBACK.TOUR_OPEN + t.id
        ),
        Markup.button.callback(
          '🗑',
          CALLBACK.TOUR_DELETE + t.id
        ),
      ]);
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
        `🗑 — turnirni o'chirish\n\n` +
        `<i>Eng oxirgi 10 ta ko'rsatilgan</i>`,
      { reply_markup: { inline_keyboard: rows } }
    );
  });

  // ============================================================
  // 6. TURNIRNI O'CHIRISH — TASDIQLASH
  // ============================================================
  bot.action(/^tour:del:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply('⛔ Ruxsat yo\'q.');
    }

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) {
      return ctx.reply('❗ Turnir topilmadi.');
    }

    const hostInfo = t.hostId ? `🎙 Host: <code>${t.hostId}</code>\n` : '';
    const teamsInfo = t.registeredTeams.length
      ? `👥 Komandalar: <b>${t.registeredTeams.length}</b>\n`
      : '';

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🗑 Ha, o\'chirish',
          CALLBACK.TOUR_DELETE_CONFIRM + t.id
        ),
        Markup.button.callback('❌ Bekor qilish', CALLBACK.ADMIN_TOURNAMENTS),
      ],
    ]);

    await safeEdit(
      ctx,
      `╔══════════════════════╗\n` +
        `   ⚠️ <b>TASDIQLASH</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🗑 <b>Turnirni o'chirmoqchimisiz?</b>\n\n` +
        `🏆 Nom: <b>${escapeHtml(t.title)}</b>\n` +
        `🆔 ID: <code>${t.id}</code>\n` +
        `📅 Sana: <b>${t.date}</b>\n` +
        `⏰ Vaqt: <b>${t.startTime}</b>\n` +
        `🎮 Rejim: <b>${escapeHtml(t.mode)}</b>\n` +
        teamsInfo +
        hostInfo +
        `\n⚠️ <i>Bu amalni qaytarib bo'lmaydi!</i>\n` +
        `Turnir va uning barcha ma'lumotlari o'chiriladi.`,
      { reply_markup: kb.reply_markup }
    );
  });

  // ============================================================
  // 7. TURNIRNI O'CHIRISH — BAJARISH
  // ============================================================
  bot.action(/^tour:delc:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply('⛔ Ruxsat yo\'q.');
    }

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) {
      return ctx.reply('❗ Turnir allaqachon o\'chirilgan.');
    }

    const title = t.title;
    const hostId = t.hostId;
    const teamCount = t.registeredTeams.length;

    try {
      // Turnirni o'chirish
      await tournamentService.deleteTournament(tId);

      // Hostga xabar
      if (hostId) {
        try {
          await ctx.telegram.sendMessage(
            hostId,
            `⚠️ <b>Turnir o'chirildi</b>\n\n` +
              `🏆 <b>${escapeHtml(title)}</b>\n\n` +
              `<i>Admin tomonidan o'chirildi.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) { /* host bloklagan */ }
      }

      // Adminga xabar
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Turnirlar ro\'yxati', CALLBACK.ADMIN_TOURNAMENTS)],
        [Markup.button.callback('🏠 Admin panel', CALLBACK.ADMIN_PANEL)],
      ]);

      await safeEdit(
        ctx,
        `╔══════════════════════╗\n` +
          `   ✅ <b>O'CHIRILDI</b>\n` +
          `╚══════════════════════╝\n\n` +
          `🗑 <b>${escapeHtml(title)}</b> turniri o'chirildi.\n\n` +
          (teamCount ? `👥 ${teamCount} ta komanda ro'yxatdan o'tgan edi\n` : '') +
          (hostId ? `🎙 Hostga xabar yuborildi\n` : ''),
        { reply_markup: kb.reply_markup }
      );
    } catch (e) {
      await ctx.reply('❌ O\'chirishda xatolik: ' + (e.message || 'xato'));
    }
  });

  // ============================================================
  // 8. HOSTLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_HOSTS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const hosts = await roleService.list('host');
    const text =
      `🎙 <b>Hostlar (${hosts.length})</b>\n\n` +
      (hosts.length === 0
        ? '<i>Hozircha hostlar yo\'q</i>'
        : hosts.map((h) => `• <code>${h.id}</code>`).join('\n'));

    await safeEdit(ctx, text, roleManageKeyboard('host'));
  });

  // ============================================================
  // 9. ADMINLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_ADMINS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const admins = await roleService.list('admin');
    const text =
      `🛡 <b>Adminlar (${admins.length})</b>\n\n` +
      (admins.length === 0
        ? '<i>Hozircha adminlar yo\'q (faqat Super Admin)</i>'
        : admins.map((a) => `• <code>${a.id}</code>`).join('\n'));

    await safeEdit(ctx, text, roleManageKeyboard('admin'));
  });

  // ============================================================
  // 10. ORGANIZERLAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_ORGS, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const orgs = await roleService.list('organizer');
    const text =
      `🎯 <b>Organizerlar (${orgs.length})</b>\n\n` +
      (orgs.length === 0
        ? '<i>Hozircha organizerlar yo\'q</i>'
        : orgs.map((o) => `• <code>${o.id}</code>`).join('\n'));

    await safeEdit(ctx, text, roleManageKeyboard('organizer'));
  });

  // ============================================================
  // 11. ROL QO'SHISH
  // ============================================================
  bot.action(/^admin:addrole:(admin|organizer|host)$/, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.match[1];

    if (role === 'admin' && ctx.state.role !== ROLES.SUPER_ADMIN) {
      const s = await settingsService.getSettings();
      if (!s.allowAdminAddAdmin) {
        return ctx.reply('⛔ Faqat Super Admin admin qo\'sha oladi.');
      }
    }
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.ADMIN_ADD_USER_ID, data: { role } };
    await ctx.reply(
      `➕ Yangi <b>${role}</b> Telegram ID sini yuboring:`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 12. ROL O'CHIRISH
  // ============================================================
  bot.action(/^admin:delrole:(admin|organizer|host)$/, async (ctx) => {
    await safeAnswer(ctx);
    const role = ctx.match[1];

    if (role === 'admin' && ctx.state.role !== ROLES.SUPER_ADMIN) {
      return ctx.reply('⛔ Faqat Super Admin adminni o\'chira oladi.');
    }
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.ADMIN_ADD_USER_ID, data: { role, remove: true } };
    await ctx.reply(
      `➖ O'chiriladigan <b>${role}</b> Telegram ID sini yuboring:`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // 13. SOZLAMALAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_SETTINGS, async (ctx) => {
    await safeAnswer(ctx);
    if (ctx.state.role !== ROLES.SUPER_ADMIN) {
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
    if (ctx.state.role !== ROLES.SUPER_ADMIN) {
      return safeAnswer(ctx, '⛔ Ruxsat yo\'q');
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
  // 14. REKLAMA YUBORISH
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
      `https://t.me/${config.BOT_USERNAME}?start=tour_${t.id}`
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
      adminPanel()
    );
  });

  // ============================================================
  // 15. FSM — ROL QO'SHISH/O'CHIRISH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== STATES.ADMIN_ADD_USER_ID) return next();

    const { role, remove } = ctx.session.data;
    const v = cleanText(ctx.message.text, 20);
    if (!isPositiveInt(v)) {
      return ctx.reply('❗ Faqat raqamli Telegram ID:');
    }
    const targetId = Number(v);
    ctx.session = { state: null, data: {} };

    try {
      if (remove) {
        await roleService.remove(role, targetId);
        await ctx.reply(
          `✅ ${role} o'chirildi: <code>${targetId}</code>`,
          { parse_mode: 'HTML' }
        );
      } else {
        await roleService.add(role, targetId, ctx.from.id);
        await ctx.reply(
          `✅ ${role} qo'shildi: <code>${targetId}</code>`,
          { parse_mode: 'HTML' }
        );

        try {
          await ctx.telegram.sendMessage(
            targetId,
            `🎉 Sizga <b>${role}</b> roli berildi!\n\nBotni qayta ishga tushirish uchun /start bosing.`,
            { parse_mode: 'HTML' }
          );
        } catch (e) { /* bloklangan */ }
      }
    } catch (e) {
      await ctx.reply('❌ Xatolik: ' + (e.message || 'xato'));
    }
  });
};