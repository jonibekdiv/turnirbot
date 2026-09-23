// ============================================================
// BROADCAST STATS SERVICE — Reklama statistikasi (#17)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');

const FILE = 'broadcast_stats.json';

// ============================================================
// YANGI REKLAMA YOZISH
// ============================================================
async function startBroadcast({
  adminId,
  type,          // 'all' | 'tournament' | 'custom'
  tournamentId,
  title,
  totalTargets,
}) {
  const id = generateId('bc');
  const entry = {
    id,
    adminId,
    type,
    tournamentId: tournamentId || null,
    title: title || '',
    totalTargets,
    sent: 0,
    failed: 0,
    blocked: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: 0,
  };

  await store.update(FILE, (data) => {
    if (!data.broadcasts) data.broadcasts = {};
    data.broadcasts[id] = entry;
    return entry;
  });

  return entry;
}

// ============================================================
// REKLAMA YAKUNLASH
// ============================================================
async function finishBroadcast(broadcastId, { sent, failed, blocked }) {
  return store.update(FILE, (data) => {
    if (!data.broadcasts || !data.broadcasts[broadcastId]) return null;
    const bc = data.broadcasts[broadcastId];
    bc.sent = sent;
    bc.failed = failed;
    bc.blocked = blocked || 0;
    bc.finishedAt = new Date().toISOString();
    bc.durationMs = new Date(bc.finishedAt) - new Date(bc.startedAt);
    return bc;
  });
}

// ============================================================
// REKLAMA STATISTIKASI
// ============================================================
async function getBroadcastStats(limit = 20) {
  const data = await store.read(FILE);
  const all = Object.values(data.broadcasts || {}).sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
  return all.slice(0, limit);
}

// ============================================================
// UMUMIY STATISTIKA (summalar)
// ============================================================
async function getSummary() {
  const data = await store.read(FILE);
  const all = Object.values(data.broadcasts || {});

  return {
    total: all.length,
    totalSent: all.reduce((s, b) => s + (b.sent || 0), 0),
    totalFailed: all.reduce((s, b) => s + (b.failed || 0), 0),
    totalBlocked: all.reduce((s, b) => s + (b.blocked || 0), 0),
    totalTargets: all.reduce((s, b) => s + (b.totalTargets || 0), 0),
  };
}

// ============================================================
// BITTA REKLAMA
// ============================================================
async function getBroadcast(id) {
  const data = await store.read(FILE);
  return data.broadcasts?.[id] || null;
}

module.exports = {
  startBroadcast,
  finishBroadcast,
  getBroadcastStats,
  getSummary,
  getBroadcast,
};