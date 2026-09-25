// ============================================================
// PROMO HANDLER — Promo kodlar (3 tilda)
// ============================================================
const { Markup } = require('telegraf');
const promoService = require('../services/promoService');
const { CALLBACK, STATES, ROLES, LIMITS } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer } = require('../utils/telegramUtils');
const { cleanText, isPositiveInt } = require('../utils/validation');
const { hasAnyRole } = require('../middlewares/roleGuard');

function backToAdmin(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // 1. PROMO MENYU
  // ============================================================
  bot.action(CALLBACK.PROMO_MENU, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(`⛔ ${t('error_access')}`);
    }

    const all = await promoService.getAllPromos();
    const active = all.filter((p) => p.active).length;
    const totalUses = all.reduce((s, p) => s + (p.usedCount || 0), 0);

    const text =
      `╔══════════════════════╗\n` +
      `   🎫 <b>${t('promo_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `📊 ${t('promo_total_codes')}: <b>${all.length}</b>\n` +
      `✅ ${t('promo_active_codes')}: <b>${active}</b>\n` +
      `🎯 ${t('promo_total_uses')}: <b>${totalUses}</b>\n\n` +
      `👇 ${t('admin_panel_subtitle')}`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(t('promo_create'), CALLBACK.PROMO_CREATE)],
      [Markup.button.callback(`${t('promo_list')} (${all.length})`, CALLBACK.PROMO_LIST)],
      [Markup.button.callback(t('promo_stats'), CALLBACK.PROMO_STATS)],
      [Markup.button.callback(t('admin_panel'), CALLBACK.ADMIN_PANEL)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // ============================================================
  // 2. RO'YXAT
  // ============================================================
  bot.action(CALLBACK.PROMO_LIST, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const all = await promoService.getAllPromos();

    if (!all.length) {
      return safeEdit(ctx, `📭 ${t('promo_no_promotions')}`, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t('promo_create'), CALLBACK.PROMO_CREATE)],
            [Markup.button.callback(t('btn_back'), CALLBACK.PROMO_MENU)],
          ],
        },
      });
    }

    const lines = [`🎫 <b>${t('promo_list')} (${all.length})</b>`, '', '━━━━━━━━━━━━━━━━━━━━', ''];
    const rows = [];

    all.slice(0, 20).forEach((p) => {
      const status = p.active ? '✅' : '⏸';
      const uses = `${p.usedCount || 0}/${p.maxUses}`;
      const typeLabel = promoService.formatType(p);
      const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
      const expiredLabel = expired ? ' ⌛' : '';

      lines.push(
        `${status} <code>${escapeHtml(p.code)}</code>${expiredLabel}\n` +
          `   💰 ${typeLabel}\n` +
          `   📊 ${uses} ${t('promo_used_count')}`
      );
      lines.push('');

      rows.push([
        Markup.button.callback(
          `${status} ${p.code} — ${typeLabel}`,
          CALLBACK.PROMO_VIEW + p.id
        ),
      ]);
    });

    rows.push([Markup.button.callback(t('btn_back'), CALLBACK.PROMO_MENU)]);

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
  // 3. YANGI PROMO BOSHLASH
  // ============================================================
  bot.action(CALLBACK.PROMO_CREATE, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session = { state: STATES.PROMO_CREATE_CODE, data: {} };

    await ctx.reply(
      `➕ <b>${t('promo_create')}</b>\n\n` +
        `📍 ${t('promo_step')} 1/5\n\n` +
        `🎫 <b>${t('promo_q1_code')}</b>\n\n` +
        `<i>${t('promo_code_example')}</i>\n` +
        `<i>${LIMITS.PROMO_CODE_MIN}-${LIMITS.PROMO_CODE_MAX}</i>`,
      { parse_mode: 'HTML', reply_markup: backToAdmin(t).reply_markup }
    );
  });

  // ============================================================
  // 4. TURI TANLASH
  // ============================================================
  bot.action(/^promo:t:(percent|fixed|free)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data?.code) return;

    const type = ctx.match[1];
    ctx.session.data.type = type;

    if (type === 'free') {
      ctx.session.data.value = 0;
      ctx.session.state = STATES.PROMO_CREATE_MAX_USES;
      return ctx.reply(
        `🎁 <b>${t('promo_type_free')}</b>\n\n📍 ${t('promo_step')} 4/5\n\n` +
          `📊 <b>${t('promo_q4_max')}</b>\n\n<i>${t('promo_max_uses_example') || '100'}</i>`,
        { parse_mode: 'HTML', reply_markup: backToAdmin(t).reply_markup }
      );
    }

    ctx.session.state =
      type === 'percent' ? STATES.PROMO_CREATE_PERCENT : STATES.PROMO_CREATE_AMOUNT;

    await ctx.reply(
      type === 'percent'
        ? `💰 <b>${t('promo_type_percent')}</b>\n\n📍 ${t('promo_step')} 3/5\n\n<b>${t('promo_q3_value')}</b> (1-100)\n\n<i>${t('promo_amount_example') || '50'}</i>`
        : `💰 <b>${t('promo_type_fixed')}</b>\n\n📍 ${t('promo_step')} 3/5\n\n<b>${t('promo_q3_value')}</b>\n\n<i>${t('promo_amount_example') || '25000'}</i>`,
      { parse_mode: 'HTML', reply_markup: backToAdmin(t).reply_markup }
    );
  });

  // ============================================================
  // 5. PROMO KO'RISH
  // ============================================================
  bot.action(/^promo:v:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const promo = await promoService.getPromo(ctx.match[1]);
    if (!promo) return ctx.reply(t('promo_not_found'));

    const stats = await promoService.getPromoStats(promo.id);
    const typeLabel = promoService.formatType(promo);
    const expired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
    const statusLabel = promo.active
      ? expired
        ? t('promo_status_expired')
        : t('promo_status_active')
      : t('promo_status_inactive');

    const text =
      `╔══════════════════════╗\n` +
      `   🎫 <b>${t('promo_view_title')}</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🎫 ${t('promo_code')}: <code>${escapeHtml(promo.code)}</code>\n` +
      `💰 ${t('promo_type_label')}: <b>${typeLabel}</b>\n` +
      `📊 ${t('promo_used')}: <b>${promo.usedCount}/${promo.maxUses}</b>\n` +
      `📅 ${t('promo_created_by')}: ${new Date(promo.createdAt).toLocaleDateString('uz-UZ')}\n` +
      (promo.expiresAt
        ? `⏰ ${t('promo_expires_prompt')}: <b>${new Date(promo.expiresAt).toLocaleDateString('uz-UZ')}</b>${expired ? ' ⌛' : ''}\n`
        : '') +
      `⚡ ${t('promo_status_label')}: <b>${statusLabel}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 ${t('wallet_pay_saved')}: <b>${stats.totalDiscount.toLocaleString()}</b>`;

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          promo.active ? t('promo_active_no') : t('promo_active_yes'),
          CALLBACK.PROMO_TOGGLE + promo.id
        ),
      ],
      [Markup.button.callback(t('promo_delete'), CALLBACK.PROMO_DELETE + promo.id)],
      [Markup.button.callback(t('btn_back'), CALLBACK.PROMO_LIST)],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
  });

  // TOGGLE
  bot.action(/^promo:toggle:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const promoId = ctx.match[1];
    await promoService.toggleActive(promoId);
    await ctx.reply(`✅ ${t('promo_toggle')}`, { parse_mode: 'HTML' });
  });

  // DELETE
  bot.action(/^promo:del:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const promo = await promoService.getPromo(ctx.match[1]);
    if (!promo) return;

    await promoService.deletePromo(promo.id);
    await ctx.reply(`✅ <code>${escapeHtml(promo.code)}</code> ${t('promo_deleted')}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[Markup.button.callback(t('btn_back'), CALLBACK.PROMO_LIST)]],
      },
    });
  });

  // ============================================================
  // 6. STATISTIKA
  // ============================================================
  bot.action(CALLBACK.PROMO_STATS, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const all = await promoService.getAllPromos();
    const totalUses = all.reduce((s, p) => s + (p.usedCount || 0), 0);
    const activeCount = all.filter((p) => p.active).length;
    const top = [...all].sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0)).slice(0, 5);

    const lines = [
      `╔══════════════════════╗`,
      `   ${t('promo_stats')}`,
      `╚══════════════════════╝`,
      '',
      `🎫 ${t('promo_total_codes')}: <b>${all.length}</b>`,
      `✅ ${t('promo_active_codes')}: <b>${activeCount}</b>`,
      `⏸ ${t('promo_inactive_codes')}: <b>${all.length - activeCount}</b>`,
      `📊 ${t('promo_total_uses')}: <b>${totalUses}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `🏆 <b>${t('promo_top5')}</b>`,
      '',
    ];

    top.forEach((p, i) => {
      lines.push(`${i + 1}. <code>${escapeHtml(p.code)}</code> — ${p.usedCount}/${p.maxUses}`);
    });

    await safeEdit(ctx, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback(t('btn_back'), CALLBACK.PROMO_MENU)]],
      },
    });
  });

  // ============================================================
  // FSM — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('promo_')) return next();
    const t = ctx.t;

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return next();
    }

    // CODE
    if (s === STATES.PROMO_CREATE_CODE) {
      const raw = cleanText(ctx.message.text, LIMITS.PROMO_CODE_MAX).toUpperCase();
      const code = raw.replace(/[^A-Z0-9]/g, '');
      if (code.length < LIMITS.PROMO_CODE_MIN) {
        return ctx.reply(`❗ ${LIMITS.PROMO_CODE_MIN} ${t('error_only_digits')}`);
      }

      ctx.session.data.code = code;
      ctx.session.state = 'promo_pick_type';

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t('promo_type_percent'), 'promo:t:percent')],
        [Markup.button.callback(t('promo_type_fixed'), 'promo:t:fixed')],
        [Markup.button.callback(t('promo_type_free'), 'promo:t:free')],
        [Markup.button.callback(t('btn_cancel'), CALLBACK.PROMO_MENU)],
      ]);

      return ctx.reply(
        `✅ ${t('promo_code')}: <code>${code}</code>\n\n📍 ${t('promo_step')} 2/5\n\n💰 <b>${t('promo_q2_type')}</b>`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
    }

        // PROMO TYPE TANLASH (tugma kutilmoqda)
    if (s === 'promo_pick_type') {
      return ctx.reply(
        `❗ Iltimos, quyidagi tugmalardan birini tanlang:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(t('promo_type_percent'), 'promo:t:percent')],
              [Markup.button.callback(t('promo_type_fixed'), 'promo:t:fixed')],
              [Markup.button.callback(t('promo_type_free'), 'promo:t:free')],
              [Markup.button.callback(t('btn_cancel'), CALLBACK.PROMO_MENU)],
            ],
          },
        }
      );
    }
    // PERCENT
    if (s === STATES.PROMO_CREATE_PERCENT) {
      const v = cleanText(ctx.message.text, 5);
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);
      const pct = Number(v);
      if (pct < 1 || pct > 100) return ctx.reply(`❗ 1-100`);
      ctx.session.data.value = pct;
      ctx.session.state = STATES.PROMO_CREATE_MAX_USES;
      return ctx.reply(
        `✅ ${t('wallet_pay_saved')}: <b>${pct}%</b>\n\n📍 ${t('promo_step')} 4/5\n\n📊 <b>${t('promo_q4_max')}</b>`,
        { parse_mode: 'HTML', reply_markup: backToAdmin(t).reply_markup }
      );
    }

    // FIXED
    if (s === STATES.PROMO_CREATE_AMOUNT) {
      const v = cleanText(ctx.message.text, 15);
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);
      ctx.session.data.value = Number(v);
      ctx.session.state = STATES.PROMO_CREATE_MAX_USES;
      return ctx.reply(
        `✅ ${t('wallet_pay_saved')}: <b>${Number(v).toLocaleString()}</b>\n\n📍 ${t('promo_step')} 4/5\n\n📊 <b>${t('promo_q4_max')}</b>`,
        { parse_mode: 'HTML', reply_markup: backToAdmin(t).reply_markup }
      );
    }

    // MAX USES
    if (s === STATES.PROMO_CREATE_MAX_USES) {
      const v = cleanText(ctx.message.text, 6);
      if (!isPositiveInt(v)) return ctx.reply(`❗ ${t('error_only_digits')}`);
      ctx.session.data.maxUses = Number(v);
      ctx.session.state = STATES.PROMO_CREATE_EXPIRES;
      return ctx.reply(
        `✅ Max: <b>${v}</b>\n\n📍 ${t('promo_step')} 5/5\n\n📅 <b>${t('promo_expires_prompt')}</b>`,
        { parse_mode: 'HTML', reply_markup: backToAdmin(t).reply_markup }
      );
    }

    // EXPIRES
    if (s === STATES.PROMO_CREATE_EXPIRES) {
      const v = cleanText(ctx.message.text, 20);
      let expiresAt = null;
      if (v.toLowerCase() !== '/skip') {
        const d = new Date(v);
        if (isNaN(d.getTime())) return ctx.reply(`❗ ${t('tour_create_date_format_error')}`);
        expiresAt = d.toISOString();
      }

      const { code, type, value, maxUses } = ctx.session.data;
      try {
        const promo = await promoService.createPromo({
          code,
          type,
          value,
          maxUses,
          expiresAt,
          createdBy: ctx.from.id,
        });

        ctx.session = { state: null, data: {} };

        await ctx.reply(
          `╔══════════════════════╗\n` +
            `   ✅ <b>${t('promo_created')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🎫 ${t('promo_code')}: <code>${escapeHtml(promo.code)}</code>\n` +
            `💰 ${t('promo_type_label')}: ${promoService.formatType(promo)}\n` +
            `📊 ${t('promo_q4_max')}: ${promo.maxUses}\n` +
            (expiresAt ? `⏰ ${t('promo_expires_prompt')}: ${new Date(expiresAt).toLocaleDateString('uz-UZ')}\n` : ''),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback(t('promo_list'), CALLBACK.PROMO_LIST)],
                [Markup.button.callback(t('btn_back'), CALLBACK.PROMO_MENU)],
              ],
            },
          }
        );
      } catch (e) {
        ctx.session = { state: null, data: {} };
        await ctx.reply(`❌ ${e.message}`, backToAdmin(t));
      }
      return;
    }

    return next();
  });
};