// ============================================================
// TURNIR HANDLERLARI — To'liq
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const userService = require('../services/userService');
const roleService = require('../services/roleService');
const cardService = require('../services/cardService');
const subscriptionService = require('../services/subscriptionService');
const teamListService = require('../services/teamListService');
const matchService = require('../services/matchService');
const pointsService = require('../services/pointsService');
const {
  tournamentsMenu,
  confirmTournament,
} = require('../keyboards/tournamentKeyboard');
const {
  tournamentTypeKeyboard,
  currencyKeyboard,
  subscriptionKeyboard,
} = require('../keyboards/paymentKeyboard');
const { pickCardKeyboard } = require('../keyboards/cardKeyboard');
const { CALLBACK, STATES, LIMITS, ROLES, DEFAULT_MAP } = require('../constants');
const {
  cleanText,
  isValidDate,
  isValidTime,
  isPositiveInt,
} = require('../utils/validation');
const {
  escapeHtml,
  safeEdit,
  safeAnswer,
  displayName,
} = require('../utils/telegramUtils');
const { parseDateTime, isSameDayTashkent } = require('../utils/dateUtils');
const { hasAnyRole } = require('../middlewares/roleGuard');

const PAGE_SIZE = 5;

// ============================================================
// YORDAMCHI: ORQAGA TUGMALARI
// ============================================================
function backToMain(ctx) {
  const t = ctx?.t || ((k) => k);
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('menu_main'), CALLBACK.MENU_MAIN)],
  ]);
}

function backToTournaments() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirlar menyusi', CALLBACK.MENU_TOURNAMENTS)],
  ]);
}

function backToTournament(id) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirga qaytish', CALLBACK.TOUR_OPEN + id)],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

function backToList() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Turnirlar menyusi', CALLBACK.MENU_TOURNAMENTS)],
    [Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN)],
  ]);
}

