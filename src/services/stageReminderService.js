// ============================================================
// STAGE REMINDER SERVICE — 24h/3h/1h/30m/10m (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const stageService = require('./stageService');
const stageMatchService = require('./stageMatchService');
const teamService = require('./teamService');
const tournamentService = require('./tournamentService');
const auditService = require('./auditService');
const langService = require('./langService');
const {
  STAGE_REMINDER,
  LIMITS,
} = require('../constants');
const { parseDateTime } = require('../utils/dateUtils');

const FILE = 'stageReminders.json';

const REMINDER_MINUTES = {
  [STAGE_REMINDER.H24]: 24 * 60,
  [STAGE_REMINDER.H3]: 3 * 60,
  [STAGE_REMINDER.H1]: 60,
  [STAGE_REMINDER.M30]: 30,
  [STAGE_REMINDER.M10]: 10,
};

// ============================================================
// REMINDER
// ============================================================
async function getReminder(matchId) {
  const data = await store.read(FILE);
  return data[matchId] || null;
}

async function ensureReminder(matchId, stageId, tournamentId) {
  return store.update(FILE, (data) => {
    if (!data[matchId]) {
      data[matchId] = {
        matchId,
        stageId,
        tournamentId,
        reminders: { '24h': false, '3h': false, '1h': false, '30m': false, '10m': false },
        createdAt: new Date().toISOString(),
      };
    }
    return data[matchId];
  });
}

async function markSent(matchId, type) {
  return store.update(FILE, (data) => {
    const r = data[matchId];
    if (!r) return null;
    if (!r.reminders) r.reminders = {};
    r.reminders[type] = true;
    r.updatedAt = new Date().toISOString();
    return r;
  });
}

// ============================================================
// ASOSIY TEKSHIRUV
// ============================================================
async function checkAndSendAll(bot) {
  try {
    const data = await store.read('stageMatches.json');
    const now = new Date();

    for (const match of Object.values(data)) {
      if (match.resultStatus === 'approved') continue;

      const startDT = parseDateTime(match.date, match.startTime);
      if (!startDT) continue;

      const diffMin = Math.floor((startDT - now) / 60000);
      if (diffMin < 0) continue;
      if (diffMin > 1500) continue;

      for (const [type, minutes] of Object.entries(REMINDER_MINUTES)) {
        const reminder = await getReminder(match.id);
        if (reminder?.reminders?.[type]) continue;

        if (diffMin >= minutes - 5 && diffMin <= minutes + 5) {
          try {
            await sendReminder(bot, match, type, diffMin);
            await ensureReminder(match.id, match.stageId, match.tournamentId);
            await markSent(match.id, type);
          } catch (e) {
            console.error(`Reminder (${type}):`, e.message);
          }
        }
      }
    }
  } catch (e) {
    console.error('checkAndSendAll xatosi:', e.message);
  }
}

// ============================================================
// ESLATMA YUBORISH (3 tilda)
// ============================================================
async function sendReminder(bot, match, type, minutesLeft) {
  const stage = await stageService.getStage(match.stageId);
  if (!stage) return { ok: false, reason: 'stage_not_found' };

  const tournament = await tournamentService.getTournament(match.tournamentId);
  if (!tournament) return { ok: false, reason: 'tournament_not_found' };

  const memberIds = new Set();
  for (const teamId of match.teams || []) {
    const team = await teamService.getTeam(teamId);
    if (!team) continue;
    team.members.forEach((m) => memberIds.add(m));
  }

  if (!memberIds.size) return { ok: true, sent: 0, total: 0 };

  let sent = 0;
  let failed = 0;

  for (const uid of memberIds) {
    try {
      const userLang = await langService.getUserLang(uid);
      const t = (key, vars) => langService.t(userLang, key, vars);

      const label = {
        '24h': '24 ' + t('stage_days_label'),
        '3h': '3',
        '1h': '1',
        '30m': '30',
        '10m': '10',
      }[type] || type;

      const text = buildReminderText({
        match,
        stage,
        tournament,
        label,
        hasRoom: !!(match.roomId && match.roomPassword),
        t,
      });

      await bot.telegram.sendMessage(uid, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: t('tour_open'), callback_data: `tour:open:${match.tournamentId}` }],
          ],
        },
      });
      sent++;
    } catch (e) {
      failed++;
    }

    await new Promise((r) => setTimeout(r, LIMITS.BROADCAST_DELAY_MS));
  }

  await auditService.log({
    action: 'SEND_STAGE_REMINDER',
    tournamentId: match.tournamentId,
    stageId: match.stageId,
    matchId: match.id,
    details: { type, sent, failed, total: memberIds.size },
  });

  return { ok: true, sent, failed, total: memberIds.size };
}

