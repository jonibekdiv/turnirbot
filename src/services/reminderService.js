// ============================================================
// REMINDER SERVICE — 10 va 5 daqiqa eslatmalar (3 tilda)
// ============================================================
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const langService = require('./langService');
const { parseDateTime, minutesUntil } = require('../utils/dateUtils');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

let intervalHandle = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// ASOSIY TEKSHIRUV
// ============================================================
async function checkAndSend(bot) {
  try {
    const tournaments = await tournamentService.getAllTournaments();

    for (const tour of tournaments) {
      if (tour.status === 'cancelled' || tour.status === 'finished') continue;

      const start = parseDateTime(tour.date, tour.startTime);
      if (!start) continue;

      const diff = minutesUntil(start);

      if (diff <= 10 && diff > 5 && !tour.reminder10Sent) {
        await sendReminder(bot, tour, 10);
        await tournamentService.markReminder(tour.id, 'reminder10Sent');
      }

      if (diff <= 5 && diff >= 0 && !tour.reminder5Sent) {
        await sendReminder(bot, tour, 5);
        await tournamentService.markReminder(tour.id, 'reminder5Sent');
      }
    }
  } catch (e) {
    console.error('❌ Reminder check xatosi:', e.message);
  }
}

// ============================================================
// YUBORISH (3 tilda)
// ============================================================
async function sendReminder(bot, tournament, minutesLeft) {
  try {
    const memberIds = new Set();

    for (const teamId of tournament.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    if (!memberIds.size) return;

    let sent = 0;
    let failed = 0;

    for (const uid of memberIds) {
      try {
        const userLang = await langService.getUserLang(uid);
        const t = (key, vars) => langService.t(userLang, key, vars);

        let body;

        if (tournament.roomId && tournament.roomPassword) {
          body =
            `╔══════════════════════╗\n` +
            `   ⏰ <b>${minutesLeft} ${t('reminder_hour_title')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 <b>${escapeHtml(tournament.title)}</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📅 ${t('date')}: <b>${tournament.date}</b>\n` +
            `⏰ ${t('time')}: <b>${tournament.startTime}</b>\n` +
            (tournament.mode ? `🎮 ${t('mode')}: <b>${escapeHtml(tournament.mode)}</b>\n` : '') +
            (tournament.etapa ? `⭐️ ${t('stage')}: <b>${escapeHtml(tournament.etapa)}</b>\n` : '') +
            `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🆔 <b>${t('tour_room_info')}:</b>\n` +
            `<code>${escapeHtml(tournament.roomId)}</code>\n\n` +
            `🔒 <b>${t('password')}:</b>\n` +
            `<code>${escapeHtml(tournament.roomPassword)}</code>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⚡️ <i>${t('sub_wait_room')}</i>`;
        } else {
          body =
            `╔══════════════════════╗\n` +
            `   ⏰ <b>${minutesLeft} ${t('reminder_hour_title')}</b>\n` +
            `╚══════════════════════╝\n\n` +
            `🏆 <b>${escapeHtml(tournament.title)}</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📅 ${t('date')}: <b>${tournament.date}</b>\n` +
            `⏰ ${t('time')}: <b>${tournament.startTime}</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⚠️ <b>${t('host_no_tours')}</b>\n\n` +
            `<i>${t('sub_wait_room')}</i>`;
        }

        await bot.telegram.sendMessage(uid, body, { parse_mode: 'HTML' });
        sent++;
      } catch (e) {
        failed++;
      }
      await sleep(LIMITS.BROADCAST_DELAY_MS);
    }

    console.log(`⏰ ${minutesLeft} daq: ${tournament.title} — ${sent}/${memberIds.size}`);
  } catch (e) {
    console.error(`❌ Eslatma xatosi (${minutesLeft} daq):`, e.message);
  }
}

// ============================================================
// QO'LDA
// ============================================================
async function sendManualReminder(bot, tournamentId) {
  const t = await tournamentService.getTournament(tournamentId);
  if (!t) throw new Error('Turnir topilmadi');

  const start = parseDateTime(t.date, t.startTime);
  const diff = start ? minutesUntil(start) : null;
  const minutesLeft = diff !== null && diff > 0 ? diff : 0;

  await sendReminder(bot, t, minutesLeft);

  return { ok: true, sentTo: t.registeredTeams.length };
}

async function getUpcomingReminders() {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();
  const upcoming = [];

  for (const tour of all) {
    if (tour.status === 'cancelled' || tour.status === 'finished') continue;

    const start = parseDateTime(tour.date, tour.startTime);
    if (!start) continue;

    const diff = minutesUntil(start);
    if (diff > 0 && diff <= 60) {
      upcoming.push({
        tournament: tour,
        minutesUntil: diff,
        reminder10Sent: tour.reminder10Sent || false,
        reminder5Sent: tour.reminder5Sent || false,
      });
    }
  }

  upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil);
  return upcoming;
}

// ============================================================
// START / STOP
// ============================================================
function start(bot) {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(() => {
    checkAndSend(bot).catch((e) => console.error('Reminder interval:', e.message));
  }, 30 * 1000);
  console.log('⏰ Eslatma xizmati ishga tushdi (10 va 5 daqiqa)');
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  console.log("⏹ Eslatma xizmati to'xtatildi");
}

module.exports = {
  start,
  stop,
  checkAndSend,
  sendReminder,
  sendManualReminder,
  getUpcomingReminders,
};