// ============================================================
// YORDAMCHI: KARTA TANLASH
// ============================================================
async function showCardPicker(ctx) {
  const cards = await cardService.getAllCards();

  if (!cards.length) {
    ctx.session.state = STATES.TOUR_CREATE_CARD_NUMBER;
    return ctx.reply(
      `📭 <b>Kartalar yo'q</b>\n\n` +
        `Sizda saqlangan kartalar mavjud emas. Yangi karta qo'shing ` +
        `(Admin panel → 💳 Kartalar) yoki qo'lda karta raqamini kiriting:\n\n` +
        `💳 <b>Karta raqamini kiriting:</b>\n\n` +
        `<i>Masalan: 8600 1234 5678 9012</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("➕ Yangi karta qo'shish", CALLBACK.CARD_ADD)],
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  }

  ctx.session.state = STATES.TOUR_CREATE_PICK_CARD;

  const text =
    `📍 <b>Qadam: Karta tanlash</b>\n\n` +
    `Quyidagi kartalardan birini tanlang yoki qo'lda kiriting:`;

  await ctx.reply(text, { parse_mode: 'HTML', ...pickCardKeyboard(ctx, cards) });
}

async function moveToImageStep(ctx) {
  ctx.session.state = STATES.TOUR_CREATE_IMAGE;

  return ctx.reply(
    `✅ <b>To'lov ma'lumotlari saqlandi</b>\n\n` +
      `📍 Keyingi qadam: Rasm\n\n` +
      `🖼 Turnir rasmini yuboring yoki /skip:`,
    { parse_mode: 'HTML', reply_markup: backToMain(ctx).reply_markup }
  );
}

// ============================================================
// ASOSIY MODUL
// ============================================================
module.exports = (bot) => {
  // ============================================================
  // 1. TURNIRLAR MENYUSI
  // ============================================================
  bot.action(CALLBACK.MENU_TOURNAMENTS, async (ctx) => {
    await safeAnswer(ctx);
    try {
      await safeEdit(ctx, ctx.t('tournaments_title'), tournamentsMenu(ctx));
    } catch (e) {
      await ctx.reply(ctx.t('tournaments_title'), {
        parse_mode: 'HTML',
        ...tournamentsMenu(ctx),
      });
    }
  });

  // ============================================================
  // 2. BO'LIM TANLANGANDA
  // ============================================================
  bot.action(
    [
      CALLBACK.TOUR_TODAY,
      CALLBACK.TOUR_UPCOMING,
      CALLBACK.TOUR_FINISHED,
    ],
    async (ctx) => {
      await safeAnswer(ctx);
      const key = ctx.callbackQuery.data;
      await showTournamentList(ctx, key, 0);
    }
  );

  // ============================================================
  // 3. SAHIFALASH
  // ============================================================
  bot.action(/^tour:page:(today|upcoming|finished):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const section = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const key =
      section === 'today'
        ? CALLBACK.TOUR_TODAY
        : section === 'upcoming'
        ? CALLBACK.TOUR_UPCOMING
        : CALLBACK.TOUR_FINISHED;
    await showTournamentList(ctx, key, page);
  });

  // ============================================================
  // 4. TURNIRNI OCHISH (staff ham captain bo'lsa ro'yxat ko'rinadi)
  // ============================================================
  bot.action(/^tour:open:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const id = ctx.match[1];
    const t = await tournamentService.getTournament(id);
    if (!t) {
      return ctx.reply(ctx.t('tour_not_found'), {
        reply_markup: backToList().reply_markup,
      });
    }

    // Foydalanuvchi va komanda ma'lumotlari
    const user = await userService.getUser(ctx.from.id);
    const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;

    const isStaff = hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER]);
    const isCaptain = !!(
      team && Number(team.captainId) === Number(ctx.from.id)
    );
    const isRegistered = !!(team && t.registeredTeams.includes(team.id));
    const isFull = t.registeredTeams.length >= t.maxTeams;
    const isClosed = !!(
      t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
    );

    // Debug uchun loglar
    console.log('tour:open:', {
      userId: ctx.from.id,
      role: ctx.state.role,
      hasTeam: !!team,
      teamId: team?.id,
      teamCaptain: team?.captainId,
      isCaptain,
      isRegistered,
      isFull,
      isClosed,
      tourType: t.type,
    });

    // ---------- Asosiy tugmalar ----------
    const buttons = [
      [
        Markup.button.callback(
          ctx.t('tour_standings'),
          CALLBACK.TOUR_STANDINGS + t.id
        ),
      ],
      [
        Markup.button.callback(
          ctx.t('tour_teamlist'),
          CALLBACK.TOUR_TEAMLIST + t.id
        ),
      ],
    ];

    // ---------- Ro'yxatdan o'tish (captain uchun) ----------
    if (isCaptain && !isRegistered && !isFull && !isClosed) {
      const regLabel =
        t.type === 'paid'
          ? ctx.t('tour_register_paid')
          : ctx.t('tour_register');
      buttons.push([
        Markup.button.callback(regLabel, CALLBACK.TOUR_REGISTER + t.id),
      ]);
    }

    // Captain lekin allaqachon ro'yxatdan o'tgan
    if (isCaptain && isRegistered) {
      buttons.push([
        Markup.button.callback(
          '✅ ' + ctx.t('already_registered'),
          'no_action'
        ),
      ]);
    }

    // Captain emas, lekin teamda bor (staff emas)
    if (team && !isCaptain && !isStaff) {
      buttons.push([
        Markup.button.callback(
          "ℹ️ Faqat captain ro'yxatdan o'tkazadi",
          'no_action'
        ),
      ]);
    }

    // ---------- Room info (ro'yxatdan o'tganlarga) ----------
    if (team && isRegistered) {
      if (t.roomId && t.roomPassword) {
        buttons.push([
          Markup.button.callback(
            ctx.t('tour_room_info'),
            CALLBACK.TOUR_ROOM_INFO + t.id
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            ctx.t('tour_room_waiting'),
            CALLBACK.TOUR_ROOM_INFO + t.id
          ),
        ]);
      }

      buttons.push([
        Markup.button.callback(
          ctx.t('tour_contact_host'),
          CALLBACK.TOUR_CONTACT_HOST + t.id
        ),
      ]);
    }

    // ---------- STAFF uchun qo'shimcha ----------
    if (isStaff) {
      buttons.push([
        Markup.button.callback(ctx.t('tour_edit'), CALLBACK.TOUR_EDIT + t.id),
      ]);
      buttons.push([
        Markup.button.callback(ctx.t('tour_clone'), CALLBACK.TOUR_CLONE + t.id),
      ]);
      buttons.push([
        Markup.button.callback(
          ctx.t('tour_assign_host'),
          CALLBACK.TOUR_ASSIGN_HOST + t.id
        ),
      ]);
      buttons.push([
        Markup.button.callback(ctx.t('tour_stats'), CALLBACK.TOUR_STATS + t.id),
      ]);
      buttons.push([
        Markup.button.callback(ctx.t('tour_report'), CALLBACK.TOUR_REPORT + t.id),
      ]);
      buttons.push([
        Markup.button.callback(
          ctx.t('tour_winners'),
          CALLBACK.TOUR_WINNERS + t.id
        ),
      ]);
      buttons.push([
        Markup.button.callback(
          ctx.t('tour_announce'),
          CALLBACK.TOUR_ANNOUNCE + t.id
        ),
      ]);

      if (
        ctx.state.role === ROLES.SUPER_ADMIN ||
        ctx.state.role === ROLES.ADMIN
      ) {
        buttons.push([
          Markup.button.callback(
            ctx.t('tour_cancel'),
            'tour:cancel:' + t.id
          ),
        ]);
        buttons.push([
          Markup.button.callback(
            ctx.t('tour_delete'),
            CALLBACK.TOUR_DELETE + t.id
          ),
        ]);
      }
    }

    // ---------- Navigation ----------
    buttons.push([
      Markup.button.callback(
        ctx.t('menu_tournaments'),
        CALLBACK.MENU_TOURNAMENTS
      ),
    ]);
    buttons.push([
      Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN),
    ]);

    const text = formatTournamentText(t, true);

    if (t.imageFileId) {
      try {
        return await ctx.replyWithPhoto(t.imageFileId, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (e) {
        // rasm xatosi — matnga o'tamiz
      }
    }

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    }
  });

  // ============================================================
  // 4.1 "NO ACTION" TUGMASI (bo'sh)
  // ============================================================
  bot.action('no_action', async (ctx) => {
    await safeAnswer(ctx);
  });

  // ============================================================
  // 4.2 ROOM MA'LUMOTLARINI KO'RSATISH (obuna tekshiruvi bilan)
  // ============================================================
  bot.action(/^tour:room_info:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) {
      return ctx.reply(ctx.t('tour_not_found'), {
        reply_markup: backToList().reply_markup,
      });
    }

    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply(ctx.t('error_team_not_member'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }
    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return ctx.reply(ctx.t('error_not_found'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }
    if (!t.registeredTeams.includes(team.id)) {
      return ctx.reply(ctx.t('error_not_registered'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    // BEPUL turnirda obuna tekshiruvi
    if (t.type === 'free' && t.requiredChannels?.length > 0) {
      const isVerified = await subscriptionService.isVerified(
        t.id,
        team.id,
        ctx.from.id
      );

      if (!isVerified) {
        const kb = subscriptionKeyboard(ctx, t.id, t.requiredChannels);

        return ctx.reply(
          `╔══════════════════════╗\n` +
            `   ⚠️ <b>OBUNA KERAK</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📌 Room ID va parolni ko'rish uchun\n` +
            `quyidagi kanallarga obuna bo'ling:`,
          {
            parse_mode: 'HTML',
            ...kb,
          }
        );
      }
    }

    // Host hali yubormagan
    if (!t.roomId && !t.roomPassword) {
      return ctx.reply(
        `╔══════════════════════╗\n` +
          `   ${ctx.t('room_waiting_title')}\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${ctx.t('room_waiting_desc')}`,
        {
          parse_mode: 'HTML',
          reply_markup: backToTournament(t.id).reply_markup,
        }
      );
    }

    if (!t.roomId || !t.roomPassword) {
      return ctx.reply(
        `╔══════════════════════╗\n` +
          `   ${ctx.t('room_partial_title')}\n` +
          `╚══════════════════════╝\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🆔 Room ID: <code>${escapeHtml(t.roomId || ctx.t('not_yet'))}</code>\n` +
          `🔒 ${ctx.t('password')}: <code>${escapeHtml(
            t.roomPassword || ctx.t('not_yet')
          )}</code>\n\n` +
          `${ctx.t('room_partial_desc')}`,
        {
          parse_mode: 'HTML',
          reply_markup: backToTournament(t.id).reply_markup,
        }
      );
    }

    // Ikkalasi ham tayyor
    const text =
      `╔══════════════════════╗\n` +
      `   ${ctx.t('room_info_title')}\n` +
      `╚══════════════════════╝\n\n` +
      `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 <b>${ctx.t('date')}:</b> ${t.date}\n` +
      `⏰ <b>${ctx.t('time')}:</b> ${t.startTime}\n` +
      (t.mode ? `🎮 <b>${ctx.t('mode')}:</b> ${escapeHtml(t.mode)}\n` : '') +
      (t.etapa ? `⭐️ <b>${ctx.t('stage')}:</b> ${escapeHtml(t.etapa)}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🆔 <b>Room ID:</b>\n` +
      `<code>${escapeHtml(String(t.roomId))}</code>\n\n` +
      `🔒 <b>${ctx.t('password')}:</b>\n` +
      `<code>${escapeHtml(String(t.roomPassword))}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${ctx.t('copy_hint')}`;

    const kb = {
      inline_keyboard: [
        [
          {
            text: ctx.t('btn_copy_room_id'),
            copy_text: { text: String(t.roomId) },
          },
        ],
        [
          {
            text: ctx.t('btn_copy_password'),
            copy_text: { text: String(t.roomPassword) },
          },
        ],
        [
          {
            text: ctx.t('btn_copy_all'),
            copy_text: {
              text: `Room ID: ${t.roomId}\nPassword: ${t.roomPassword}`,
            },
          },
        ],
        [
          {
            text: ctx.t('btn_back_tournament'),
            callback_data: CALLBACK.TOUR_OPEN + t.id,
          },
        ],
        [{ text: ctx.t('menu_main'), callback_data: CALLBACK.MENU_MAIN }],
      ],
    };

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    }
  });

  // ============================================================
  // 5. NATIJALAR — PNG
  // ============================================================
  bot.action(/^tour:st:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) {
      return ctx.reply(ctx.t('tour_not_found'), {
        reply_markup: backToList().reply_markup,
      });
    }

    const matchData = await matchService.getTournamentMatches(t.id);
    const teamsMap = {};
    for (const tid of t.registeredTeams) {
      const team = await teamService.getTeam(tid);
      if (team) teamsMap[tid] = team;
    }

    const standings = pointsService.calculateStandings(t, matchData, teamsMap);

    const loading = await ctx.reply(ctx.t('loading'));

    try {
      const imagePath = await pointsService.generateStandingsPNG(t, standings);

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            ctx.t('btn_refresh'),
            CALLBACK.TOUR_STANDINGS + t.id
          ),
        ],
        [Markup.button.callback(ctx.t('btn_as_text'), 'tour:st_text:' + t.id)],
        [
          Markup.button.callback(
            ctx.t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + t.id
          ),
        ],
        [Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
      ]);

      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
      } catch (e) {}

      await ctx.replyWithPhoto(
        { source: imagePath },
        {
          caption:
            `📊 <b>${escapeHtml(t.title)}</b>\n` +
            `${ctx.t('matches')}: <b>${matchData.matches.length}</b> | ${ctx.t(
              'teams'
            )}: <b>${t.registeredTeams.length}</b>`,
          parse_mode: 'HTML',
          reply_markup: kb.reply_markup,
        }
      );
    } catch (e) {
      console.error('PNG error:', e);

      const text = pointsService.formatStandings(standings, t);
      const kb = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            ctx.t('btn_refresh'),
            CALLBACK.TOUR_STANDINGS + t.id
          ),
        ],
        [
          Markup.button.callback(
            ctx.t('btn_back_tournament'),
            CALLBACK.TOUR_OPEN + t.id
          ),
        ],
      ]);

      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
      } catch (err) {}

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
      });
    }
  });

  // ============================================================
  // 5.1 NATIJALAR — MATN KO'RINISHIDA
  // ============================================================
  bot.action(/^tour:st_text:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    const matchData = await matchService.getTournamentMatches(t.id);
    const teamsMap = {};
    for (const tid of t.registeredTeams) {
      const team = await teamService.getTeam(tid);
      if (team) teamsMap[tid] = team;
    }

    const standings = pointsService.calculateStandings(t, matchData, teamsMap);
    const text = pointsService.formatStandings(standings, t);

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.t('btn_as_image'),
          CALLBACK.TOUR_STANDINGS + t.id
        ),
      ],
      [
        Markup.button.callback(
          ctx.t('btn_back_tournament'),
          CALLBACK.TOUR_OPEN + t.id
        ),
      ],
      [Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
    ]);

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: kb.reply_markup,
    });
  });

  // ============================================================
  // 6. KOMANDALAR RO'YXATI
  // ============================================================
  bot.action(/^tour:tl:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const id = ctx.match[1];
    const t = await tournamentService.getTournament(id);
    if (!t) {
      return ctx.reply(ctx.t('tour_not_found'), {
        reply_markup: backToList().reply_markup,
      });
    }

    const text = await teamListService.buildTeamList(t);

    const buttons = [
      [
        Markup.button.callback(
          ctx.t('btn_refresh'),
          CALLBACK.TOUR_TEAMLIST + t.id
        ),
      ],
      [
        Markup.button.callback(
          ctx.t('btn_back_tournament'),
          CALLBACK.TOUR_OPEN + t.id
        ),
      ],
      [Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN)],
    ];

    if (t.imageFileId) {
      try {
        return await ctx.replyWithPhoto(t.imageFileId, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (e) {}
    }

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
    }
  });

  // ============================================================
  // 7. TURNIRGA RO'YXATDAN O'TISH
  // ============================================================
  bot.action(/^tour:reg:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    // Foydalanuvchi
    const user = await userService.getUser(ctx.from.id);
    if (!user?.teamId) {
      return ctx.reply(
        "❗ <b>Siz komandada emassiz.</b>\n\n" +
          "Avval komanda yarating yoki mavjud komandaga qo'shiling.",
        {
          parse_mode: 'HTML',
          reply_markup: backToTournament(t.id).reply_markup,
        }
      );
    }

    const team = await teamService.getTeam(user.teamId);
    if (!team) {
      return ctx.reply(ctx.t('error_not_found'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    // Faqat captain
    if (Number(team.captainId) !== Number(ctx.from.id)) {
      return ctx.reply(
        "❗ <b>Faqat komanda captain'i ro'yxatdan o'tkaza oladi.</b>\n\n" +
          `<i>Siz captain emassiz. Captain'dan so'rang.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: backToTournament(t.id).reply_markup,
        }
      );
    }

    // Muddat tugagan
    if (
      t.registrationDeadline &&
      new Date(t.registrationDeadline) < new Date()
    ) {
      return ctx.reply(ctx.t('error_registration_closed'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    // Allaqachon ro'yxatdan o'tgan
    if (t.registeredTeams.includes(team.id)) {
      return ctx.reply(ctx.t('error_already_registered'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    // To'lgan
    if (t.registeredTeams.length >= t.maxTeams) {
      return ctx.reply(ctx.t('error_tournament_full'), {
        reply_markup: backToTournament(t.id).reply_markup,
      });
    }

    // ---------- PULLIK TURNIR ----------
    if (t.type === 'paid') {
      return ctx.reply(
        `💳 <b>${ctx.t('tour_type_paid')}</b>\n\n` +
          `${ctx.t('payment_amount')}: <b>${t.payment?.amount} ${t.payment?.currency}</b>\n\n` +
          `${ctx.t('tour_paid_see_details')}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: ctx.t('tour_paid_show_payment'),
                  callback_data: 'tour:reg_paid:' + t.id,
                },
              ],
              [
                {
                  text: ctx.t('btn_back'),
                  callback_data: CALLBACK.TOUR_OPEN + t.id,
                },
              ],
            ],
          },
        }
      );
    }

    // ---------- BEPUL TURNIR ----------
    // Kanalsiz bo'lsa — to'g'ridan-to'g'ri ro'yxatga
    const channels = t.requiredChannels || [];

    if (!channels.length) {
      const res = await tournamentService.registerTeam(t.id, team.id);
      if (!res.ok) {
        return ctx.reply(`❗ Xatolik: ${res.reason}`, {
          reply_markup: backToTournament(t.id).reply_markup,
        });
      }

      // Hostga xabar
      if (t.hostId) {
        try {
          await ctx.telegram.sendMessage(
            t.hostId,
            `ℹ️ <b>${escapeHtml(t.title)}</b> turniriga yangi komanda:\n<b>${escapeHtml(
              team.name
            )} [${escapeHtml(team.tag)}]</b>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }

      return ctx.reply(
        `╔══════════════════════╗\n` +
          `   🎉 <b>MUVAFFAQIYAT!</b>\n` +
          `╚══════════════════════╝\n\n` +
          `✅ <b>${escapeHtml(
            team.name
          )}</b> komandasi turnirga ro'yxatdan o'tdi!\n\n` +
          `🏆 ${escapeHtml(t.title)}\n` +
          `👥 Komandalar: <b>${t.registeredTeams.length + 1}/${
            t.maxTeams
          }</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📋 Komandalar ro'yxati",
                  callback_data: CALLBACK.TOUR_TEAMLIST + t.id,
                },
              ],
              [
                {
                  text: ctx.t('btn_back_tournament'),
                  callback_data: CALLBACK.TOUR_OPEN + t.id,
                },
              ],
            ],
          },
        }
      );
    }

    // Kanallar bor — obuna sahifasiga
    return ctx.reply(
      `📢 <b>${ctx.t('tour_type_free')}</b>\n\n${ctx.t('tour_free_start')}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ctx.t('btn_continue'),
                callback_data: 'tour:reg_free:' + t.id,
              },
            ],
            [
              {
                text: ctx.t('btn_back'),
                callback_data: CALLBACK.TOUR_OPEN + t.id,
              },
            ],
          ],
        },
      }
    );
  });

  // ============================================================
  // 8. TURNIR YARATISH — BOSHLASH
  // ============================================================
  bot.action(CALLBACK.TOUR_CREATE, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'), backToMain(ctx));
    }

    ctx.session = { state: STATES.TOUR_CREATE_TITLE, data: {} };

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('btn_cancel'), CALLBACK.TOUR_CANCEL)],
    ]);

    const text =
      `🆕 <b>${ctx.t('tour_create_title')}</b>\n\n` +
      `📍 ${ctx.t('tour_create_step', { n: 1 })}\n\n` +
      `✍️ ${ctx.t('tour_create_name_prompt')}\n\n` +
      `<i>${ctx.t('tour_create_name_example')}</i>`;

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
  });

  // ============================================================
  // 8.1 HOST TANLASH
  // ============================================================
  bot.action(/^tour:ph:(host_.+|\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const hostId = ctx.match[1].replace('host_', '');
    const d = ctx.session?.data || {};
    if (!d.title) {
      return ctx.reply(ctx.t('error_no_data'), backToMain(ctx));
    }

    d.hostId = Number(hostId) || hostId;
    ctx.session.state = STATES.TOUR_CREATE_CONFIRM;
    const summary = await buildConfirmSummary(ctx, d);
    return ctx.reply(summary, { parse_mode: 'HTML', ...confirmTournament(ctx) });
  });

  bot.action('tour:ph:skip', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const d = ctx.session?.data || {};
    if (!d.title) {
      return ctx.reply(ctx.t('error_no_data'), backToMain(ctx));
    }
    d.hostId = null;
    ctx.session.state = STATES.TOUR_CREATE_CONFIRM;
    const summary = await buildConfirmSummary(ctx, d);
    return ctx.reply(summary, { parse_mode: 'HTML', ...confirmTournament(ctx) });
  });

  // ============================================================
  // 8.2 TASDIQLASH
  // ============================================================
  bot.action(CALLBACK.TOUR_CONFIRM, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const d = ctx.session?.data || {};
    if (!d.title) {
      return ctx.reply(ctx.t('error_no_data'), backToMain(ctx));
    }

    try {
      const t = await tournamentService.createTournament({
        ...d,
        map: DEFAULT_MAP,
        createdBy: ctx.from.id,
        createdByRole: ctx.state.role,
      });

      if (d.hostId) {
        await tournamentService.setHost(t.id, d.hostId);
        try {
          await ctx.telegram.sendMessage(
            d.hostId,
            `🎙 <b>${ctx.t('host_new_assigned_title')}</b>\n\n` +
              `🏆 <b>${escapeHtml(t.title)}</b>\n` +
              `📅 ${t.date} | ⏰ ${t.startTime}\n\n` +
              `${ctx.t('host_new_assigned_desc')}`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }

      ctx.session = { state: null, data: {} };

      const typeLabel =
        t.type === 'paid'
          ? `${ctx.t('tour_type_paid')} (${t.payment?.amount} ${t.payment?.currency})`
          : ctx.t('tour_type_free');

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(ctx.t('tour_open'), CALLBACK.TOUR_OPEN + t.id)],
        [
          Markup.button.callback(
            ctx.t('tour_create_again'),
            CALLBACK.TOUR_CREATE
          ),
        ],
        [Markup.button.callback(ctx.t('menu_admin'), CALLBACK.ADMIN_PANEL)],
      ]);

      await ctx.reply(
        `╔══════════════════════╗\n` +
          `   ${ctx.t('tour_created_title')}\n` +
          `╚══════════════════════╝\n\n` +
          `🆔 ID: <code>${t.id}</code>\n` +
          `🏆 ${ctx.t('name')}: <b>${escapeHtml(t.title)}</b>\n` +
          `💳 ${ctx.t('tour_type_label')}: <b>${typeLabel}</b>\n` +
          `📅 ${t.date} | ⏰ ${t.startTime}\n` +
          `🎮 ${escapeHtml(t.mode)}\n` +
          `🎙 ${ctx.t('host_label')}: <b>${
            d.hostId ? ctx.t('yes') : ctx.t('no')
          }</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${ctx.t('tour_created_hint')}`,
        { parse_mode: 'HTML', reply_markup: kb.reply_markup }
      );
    } catch (e) {
      ctx.session = { state: null, data: {} };
      await ctx.reply(
        `${ctx.t('error_prefix')} ${e.message || ctx.t('error_generic')}`,
        backToMain(ctx)
      );
    }
  });

  // ============================================================
  // 8.3 BEKOR QILISH
  // ============================================================
  bot.action(CALLBACK.TOUR_CANCEL, async (ctx) => {
    await safeAnswer(ctx);
    ctx.session = { state: null, data: {} };
    try {
      await ctx.editMessageText(`❌ <b>${ctx.t('cancel')}</b>`, {
        parse_mode: 'HTML',
        reply_markup: backToMain(ctx).reply_markup,
      });
    } catch (e) {
      await ctx.reply(`❌ <b>${ctx.t('cancel')}</b>`, {
        parse_mode: 'HTML',
        reply_markup: backToMain(ctx).reply_markup,
      });
    }
  });

  // ============================================================
  // 9. FSM — TURNIR YARATISH QADAMLARI
  // ============================================================
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (!s) return next();
    if (!s.startsWith('tour_create')) return next();

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('error_access'), backToMain(ctx));
    }

    // 1. NOM
    if (s === STATES.TOUR_CREATE_TITLE) {
      const title = cleanText(ctx.message.text, LIMITS.MAX_NAME_LEN);
      if (title.length < 3) {
        return ctx.reply(ctx.t('tour_create_name_short'), backToMain(ctx));
      }
      ctx.session.data.title = title;
      ctx.session.state = STATES.TOUR_CREATE_TYPE;

      return ctx.reply(ctx.t('tour_type_pick'), {
        parse_mode: 'HTML',
        ...tournamentTypeKeyboard(ctx),
      });
    }

    // PULLIK: AMOUNT
    if (s === STATES.TOUR_CREATE_AMOUNT) {
      const v = cleanText(ctx.message.text, 15);
      if (!isPositiveInt(v)) {
        return ctx.reply(ctx.t('tour_create_amount_error'));
      }
      const amount = Number(v);
      if (amount > LIMITS.MAX_PAYMENT_AMOUNT) {
        return ctx.reply(
          ctx.t('tour_create_amount_too_big', { max: LIMITS.MAX_PAYMENT_AMOUNT })
        );
      }
      ctx.session.data.amount = amount;
      ctx.session.state = STATES.TOUR_CREATE_CURRENCY;

      return ctx.reply(ctx.t('payment_currency_prompt', { amount }), {
        parse_mode: 'HTML',
        ...currencyKeyboard(ctx),
      });
    }

    // PULLIK: CARD NUMBER (qo'lda)
    if (s === STATES.TOUR_CREATE_CARD_NUMBER) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_CARD_NUMBER_LEN);
      if (!cardService.isValidCardNumber(v)) {
        return ctx.reply(
          `❗ Karta raqami noto'g'ri (16 xonali raqam kiriting):`
        );
      }
      ctx.session.data.cardNumber = v;
      ctx.session.data.cardId = null;
      ctx.session.state = STATES.TOUR_CREATE_CARD_OWNER;

      return ctx.reply(ctx.t('payment_card_owner_prompt'), {
        parse_mode: 'HTML',
      });
    }

    // PULLIK: CARD OWNER
    if (s === STATES.TOUR_CREATE_CARD_OWNER) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_CARD_OWNER_LEN);
      if (v.length < 3) {
        return ctx.reply(ctx.t('tour_create_card_owner_short'));
      }
      ctx.session.data.cardOwner = v;
      ctx.session.state = STATES.TOUR_CREATE_PAYMENT_INSTR;

      return ctx.reply(ctx.t('payment_instruction_prompt'), {
        parse_mode: 'HTML',
      });
    }

    // PULLIK: PAYMENT INSTRUCTION
    if (s === STATES.TOUR_CREATE_PAYMENT_INSTR) {
      const v = cleanText(ctx.message.text, 300);
      ctx.session.data.instruction = v.toLowerCase() === '/skip' ? '' : v;
      ctx.session.state = STATES.TOUR_CREATE_PAYMENT_DEADLINE;

      return ctx.reply(ctx.t('payment_deadline_prompt'), {
        parse_mode: 'HTML',
      });
    }

    // PULLIK: PAYMENT DEADLINE
    if (s === STATES.TOUR_CREATE_PAYMENT_DEADLINE) {
      const v = cleanText(ctx.message.text, 20);
      if (v.toLowerCase() !== '/skip') {
        const parts = v.split(' ');
        if (parts.length === 2) {
          ctx.session.data.paymentDeadline = v;
        } else {
          return ctx.reply(ctx.t('tour_create_date_format_error'));
        }
      } else {
        ctx.session.data.paymentDeadline = null;
      }

      return moveToImageStep(ctx);
    }

    // RASM
    if (s === STATES.TOUR_CREATE_IMAGE) {
      const v = cleanText(ctx.message.text, 10).toLowerCase();
      if (v === '/skip') {
        ctx.session.data.imageFileId = null;
        ctx.session.state = STATES.TOUR_CREATE_DATE;
        return ctx.reply(ctx.t('tour_create_date_prompt'), {
          reply_markup: backToMain(ctx).reply_markup,
        });
      }
      return ctx.reply(ctx.t('tour_create_image_error'), backToMain(ctx));
    }

    // SANA
    if (s === STATES.TOUR_CREATE_DATE) {
      const v = cleanText(ctx.message.text, 10);
      if (!isValidDate(v)) {
        return ctx.reply(ctx.t('tour_create_date_error'), backToMain(ctx));
      }
      ctx.session.data.date = v;
      ctx.session.state = STATES.TOUR_CREATE_TIME;
      return ctx.reply(ctx.t('tour_create_time_prompt'), {
        reply_markup: backToMain(ctx).reply_markup,
      });
    }

    // VAQT
    if (s === STATES.TOUR_CREATE_TIME) {
      const v = cleanText(ctx.message.text, 5);
      if (!isValidTime(v)) {
        return ctx.reply(ctx.t('tour_create_time_error'), backToMain(ctx));
      }
      ctx.session.data.startTime = v;
      ctx.session.state = STATES.TOUR_CREATE_MODE;
      return ctx.reply(ctx.t('tour_create_mode_prompt'), {
        reply_markup: backToMain(ctx).reply_markup,
      });
    }

    // REJIM
    if (s === STATES.TOUR_CREATE_MODE) {
      const mode = cleanText(ctx.message.text, 20);
      if (!['solo', 'duo', 'squad'].includes(mode.toLowerCase())) {
        return ctx.reply(ctx.t('tour_create_mode_error'), backToMain(ctx));
      }
      ctx.session.data.mode =
        mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
      ctx.session.state = STATES.TOUR_CREATE_PRIZE;
      return ctx.reply(ctx.t('tour_create_prize_prompt'), {
        parse_mode: 'HTML',
        reply_markup: backToMain(ctx).reply_markup,
      });
    }

    // PRIZ
    if (s === STATES.TOUR_CREATE_PRIZE) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_PRIZE_LEN);
      if (!v) return ctx.reply(ctx.t('tour_create_prize_error'), backToMain(ctx));
      ctx.session.data.prize = v;
      ctx.session.state = STATES.TOUR_CREATE_MAP_TAG;
      return ctx.reply(ctx.t('tour_create_map_prompt'), {
        parse_mode: 'HTML',
        reply_markup: backToMain(ctx).reply_markup,
      });
    }

    // MAP
    if (s === STATES.TOUR_CREATE_MAP_TAG) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_MAP_TAG_LEN);
      if (!v) return ctx.reply(ctx.t('tour_create_map_error'), backToMain(ctx));
      ctx.session.data.mapTag = v;
      ctx.session.state = STATES.TOUR_CREATE_ETAPA;
      return ctx.reply(ctx.t('tour_create_etapa_prompt'), {
        parse_mode: 'HTML',
        reply_markup: backToMain(ctx).reply_markup,
      });
    }

    // ETAP
    if (s === STATES.TOUR_CREATE_ETAPA) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_ETAPA_LEN);
      if (!v) return ctx.reply(ctx.t('tour_create_etapa_error'), backToMain(ctx));
      ctx.session.data.etapa = v;
      ctx.session.state = STATES.TOUR_CREATE_MAXTEAMS;
      return ctx.reply(
        ctx.t('tour_create_maxteams_prompt', {
          max: LIMITS.MAX_TEAMS_PER_TOURNAMENT,
        }),
        { reply_markup: backToMain(ctx).reply_markup }
      );
    }

    // MAKS. KOMANDALAR
    if (s === STATES.TOUR_CREATE_MAXTEAMS) {
      const v = cleanText(ctx.message.text, 3);
      if (!isPositiveInt(v)) {
        return ctx.reply(ctx.t('tour_create_maxteams_error'), backToMain(ctx));
      }
      ctx.session.data.maxTeams = Math.min(
        Number(v),
        LIMITS.MAX_TEAMS_PER_TOURNAMENT
      );
      ctx.session.state = STATES.TOUR_CREATE_DESC;
      return ctx.reply(ctx.t('tour_create_desc_prompt'), backToMain(ctx));
    }

    // IZOH
    if (s === STATES.TOUR_CREATE_DESC) {
      const v = cleanText(ctx.message.text, LIMITS.MAX_DESC_LEN);
      ctx.session.data.description = v.toLowerCase() === '/skip' ? '' : v;
      ctx.session.state = STATES.TOUR_CREATE_DEADLINE;
      return ctx.reply(ctx.t('tour_create_deadline_prompt'), backToMain(ctx));
    }

    // MUDDAT
    if (s === STATES.TOUR_CREATE_DEADLINE) {
      const v = cleanText(ctx.message.text, 20);
      if (v.toLowerCase() !== '/skip') {
        const [d, tm] = v.split(' ');
        if (isValidDate(d) && isValidTime(tm)) {
          ctx.session.data.registrationDeadline = parseDateTime(
            d,
            tm
          ).toISOString();
        } else {
          return ctx.reply(ctx.t('tour_create_deadline_error'), backToMain(ctx));
        }
      }
      ctx.session.state = STATES.TOUR_CREATE_HOST;
      return sendHostPicker(ctx);
    }

    return next();
  });

  // ============================================================
  // 10. RASM QABUL QILISH
  // ============================================================
  bot.on('photo', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s === STATES.TOUR_CREATE_IMAGE) {
      if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
        ctx.session = { state: null, data: {} };
        return;
      }
      ctx.session.data.imageFileId =
        ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.session.state = STATES.TOUR_CREATE_DATE;
      return ctx.reply(ctx.t('tour_create_date_prompt'), {
        reply_markup: backToMain(ctx).reply_markup,
      });
    }
    return next();
  });

  // ============================================================
  // 11. TURNIR UCHUN KARTA TANLASH
  // ============================================================
  bot.action(/^tpick:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    if (!ctx.session?.data) return;

    const cardId = ctx.match[1];
    if (cardId === 'skip') {
      ctx.session.data.cardId = null;
      ctx.session.data.cardNumber = null;
      ctx.session.data.cardOwner = null;
      return moveToImageStep(ctx);
    }

    const card = await cardService.getCard(cardId);
    if (!card) return ctx.reply(ctx.t('error_not_found'));

    ctx.session.data.cardId = card.id;
    ctx.session.data.cardNumber = card.number;
    ctx.session.data.cardOwner = card.owner;
    ctx.session.data.cardPhone = card.phone;
    ctx.session.data.cardType = card.type;
    ctx.session.data.cardBank = card.bank;

    await safeEdit(
      ctx,
      `✅ <b>Karta tanlandi</b>\n\n` +
        `👤 ${escapeHtml(card.owner)}\n` +
        `🔢 <code>${cardService.formatCardNumber(card.number)}</code>\n` +
        (card.phone ? `📱 <code>${escapeHtml(card.phone)}</code>\n` : '') +
        (card.bank ? `🏦 ${escapeHtml(card.bank)}\n` : ''),
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('➡️ Davom etish', 'tour:card_confirm')],
            [Markup.button.callback('🔄 Boshqa karta', 'tour:card_change')],
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  });

  bot.action('tour:card_confirm', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    return moveToImageStep(ctx);
  });

  bot.action('tour:card_change', async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;
    return showCardPicker(ctx);
  });

  bot.action(CALLBACK.TOUR_CARD_MANUAL, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    ctx.session.state = STATES.TOUR_CREATE_CARD_NUMBER;

    await ctx.reply(
      `✏️ <b>Qo'lda kiritish</b>\n\n` +
        `💳 <b>Karta raqamini kiriting:</b>\n\n` +
        `<i>Masalan: 8600 1234 5678 9012</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', CALLBACK.TOUR_CANCEL)],
          ],
        },
      }
    );
  });

  // ============================================================
  // 12. TURNIR ID MATN SIFATIDA
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state) return next();

    const text = (ctx.message.text || '').trim();
    const match = text.match(/^(tour_[a-z0-9]+)$/i);
    if (!match) return next();

    const t = await tournamentService.getTournament(match[1]);
    if (!t) {
      return ctx.reply(
        `❗ <b>${ctx.t('tour_id_not_found')}</b>\n\n` +
          `${ctx.t('tour_id_sent')}: <code>${escapeHtml(text)}</code>`,
        { parse_mode: 'HTML', reply_markup: backToMain(ctx).reply_markup }
      );
    }

    const user = await userService.getUser(ctx.from.id);
    const team = user?.teamId ? await teamService.getTeam(user.teamId) : null;

    const isStaff = hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER]);
    const isCaptain = !!(
      team && Number(team.captainId) === Number(ctx.from.id)
    );
    const isRegistered = !!(team && t.registeredTeams.includes(team.id));
    const isFull = t.registeredTeams.length >= t.maxTeams;
    const isClosed = !!(
      t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
    );

    const summary = formatTournamentText(t, true);
    const buttons = [
      [
        Markup.button.callback(
          ctx.t('tour_standings'),
          CALLBACK.TOUR_STANDINGS + t.id
        ),
      ],
      [
        Markup.button.callback(
          ctx.t('tour_teamlist'),
          CALLBACK.TOUR_TEAMLIST + t.id
        ),
      ],
    ];

    if (isCaptain && !isRegistered && !isFull && !isClosed) {
      const regLabel =
        t.type === 'paid'
          ? ctx.t('tour_register_paid')
          : ctx.t('tour_register');
      buttons.push([
        Markup.button.callback(regLabel, CALLBACK.TOUR_REGISTER + t.id),
      ]);
    }

    if (isCaptain && isRegistered) {
      buttons.push([
        Markup.button.callback(
          '✅ ' + ctx.t('already_registered'),
          'no_action'
        ),
      ]);
    }

    if (team && isRegistered) {
      if (t.roomId && t.roomPassword) {
        buttons.push([
          Markup.button.callback(
            ctx.t('tour_room_info'),
            CALLBACK.TOUR_ROOM_INFO + t.id
          ),
        ]);
      } else {
        buttons.push([
          Markup.button.callback(
            ctx.t('tour_room_waiting'),
            CALLBACK.TOUR_ROOM_INFO + t.id
          ),
        ]);
      }

      buttons.push([
        Markup.button.callback(
          ctx.t('tour_contact_host'),
          CALLBACK.TOUR_CONTACT_HOST + t.id
        ),
      ]);
    }

    if (isStaff) {
      buttons.push([
        Markup.button.callback(ctx.t('tour_edit'), CALLBACK.TOUR_EDIT + t.id),
      ]);
      buttons.push([
        Markup.button.callback(
          ctx.t('tour_assign_host'),
          CALLBACK.TOUR_ASSIGN_HOST + t.id
        ),
      ]);
      buttons.push([
        Markup.button.callback(ctx.t('tour_report'), CALLBACK.TOUR_REPORT + t.id),
      ]);
    }

    buttons.push([
      Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN),
    ]);

    if (t.imageFileId) {
      try {
        return ctx.replyWithPhoto(t.imageFileId, {
          caption: summary,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (e) {}
    }

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  });

  // ============================================================
  // 13. TURNIRNI TAHRIRLASH
  // ============================================================
  bot.action(/^tour:edit:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🏆 ' + ctx.t('name'),
          'tour:editf:' + tId + ':title'
        ),
      ],
      [
        Markup.button.callback(
          '📅 ' + ctx.t('date'),
          'tour:editf:' + tId + ':date'
        ),
      ],
      [
        Markup.button.callback(
          '⏰ ' + ctx.t('time'),
          'tour:editf:' + tId + ':time'
        ),
      ],
      [
        Markup.button.callback(
          '🎮 ' + ctx.t('mode'),
          'tour:editf:' + tId + ':mode'
        ),
      ],
      [Markup.button.callback('💲 PRIZ', 'tour:editf:' + tId + ':prize')],
      [Markup.button.callback('♾️ MAP', 'tour:editf:' + tId + ':mapTag')],
      [
        Markup.button.callback(
          '⭐️ ' + ctx.t('stage'),
          'tour:editf:' + tId + ':etapa'
        ),
      ],
      [
        Markup.button.callback(
          '👥 ' + ctx.t('max_teams'),
          'tour:editf:' + tId + ':maxTeams'
        ),
      ],
      [
        Markup.button.callback(
          '📄 ' + ctx.t('description'),
          'tour:editf:' + tId + ':desc'
        ),
      ],
      [
        Markup.button.callback(
          '🎙 ' + ctx.t('host_label'),
          'tour:editf:' + tId + ':host'
        ),
      ],
      [
        Markup.button.callback(
          ctx.t('btn_back_tournament'),
          CALLBACK.TOUR_OPEN + tId
        ),
      ],
    ]);

    await safeEdit(
      ctx,
      `✏️ <b>${ctx.t('tour_edit_title')}</b>\n\n` +
        `🏆 ${ctx.t('name')}: <b>${escapeHtml(t.title)}</b>\n` +
        `📅 ${ctx.t('date')}: <b>${t.date}</b>\n` +
        `⏰ ${ctx.t('time')}: <b>${t.startTime}</b>\n` +
        `🎮 ${ctx.t('mode')}: <b>${escapeHtml(t.mode)}</b>\n` +
        `💲 PRIZ: <b>${escapeHtml(t.prize || '-')}</b>\n` +
        `♾️ MAP: <b>${escapeHtml(t.mapTag || '-')}</b>\n` +
        `⭐️ ${ctx.t('stage')}: <b>${escapeHtml(t.etapa || '-')}</b>\n` +
        `👥 ${ctx.t('max_teams')}: <b>${t.maxTeams}</b>\n\n` +
        `${ctx.t('tour_edit_hint')}`,
      { reply_markup: kb.reply_markup }
    );
  });

  bot.action(/^tour:editf:(.+):(\w+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const field = ctx.match[2];

    const prompts = {
      title: '🏆 ' + ctx.t('tour_edit_name_prompt'),
      date: '📅 ' + ctx.t('tour_edit_date_prompt'),
      time: '⏰ ' + ctx.t('tour_edit_time_prompt'),
      mode: '🎮 ' + ctx.t('tour_edit_mode_prompt'),
      prize: '💲 ' + ctx.t('tour_edit_prize_prompt'),
      mapTag: '♾️ ' + ctx.t('tour_edit_map_prompt'),
      etapa: '⭐️ ' + ctx.t('tour_edit_etapa_prompt'),
      maxTeams: `👥 ${ctx.t('tour_edit_maxteams_prompt', {
        max: LIMITS.MAX_TEAMS_PER_TOURNAMENT,
      })}`,
      desc: '📄 ' + ctx.t('tour_edit_desc_prompt'),
      host: '🎙 ' + ctx.t('tour_edit_host_prompt'),
    };

    const prompt = prompts[field];
    if (!prompt) return ctx.reply(ctx.t('error_wrong_field'));

    ctx.session = { state: 'tour_edit_field', data: { tid: tId, field } };

    await ctx.reply(prompt, backToTournament(tId));
  });

  // ============================================================
  // 14. FSM — TURNIR TAHRIRLASH
  // ============================================================
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.state !== 'tour_edit_field') return next();

    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('error_access'));
    }

    const { tid, field } = ctx.session.data;
    const t = await tournamentService.getTournament(tid);
    if (!t) {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('tour_not_found'));
    }

    const v = cleanText(ctx.message.text, 200);
    const patch = {};

    if (field === 'title') {
      if (v.length < 3) return ctx.reply(ctx.t('tour_create_name_short'));
      patch.title = v;
    } else if (field === 'date') {
      if (!isValidDate(v)) return ctx.reply(ctx.t('tour_create_date_error'));
      patch.date = v;
    } else if (field === 'time') {
      if (!isValidTime(v)) return ctx.reply(ctx.t('tour_create_time_error'));
      patch.startTime = v;
    } else if (field === 'mode') {
      if (!['solo', 'duo', 'squad'].includes(v.toLowerCase())) {
        return ctx.reply(ctx.t('tour_create_mode_error'));
      }
      patch.mode = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    } else if (field === 'prize') {
      patch.prize = v;
    } else if (field === 'mapTag') {
      patch.mapTag = v;
    } else if (field === 'etapa') {
      patch.etapa = v;
    } else if (field === 'maxTeams') {
      if (!isPositiveInt(v)) return ctx.reply(ctx.t('tour_create_maxteams_error'));
      patch.maxTeams = Math.min(Number(v), LIMITS.MAX_TEAMS_PER_TOURNAMENT);
    } else if (field === 'desc') {
      patch.description = v;
    } else if (field === 'host') {
      if (!isPositiveInt(v)) return ctx.reply(ctx.t('error_only_digits'));
      const hostId = Number(v);
      const isHost = await roleService.has('host', hostId);
      if (!isHost) return ctx.reply(ctx.t('error_not_host'));
      await tournamentService.setHost(tid, hostId);
      patch.hostId = hostId;
    } else {
      ctx.session = { state: null, data: {} };
      return ctx.reply(ctx.t('error_wrong_field'));
    }

    if (Object.keys(patch).length) {
      await tournamentService.updateTournament(tid, patch);
    }

    ctx.session = { state: null, data: {} };

    await ctx.reply(
      `✅ <b>${ctx.t('success_changed')}</b>\n\n` +
        `🏆 <b>${escapeHtml(t.title)}</b>`,
      { parse_mode: 'HTML', reply_markup: backToTournament(tid).reply_markup }
    );
  });

  // ============================================================
  // 15. HOST BIRIKTIRISH
  // ============================================================
  bot.action(/^tour:ah:(.+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) {
      return ctx.reply(ctx.t('error_access'));
    }

    const tId = ctx.match[1];
    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    const hosts = await roleService.list('host');
    if (!hosts.length) {
      return ctx.reply(ctx.t('host_no_hosts'), {
        reply_markup: backToTournament(tId).reply_markup,
      });
    }

    const rows = hosts.slice(0, 10).map((h) => [
      Markup.button.callback(
        `🎙 ${h.id}${t.hostId === h.id ? ' ' + ctx.t('host_current') : ''}`,
        'tour:ah_set:' + tId + ':' + h.id
      ),
    ]);
    rows.push([
      Markup.button.callback(ctx.t('btn_cancel'), CALLBACK.TOUR_OPEN + tId),
    ]);

    await ctx.reply(
      `🎙 <b>${ctx.t('tour_assign_host')}</b>\n\n` +
        `🏆 <b>${escapeHtml(t.title)}</b>\n` +
        `${ctx.t('host_current_label')}: <b>${t.hostId || ctx.t('no')}</b>\n\n` +
        `${ctx.t('host_pick_new')}`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      }
    );
  });

  bot.action(/^tour:ah_set:(.+):(\d+)$/, async (ctx) => {
    await safeAnswer(ctx);
    if (!hasAnyRole(ctx.state.role, [ROLES.ADMIN, ROLES.ORGANIZER])) return;

    const tId = ctx.match[1];
    const hostId = parseInt(ctx.match[2], 10);

    const t = await tournamentService.getTournament(tId);
    if (!t) return ctx.reply(ctx.t('tour_not_found'));

    const oldHostId = t.hostId;

    if (oldHostId === hostId) {
      return ctx.reply(ctx.t('host_already_assigned'));
    }

    await tournamentService.setHost(tId, hostId);

    if (oldHostId) {
      try {
        await ctx.telegram.sendMessage(
          oldHostId,
          `ℹ️ <b>${escapeHtml(t.title)}</b> ${ctx.t('host_removed')}`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }

    try {
      await ctx.telegram.sendMessage(
        hostId,
        `🎙 <b>${ctx.t('host_new_assigned_title')}</b>\n\n` +
          `🏆 <b>${escapeHtml(t.title)}</b>\n` +
          `📅 ${t.date} | ⏰ ${t.startTime}\n\n` +
          `${ctx.t('host_new_assigned_desc')}`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}

    await ctx.reply(
      `✅ <b>${ctx.t('host_assigned')}</b>\n\n` +
        `🎙 ${ctx.t('host_label')}: <code>${hostId}</code>`,
      { parse_mode: 'HTML', reply_markup: backToTournament(tId).reply_markup }
    );
  });
};

// ============================================================
// YORDAMCHI: TURNIRLAR RO'YXATI
// ============================================================
async function showTournamentList(ctx, key, page) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();

  let list = [];
  let sectionNameKey = '';
  let sectionEmoji = '';
  let sectionKey = '';

  if (key === CALLBACK.TOUR_TODAY) {
    list = all.filter((t) => {
      const d = parseDateTime(t.date, t.startTime);
      return d && isSameDayTashkent(d, now);
    });
    sectionNameKey = 'tour_today';
    sectionEmoji = '📅';
    sectionKey = 'today';
  } else if (key === CALLBACK.TOUR_UPCOMING) {
    list = all.filter((t) => {
      const d = parseDateTime(t.date, t.startTime);
      return d && d > now && !isSameDayTashkent(d, now);
    });
    sectionNameKey = 'tour_upcoming';
    sectionEmoji = '⏭';
    sectionKey = 'upcoming';
  } else {
    list = all.filter((t) => {
      const d = parseDateTime(t.date, t.startTime);
      return d && d < now;
    });
    sectionNameKey = 'tour_finished';
    sectionEmoji = '✅';
    sectionKey = 'finished';
  }

  list.sort((a, b) => {
    const da = parseDateTime(a.date, a.startTime) || new Date(0);
    const db = parseDateTime(b.date, b.startTime) || new Date(0);
    return sectionKey === 'finished' ? db - da : da - db;
  });

  if (!list.length) {
    return safeEdit(
      ctx,
      `${sectionEmoji} <b>${ctx.t(sectionNameKey)}</b>\n\n📭 ${ctx.t(
        'tour_empty'
      )}`,
      backToList()
    );
  }

  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = currentPage * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const lines = [];
  lines.push(`${sectionEmoji} <b>${ctx.t(sectionNameKey)}</b>`);
  lines.push(
    ctx.t('tour_page_info', {
      total: list.length,
      page: currentPage + 1,
      pages: totalPages,
    })
  );
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  pageItems.forEach((t, i) => {
    const num = start + i + 1;
    const regStatus =
      t.registeredTeams.length >= t.maxTeams
        ? '🔴'
        : t.registrationDeadline &&
          new Date(t.registrationDeadline) < new Date()
        ? '⚫️'
        : '🟢';
    const typeEmoji = t.type === 'paid' ? '💳' : '🆓';

    lines.push(
      `<b>${num}. ${escapeHtml(t.title)}</b> ${typeEmoji}\n` +
        `   📅 ${t.date} | ⏰ ${t.startTime}\n` +
        `   🎮 ${escapeHtml(t.mode)} | 👥 ${t.registeredTeams.length}/${
          t.maxTeams
        } ${regStatus}`
    );
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push(`💡 <i>${ctx.t('tour_press_to_open')}</i>`);

  const buttons = [];
  pageItems.forEach((t, i) => {
    const num = start + i + 1;
    const title = t.title.length > 30 ? t.title.slice(0, 27) + '...' : t.title;
    buttons.push([
      Markup.button.callback(`🔍 ${num}. ${title}`, CALLBACK.TOUR_OPEN + t.id),
    ]);
  });

  const paginationRow = [];
  if (currentPage > 0) {
    paginationRow.push(
      Markup.button.callback(
        '⬅️ ' + ctx.t('btn_prev'),
        `tour:page:${sectionKey}:${currentPage - 1}`
      )
    );
  }
  if (currentPage < totalPages - 1) {
    paginationRow.push(
      Markup.button.callback(
        ctx.t('btn_next') + ' ➡️',
        `tour:page:${sectionKey}:${currentPage + 1}`
      )
    );
  }
  if (paginationRow.length) buttons.push(paginationRow);

  buttons.push([
    Markup.button.callback(ctx.t('menu_tournaments'), CALLBACK.MENU_TOURNAMENTS),
  ]);
  buttons.push([Markup.button.callback(ctx.t('menu_main'), CALLBACK.MENU_MAIN)]);

  const text = lines.join('\n');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e) {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

// ============================================================
// YORDAMCHI: HOST TANLASH
// ============================================================
async function sendHostPicker(ctx) {
  const hosts = await roleService.list('host');

  if (!hosts.length) {
    ctx.session.state = STATES.TOUR_CREATE_CONFIRM;
    ctx.session.data.hostId = null;
    const summary = await buildConfirmSummary(ctx, ctx.session.data);
    return ctx.reply(
      `⚠️ <i>${ctx.t('host_none_skip')}</i>\n\n` + summary,
      { parse_mode: 'HTML', ...confirmTournament(ctx) }
    );
  }

  const rows = hosts.slice(0, 10).map((h) => [
    Markup.button.callback(
      `🎙 ${ctx.t('host_label')} ID: ${h.id}`,
      CALLBACK.TOUR_PICK_HOST + 'host_' + h.id
    ),
  ]);
  rows.push([Markup.button.callback('⏭ ' + ctx.t('host_skip'), 'tour:ph:skip')]);
  rows.push([Markup.button.callback(ctx.t('btn_cancel'), CALLBACK.TOUR_CANCEL)]);

  await ctx.reply(
    `🎙 <b>${ctx.t('tour_assign_host')}</b>\n\n` + `${ctx.t('host_pick_hint')}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
  );
}

