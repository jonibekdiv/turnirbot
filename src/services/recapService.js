// ============================================================
// RECAP SERVICE — Turnir xulosasi (#12)
// ============================================================
const store = require('../storage/jsonStore');
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const matchService = require('./matchService');
const pointsService = require('./pointsService');
const userService = require('./userService');
const { escapeHtml } = require('../utils/telegramUtils');
const { generateId } = require('../utils/idGenerator');

const FILE = 'recaps.json';

// ============================================================
// RECAP MATNI YARATISH
// ============================================================
async function buildRecap(tournamentId) {
  const tour = await tournamentService.getTournament(tournamentId);
  if (!tour) throw new Error('Turnir topilmadi');

  const matchData = await matchService.getTournamentMatches(tournamentId);
  const teamsMap = {};
  for (const tid of tour.registeredTeams) {
    const team = await teamService.getTeam(tid);
    if (team) teamsMap[tid] = team;
  }

  const standings = pointsService.calculateStandings(
    tour,
    matchData,
    teamsMap
  );

  // Statistika
  let totalKills = 0;
  let totalPlayers = 0;

  for (const team of Object.values(teamsMap)) {
    totalPlayers += team.members.length;
  }

  matchData.matches.forEach((m) => {
    m.results.forEach((r) => {
      totalKills += r.kills || 0;
    });
  });

  const avgKills =
    matchData.matches.length > 0
      ? (totalKills / matchData.matches.length).toFixed(1)
      : 0;

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   📊 <b>TURNIR XULOSASI</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`🏆 <b>${escapeHtml(tour.title)}</b>`);
  lines.push(`📅 ${tour.date} | ⏰ ${tour.startTime}`);
  if (tour.type === 'paid') {
    lines.push(`💳 Pullik turnir`);
  } else {
    lines.push(`🆓 Bepul turnir`);
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`👥 Komandalar: <b>${tour.registeredTeams.length}</b>`);
  lines.push(`👤 O'yinchilar: <b>${totalPlayers}</b>`);
  lines.push(`🎮 Kartalar: <b>${matchData.matches.length}</b>`);
  lines.push(`💥 Jami kill: <b>${totalKills}</b>`);
  lines.push(`📊 O'rtacha kill/karta: <b>${avgKills}</b>`);
  lines.push('');

  // TOP-3
  if (standings.length) {
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`🥇 <b>TOP-3 G'OLIBLAR:</b>`);
    lines.push('');

    const medals = ['🥇', '🥈', '🥉'];
    const rankNames = ["1-O'RIN", "2-O'RIN", "3-O'RIN"];

    for (let i = 0; i < Math.min(3, standings.length); i++) {
      const s = standings[i];
      lines.push(`${medals[i]} <b>${rankNames[i]}</b>`);
      lines.push(`🏷 <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`);
      lines.push(`💯 <b>${s.totalPoints}</b> ball`);
      lines.push(`🎯 ${s.totalKills} kill`);
      lines.push(`🏆 ${s.wins} win`);
      lines.push('');
    }

    // To'liq jadval
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`📋 <b>TO'LIQ JADVAL:</b>`);
    lines.push('');
    lines.push('<pre>');
    lines.push('No Team              Win Place Kill Total');
    lines.push('─────────────────────────────────────────');

    standings.forEach((s, i) => {
      const no = String(i + 1).padEnd(3);
      const name = (s.name || '').slice(0, 17).padEnd(18);
      const w = String(s.wins).padEnd(4);
      const p = String(s.totalPlacementPoints).padEnd(6);
      const k = String(s.totalKills).padEnd(5);
      const tot = String(s.totalPoints);
      lines.push(`${no}${name}${w}${p}${k}${tot}`);
    });
    lines.push('</pre>');
  } else {
    lines.push(`<i>Natijalar yo'q</i>`);
  }

  return lines.join('\n');
}

// ============================================================
// RECAP SAQLASH
// ============================================================
async function saveRecap(tournamentId, text, createdBy) {
  return store.update(FILE, (data) => {
    if (!data.recaps) data.recaps = {};

    const id = generateId('rcp');
    data.recaps[id] = {
      id,
      tournamentId,
      text,
      createdBy: Number(createdBy),
      createdAt: new Date().toISOString(),
    };
    return data.recaps[id];
  });
}

// ============================================================
// RECAP OLISH
// ============================================================
async function getRecap(id) {
  const data = await store.read(FILE);
  return data.recaps?.[id] || null;
}

// ============================================================
// TURNIR UCHUN RECAPLAR
// ============================================================
async function getRecapsByTournament(tournamentId) {
  const data = await store.read(FILE);
  return Object.values(data.recaps || {}).filter(
    (r) => r.tournamentId === tournamentId
  );
}

// ============================================================
// RECAP O'CHIRISH
// ============================================================
async function deleteRecap(id) {
  return store.update(FILE, (data) => {
    if (data.recaps) delete data.recaps[id];
  });
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  buildRecap,
  saveRecap,
  getRecap,
  getRecapsByTournament,
  deleteRecap,
};