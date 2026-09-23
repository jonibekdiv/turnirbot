// ============================================================
// LIVE SCORE SERVICE — Real-time ball (#23)
// ============================================================
const store = require('../storage/jsonStore');
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const pointsService = require('./pointsService');
const { escapeHtml } = require('../utils/telegramUtils');

const FILE = 'live_scores.json';

// ============================================================
// LIVE SESSION BOSHLASH
// ============================================================
async function startSession(tournamentId, hostId) {
  return store.update(FILE, (data) => {
    if (data[tournamentId] && data[tournamentId].active) {
      return data[tournamentId];
    }

    data[tournamentId] = {
      tournamentId,
      hostId,
      matchNumber: (data[tournamentId]?.matchNumber || 0) + 1,
      active: true,
      results: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      endedAt: null,
    };

    return data[tournamentId];
  });
}

// ============================================================
// KILL QO'SHISH
// ============================================================
async function addKills(tournamentId, teamId, kills = 1) {
  return store.update(FILE, (data) => {
    const s = data[tournamentId];
    if (!s || !s.active) return null;

    if (!s.results[teamId]) {
      s.results[teamId] = { kills: 0, placement: null };
    }

    s.results[teamId].kills = (s.results[teamId].kills || 0) + kills;
    s.results[teamId].updatedAt = new Date().toISOString();
    s.updatedAt = new Date().toISOString();

    return s;
  });
}

// ============================================================
// KILL AYIRISH
// ============================================================
async function removeKills(tournamentId, teamId, kills = 1) {
  return store.update(FILE, (data) => {
    const s = data[tournamentId];
    if (!s || !s.active) return null;

    if (!s.results[teamId]) {
      s.results[teamId] = { kills: 0, placement: null };
    }

    s.results[teamId].kills = Math.max(
      0,
      (s.results[teamId].kills || 0) - kills
    );
    s.results[teamId].updatedAt = new Date().toISOString();
    s.updatedAt = new Date().toISOString();

    return s;
  });
}

// ============================================================
// O'RIN BELGILASH
// ============================================================
async function setPlacement(tournamentId, teamId, placement) {
  return store.update(FILE, (data) => {
    const s = data[tournamentId];
    if (!s || !s.active) return null;

    if (!s.results[teamId]) {
      s.results[teamId] = { kills: 0, placement: null };
    }

    s.results[teamId].placement = placement;
    s.results[teamId].updatedAt = new Date().toISOString();
    s.updatedAt = new Date().toISOString();

    return s;
  });
}

// ============================================================
// SESSION YAKUNLASH
// ============================================================
async function endSession(tournamentId) {
  return store.update(FILE, (data) => {
    const s = data[tournamentId];
    if (!s) return null;
    s.active = false;
    s.endedAt = new Date().toISOString();
    return s;
  });
}

// ============================================================
// SESSIONNI TOZALASH
// ============================================================
async function clearSession(tournamentId) {
  return store.update(FILE, (data) => {
    delete data[tournamentId];
  });
}

// ============================================================
// SESSIONNI OLISH
// ============================================================
async function getSession(tournamentId) {
  const data = await store.read(FILE);
  return data[tournamentId] || null;
}

// ============================================================
// TEAM MA'LUMOTLARINI YIG'ISH
// ============================================================
async function getEnrichedResults(tournamentId) {
  const s = await getSession(tournamentId);
  if (!s || !s.results) return [];

  const rows = [];

  for (const [teamId, r] of Object.entries(s.results)) {
    const team = await teamService.getTeam(teamId);
    const pts = r.placement
      ? pointsService.calculateTotal(r.placement, r.kills || 0)
      : r.kills || 0;

    rows.push({
      teamId,
      name: team?.name || 'Noma\'lum',
      tag: team?.tag || '?',
      placement: r.placement,
      kills: r.kills || 0,
      points: pts,
      updatedAt: r.updatedAt,
    });
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if ((a.placement || 999) !== (b.placement || 999)) {
      return (a.placement || 999) - (b.placement || 999);
    }
    return 0;
  });

  return rows;
}

// ============================================================
// LIVE TABLE MATNI
// ============================================================
async function formatLiveTable(tournamentId) {
  const s = await getSession(tournamentId);

  if (!s) {
    return '📭 Live ma\'lumot yo\'q.';
  }

  const t = await tournamentService.getTournament(tournamentId);
  if (!t) return '❗ Turnir topilmadi.';

  const rows = await getEnrichedResults(tournamentId);

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   🔴 <b>LIVE SCORE</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`🏆 <b>${escapeHtml(t.title)}</b>`);
  lines.push(`🎮 Karta №${s.matchNumber}`);
  lines.push(`📊 Komandalar: ${rows.length}`);
  lines.push('');

  if (!rows.length) {
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push('<i>Hozircha natijalar yo\'q</i>');
    return lines.join('\n');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📋 <b>NATIJALAR:</b>');
  lines.push('');

  rows.forEach((r, i) => {
    const medal =
      i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const placeTxt = r.placement ? `#${r.placement}` : '—';
    lines.push(
      `${medal} <b>${escapeHtml(r.name)}</b> [${escapeHtml(r.tag)}]\n` +
        `   📍 ${placeTxt} | 💥 ${r.kills} kill | 💯 <b>${r.points}</b> pts`
    );
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push(
    `🕐 Yangilangan: ${new Date(s.updatedAt).toLocaleTimeString('uz-UZ')}`
  );

  return lines.join('\n');
}

// ============================================================
// MATCHNI YAKUNLASH VA NATIJALARGA O'TKAZISH
// ============================================================
async function commitToMatch(tournamentId, createdBy) {
  const s = await getSession(tournamentId);
  if (!s || !s.results) {
    throw new Error('Live session topilmadi yoki natijalar yo\'q');
  }

  // Har bir komandada placement bo'lishi kerak
  const entries = Object.entries(s.results);
  if (!entries.length) {
    throw new Error('Natijalar bo\'sh');
  }

  const results = [];
  const missingPlacement = [];

  for (const [teamId, r] of entries) {
    if (!r.placement) {
      missingPlacement.push(teamId);
      continue;
    }
    results.push({
      teamId,
      placement: r.placement,
      kills: r.kills || 0,
    });
  }

  if (missingPlacement.length) {
    throw new Error(
      `Quyidagi komandalar uchun o'rin belgilanmagan: ${missingPlacement.length}`
    );
  }

  // O'rinlarni tekshirish (dublikatlar)
  const placements = results.map((r) => r.placement);
  const uniquePlacements = new Set(placements);
  if (uniquePlacements.size !== placements.length) {
    throw new Error('O\'rin raqamlari takrorlanmasin!');
  }

  // Matchni saqlash
  const matchService = require('./matchService');
  const match = await matchService.addMatch(tournamentId, results, createdBy);

  // Sessionni tugatish
  await endSession(tournamentId);

  return match;
}

// ============================================================
// ACTIVENI TEKSHIRISH
// ============================================================
async function isActive(tournamentId) {
  const s = await getSession(tournamentId);
  return s?.active || false;
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  startSession,
  addKills,
  removeKills,
  setPlacement,
  endSession,
  clearSession,
  getSession,
  getEnrichedResults,
  formatLiveTable,
  commitToMatch,
  isActive,
};