// ============================================================
// YORDAMCHI: TASDIQLASH XULOSASI
// ============================================================
async function buildConfirmSummary(ctx, d) {
  let hostName = `❌ ${ctx.t('no')}`;
  if (d.hostId) {
    const host = await userService.getUser(d.hostId);
    hostName = host ? `🎙 ${escapeHtml(displayName(host))}` : `ID: ${d.hostId}`;
  }

  const typeLabel =
    d.type === 'paid'
      ? `💳 ${ctx.t('tour_type_paid')} (${d.amount || '?'} ${
          d.currency || ''
        })`
      : `🆓 ${ctx.t('tour_type_free')}`;

  const channelCount = (d.requiredChannels || []).length;

  return (
    `╔══════════════════════╗\n` +
    `   📋 <b>${ctx.t('confirm_title')}</b>\n` +
    `╚══════════════════════╝\n\n` +
    `🏆 ${ctx.t('name')}: <b>${escapeHtml(d.title)}</b>\n` +
    `💳 ${ctx.t('tour_type_label')}: <b>${typeLabel}</b>\n` +
    `🖼 ${ctx.t('image')}: <b>${d.imageFileId ? '✅' : ctx.t('no')}</b>\n` +
    `📅 ${ctx.t('date')}: <b>${d.date}</b>\n` +
    `⏰ ${ctx.t('time')}: <b>${d.startTime}</b>\n` +
    `🎮 ${ctx.t('mode')}: <b>${escapeHtml(d.mode)}</b>\n` +
    `💲 PRIZ: <b>${escapeHtml(d.prize || '-')}</b>\n` +
    `♾️ MAP: <b>${escapeHtml(d.mapTag || '-')}</b>\n` +
    `⭐️ ${ctx.t('stage')}: <b>${escapeHtml(d.etapa || '-')}</b>\n` +
    `👥 ${ctx.t('max_teams')}: <b>${d.maxTeams}</b>\n` +
    (d.type === 'paid'
      ? `💰 ${ctx.t('payment_amount')}: <b>${d.amount} ${d.currency}</b>\n💳 ${ctx.t(
          'payment_card'
        )}: <code>${escapeHtml(d.cardNumber || '-')}</code>\n` +
        (d.cardOwner
          ? `👤 ${ctx.t('payment_card_owner')}: <b>${escapeHtml(
              d.cardOwner
            )}</b>\n`
          : '')
      : '') +
    (d.type === 'free' && channelCount
      ? `📢 ${ctx.t('required_channels')}: <b>${channelCount}</b>\n`
      : '') +
    `🎙 ${ctx.t('host_label')}: ${hostName}`
  );
}

