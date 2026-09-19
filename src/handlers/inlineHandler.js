// Telegram Inline rejim handleri
// Foydalanuvchi @EsportArenaBot <so'rov> yozganda ishlaydi
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const { escapeHtml } = require('../utils/telegramUtils');
const { parseDateTime } = require('../utils/dateUtils');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // INLINE QUERY HANDLER
  // ============================================================
  bot.on('inline_query', async (ctx) => {
    try {
      const query = (ctx.inlineQuery.query || '').trim();
      const results = await buildResults(query);

      if (results.length === 0) {
        return ctx.answerInlineQuery([], {
          cache_time: 3,
          switch_pm_text: '🎮 Botni ochish',
          switch_pm_parameter: 'inline_empty',
        });
      }

      return ctx.answerInlineQuery(results, {
        cache_time: 3,
        is_personal: false,
      });
    } catch (e) {
      console.error('Inline query xatosi:', e.message);
      try {
        return ctx.answerInlineQuery([], { cache_time: 1 });
      } catch {}
    }
  });
};

// ============================================================
// NATIJALARNI TAYYORLASH
// ============================================================
async function buildResults(query) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();

  // ---------- 1. Turnir ID si bo'yicha (tour_xxx) ----------
  if (/^tour_[a-z0-9]+$/i.test(query)) {
    const t = all.find((x) => x.id === query);
    if (t) return [buildTournamentResult(t, true)];
    return [buildNotFound(query)];
  }

  // ---------- 2. Komanda qidirish (team TAG) ----------
  if (query.toLowerCase().startsWith('team ')) {
    const tag = query.slice(5).trim().toUpperCase();
    if (!tag) return [];
    const teams = await teamService.getAllTeams();
    const found = teams
      .filter(
        (t) =>
          t.tag.toUpperCase().includes(tag) ||
          t.name.toUpperCase().includes(tag)
      )
      .slice(0, 20);
    return found.map(buildTeamResult);
  }

  // ---------- 3. Bo'sh query — kelajakdagi turnirlar ----------
  if (!query) {
    const upcoming = all
      .filter((t) => {
        const d = parseDateTime(t.date, t.startTime);
        return d && d > now;
      })
      .sort((a, b) => {
        const da = parseDateTime(a.date, a.startTime);
        const db = parseDateTime(b.date, b.startTime);
        return da - db;
      })
      .slice(0, 20);

    if (upcoming.length === 0) {
      return [buildEmptyResult()];
    }
    return upcoming.map((t) => buildTournamentResult(t, false));
  }

  // ---------- 4. Matn bo'yicha qidirish ----------
  const q = query.toLowerCase();
  const found = all
    .filter(
      (t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.mode || '').toLowerCase().includes(q) ||
        (t.map || '').toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const da = parseDateTime(a.date, a.startTime);
      const db = parseDateTime(b.date, b.startTime);
      return da - db;
    })
    .slice(0, 20);

  return found.map((t) => buildTournamentResult(t, false));
}

