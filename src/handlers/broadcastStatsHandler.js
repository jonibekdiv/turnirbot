// ============================================================
// BROADCAST STATS HANDLER — Reklama statistikasi (#17)
// ============================================================
const { Markup } = require('telegraf');
const broadcastStatsService = require('../services/broadcastStatsService');
const userService = require('../services/userService');
const { CALLBACK, ROLES } = require('../constants');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
  displayName,
} = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // STATISTIKA UMUMIY KO'RINISH
  // ============================================================
  bot.action(CALLBACK.ADMIN_BC_STATS, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply("⛔ Ruxsat yo'q.");
    }

    try {
      const summary = await broadcastStatsService.getSummary();
      const recent = await broadcastStatsService.getBroadcastStats(5);

      const successRate =
        summary.totalTargets > 0
          ? ((summary.totalSent / summary.totalTargets) * 100).toFixed(1)
          : 0;

      const lines = [`📊 <b>REKLAMA STATISTIKASI</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      lines.push(`📢 <b>Jami reklamalar:</b> <b>${summary.total}</b>`);
      lines.push(`📤 <b>Yuborilgan:</b> <b>${summary.totalSent}</b>`);
      lines.push(`❌ <b>Xato:</b> <b>${summary.totalFailed}</b>`);
      lines.push(`🚫 <b>Bloklagan:</b> <b>${summary.totalBlocked}</b>`);
      lines.push(`👥 <b>Jami nishonlar:</b> <b>${summary.totalTargets}</b>`);
      lines.push(`📈 <b>Samaradorlik:</b> <b>${successRate}%</b>`);
      lines.push('');

      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      if (recent.length) {
        lines.push(`📋 <b>Oxirgi ${recent.length} ta reklama:</b>`);
        lines.push('');

        recent.forEach((b, i) => {
          const date = new Date(b.startedAt).toLocaleString('uz-UZ');
          const rate =
            b.totalTargets > 0
              ? ((b.sent / b.totalTargets) * 100).toFixed(0)
              : 0;
          const status = b.finishedAt ? '✅' : '⏳';

          lines.push(
            `${status} <b>${i + 1}. ${escapeHtml(b.title || b.type)}</b>\n` +
              `   📅 ${date}\n` +
              `   📤 ${b.sent}/${b.totalTargets} (${rate}%)`
          );
          lines.push('');
        });
      } else {
        lines.push('<i>Hozircha reklamalar yo\'q</i>');
      }

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📋 Barcha reklamalar',
            CALLBACK.ADMIN_BC_STATS_LIST
          ),
        ],
        [Markup.button.callback('🔄 Yangilash', CALLBACK.ADMIN_BC_STATS)],
        [Markup.button.callback('⬅️ Admin panel', CALLBACK.ADMIN_PANEL)],
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
      console.error('bc:stats xatosi:', e.message);
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });

  // ============================================================
  // BARCHA REKLAMALAR RO'YXATI
  // ============================================================
  bot.action(CALLBACK.ADMIN_BC_STATS_LIST, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    try {
      const list = await broadcastStatsService.getBroadcastStats(20);

      if (!list.length) {
        const kb = Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Orqaga', CALLBACK.ADMIN_BC_STATS)],
        ]);
        return ctx.editMessageText("📭 <b>Reklamalar yo'q</b>", {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }

      const lines = [`📋 <b>Reklamalar (${list.length})</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      const rows = [];

      list.forEach((b, i) => {
        const date = new Date(b.startedAt).toLocaleString('uz-UZ');
        const status = b.finishedAt ? '✅' : '⏳';
        const rate =
          b.totalTargets > 0
            ? ((b.sent / b.totalTargets) * 100).toFixed(0)
            : 0;

        lines.push(
          `${status} <b>${i + 1}. ${escapeHtml(b.title || b.type)}</b>\n` +
            `   📅 ${date}\n` +
            `   📤 ${b.sent}/${b.totalTargets} (${rate}%) | ❌ ${b.failed}`
        );
        lines.push('');

        rows.push([
          Markup.button.callback(
            `${status} #${i + 1} — ${(b.title || b.type).slice(0, 22)}`,
            CALLBACK.ADMIN_BC_STATS_VIEW + b.id
          ),
        ]);
      });

      rows.push([Markup.button.callback('⬅️ Orqaga', CALLBACK.ADMIN_BC_STATS)]);

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
      console.error('bc:stats_list xatosi:', e.message);
    }
  });

  // ============================================================
  // BITTA REKLAMA STATISTIKASI
  // ============================================================
  bot.action(/^bcs:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    try {
      const bcId = ctx.match[1];
      const bc = await broadcastStatsService.getBroadcast(bcId);

      if (!bc) {
        return ctx.reply("❗ Reklama topilmadi.");
      }

      const admin = await userService.getUser(bc.adminId);
      const adminName = admin
        ? displayName(admin)
        : `ID: ${bc.adminId}`;

      const startedAt = new Date(bc.startedAt).toLocaleString('uz-UZ');
      const finishedAt = bc.finishedAt
        ? new Date(bc.finishedAt).toLocaleString('uz-UZ')
        : '<i>Davom etmoqda</i>';

      const successRate =
        bc.totalTargets > 0
          ? ((bc.sent / bc.totalTargets) * 100).toFixed(1)
          : 0;

      const duration = bc.durationMs
        ? `${(bc.durationMs / 1000).toFixed(1)} sekund`
        : '—';

      const typeLabels = {
        all: '📢 Barcha foydalanuvchilar',
        tournament: '🏆 Turnir ishtirokchilari',
        custom: '📝 Maxsus matn',
      };

      const text =
        `╔══════════════════════╗\n` +
        `   📊 <b>REKLAMA HISOBOTI</b>\n` +
        `╚══════════════════════╝\n\n` +
        `📌 <b>${escapeHtml(bc.title || 'Sarlavhasiz')}</b>\n` +
        `📂 Turi: <b>${typeLabels[bc.type] || bc.type}</b>\n` +
        `👤 Admin: <b>${escapeHtml(adminName)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📅 Boshlangan: <b>${startedAt}</b>\n` +
        `📅 Tugagan: <b>${finishedAt}</b>\n` +
        `⏱ Davomiylik: <b>${duration}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📤 Yuborilgan: <b>${bc.sent}</b>\n` +
        `❌ Xato: <b>${bc.failed}</b>\n` +
        `🚫 Bloklagan: <b>${bc.blocked || 0}</b>\n` +
        `👥 Jami nishonlar: <b>${bc.totalTargets}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📈 <b>Samaradorlik: ${successRate}%</b>`;

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⬅️ Orqaga',
            CALLBACK.ADMIN_BC_STATS_LIST
          ),
        ],
      ]);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      } catch (e) {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }
    } catch (e) {
      console.error('bcs:v xatosi:', e.message);
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });

  // ============================================================
  // STATISTIKANI TOZALASH (SUPER ADMIN)
  // ============================================================
  bot.action('bcs:clear', async (ctx) => {
    await safeAnswer(ctx);

    if (ctx.state.role !== ROLES.SUPER_ADMIN) {
      return ctx.reply("⛔ Faqat Super Admin.");
    }

    try {
      const store = require('../storage/jsonStore');
      await store.update('broadcast_stats.json', (data) => {
        data.broadcasts = {};
      });

      await ctx.reply("✅ Reklama statistikasi tozalandi.");
    } catch (e) {
      console.error('bcs:clear xatosi:', e.message);
      await ctx.reply("❌ Xatolik yuz berdi.");
    }
  });
};