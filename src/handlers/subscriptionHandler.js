// ============================================================
// SUBSCRIPTION HANDLER — Captain + barcha a'zolar obunasi
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const channelService = require('../services/channelService');
const subscriptionService = require('../services/subscriptionService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const { CALLBACK, ROLES } = require('../constants');
const { escapeHtml, safeEdit, safeAnswer, displayName } = require('../utils/telegramUtils');
const { subscriptionKeyboard } = require('../keyboards/paymentKeyboard');

module.exports = (bot) => {
  // ============================================================
  // BEPUL TURNIRGA RO'YXATDAN O'TISH — BOSHLASH (Captain)
  // ============================================================
  bot.action(/^tour:reg_free:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    // Faqat bepul turnir
    if (t.type !== 'free') {
      return ctx.reply("❗ Bu faqat bepul turnirlar uchun.");
    }

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply(ctx.t('error_team_not_member'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Orqaga', callback_data: CALLBACK.TOUR_OPEN + tId }],
          ],
        },
      });
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(ctx.t('error_not_found'));

    if (team.captainId !== ctx.from.id) {
      return ctx.reply(ctx.t('error_not_captain'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Orqaga', callback_data: CALLBACK.TOUR_OPEN + tId }],
          ],
        },
      });
    }

    if (t.registeredTeams.includes(team.id)) {
      return ctx.reply(ctx.t('error_already_registered'));
    }

    if (t.registeredTeams.length >= t.maxTeams) {
      return ctx.reply(ctx.t('error_tournament_full'));
    }

    // Majburiy kanallar
    const channels = t.requiredChannels || [];

    if (!channels.length) {
      // Kanalsiz — to'g'ridan-to'g'ri ro'yxatdan o'tish
      return registerTeamForFree(ctx, t, team);
    }

    // Captain obunasi tekshiruvi
    await showSubscriptionPage(ctx, t, channels, 'captain');
  });

  // ============================================================
  // OBUNANI TEKSHIRISH (universal — captain yoki a'zo)
  // ============================================================
  bot.action(/^chv:all:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    if (t.type !== 'free') return;

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) return ctx.reply(ctx.t('error_team_not_member'));

    const team = await teamService.getTeam(user.teamId);
    if (!team) return ctx.reply(ctx.t('error_not_found'));

    const channels = t.requiredChannels || [];
    if (!channels.length) {
      // Kanalsiz
      if (team.captainId === ctx.from.id) {
        return registerTeamForFree(ctx, t, team);
      }
      return ctx.reply('✅ OK');
    }

    // Barcha kanallar tekshiruvi
    const results = await channelService.checkAllSubscriptions(
      bot,
      ctx.from.id,
      channels
    );
    const notSubscribed = results.filter((r) => !r.subscribed);

    // ---------- Obuna bo'lmagan ----------
    if (notSubscribed.length > 0) {
      return showMissingChannels(ctx, t, channels, notSubscribed);
    }

    // ---------- Barcha kanallarga obuna ✅ ----------
    await subscriptionService.markVerified(t.id, team.id, ctx.from.id);

    const isCaptain = team.captainId === ctx.from.id;

    if (isCaptain) {
      // Captain → komandani ro'yxatdan o'tkazamiz
      return registerTeamForFree(ctx, t, team);
    }

    // A'zo → tasdiqlandi, faqat xabar
    return showMemberSuccess(ctx, t, team);
  });

  // ============================================================
  // ORQAGA (obunadan)
  // ============================================================
  bot.action(/^chv:back:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    return ctx.reply('⬅️', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Orqaga', callback_data: CALLBACK.TOUR_OPEN + tId }],
        ],
      },
    });
  });
};

// ============================================================
// YORDAMCHI: OBUNA SAHIFASI
// ============================================================
async function showSubscriptionPage(ctx, tournament, channels, role = 'captain') {
  const lines = [];
  lines.push(`📢 <b>Majburiy kanallarga obuna</b>`);
  lines.push('');
  lines.push(
    role === 'captain'
      ? `<i>Komandani ro'yxatdan o'tkazish uchun quyidagi kanallarga obuna bo'ling.</i>`
      : `<i>Room ma'lumotlarini ko'rish uchun quyidagi kanallarga obuna bo'ling.</i>`
  );
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  channels.forEach((ch, i) => {
    lines.push(`${i + 1}. <b>${escapeHtml(ch.channelTitle || 'Kanal')}</b>`);
    if (ch.channelUsername) {
      lines.push(`   ${escapeHtml(ch.channelUsername)}`);
    }
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(
    `<i>Barcha kanallarga obuna bo'lgandan keyin "✅ Obunani tekshirish" tugmasini bosing.</i>`
  );

  const kb = subscriptionKeyboard(tournament.id, channels);

  try {
    await ctx.editMessageText(lines.join('\n'), {
      parse_mode: 'HTML',
      ...kb,
    });
  } catch (e) {
    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      ...kb,
    });
  }
}