// ============================================================
// TURNIR NATIJASI
// ============================================================
function buildTournamentResult(t, detailed) {
  const regStatus =
    t.registeredTeams.length >= t.maxTeams
      ? '🔴 To\'lgan'
      : (t.registrationDeadline && new Date(t.registrationDeadline) < new Date()
          ? '🔴 Yopilgan'
          : '🟢 Ochiq');

  const text =
    `🏆 <b>${escapeHtml(t.title)}</b>\n\n` +
    `📅 Sana: <b>${t.date}</b>\n` +
    `⏰ Vaqt: <b>${t.startTime}</b> (${t.timezone})\n` +
    `🎮 Rejim: <b>${escapeHtml(t.mode)}</b>\n` +
    `🗺 Xarita: <b>${escapeHtml(t.map || 'Erangel')}</b>\n` +
    `👥 Komandalar: <b>${t.registeredTeams.length}/${t.maxTeams}</b>\n` +
    `📝 Ro'yxat: <b>${regStatus}</b>\n` +
    `🎙 Host: <b>${t.hostId ? 'bor ✅' : 'yo\'q'}</b>\n` +
    (detailed ? `\n🆔 ID: <code>${t.id}</code>\n` : '') +
    (detailed && t.description ? `\n📄 ${escapeHtml(t.description)}` : '');

  const keyboard = {
    inline_keyboard: [
      [
        Markup.button.url(
          '🎮 Turnirga kirish',
          `https://t.me/${config.BOT_USERNAME}?start=tour_${t.id}`
        ),
      ],
    ],
  };

  // Rasm mavjud bo'lsa — photo result
  if (t.imageFileId) {
    return {
      type: 'photo',
      id: `tour_${t.id}`,
      photo_file_id: t.imageFileId,
      title: `🏆 ${t.title}`,
      description: `${t.date} • ${t.startTime} • ${t.mode} • ${t.registeredTeams.length}/${t.maxTeams}`,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    };
  }

  // Rasm yo'q — article result
  return {
    type: 'article',
    id: `tour_${t.id}`,
    title: `🏆 ${t.title}`,
    description: `${t.date} • ${t.startTime} • ${t.mode} • ${t.registeredTeams.length}/${t.maxTeams}`,
    input_message_content: {
      message_text: text,
      parse_mode: 'HTML',
    },
    reply_markup: keyboard,
  };
}

// ============================================================
// KOMANDA NATIJASI
// ============================================================
function buildTeamResult(team) {
  const text =
    `👥 <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>\n\n` +
    `👑 Captain ID: <code>${team.captainId}</code>\n` +
    `👥 A'zolar: <b>${team.members.length}/8</b>\n` +
    `🔑 Qo'shilish kodi: <code>${team.joinCode}</code>`;

  const keyboard = {
    inline_keyboard: [
      [
        Markup.button.url(
          '🔑 Komandaga qo\'shilish',
          `https://t.me/${config.BOT_USERNAME}?start=join_${team.joinCode}`
        ),
      ],
    ],
  };

  if (team.avatarFileId) {
    return {
      type: 'photo',
      id: `team_${team.id}`,
      photo_file_id: team.avatarFileId,
      title: `👥 ${team.name} [${team.tag}]`,
      description: `👥 ${team.members.length}/8 a'zo`,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    };
  }

  return {
    type: 'article',
    id: `team_${team.id}`,
    title: `👥 ${team.name} [${team.tag}]`,
    description: `👥 ${team.members.length}/8 a'zo`,
    input_message_content: {
      message_text: text,
      parse_mode: 'HTML',
    },
    reply_markup: keyboard,
  };
}

// ============================================================
// TURNIR TOPILMADI
// ============================================================
function buildNotFound(query) {
  return {
    type: 'article',
    id: 'not_found',
    title: '❌ Turnir topilmadi',
    description: `"${query}" bo'yicha natija yo'q`,
    input_message_content: {
      message_text:
        `❌ <b>Turnir topilmadi</b>\n\n` +
        `Qidirilgan ID: <code>${escapeHtml(query)}</code>\n\n` +
        `💡 <i>ID to'g'ri kiritilganini tekshiring.</i>`,
      parse_mode: 'HTML',
    },
  };
}

// ============================================================
// BO'SH NATIJA
// ============================================================
function buildEmptyResult() {
  return {
    type: 'article',
    id: 'empty',
    title: '📭 Hozircha turnirlar yo\'q',
    description: 'Yangi turnirlar tez orada qo\'shiladi',
    input_message_content: {
      message_text:
        `📭 <b>Hozircha faol turnirlar yo'q</b>\n\n` +
        `💡 <i>Yangi turnirlar haqida xabar olish uchun botni kuzatib turing.</i>`,
      parse_mode: 'HTML',
    },
    reply_markup: {
      inline_keyboard: [
        [
          Markup.button.url(
            '🎮 Botni ochish',
            `https://t.me/${config.BOT_USERNAME}`
          ),
        ],
      ],
    },
  };
}