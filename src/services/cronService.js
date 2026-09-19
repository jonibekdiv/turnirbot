// Cron eslatmalar — kunlik, haftalik
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const userService = require('./userService');
const { parseDateTime } = require('../utils/dateUtils');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

let dailyTimer = null;
let hourlyTimer = null;

// Kunlik eslatma — har kuni 10:00 da bugungi turnirlar haqida
async function sendDailyDigest(bot) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

  const todayTours = all.filter((t) => t.date === today);
  if (!todayTours.length) return;

  const users = await userService.getAllUsers();
  const text = buildDailyDigestText(todayTours);

  for (const u of users) {
    if (u.status === 'inactive') continue;
    try {
      await bot.telegram.sendMessage(u.id, text, { parse_mode: 'HTML' });
    } catch (e) { /* bloklangan */ }
    await sleep(LIMITS.BROADCAST_DELAY_MS);
  }
  console.log(`📢 Kunlik eslatma yuborildi (${todayTours.length} turnir)`);
}

function buildDailyDigestText(tours) {
  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   📅 <b>BUGUNGI TURNIRLAR</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`📊 Jami: <b>${tours.length}</b> ta`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  tours.forEach((t, i) => {
    lines.push(`<b>${i + 1}. ${escapeHtml(t.title)}</b>`);
    lines.push(`   ⏰ ${t.startTime}`);
    lines.push(`   🎮 ${escapeHtml(t.mode)}`);
    lines.push(`   👥 ${t.registeredTeams.length}/${t.maxTeams}`);
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 <i>Turnirga kirish uchun botga /start bosing</i>');
  return lines.join('\n');
}

// Soatiga bir marta — 1 soat qolgan turnirlar
async function checkUpcomingHour(bot) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();

  for (const t of all) {
    const d = parseDateTime(t.date, t.startTime);
    if (!d) continue;
    const diffMin = Math.floor((d - now) / 60000);

    if (diffMin === 60 && !t.hourReminderSent) {
      await sendHourReminder(bot, t);
      await tournamentService.updateTournament(t.id, { hourReminderSent: true });
    }
  }
}

async function sendHourReminder(bot, t) {
  const memberIds = new Set();
  for (const teamId of t.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (team) team.members.forEach((m) => memberIds.add(m));
  }

  const text =
    `⏰ <b>1 SOAT QOLDI!</b>\n\n` +
    `🎮 <b>${escapeHtml(t.title)}</b>\n` +
    `📅 ${t.date} | ⏰ ${t.startTime}\n\n` +
    `<i>Tayyorlaning!</i>`;

  for (const uid of memberIds) {
    try { await bot.telegram.sendMessage(uid, text, { parse_mode: 'HTML' }); } catch {}
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ============================================================
// SCHEDULER
// ============================================================
function start(bot) {
  // Har daqiqada upcoming hour tekshirish
  if (hourlyTimer) clearInterval(hourlyTimer);
  hourlyTimer = setInterval(() => {
    checkUpcomingHour(bot).catch((e) => console.error('Cron xato:', e.message));
  }, 60 * 1000);

  // Har 30 daqiqada kunlik vaqtni tekshirish
  if (dailyTimer) clearInterval(dailyTimer);
  dailyTimer = setInterval(() => {
    const now = new Date();
    const tashkentHour = parseInt(
      now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit' }),
      10
    );
    const tashkentMin = parseInt(
      now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', minute: '2-digit' }),
      10
    );
    // 10:00 da
    if (tashkentHour === 10 && tashkentMin < 30) {
      const key = `digest_${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })}`;
      if (!global[key]) {
        global[key] = true;
        sendDailyDigest(bot).catch((e) => console.error('Digest xato:', e.message));
      }
    }
  }, 30 * 60 * 1000);

  console.log('⏰ Cron xizmati ishga tushdi');
}

module.exports = { start, sendDailyDigest, checkUpcomingHour };