// ============================================================
// YORDAMCHI: OBUNA BO'LMAGAN KANALLAR
// ============================================================
async function showMissingChannels(ctx, tournament, channels, notSubscribed) {
  const list = notSubscribed
    .map(
      (r, i) =>
        `${i + 1}. <b>${escapeHtml(r.channel.channelTitle || 'Kanal')}</b>`
    )
    .join('\n');

  const text =
    `❌ <b>Siz hali quyidagi kanallarga obuna bo'lmagansiz:</b>\n\n` +
    `${list}\n\n` +
    `Avval obuna bo'ling, keyin <b>✅ Obunani tekshirish</b> tugmasini bosing.`;

  const kb = subscriptionKeyboard(tournament.id, channels);

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
  } catch (e) {
    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  }
}

// ============================================================
// YORDAMCHI: KOMANDANI RO'YXATDAN O'TKAZISH (bepul)
// ============================================================
async function registerTeamForFree(ctx, tournament, team) {
  const res = await tournamentService.registerTeam(tournament.id, team.id);

  if (!res.ok) {
    if (res.reason === 'already') {
      return ctx.reply(ctx.t('error_already_registered'));
    }
    if (res.reason === 'full') {
      return ctx.reply(ctx.t('error_tournament_full'));
    }
    return ctx.reply(`❌ ${res.reason}`);
  }

  // ✅ A'zolarga xabar yuborish (captain'dan tashqari)
  let sentCount = 0;
  const failedIds = [];

  for (const memberId of team.members) {
    if (memberId === ctx.from.id) continue;

    try {
      // Captain tasdiqlangan — a'zo hali yo'q
      const alreadyVerified = await require('../services/subscriptionService').isVerified(
        tournament.id,
        team.id,
        memberId
      );

      if (alreadyVerified) {
        // Allaqachon tasdiqlangan — Room info ko'rishi mumkin
        await ctx.telegram.sendMessage(
          memberId,
          `📢 <b>Komandangiz turnirga ro'yxatdan o'tdi!</b>\n\n` +
            `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
            `👥 ${escapeHtml(team.name)}\n\n` +
            `✅ Siz allaqachon kanallarga obuna bo'lgansiz.\n` +
            `Room ma'lumotlarini turnir boshlanishida ko'rasiz.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🏆 Turnirga o'tish",
                    callback_data: CALLBACK.TOUR_OPEN + tournament.id,
                  },
                ],
              ],
            },
          }
        );
      } else {
        // Obuna bo'lishi kerak
        const channels = tournament.requiredChannels || [];
        await ctx.telegram.sendMessage(
          memberId,
          `📢 <b>Sizning komandangiz turnirga ro'yxatdan o'tdi!</b>\n\n` +
            `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
            `👥 ${escapeHtml(team.name)}\n` +
            `👑 Captain: ${escapeHtml(displayName(await userService.getUser(team.captainId)) || '-')}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📌 <b>Room ID va parolni ko'rish uchun</b> quyidagi kanallarga obuna bo'ling:`,
          {
            parse_mode: 'HTML',
            reply_markup: subscriptionKeyboard(tournament.id, channels).reply_markup,
          }
        );
      }

      sentCount++;
    } catch (e) {
      failedIds.push(memberId);
    }
  }

  // Captain'ga xabar
  const typeLabel = '🆓 Bepul';
  const totalMembers = team.members.length;
  const pendingCount = totalMembers - 1 - (sentCount - failedIds.length);

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "📋 Komandalar ro'yxati",
        CALLBACK.TOUR_TEAMLIST + tournament.id
      ),
    ],
    [
      Markup.button.callback(
        '⬅️ Turnirga qaytish',
        CALLBACK.TOUR_OPEN + tournament.id
      ),
    ],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);

  await safeEdit(
    ctx,
    `╔══════════════════════╗\n` +
      `   🎉 <b>MUVAFFAQIYAT!</b>\n` +
      `╚══════════════════════╝\n\n` +
      `✅ <b>${escapeHtml(team.name)}</b> komandasi turnirga ro'yxatdan o'tdi!\n\n` +
      `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
      `💳 Turi: ${typeLabel}\n` +
      `👥 Komandalar: <b>${tournament.registeredTeams.length + 1}/${tournament.maxTeams}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📤 <b>${sentCount}</b> a'zoga xabar yuborildi\n` +
      (failedIds.length ? `⚠️ ${failedIds.length} a'zoga yuborilmadi\n` : '') +
      `\n📌 <i>A'zolar kanallarga obuna bo'lgach, Room ID va parolni ko'radi.</i>`,
    { parse_mode: 'HTML', reply_markup: kb.reply_markup }
  );
}

// ============================================================
// YORDAMCHI: A'ZO MUVAFFAQIYATI
// ============================================================
async function showMemberSuccess(ctx, tournament, team) {
  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🔑 Room ma\'lumotlari',
        CALLBACK.TOUR_ROOM_INFO + tournament.id
      ),
    ],
    [
      Markup.button.callback(
        '⬅️ Turnirga qaytish',
        CALLBACK.TOUR_OPEN + tournament.id
      ),
    ],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);

  await safeEdit(
    ctx,
    `╔══════════════════════╗\n` +
      `   ✅ <b>OBUNA TASDIQLANDI!</b>\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>${escapeHtml(tournament.title)}</b>\n` +
      `👥 ${escapeHtml(team.name)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ Siz barcha kanallarga obuna bo'ldingiz!\n\n` +
      `📌 <i>Endi Room ID va parolni ko'rishingiz mumkin.</i>`,
    { parse_mode: 'HTML', reply_markup: kb.reply_markup }
  );
}