// ============================================================
// BROADCAST STATS HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const broadcastStatsService = require('../services/broadcastStatsService');
const userService = require('../services/userService');
const { CALLBACK, ROLES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

module.exports = (bot) => {
  // ============================================================
  // 1. STATISTIKA UMUMIY
  // ============================================================
  bot.action(CALLBACK.ADMIN_BC_STATS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    try {
      const summary = await broadcastStatsService.getSummary();
      const recent = await broadcastStatsService.getBroadcastStats(5);

      const successRate =
        summary.totalTargets > 0
          ? ((summary.totalSent / summary.totalTargets) * 100).toFixed(1)
          : 0;

      const lines = [`📊 <b>${t('bc_stats_title').toUpperCase()}</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      lines.push(`📢 <b>${t('bc_stats_total')}:</b> <b>${summary.total}</b>`);
      lines.push(`📤 <b>${t('bc_stats_sent')}:</b> <b>${summary.totalSent}</b>`);
      lines.push(`❌ <b>${t('bc_stats_failed')}:</b> <b>${summary.totalFailed}</b>`);
      lines.push(`🚫 <b>${t('bc_stats_blocked')}:</b> <b>${summary.totalBlocked}</b>`);
      lines.push(`👥 <b>${t('wallet_admin_total_users')}:</b> <b>${summary.totalTargets}</b>`);
      lines.push(`📈 <b>${t('bc_stats_success_rate')}:</b> <b>${successRate}%</b>`);
      lines.push('');

      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      if (recent.length) {
        lines.push(`📋 <b>${t('bc_stats_recent')} (${recent.length}):</b>`);
        lines.push('');

        recent.forEach((b, i) => {
          const date = new Date(b.startedAt).toLocaleString('uz-UZ');
          const rate =
            b.totalTargets > 0 ? ((b.sent / b.totalTargets) * 100).toFixed(0) : 0;
          const status = b.finishedAt ? '✅' : '⏳';

          lines.push(
            `${status} <b>${i + 1}. ${escapeHtml(b.title || b.type)}</b>\n` +
              `   📅 ${date}\n` +
              `   📤 ${b.sent}/${b.totalTargets} (${rate}%)`
          );
          lines.push('');
        });
      } else {
        lines.push(`<i>${t('bc_stats_recent')} — ${t('no_data')}</i>`);
      }

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('bc_stats_all'), CALLBACK.ADMIN_BC_STATS_LIST)],
        [Markup.button.callback(t('btn_refresh'), CALLBACK.ADMIN_BC_STATS)],
        [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
      ]);

      try {
        await ctx.editMessageText(lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      } catch (e) {
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
    } catch (e) {
      console.error('bc:stats xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });

  // ============================================================
  // 2. BARCHA REKLAMALAR
  // ============================================================
  bot.action(CALLBACK.ADMIN_BC_STATS_LIST, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    try {
      const list = await broadcastStatsService.getBroadcastStats(20);

      if (!list.length) {
        const kb = Markup.inlineKeyboard([
          [Markup.button.callback(t('btn_back'), CALLBACK.ADMIN_BC_STATS)],
        ]);
        return ctx.editMessageText(`📭 <b>${t('no_data')}</b>`, {
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        });
      }

      const lines = [`📋 <b>${t('bc_stats_all')} (${list.length})</b>`, ''];
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');

      const rows = [];

      list.forEach((b, i) => {
        const date = new Date(b.startedAt).toLocaleString('uz-UZ');
        const status = b.finishedAt ? '✅' : '⏳';
        const rate =
          b.totalTargets > 0 ? ((b.sent / b.totalTargets) * 100).toFixed(0) : 0;

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

      rows.push([Markup.button.callback(t('btn_back'), CALLBACK.ADMIN_BC_STATS)]);

      try {
        await ctx.editMessageText(lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: rows },
        });
      } catch (e) {
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
      }
    } catch (e) {
      console.error('bc:stats_list xatosi:', e.message);
    }
  });

  // ============================================================
  // 3. BITTA REKLAMA
  // ============================================================
  bot.action(/^bcs:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    try {
      const bcId = ctx.match[1];
      const bc = await broadcastStatsService.getBroadcast(bcId);

      if (!bc) return ctx.reply(`❗ ${t('error_not_found')}`);

      const admin = await userService.getUser(bc.adminId);
      const adminName = admin ? displayName(admin) : `ID: ${bc.adminId}`;

      const startedAt = new Date(bc.startedAt).toLocaleString('uz-UZ');
      const finishedAt = bc.finishedAt
        ? new Date(bc.finishedAt).toLocaleString('uz-UZ')
        : `<i>${t('wallet_pending')}</i>`;

      const successRate =
        bc.totalTargets > 0 ? ((bc.sent / bc.totalTargets) * 100).toFixed(1) : 0;

      const duration = bc.durationMs
        ? `${(bc.durationMs / 1000).toFixed(1)} sek`
        : '—';

      const typeLabels = {
        all: `📢 ${t('bc_stats_all')}`,
        tournament: `🏆 ${t('admin_tournaments')}`,
        custom: `📝 ${t('support_enter_text')}`,
      };

      const text =
        `╔══════════════════════╗\n` +
        `   📊 <b>${t('bc_stats_title').toUpperCase()}</b>\n` +
        `╚══════════════════════╝\n\n` +
        `📌 <b>${escapeHtml(bc.title || '-')}</b>\n` +
        `📂 ${t('promo_type_label')}: <b>${typeLabels[bc.type] || bc.type}</b>\n` +
        `👤 ${t('admin_users')}: <b>${escapeHtml(adminName)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📅 ${t('date')}: <b>${startedAt}</b>\n` +
        `📅 ${t('date')}: <b>${finishedAt}</b>\n` +
        `⏱ ${t('bc_stats_duration')}: <b>${duration}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📤 ${t('bc_stats_sent')}: <b>${bc.sent}</b>\n` +
        `❌ ${t('bc_stats_failed')}: <b>${bc.failed}</b>\n` +
        `🚫 ${t('bc_stats_blocked')}: <b>${bc.blocked || 0}</b>\n` +
        `👥 ${t('wallet_admin_total_users')}: <b>${bc.totalTargets}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📈 <b>${t('bc_stats_success_rate')}: ${successRate}%</b>`;

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('btn_back'), CALLBACK.ADMIN_BC_STATS_LIST)],
      ]);

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      } catch (e) {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
      }
    } catch (e) {
      console.error('bcs:v xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });

  // ============================================================
  // 4. STATISTIKANI TOZALASH
  // ============================================================
  bot.action('bcs:clear', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (ctx.state.role !== ROLES.SUPER_ADMIN) return ctx.reply(`⛔ ${t('error_only_super')}`);

    try {
      const store = require('../storage/jsonStore');
      await store.update('broadcast_stats.json', (data) => {
        data.broadcasts = {};
      });

      await ctx.reply(`✅ ${t('success')}`);
    } catch (e) {
      console.error('bcs:clear xatosi:', e.message);
      await ctx.reply(`❌ ${t('error_generic')}`);
    }
  });
};