// ============================================================
// INLINE HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const tournamentService = require('../services/tournamentService');
const teamService = require('../services/teamService');
const { escapeHtml } = require('../utils/telegramUtils');
const { parseDateTime } = require('../utils/dateUtils');
const config = require('../config');

module.exports = (bot) => {
  // ============================================================
  // INLINE QUERY
  // ============================================================
  bot.on('inline_query', async (ctx) => {
    const t = ctx.t || ((key) => key);

    try {
      const query = (ctx.inlineQuery.query || '').trim();
      const results = await buildResults(query, t);

      if (results.length === 0) {
        return ctx.answerInlineQuery([], {
          cache_time: 3,
          switch_pm_text: `🏆 ${t('menu_tournaments')}`,
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
// NATIJALAR
// ============================================================
async function buildResults(query, t) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();

  // 1. Turnir ID
  if (/^tour_[a-z0-9]+$/i.test(query)) {
    const tour = all.find((x) => x.id === query);
    if (tour) return [buildTournamentResult(tour, true, t)];
    return [buildNotFound(query, t)];
  }

  // 2. Komanda
  if (query.toLowerCase().startsWith('team ')) {
    const tag = query.slice(5).trim().toUpperCase();
    if (!tag) return [];
    const teams = await teamService.getAllTeams();
    const found = teams
      .filter(
        (tm) =>
          tm.tag.toUpperCase().includes(tag) || tm.name.toUpperCase().includes(tag)
      )
      .slice(0, 20);
    return found.map((tm) => buildTeamResult(tm, t));
  }

  // 3. Bo'sh query
  if (!query) {
    const upcoming = all
      .filter((tour) => {
        const d = parseDateTime(tour.date, tour.startTime);
        return d && d > now;
      })
      .sort((a, b) => {
        const da = parseDateTime(a.date, a.startTime);
        const db = parseDateTime(b.date, b.startTime);
        return da - db;
      })
      .slice(0, 20);

    if (upcoming.length === 0) return [buildEmptyResult(t)];
    return upcoming.map((tour) => buildTournamentResult(tour, false, t));
  }

  // 4. Matn
  const q = query.toLowerCase();
  const found = all
    .filter(
      (tour) =>
        (tour.title || '').toLowerCase().includes(q) ||
        (tour.mode || '').toLowerCase().includes(q) ||
        (tour.map || '').toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const da = parseDateTime(a.date, a.startTime);
      const db = parseDateTime(b.date, b.startTime);
      return da - db;
    })
    .slice(0, 20);

  return found.map((tour) => buildTournamentResult(tour, false, t));
}

// ============================================================
// TURNIR RESULT
// ============================================================
function buildTournamentResult(tour, detailed, t) {
  const regStatus =
    tour.registeredTeams.length >= tour.maxTeams
      ? `🔴 ${t('error_tournament_full')}`
      : tour.registrationDeadline && new Date(tour.registrationDeadline) < new Date()
      ? `🔴 ${t('error_registration_closed')}`
      : `🟢 ${t('success')}`;

  const text =
    `🏆 <b>${escapeHtml(tour.title)}</b>\n\n` +
    `📅 ${t('date')}: <b>${tour.date}</b>\n` +
    `⏰ ${t('time')}: <b>${tour.startTime}</b> (${tour.timezone})\n` +
    `🎮 ${t('mode')}: <b>${escapeHtml(tour.mode)}</b>\n` +
    `🗺 ${t('stage_match_map')}: <b>${escapeHtml(tour.map || 'Erangel')}</b>\n` +
    `👥 ${t('admin_teams')}: <b>${tour.registeredTeams.length}/${tour.maxTeams}</b>\n` +
    `📝 ${t('success')}: <b>${regStatus}</b>\n` +
    `🎙 ${t('host_label')}: <b>${tour.hostId ? '✅' : '❌'}</b>\n` +
    (detailed ? `\n🆔 ID: <code>${tour.id}</code>\n` : '') +
    (detailed && tour.description ? `\n📄 ${escapeHtml(tour.description)}` : '');

  const keyboard = {
    inline_keyboard: [
      [
        Markup.button.url(
          '🎮 ' + t('tour_open'),
          `https://t.me/${config.BOT_USERNAME}?start=tour_${tour.id}`
        ),
      ],
    ],
  };

  if (tour.imageFileId) {
    return {
      type: 'photo',
      id: `tour_${tour.id}`,
      photo_file_id: tour.imageFileId,
      title: `🏆 ${tour.title}`,
      description: `${tour.date} • ${tour.startTime} • ${tour.mode} • ${tour.registeredTeams.length}/${tour.maxTeams}`,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    };
  }

  return {
    type: 'article',
    id: `tour_${tour.id}`,
    title: `🏆 ${tour.title}`,
    description: `${tour.date} • ${tour.startTime} • ${tour.mode} • ${tour.registeredTeams.length}/${tour.maxTeams}`,
    input_message_content: { message_text: text, parse_mode: 'HTML' },
    reply_markup: keyboard,
  };
}

// ============================================================
// KOMANDA RESULT
// ============================================================
function buildTeamResult(team, t) {
  const text =
    `👥 <b>${escapeHtml(team.name)} [${escapeHtml(team.tag)}]</b>\n\n` +
    `👑 ${t('team_captain')} ID: <code>${team.captainId}</code>\n` +
    `👥 ${t('team_members_count')}: <b>${team.members.length}/8</b>\n` +
    `🔑 ${t('team_join_code')}: <code>${team.joinCode}</code>`;

  const keyboard = {
    inline_keyboard: [
      [
        Markup.button.url(
          '🔑 ' + t('team_join'),
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
      description: `👥 ${team.members.length}/8`,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    };
  }

  return {
    type: 'article',
    id: `team_${team.id}`,
    title: `👥 ${team.name} [${team.tag}]`,
    description: `👥 ${team.members.length}/8`,
    input_message_content: { message_text: text, parse_mode: 'HTML' },
    reply_markup: keyboard,
  };
}

// ============================================================
// TOPILMADI
// ============================================================
function buildNotFound(query, t) {
  return {
    type: 'article',
    id: 'not_found',
    title: `❗ ${t('tour_not_found')}`,
    description: `"${query}" — ${t('no_data')}`,
    input_message_content: {
      message_text:
        `❗ <b>${t('tour_not_found')}</b>\n\n` +
        `${t('tour_id_sent')}: <code>${escapeHtml(query)}</code>\n\n` +
        `<i>${t('tour_announce_check_id')}</i>`,
      parse_mode: 'HTML',
    },
  };
}

// ============================================================
// BO'SH
// ============================================================
function buildEmptyResult(t) {
  return {
    type: 'article',
    id: 'empty',
    title: `📭 ${t('tour_empty')}`,
    description: t('tour_announce_check_id'),
    input_message_content: {
      message_text: `📭 <b>${t('tour_empty')}</b>\n\n<i>${t('tour_empty')}</i>`,
      parse_mode: 'HTML',
    },
    reply_markup: {
      inline_keyboard: [
        [
          Markup.button.url(
            '🎮 ' + t('menu_tournaments'),
            `https://t.me/${config.BOT_USERNAME}`
          ),
        ],
      ],
    },
  };
}