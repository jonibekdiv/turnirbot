// ============================================================
// REMINDER SERVICE — 10 va 5 daqiqa eslatmalar (#14)
// ============================================================
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const { parseDateTime, minutesUntil } = require('../utils/dateUtils');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

let intervalHandle = null;

// ============================================================
// YORDAMCHI: SLEEP
// ============================================================
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// ASOSIY TEKSHIRUV
// ============================================================
async function checkAndSend(bot) {
  try {
    const tournaments = await tournamentService.getAllTournaments();

    for (const t of tournaments) {
      // Bekor qilingan yoki tugagan turnirlar — o'tkazib yuboramiz
      if (t.status === 'cancelled' || t.status === 'finished') continue;

      const start = parseDateTime(t.date, t.startTime);
      if (!start) continue;

      const diff = minutesUntil(start);

      // 10 daqiqa oldin
      if (diff <= 10 && diff > 5 && !t.reminder10Sent) {
        await sendReminder(bot, t, 10);
        await tournamentService.markReminder(t.id, 'reminder10Sent');
      }

      // 5 daqiqa oldin
      if (diff <= 5 && diff >= 0 && !t.reminder5Sent) {
        await sendReminder(bot, t, 5);
        await tournamentService.markReminder(t.id, 'reminder5Sent');
      }
    }
  } catch (e) {
    console.error('❌ Reminder check xatosi:', e.message);
  }
}

// ============================================================
// ESLATMA YUBORISH
// ============================================================
async function sendReminder(bot, tournament, minutesLeft) {
  try {
    // A'zolarni yig'ish
    const memberIds = new Set();

    for (const teamId of tournament.registeredTeams) {
      const team = await teamService.getTeam(teamId);
      if (team) team.members.forEach((m) => memberIds.add(m));
    }

    if (!memberIds.size) return;

    // Xabar matni
    let body;

    if (tournament.roomId && tournament.roomPassword) {
      // Host ma'lumot yuborgan
      body =
        `╔══════════════════════╗\n` +
        `   ⏰ <b>${minutesLeft} DAQIQA QOLDI!</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(tournament.title)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📅 Sana: <b>${tournament.date}</b>\n` +
        `⏰ Vaqt: <b>${tournament.startTime}</b>\n` +
        (tournament.mode
          ? `🎮 Rejim: <b>${escapeHtml(tournament.mode)}</b>\n`
          : '') +
        (tournament.etapa
          ? `⭐️ Etap: <b>${escapeHtml(tournament.etapa)}</b>\n`
          : '') +
        `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🆔 <b>Room ID:</b>\n` +
        `<code>${escapeHtml(tournament.roomId)}</code>\n\n` +
        `🔒 <b>Parol:</b>\n` +
        `<code>${escapeHtml(tournament.roomPassword)}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚡️ <i>Iltimos, hoziroq xonaga kiring!</i>`;
    } else {
      // Host hali yubormagan
      body =
        `╔══════════════════════╗\n` +
        `   ⏰ <b>${minutesLeft} DAQIQA QOLDI!</b>\n` +
        `╚══════════════════════╝\n\n` +
        `🏆 <b>${escapeHtml(tournament.title)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📅 Sana: <b>${tournament.date}</b>\n` +
        `⏰ Vaqt: <b>${tournament.startTime}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ <b>Host hali xona ma'lumotlarini yubormadi.</b>\n\n` +
        `<i>Iltimos, kuting. Xona ma'lumotlari kelishi bilan sizga yuboriladi.</i>`;
    }

    // Yuborish
    let sent = 0;
    let failed = 0;

    for (const uid of memberIds) {
      try {
        await bot.telegram.sendMessage(uid, body, { parse_mode: 'HTML' });
        sent++;
      } catch (e) {
        failed++;
      }
      await sleep(LIMITS.BROADCAST_DELAY_MS);
    }

    console.log(
      `⏰ ${minutesLeft} daq eslatma: ${tournament.title} — ${sent}/${memberIds.size}`
    );
  } catch (e) {
    console.error(`❌ Eslatma yuborish xatosi (${minutesLeft} daq):`, e.message);
  }
}

// ============================================================
// QO'LDA YUBORISH (admin uchun)
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

// ============================================================
// STATISTIKA — nechta eslatma qoldi
// ============================================================
async function getUpcomingReminders() {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();

  const upcoming = [];

  for (const t of all) {
    if (t.status === 'cancelled' || t.status === 'finished') continue;

    const start = parseDateTime(t.date, t.startTime);
    if (!start) continue;

    const diff = minutesUntil(start);
    if (diff > 0 && diff <= 60) {
      upcoming.push({
        tournament: t,
        minutesUntil: diff,
        reminder10Sent: t.reminder10Sent || false,
        reminder5Sent: t.reminder5Sent || false,
      });
    }
  }

  upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil);
  return upcoming;
}

// ============================================================
// START
// ============================================================
function start(bot) {
  if (intervalHandle) clearInterval(intervalHandle);

  // Har 30 sekundda tekshirish
  intervalHandle = setInterval(() => {
    checkAndSend(bot).catch((e) =>
      console.error('Reminder interval xato:', e.message)
    );
  }, 30 * 1000);

  console.log('⏰ Eslatma xizmati ishga tushdi (10 va 5 daqiqa)');
}

// ============================================================
// STOP
// ============================================================
function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  console.log('⏹ Eslatma xizmati to\'xtatildi');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  start,
  stop,
  checkAndSend,
  sendReminder,
  sendManualReminder,
  getUpcomingReminders,
};