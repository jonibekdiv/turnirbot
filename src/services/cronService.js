// ============================================================
// CRON SERVICE — Kunlik statistika + kanal postlari (#4, #14, #19)
// ============================================================
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const userService = require('./userService');
const channelService = require('./channelService');
const paymentService = require('./paymentService');
const reservationService = require('./reservationService');
const { parseDateTime } = require('../utils/dateUtils');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');
const config = require('../config');

let minuteTimer = null;
let hourlyTimer = null;
let dailyTimer = null;

// ============================================================
// YORDAMCHI: SLEEP
// ============================================================
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// #4 KUNLIK STATISTIKA — SUPER ADMIN UCHUN
// ============================================================
async function sendDailyDigest(bot) {
  try {
    const all = await tournamentService.getAllTournaments();
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

    const todayTours = all.filter((t) => t.date === today);
    const users = await userService.getAllUsers();
    const teams = await teamService.getAllTeams();

    // Bugun qo'shilganlar
    const todayUsers = users.filter(
      (u) =>
        new Date(u.createdAt).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Tashkent',
        }) === today
    ).length;

    const todayTeams = teams.filter(
      (t) =>
        new Date(t.createdAt).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Tashkent',
        }) === today
    ).length;

    const pendingPayments = await paymentService.getAllPayments('pending');

    const text =
      `╔══════════════════════╗\n` +
      `   📊 <b>KUNLIK HISOBOT</b>\n` +
      `╚══════════════════════╝\n\n` +
      `📅 Sana: <b>${today}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 Yangi foydalanuvchilar: <b>+${todayUsers}</b>\n` +
      `👥 Yangi komandalar: <b>+${todayTeams}</b>\n` +
      `🏆 Bugungi turnirlar: <b>${todayTours.length}</b>\n` +
      `💳 Kutilayotgan to'lovlar: <b>${pendingPayments.length}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📈 <b>Jami:</b>\n` +
      `👤 Foydalanuvchilar: <b>${users.length}</b>\n` +
      `👥 Komandalar: <b>${teams.length}</b>\n` +
      `🏆 Turnirlar: <b>${all.length}</b>`;

    await bot.telegram.sendMessage(config.SUPER_ADMIN_ID, text, {
      parse_mode: 'HTML',
    });

    console.log('📊 Kunlik hisobot yuborildi');
  } catch (e) {
    console.error('❌ Kunlik hisobot xatosi:', e.message);
  }
}