// ============================================================
// YORDAMCHI: TURNIR MATNI
// ============================================================
function formatTournamentText(t, detailed = false) {
  const regStatus =
    t.registeredTeams.length >= t.maxTeams
      ? "🔴 To'lgan"
      : t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
      ? "🔴 Yopilgan"
      : '🟢 Ochiq';

  const lines = [
    `🏆 <b>${escapeHtml(t.title)}</b>`,
    `📅 Sana: <b>${t.date}</b>`,
    `⏰ Vaqt: <b>${t.startTime}</b> (${t.timezone || 'Asia/Tashkent'})`,
    `🎮 Rejim: <b>${escapeHtml(t.mode)}</b> | 🗺 <b>${escapeHtml(
      t.map || DEFAULT_MAP
    )}</b>`,
  ];

  if (t.prize) lines.push(`💲 PRIZ: <b>${escapeHtml(t.prize)}</b>`);
  if (t.mapTag) lines.push(`♾️ MAP: <b>${escapeHtml(t.mapTag)}</b>`);
  if (t.etapa) lines.push(`⭐️ Etap: <b>${escapeHtml(t.etapa)}</b>`);

  if (t.type === 'paid') {
    lines.push(
      `💳 Turi: <b>Pullik</b> — <b>${t.payment?.amount} ${t.payment?.currency}</b>`
    );
  } else {
    lines.push(`🆓 Turi: <b>Bepul</b>`);
    if (t.requiredChannels?.length) {
      lines.push(
        `📢 Majburiy kanallar: <b>${t.requiredChannels.length}</b> ta`
      );
    }
  }

  lines.push(`👥 Komandalar: <b>${t.registeredTeams.length}/${t.maxTeams}</b>`);
  lines.push(`📝 Ro'yxatdan o'tish: <b>${regStatus}</b>`);
  lines.push(`🎙 Host: <b>${t.hostId ? 'biriktirilgan ✅' : "yo'q"}</b>`);

  if (detailed && t.description) {
    lines.push(`\n📄 ${escapeHtml(t.description)}`);
  }
  if (detailed) {
    lines.push(`\n🆔 ID: <code>${t.id}</code>`);
  }

  return lines.join('\n');
}
