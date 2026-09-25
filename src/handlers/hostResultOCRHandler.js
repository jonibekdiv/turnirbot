// ============================================================
// HOST RESULT OCR HANDLER — Tesseract + qo'lda + jarima
// ============================================================
const { Markup } = require('telegraf');
const ocrService = require('../services/ocrService');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const matchService = require('../services/matchService');
const stageMatchService = require('../services/stageMatchService');
const { PLACEMENT_POINTS, ROLES } = require('../constants');
const { escapeHtml, safeAnswer } = require('../utils/telegramUtils');

function canAccess(role) {
  return [ROLES.HOST, ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(role);
}

module.exports = (bot) => {
  // ============================================================
  // 1. SKRINSHOT REJIMINI BOSHLASH (oddiy turnir)
  // ============================================================
  bot.action(/^host:ocr_start:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    if (!canAccess(ctx.state.role)) return;

    const tId = ctx.match[1];
    const tour = await tournamentService.getTournament(tId);
    if (!tour) return ctx.reply(`❗ ${t('tour_not_found')}`);

    ctx.session = {
      state: 'host_ocr_waiting',
      data: { tid: tId, type: 'tournament' },
    };

    await ctx.reply(
      `📸 <b>Natija skrinshotini yuboring</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <b>Talablar:</b>\n` +
        `• Faqat oddiy jadval ko'rinishida\n` +
        `• Format: <code>#raqam  TAG  kill</code>\n` +
        `• Har bir teg <b>kamida 2 marta</b>\n\n` +
        `⚠️ <b>MUHIM:</b>\n` +
        `<i>Agar skrinshot murakkab bo'lsa (har bir o'yinchi alohida) — OCR o'qiy olmaydi. U holda qo'lda kiriting.</i>\n\n` +
        `💡 <b>Yaxshi skrinshot misoli:</b>\n` +
        `<code>#1 UP 12\n#2 N1 8\n#3 S7 5</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                '✏️ Qo\'lda kiritish',
                'host_ocr_manual_start'
              ),
            ],
            [Markup.button.callback(t('btn_cancel'), `host:open:${tId}`)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 2. SKRINSHOT REJIMINI BOSHLASH (stage match)
  // ============================================================
  bot.action(/^hst:ocr_start:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    if (!canAccess(ctx.state.role)) return;

    const matchId = ctx.match[1];
    const match = await stageMatchService.getMatch(matchId);
    if (!match) return;

    ctx.session = {
      state: 'host_ocr_waiting',
      data: { matchId, type: 'stage_match' },
    };

    await ctx.reply(
      `📸 <b>Natija skrinshotini yuboring</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 <b>Talablar:</b>\n` +
        `• Faqat oddiy jadval ko'rinishida\n` +
        `• Format: <code>#raqam  TAG  kill</code>\n` +
        `• Har bir teg <b>kamida 2 marta</b>\n\n` +
        `⚠️ <i>Murakkab skrinshotda OCR ishlamasligi mumkin. Qo'lda kiritish tugmasi ham mavjud.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                '✏️ Qo\'lda kiritish',
                'host_ocr_manual_start'
              ),
            ],
            [Markup.button.callback(t('btn_cancel'), `hst:m:${matchId}`)],
          ],
        },
      }
    );
  });

  // ============================================================
  // QO'LDA KIRITISHNI BOSHLASH (OCR o'rniga)
  // ============================================================
  bot.action('host_ocr_manual_start', async (ctx) => {
    await safeAnswer(ctx);
    const data = ctx.session?.data;
    if (!data) return;

    ctx.session = {
      state: 'host_ocr_fill_rest_input',
      data: {
        ...data,
        ocrResults: [],
        allTeams: [],
        leftover: [],
      },
    };

    // Komandalar ro'yxatini olish
    let teams = [];
    if (data.type === 'tournament') {
      const tour = await tournamentService.getTournament(data.tid);
      for (const tid of tour.registeredTeams) {
        const team = await teamService.getTeam(tid);
        if (team) teams.push({ id: team.id, name: team.name, tag: team.tag });
      }
    } else {
      const match = await stageMatchService.getMatch(data.matchId);
      for (const tid of match.teams || []) {
        const team = await teamService.getTeam(tid);
        if (team) teams.push({ id: team.id, name: team.name, tag: team.tag });
      }
    }

    ctx.session.data.allTeams = teams;

    const teamLines = teams
      .map((tm) => `• <b>${escapeHtml(tm.tag)}</b> — ${escapeHtml(tm.name)}`)
      .join('\n');

    await ctx.reply(
      `✏️ <b>Qo'lda kiritish</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>Komandalar:</b>\n${teamLines}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>Format:</b> <code>TAG - KILL</code>\n` +
        `Har bir qatorda bitta komanda.\n` +
        `Tartib = o'rin.\n\n` +
        `<b>Misol:</b>\n` +
        `<code>UP - 12\nN1 - 8\nS7 - 5</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'host_ocr_cancel')],
          ],
        },
      }
    );
  });

  // ============================================================
  // 3. SKRINSHOT QABUL QILISH (Tesseract OCR)
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.state !== 'host_ocr_waiting') return next();
    if (!canAccess(ctx.state.role)) {
      ctx.session = { state: null, data: {} };
      return next();
    }

    const data = ctx.session.data;
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    const loading = await ctx.reply(
      `⏳ <b>Skrinshot o'qilmoqda...</b>\n\n<i>5-15 soniya olishi mumkin.</i>`,
      { parse_mode: 'HTML' }
    );

    try {
      let teams = [];
      if (data.type === 'tournament') {
        const tour = await tournamentService.getTournament(data.tid);
        for (const tid of tour.registeredTeams) {
          const team = await teamService.getTeam(tid);
          if (team) teams.push({ id: team.id, name: team.name, tag: team.tag });
        }
      } else {
        const match = await stageMatchService.getMatch(data.matchId);
        for (const tid of match.teams || []) {
          const team = await teamService.getTeam(tid);
          if (team) teams.push({ id: team.id, name: team.name, tag: team.tag });
        }
      }

      const result = await ocrService.processScreenshot(bot, fileId, teams);

      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
      } catch (e) {}

      if (!result.ok) {
        ctx.session = { state: null, data: {} };
        return ctx.reply(`❌ OCR xatosi: ${result.reason}`);
      }

      if (!result.matched.length) {
        // OCR ishlamadi — qo'lda kiritishga yo'naltirish
        ctx.session = {
          state: 'host_ocr_waiting',
          data,
        };

        return ctx.reply(
          `❌ <b>OCR skrinshotni o'qiy olmadi</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📌 Jami o'qilgan: <b>${result.totalPairs}</b>\n\n` +
            `💡 <b>Sabablari:</b>\n` +
            `• Skrinshot murakkab (har bir o'yinchi alohida)\n` +
            `• Stilizatsiya qilingan shrift\n` +
            `• Xira yoki noto'g'ri burchak\n\n` +
            `✏️ <b>Qo'lda kiritishni tavsiya qilamiz.</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  Markup.button.callback(
                    '✏️ Qo\'lda kiritish',
                    'host_ocr_manual_start'
                  ),
                ],
                [Markup.button.callback('🔁 Qayta skrinshot', 'host_ocr_retry')],
                [Markup.button.callback('❌ Bekor qilish', 'host_ocr_cancel')],
              ],
            },
          }
        );
      }

      await showPreview(ctx, data, result, teams);
    } catch (e) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
      } catch (err) {}
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ Xatolik: ${e.message}`);
    }
  });

  // ============================================================
  // PREVIEW
  // ============================================================
  async function showPreview(ctx, data, result, teams) {
    const lines = [];
    lines.push(`📸 <b>OCR NATIJASI</b>`);
    lines.push('');
    lines.push(`🔍 Jami o'qilgan: <b>${result.totalPairs}</b>`);
    lines.push(`✅ Tasdiqlangan (2+ marta): <b>${result.confirmed.length}</b>`);
    lines.push(`⚠️ Qolgan: <b>${result.ignored.length + result.unmatched.length}</b>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    let totalKills = 0;

    result.matched.forEach((r) => {
      const placePts = PLACEMENT_POINTS[r.place] || 0;
      const total = placePts + r.kills;
      totalKills += r.kills;

      const medal =
        r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : `${r.place}.`;

      lines.push(`${medal} <b>${escapeHtml(r.teamName)}</b> [${escapeHtml(r.teamTag)}]`);
      lines.push(`   📍 ${r.place}-o'rin | 💥 ${r.kills} kill | 💯 <b>${total}</b>`);
      lines.push(`   <i>(${r.occurrences}x)</i>`);
      lines.push('');
    });

    const leftover = [];

    for (const g of result.ignored) {
      leftover.push({
        tag: g.tag,
        kills: g.kills,
        occurrences: g.occurrences,
        reason: 'kam uchradi',
      });
    }
    for (const u of result.unmatched) {
      leftover.push({
        tag: u.tag,
        kills: u.kills,
        occurrences: u.occurrences,
        reason: "ro'yxatda yo'q",
      });
    }

    if (leftover.length) {
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`⚠️ <b>Qolganlar (qo'lda kiritasiz):</b>`);
      lines.push('');
      leftover.slice(0, 15).forEach((u) => {
        lines.push(
          `• <code>${escapeHtml(u.tag)}</code> — ${u.kills} kill <i>(${u.occurrences}x, ${u.reason})</i>`
        );
      });
      lines.push('');
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`💥 <b>Jami kill:</b> ${totalKills}`);

    const readyResults = result.matched.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName,
      place: r.place,
      kills: r.kills,
      penalty: 0,
    }));

    ctx.session = {
      state: 'host_ocr_confirm',
      data: {
        ...data,
        ocrResults: readyResults,
        leftover: leftover.map((l) => l.tag),
        allTeams: teams,
      },
    };

    const rows = [];
    rows.push([Markup.button.callback('✅ Tasdiqlash', 'host_ocr_confirm')]);

    if (leftover.length) {
      rows.push([
        Markup.button.callback(
          `✏️ Qolganlarini kiritish (${leftover.length})`,
          'host_ocr_fill_rest'
        ),
      ]);
    }

    rows.push([Markup.button.callback('🔁 Qayta skrinshot', 'host_ocr_retry')]);
    rows.push([Markup.button.callback('❌ Bekor qilish', 'host_ocr_cancel')]);

    const kb = Markup.inlineKeyboard(rows);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: kb.reply_markup,
    });
  }

  // ============================================================
  // 4. TASDIQLASH
  // ============================================================
  bot.action('host_ocr_confirm', async (ctx) => {
    await safeAnswer(ctx);
    const data = ctx.session?.data;
    if (!data) return ctx.reply(`❗ Ma'lumot yo'q`);

    if (data.leftover?.length && !data.leftoverFilled) {
      return ctx.reply(
        `⚠️ <b>${data.leftover.length} ta teg qolgan</b>\n\n` +
          `Ularni qo'lda kiritishingiz kerak:\n` +
          `<code>${data.leftover.slice(0, 10).join(', ')}${data.leftover.length > 10 ? '...' : ''}</code>\n\n` +
          `👇 Tugmani bosing.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback(
                  `✏️ Kiritish (${data.leftover.length})`,
                  'host_ocr_fill_rest'
                ),
              ],
              [Markup.button.callback('⏭ Ularsiz davom', 'host_ocr_skip_rest')],
              [Markup.button.callback('❌ Bekor qilish', 'host_ocr_cancel')],
            ],
          },
        }
      );
    }

    ctx.session = {
      state: 'host_ocr_penalty',
      data: { ...data, penaltyTeamIndex: 0 },
    };

    await showPenaltyStep(ctx, ctx.session.data);
  });

  // ============================================================
  // 5. QOLGANLARNI QO'LDA TO'LDIRISH
  // ============================================================
  bot.action('host_ocr_fill_rest', async (ctx) => {
    await safeAnswer(ctx);
    const data = ctx.session?.data;
    if (!data) return;

    ctx.session = {
      state: 'host_ocr_fill_rest_input',
      data,
    };

    const teamsMap = {};
    for (const tm of data.allTeams || []) {
      teamsMap[tm.tag.toUpperCase()] = tm;
    }

    const leftoverList = data.leftover || [];

    const lines = [
      `✏️ <b>Qolganlarni kiritish</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `Quyidagi teglar uchun kill kiritasiz:`,
      '',
    ];

    leftoverList.slice(0, 20).forEach((tag) => {
      const inTeams = teamsMap[tag] ? '✅' : '⚠️';
      lines.push(`${inTeams} <code>${escapeHtml(tag)}</code>`);
    });
    if (leftoverList.length > 20) {
      lines.push(`<i>... +${leftoverList.length - 20}</i>`);
    }

    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`📝 <b>Format:</b> <code>TAG - KILL</code>`);
    lines.push('');
    lines.push(`<b>Misol:</b>`);
    lines.push(`<code>X9 - 2`);
    lines.push(`Z2 - 4</code>`);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('⏭ Hech narsa kiritmayman', 'host_ocr_skip_rest')],
          [Markup.button.callback('❌ Bekor qilish', 'host_ocr_cancel')],
        ],
      },
    });
  });

  // ============================================================
  // FSM — QO'LDA TO'LDIRISH (ham bo'sh ro'yxatdan, ham qolganlardan)
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'host_ocr_fill_rest_input') return next();
    const data = ctx.session?.data;
    if (!data) return next();

    const text = ctx.message.text || '';
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const teamsMap = {};
    for (const tm of data.allTeams || []) {
      teamsMap[tm.tag.toUpperCase()] = tm;
    }

    const extraResults = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([A-Z0-9]{2,6})\s*[-–—:|\s]+\s*(\d+)$/i);
      if (!m) {
        errors.push(`${i + 1}-qator: <code>${escapeHtml(lines[i])}</code>`);
        continue;
      }

      const tag = m[1].toUpperCase();
      const kills = parseInt(m[2], 10);
      const team = teamsMap[tag];

      if (!team) {
        errors.push(`"${tag}" — ro'yxatda yo'q`);
        continue;
      }

      extraResults.push({
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        place: null,
        kills,
        penalty: 0,
      });
    }

    if (errors.length) {
      return ctx.reply(
        `❌ <b>Xatolar:</b>\n\n${errors.join('\n')}\n\n` +
          `Qayta kiriting.`,
        { parse_mode: 'HTML' }
      );
    }

    if (!extraResults.length) {
      return ctx.reply(`❗ Hech narsa kiritilmadi.`);
    }

    let combined = [...(data.ocrResults || [])];

    for (const ex of extraResults) {
      const exists = combined.find((c) => c.teamId === ex.teamId);
      if (exists) {
        exists.kills += ex.kills;
      } else {
        combined.push(ex);
      }
    }

    const usedPlaces = new Set(
      combined.filter((c) => c.place !== null).map((c) => c.place)
    );

    let nextPlace = 1;
    for (const c of combined) {
      if (c.place === null) {
        while (usedPlaces.has(nextPlace)) nextPlace++;
        c.place = nextPlace;
        usedPlaces.add(nextPlace);
        nextPlace++;
      }
    }

    combined.sort((a, b) => a.place - b.place);

    ctx.session = {
      state: 'host_ocr_penalty',
      data: {
        ...data,
        ocrResults: combined,
        leftoverFilled: true,
        penaltyTeamIndex: 0,
      },
    };

    await ctx.reply(
      `✅ <b>${extraResults.length} ta komanda qo'shildi</b>\n\n` +
        `Umumiy: <b>${combined.length}</b> ta`,
      { parse_mode: 'HTML' }
    );

    await showPenaltyStep(ctx, ctx.session.data);
  });

  // ============================================================
  // ULARSIZ DAVOM
  // ============================================================
  bot.action('host_ocr_skip_rest', async (ctx) => {
    await safeAnswer(ctx);
    const data = ctx.session?.data;
    if (!data) return;

    ctx.session = {
      state: 'host_ocr_penalty',
      data: {
        ...data,
        leftoverFilled: true,
        penaltyTeamIndex: 0,
      },
    };

    await showPenaltyStep(ctx, ctx.session.data);
  });

  // ============================================================
  // JARIMA BOSQICHI
  // ============================================================
  async function showPenaltyStep(ctx, data) {
    const idx = data.penaltyTeamIndex || 0;
    const teams = data.ocrResults;

    if (!teams || idx >= teams.length) {
      return await saveResults(ctx, data);
    }

    const team = teams[idx];

    const lines = [
      `⚖️ <b>JARIMA BALI (${idx + 1}/${teams.length})</b>`,
      '',
      `🏆 <b>${escapeHtml(team.teamName)}</b>`,
      `📍 ${team.place}-o'rin | 💥 ${team.kills} kill`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `Agar bu komandaga <b>jarima</b> qo'yilsa — raqamni kiriting.`,
      `Aks holda <b>⏭ O'tkazib yuborish</b> tugmasini bosing.`,
      '',
      `<i>Misol: 5 ball jarima → "5" deb yozing</i>`,
    ];

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('⏭ O\'tkazib yuborish', 'host_penalty_skip')],
      [Markup.button.callback('❌ Bekor qilish', 'host_ocr_cancel')],
    ]);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: kb.reply_markup,
    });
  }

  // ============================================================
  // JARIMA — SKIP
  // ============================================================
  bot.action('host_penalty_skip', async (ctx) => {
    await safeAnswer(ctx);
    const data = ctx.session?.data;
    if (!data) return;

    data.penaltyTeamIndex = (data.penaltyTeamIndex || 0) + 1;
    ctx.session.data = data;

    if (data.penaltyTeamIndex >= data.ocrResults.length) {
      return await saveResults(ctx, data);
    }

    await showPenaltyStep(ctx, data);
  });

  // ============================================================
  // JARIMA — MATN
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'host_ocr_penalty') return next();
    const data = ctx.session?.data;
    if (!data) return next();

    const text = (ctx.message.text || '').trim();
    const match = text.match(/^-?(\d+)$/);

    if (!match) {
      return ctx.reply(`❗ Faqat raqam kiriting (masalan: 5):`);
    }

    let penalty = parseInt(match[1], 10);
    if (penalty < 0) penalty = Math.abs(penalty);

    const idx = data.penaltyTeamIndex;
    data.ocrResults[idx].penalty = penalty;

    data.penaltyTeamIndex = idx + 1;
    ctx.session.data = data;

    if (data.penaltyTeamIndex >= data.ocrResults.length) {
      return await saveResults(ctx, data);
    }

    await showPenaltyStep(ctx, data);
  });

  // ============================================================
  // SAQLASH
  // ============================================================
  async function saveResults(ctx, data) {
    try {
      if (data.type === 'tournament') {
        const match = await matchService.addMatch(
          data.tid,
          data.ocrResults,
          ctx.from.id
        );

        await ctx.reply(
          `✅ <b>Natija saqlandi!</b>\n\n` +
            `📊 Match №${match.number}\n` +
            `👥 Komandalar: <b>${data.ocrResults.length}</b>\n\n` +
            (data.ocrResults.some((r) => r.penalty > 0)
              ? `⚖️ Jarima: <b>${data.ocrResults.filter((r) => r.penalty > 0).length}</b> komanda`
              : ''),
          { parse_mode: 'HTML' }
        );
      } else {
        const parsed = data.ocrResults.map((r) => ({
          teamId: r.teamId,
          teamName: r.teamName,
          place: r.place,
          kills: r.kills,
          penalty: r.penalty || 0,
        }));

        await stageMatchService.setResults(data.matchId, parsed, ctx.from.id);

        await ctx.reply(
          `✅ <b>Natija saqlandi!</b>\n\n` +
            `👥 Komandalar: <b>${data.ocrResults.length}</b>\n\n` +
            (data.ocrResults.some((r) => r.penalty > 0)
              ? `⚖️ Jarima: <b>${data.ocrResults.filter((r) => r.penalty > 0).length}</b> komanda`
              : ''),
          { parse_mode: 'HTML' }
        );
      }

      ctx.session = { state: null, data: {} };
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(`❌ ${e.message}`);
    }
  }

  // ============================================================
  // QAYTA
  // ============================================================
  bot.action('host_ocr_retry', async (ctx) => {
    await safeAnswer(ctx);
    const data = ctx.session?.data;
    if (!data) return;

    ctx.session = {
      state: 'host_ocr_waiting',
      data: { tid: data.tid, matchId: data.matchId, type: data.type },
    };

    await ctx.reply(`📸 <b>Yangi skrinshot yuboring.</b>`, { parse_mode: 'HTML' });
  });

  // ============================================================
  // BEKOR
  // ============================================================
  bot.action('host_ocr_cancel', async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    await ctx.reply(`❌ Bekor qilindi.`, { parse_mode: 'HTML' });
  });
};