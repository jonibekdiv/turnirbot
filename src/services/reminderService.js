// Turnir boshlanishidan 10 va 5 daqiqa oldin eslatma yuborish
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const { parseDateTime, minutesUntil } = require('../utils/dateUtils');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

let intervalHandle = null;

async function checkAndSend(bot) {
  const tournaments = await tournamentService.getAllTournaments();
  for (const t of tournaments) {
    const start = parseDateTime(t.date, t.startTime);
    if (!start) continue;
    const diff = minutesUntil(start);
    if (diff < 0 || diff > 11) continue;

    // 10 daqiqa
    if (diff <= 10 && diff > 5 && !t.reminder10Sent) {
      await sendReminder(bot, t, 10);
      await tournamentService.markReminder(t.id, 'reminder10Sent');
    }

    // 5 daqiqa
    if (diff <= 5 && diff >= 0 && !t.reminder5Sent) {
      await sendReminder(bot, t, 5);
      await tournamentService.markReminder(t.id, 'reminder5Sent');
    }
  }
}

async function sendReminder(bot, tournament, minutesLeft) {
  const teamIds = tournament.registeredTeams || [];
  const memberIds = new Set();
  for (const teamId of teamIds) {
    const team = await teamService.getTeam(teamId);
    if (team) team.members.forEach((m) => memberIds.add(m));
  }
  if (!memberIds.size) return;

  let body;
  if (tournament.roomId && tournament.roomPassword) {
    body =
      `⏰ <b>Diqqat!</b> PUBG turniri boshlanishiga <b>${minutesLeft} daqiqa</b> qoldi.\n\n` +
      `Turnir: <b>${escapeHtml(tournament.title)}</b>\n` +
      `Sana: <b>${tournament.date}</b>\n` +
      `Vaqt: <b>${tournament.startTime}</b>\n\n` +
      `Room ID: <code>${escapeHtml(tournament.roomId)}</code>\n` +
      `Room Password: <code>${escapeHtml(tournament.roomPassword)}</code>\n\n` +
      `Iltimos, o'z vaqtida xonaga kiring.`;
  } else {
    body =
      `⏰ PUBG turniri boshlanishiga <b>${minutesLeft} daqiqa</b> qoldi.\n\n` +
      `Turnir: <b>${escapeHtml(tournament.title)}</b>\n\n` +
      `⚠️ <i>Host hali xona ma'lumotlarini yubormadi. Iltimos, kuting.</i>`;
  }

  for (const uid of memberIds) {
    try {
      await bot.telegram.sendMessage(uid, body, { parse_mode: 'HTML' });
    } catch {}
    await new Promise((r) => setTimeout(r, LIMITS.BROADCAST_DELAY_MS));
  }
}

function start(bot) {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(() => {
    checkAndSend(bot).catch((e) => console.error('Reminder xato:', e.message));
  }, 30 * 1000);
  console.log('Eslatma xizmati ishga tushdi');
}

module.exports = { start, checkAndSend, sendReminder };