// ============================================================
// XABAR MATNI (3 tilda)
// ============================================================
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReminderText({ match, stage, tournament, label, hasRoom, t }) {
  if (typeof t !== 'function') t = (k) => k;

  const lines = [];

  lines.push('╔══════════════════════╗');
  lines.push(`   ⏰ <b>${label} — ${t('reminder_hour_title')}</b>`);
  lines.push('╚══════════════════════╝');
  lines.push('');

  lines.push(`🏆 <b>${escapeHtml(tournament.title)}</b>`);
  lines.push(`📊 ${escapeHtml(stage.name)}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  lines.push(`📅 <b>${t('promotion_day')}:</b> ${match.dayNumber}`);
  lines.push(`🎮 <b>${t('stage_match_num')}:</b> #${match.dayMatchNumber || match.matchNumber}`);
  lines.push(`🗺 <b>${t('stage_match_map')}:</b> ${escapeHtml(match.map || 'Erangel')}`);
  lines.push(`📆 <b>${t('date')}:</b> ${match.date}`);
  lines.push(`⏰ <b>${t('time')}:</b> ${match.startTime}`);
  lines.push('');

  if (hasRoom) {
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`🆔 <b>${t('tour_room_info')}:</b>`);
    lines.push(`<code>${escapeHtml(match.roomId)}</code>`);
    lines.push('');
    lines.push(`🔒 <b>${t('password')}:</b>`);
    lines.push(`<code>${escapeHtml(match.roomPassword)}</code>`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`⚡️ <i>${t('sub_wait_room')}</i>`);
  } else {
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`⚠️ <b>${t('host_no_tours')}</b>`);
    lines.push('');
    lines.push(`<i>${t('sub_wait_room')}</i>`);
  }

  lines.push('');
  lines.push(`🏅 <i>${t('success')}!</i>`);

  return lines.join('\n');
}

// ============================================================
// QO'LDA YUBORISH
// ============================================================
async function sendManualReminder(bot, matchId) {
  const match = await stageMatchService.getMatch(matchId);
  if (!match) throw new Error('Match topilmadi');

  const startDT = parseDateTime(match.date, match.startTime);
  const diffMin = startDT ? Math.max(0, Math.floor((startDT - new Date()) / 60000)) : 0;

  return sendReminder(bot, match, 'manual', diffMin);
}

// ============================================================
// UPCOMING
// ============================================================
async function getUpcomingReminders() {
  const data = await store.read('stageMatches.json');
  const now = new Date();
  const upcoming = [];

  for (const match of Object.values(data)) {
    if (match.resultStatus === 'approved') continue;
    const startDT = parseDateTime(match.date, match.startTime);
    if (!startDT) continue;
    const diffMin = Math.floor((startDT - now) / 60000);
    if (diffMin > 0 && diffMin <= 1500) {
      const reminder = await getReminder(match.id);
      upcoming.push({
        match,
        minutesUntil: diffMin,
        reminders: reminder?.reminders || {},
      });
    }
  }

  upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil);
  return upcoming;
}

// ============================================================
// SCHEDULER
// ============================================================
let intervalHandle = null;

function start(bot) {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(() => {
    checkAndSendAll(bot).catch((e) => console.error('StageReminder interval:', e.message));
  }, 60 * 1000);
  console.log('⏰ Stage Reminder xizmati ishga tushdi');
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  console.log("⏹ Stage Reminder to'xtatildi");
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  REMINDER_MINUTES,
  getReminder,
  ensureReminder,
  markSent,
  checkAndSendAll,
  sendReminder,
  sendManualReminder,
  getUpcomingReminders,
  buildReminderText,
  start,
  stop,
};