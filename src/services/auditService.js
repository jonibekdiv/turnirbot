// ============================================================
// AUDIT SERVICE — Barcha o'zgarishlar tarixi
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'auditLogs.json';

// ============================================================
// LOG YOZISH
// ============================================================
async function log({
  action,
  actorId = null,
  tournamentId = null,
  stageId = null,
  matchId = null,
  teamId = null,
  details = {},
  result = 'success',
}) {
  try {
    return await store.update(FILE, (data) => {
      if (!data.logs) data.logs = [];

      const entry = {
        id: generateId('log'),
        action,
        actorId: actorId ? Number(actorId) : null,
        tournamentId: tournamentId || null,
        stageId: stageId || null,
        matchId: matchId || null,
        teamId: teamId || null,
        details: details || {},
        result,
        at: new Date().toISOString(),
      };

      data.logs.push(entry);

      // Limit
      if (data.logs.length > LIMITS.AUDIT_LOG_MAX) {
        data.logs = data.logs.slice(-LIMITS.AUDIT_LOG_MAX);
      }

      return entry;
    });
  } catch (e) {
    console.error('auditService.log xatosi:', e.message);
    return null;
  }
}

// ============================================================
// LOG OLISH
// ============================================================
async function getLogs(filter = {}, limit = 50) {
  const data = await store.read(FILE);
  let list = data.logs || [];

  if (filter.tournamentId) {
    list = list.filter((l) => l.tournamentId === filter.tournamentId);
  }
  if (filter.stageId) {
    list = list.filter((l) => l.stageId === filter.stageId);
  }
  if (filter.matchId) {
    list = list.filter((l) => l.matchId === filter.matchId);
  }
  if (filter.teamId) {
    list = list.filter((l) => l.teamId === filter.teamId);
  }
  if (filter.actorId) {
    list = list.filter((l) => Number(l.actorId) === Number(filter.actorId));
  }
  if (filter.action) {
    list = list.filter((l) => l.action === filter.action);
  }

  return list.slice().reverse().slice(0, limit);
}

// ============================================================
// TOZALASH (Super Admin)
// ============================================================
async function clearOldLogs(daysOld = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return store.update(FILE, (data) => {
    if (!data.logs) return;
    data.logs = data.logs.filter((l) => new Date(l.at) > cutoff);
  });
}

// ============================================================
// FORMAT
// ============================================================
function formatLog(log) {
  const dt = new Date(log.at).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
  });
  return (
    `📝 <b>${log.action}</b>\n` +
    `👤 Actor: <code>${log.actorId || '-'}</code>\n` +
    (log.tournamentId ? `🏆 Turnir: <code>${log.tournamentId}</code>\n` : '') +
    (log.stageId ? `📊 Etap: <code>${log.stageId}</code>\n` : '') +
    (log.matchId ? `🎮 Match: <code>${log.matchId}</code>\n` : '') +
    (log.teamId ? `👥 Komanda: <code>${log.teamId}</code>\n` : '') +
    `📅 ${dt}\n` +
    `📊 Natija: <b>${log.result}</b>`
  );
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  log,
  getLogs,
  clearOldLogs,
  formatLog,
};