// ============================================================
// #19 KANALGA KUNLIK POST
// ============================================================
async function sendChannelDailyPost(bot) {
  try {
    const channelId = await channelService.getChannel();
    if (!channelId) return;

    const all = await tournamentService.getAllTournaments();
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

    const todayTours = all.filter((t) => t.date === today);

    const upcomingTours = all
      .filter((t) => {
        const d = parseDateTime(t.date, t.startTime);
        return d && d > now && t.date !== today;
      })
      .sort((a, b) => {
        const da = parseDateTime(a.date, a.startTime);
        const db = parseDateTime(b.date, b.startTime);
        return da - db;
      })
      .slice(0, 5);

    if (!todayTours.length && !upcomingTours.length) return;

    const lines = [];
    lines.push(`╔══════════════════════╗`);
    lines.push(`   📅 <b>KUNLIK TURNIRLAR</b>`);
    lines.push(`╚══════════════════════╝`);
    lines.push('');

    if (todayTours.length) {
      lines.push(`🔥 <b>BUGUN (${todayTours.length})</b>`);
      lines.push('');
      todayTours.forEach((t) => {
        const typeEmoji = t.type === 'paid' ? '💳' : '🆓';
        lines.push(
          `${typeEmoji} <b>${escapeHtml(t.title)}</b>\n` +
            `⏰ ${t.startTime} | 🎮 ${escapeHtml(t.mode)}\n` +
            `👥 ${t.registeredTeams.length}/${t.maxTeams}`
        );
        lines.push('');
      });
    }

    if (upcomingTours.length) {
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push(`⏭ <b>KELGUSI TURNIRLAR</b>`);
      lines.push('');
      upcomingTours.forEach((t) => {
        const typeEmoji = t.type === 'paid' ? '💳' : '🆓';
        lines.push(
          `${typeEmoji} <b>${escapeHtml(t.title)}</b>\n` +
            `   📅 ${t.date} | ⏰ ${t.startTime}`
        );
      });
      lines.push('');
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`🎮 <i>Bot: @${config.BOT_USERNAME}</i>`);

    await bot.telegram.sendMessage(channelId, lines.join('\n'), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    console.log('📢 Kanal post yuborildi');
  } catch (e) {
    console.error('❌ Kanal post xatosi:', e.message);
  }
}

// ============================================================
// #14 1 SOAT QOLGANDA ESLATMA
// ============================================================
async function checkUpcomingHour(bot) {
  try {
    const all = await tournamentService.getAllTournaments();
    const now = new Date();

    for (const t of all) {
      if (t.status === 'cancelled' || t.status === 'finished') continue;

      const d = parseDateTime(t.date, t.startTime);
      if (!d) continue;
      const diffMin = Math.floor((d - now) / 60000);

      // 60 daqiqa atrofida (58-62)
      if (
        diffMin >= 58 &&
        diffMin <= 62 &&
        !t.hourReminderSent
      ) {
        await sendHourReminder(bot, t);
        await tournamentService.updateTournament(t.id, {
          hourReminderSent: true,
        });
      }
    }
  } catch (e) {
    console.error('❌ 1 soat eslatma xatosi:', e.message);
  }
}

async function sendHourReminder(bot, t) {
  const memberIds = new Set();

  for (const teamId of t.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (team) team.members.forEach((m) => memberIds.add(m));
  }

  if (!memberIds.size) return;

  const text =
    `⏰ <b>1 SOAT QOLDI!</b>\n\n` +
    `🎮 <b>${escapeHtml(t.title)}</b>\n` +
    `📅 ${t.date} | ⏰ ${t.startTime}\n` +
    `🎮 ${escapeHtml(t.mode)}\n\n` +
    (t.roomId
      ? `🆔 Room ID: <code>${escapeHtml(t.roomId)}</code>\n` +
        (t.roomPassword
          ? `🔒 Parol: <code>${escapeHtml(t.roomPassword)}</code>\n`
          : '')
      : `⚠️ <i>Host hali xona ma'lumotlarini yubormadi</i>`) +
    `\n\n<i>Tayyorlaning!</i>`;

  let sent = 0;
  for (const uid of memberIds) {
    try {
      await bot.telegram.sendMessage(uid, text, { parse_mode: 'HTML' });
      sent++;
    } catch (e) {
      // Bloklangan
    }
    await sleep(LIMITS.BROADCAST_DELAY_MS);
  }

  console.log(`⏰ 1 soat eslatma: ${t.title} — ${sent}/${memberIds.size}`);
}

// ============================================================
// #14 24 SOAT OLDIN ESLATMA
// ============================================================
async function checkDayBefore(bot) {
  try {
    const all = await tournamentService.getAllTournaments();
    const now = new Date();

    for (const t of all) {
      if (t.status === 'cancelled' || t.status === 'finished') continue;

      const d = parseDateTime(t.date, t.startTime);
      if (!d) continue;
      const diffMin = Math.floor((d - now) / 60000);

      // 1440 daqiqa atrofida (1420-1460)
      if (
        diffMin >= 1420 &&
        diffMin <= 1460 &&
        !t.dayReminderSent
      ) {
        await sendDayBeforeReminder(bot, t);
        await tournamentService.updateTournament(t.id, {
          dayReminderSent: true,
        });
      }
    }
  } catch (e) {
    console.error('❌ 24 soat eslatma xatosi:', e.message);
  }
}

async function sendDayBeforeReminder(bot, t) {
  const memberIds = new Set();

  for (const teamId of t.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (team) team.members.forEach((m) => memberIds.add(m));
  }

  if (!memberIds.size) return;

  const text =
    `📅 <b>ERTAGA TURNIR!</b>\n\n` +
    `🎮 <b>${escapeHtml(t.title)}</b>\n` +
    `📅 ${t.date} | ⏰ ${t.startTime}\n` +
    `🎮 ${escapeHtml(t.mode)}\n` +
    (t.prize ? `💲 PRIZ: <b>${escapeHtml(t.prize)}</b>\n` : '') +
    `\n<i>Ertaga turnir bo'lib o'tadi. Tayyor bo'ling!</i>`;

  let sent = 0;
  for (const uid of memberIds) {
    try {
      await bot.telegram.sendMessage(uid, text, { parse_mode: 'HTML' });
      sent++;
    } catch (e) {}
    await sleep(LIMITS.BROADCAST_DELAY_MS);
  }

  console.log(`📅 24 soat eslatma: ${t.title} — ${sent}/${memberIds.size}`);
}

// ============================================================
// #20 BRON TIMEOUT TEKSHIRISH
// ============================================================
async function checkReservationTimeouts(bot) {
  try {
    const expired = await reservationService.getExpiredPending();
    if (!expired.length) return;

    for (const r of expired) {
      await reservationService.releaseReservation(r.id);

      const t = await tournamentService.getTournament(r.tournamentId);
      const team = await teamService.getTeam(r.teamId);
      if (!t || !team) continue;

      // Captainga xabar
      try {
        await bot.telegram.sendMessage(
          r.captainId,
          `⏰ <b>Bron vaqti tugadi!</b>\n\n` +
            `🏆 ${escapeHtml(t.title)}\n` +
            `👥 ${escapeHtml(team.name)}\n\n` +
            `<i>5 daqiqa ichida tasdiqlamadingiz. Joy boshqa komandaga o'tkazilishi mumkin.</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}

      console.log(`⏰ Bron timeout: ${team.name}`);
    }
  } catch (e) {
    console.error('❌ Bron timeout xatosi:', e.message);
  }
}

// ============================================================
// STATISTIKA — SOATIGA BIR (agar kerak bo'lsa)
// ============================================================
async function sendHourlyHealthCheck() {
  try {
    const users = await userService.getAllUsers();
    const teams = await teamService.getAllTeams();
    const tours = await tournamentService.getAllTournaments();

    const active = users.filter((u) => u.status === 'active').length;

    console.log(
      `💚 Health: ${users.length} user (${active} active), ${teams.length} team, ${tours.length} tour`
    );
  } catch (e) {
    console.error('❌ Health check xatosi:', e.message);
  }
}

// ============================================================
// SCHEDULER START
// ============================================================
function start(bot) {
  // Har daqiqada — 1 soat eslatmasi + bron timeout
  if (minuteTimer) clearInterval(minuteTimer);
  minuteTimer = setInterval(() => {
    checkUpcomingHour(bot).catch((e) =>
      console.error('Hour reminder xato:', e.message)
    );
    checkReservationTimeouts(bot).catch((e) =>
      console.error('Reservation timeout xato:', e.message)
    );
  }, 60 * 1000);

  // Har 30 daqiqada — 24 soat eslatma
  if (hourlyTimer) clearInterval(hourlyTimer);
  hourlyTimer = setInterval(
    () => {
      checkDayBefore(bot).catch((e) =>
        console.error('Day reminder xato:', e.message)
      );
    },
    30 * 60 * 1000
  );

  // Har 30 daqiqada — kunlik hisobot + kanal post (10:00 da)
  if (dailyTimer) clearInterval(dailyTimer);
  dailyTimer = setInterval(
    () => {
      const now = new Date();
      const tashkentHour = parseInt(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Tashkent',
          hour: '2-digit',
        }),
        10
      );
      const tashkentMin = parseInt(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Tashkent',
          minute: '2-digit',
        }),
        10
      );

      // 10:00-10:29 oralig'ida bir marta
      if (tashkentHour === 10 && tashkentMin < 30) {
        const today = now.toLocaleDateString('en-CA', {
          timeZone: 'Asia/Tashkent',
        });
        const key = `daily_sent_${today}`;

        if (!global[key]) {
          global[key] = true;

          sendDailyDigest(bot).catch((e) =>
            console.error('Daily digest xato:', e.message)
          );

          sendChannelDailyPost(bot).catch((e) =>
            console.error('Channel post xato:', e.message)
          );
        }
      }
    },
    30 * 60 * 1000
  );

  console.log('⏰ Cron xizmati ishga tushdi (kengaytirilgan)');
  console.log('   ⏱ Har daqiqa: 1 soat eslatma + bron timeout');
  console.log('   ⏱ Har 30 daqiqa: 24 soat eslatma');
  console.log('   ⏱ Har 30 daqiqa: kunlik hisobot (10:00)');
}

// ============================================================
// STOP
// ============================================================
function stop() {
  if (minuteTimer) clearInterval(minuteTimer);
  if (hourlyTimer) clearInterval(hourlyTimer);
  if (dailyTimer) clearInterval(dailyTimer);
  minuteTimer = null;
  hourlyTimer = null;
  dailyTimer = null;
  console.log('⏹ Cron xizmati to\'xtatildi');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  start,
  stop,
  sendDailyDigest,
  sendChannelDailyPost,
  checkUpcomingHour,
  checkDayBefore,
  checkReservationTimeouts,
  sendHourlyHealthCheck,
};