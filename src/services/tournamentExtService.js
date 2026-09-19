// Turnir qo'shimcha funksiyalari
const store = require('../storage/jsonStore');
const tournamentService = require('./tournamentService');
const matchService = require('./matchService');
const teamService = require('./teamService');
const { generateId } = require('../utils/idGenerator');
const { escapeHtml } = require('../utils/telegramUtils');
const { formatDateTime } = require('../utils/dateUtils');

const T_FILE = 'tournaments.json';
const TPL_FILE = 'templates.json';

// ============================================================
// 2. TURNIRNI NUSXALASH
// ============================================================
async function cloneTournament(oldId, newDate, newTime, createdBy) {
  const old = await tournamentService.getTournament(oldId);
  if (!old) throw new Error('Turnir topilmadi');

  const newId = generateId('tour');
  const cloned = {
    ...old,
    id: newId,
    date: newDate || old.date,
    startTime: newTime || old.startTime,
    registeredTeams: [],
    roomId: null,
    roomPassword: null,
    hostId: null,
    status: 'open',
    createdBy,
    createdAt: new Date().toISOString(),
    reminder10Sent: false,
    reminder5Sent: false,
    roomCredentialsSent: false,
  };
  delete cloned._id;

  await store.update(T_FILE, (data) => {
    data[newId] = cloned;
    return cloned;
  });
  return cloned;
}

// ============================================================
// 4. TURNIRNI BEKOR QILISH
// ============================================================
async function cancelTournament(tournamentId, reason) {
  const t = await tournamentService.getTournament(tournamentId);
  if (!t) throw new Error('Turnir topilmadi');

  await tournamentService.updateTournament(tournamentId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelReason: reason || 'Sababsiz bekor qilindi',
  });

  // Barcha ishtirokchilarni yig'ish
  const memberIds = new Set();
  for (const teamId of t.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (team) team.members.forEach((m) => memberIds.add(m));
  }
  return { tournament: t, memberIds: Array.from(memberIds) };
}

// ============================================================
// 5. TURNIR TARIXI (tugagan)
// ============================================================
async function getTournamentHistory(limit = 20) {
  const all = await tournamentService.getAllTournaments();
  const now = new Date();
  return all
    .filter((t) => {
      const d = new Date(`${t.date}T${t.startTime}:00+05:00`);
      return d < now || t.status === 'finished';
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ============================================================
// 6. TURNIR HAVOLASI
// ============================================================
function buildTournamentLink(tournamentId, botUsername) {
  return `https://t.me/${botUsername}?start=tour_${tournamentId}`;
}

// ============================================================
// 7. TURNIR STATISTIKASI
// ============================================================
async function getTournamentStats(tournamentId) {
  const t = await tournamentService.getTournament(tournamentId);
  if (!t) return null;

  const matchData = await matchService.getTournamentMatches(tournamentId);

  // Nechta komanda, nechta o'yinchi
  let totalPlayers = 0;
  for (const teamId of t.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (team) totalPlayers += team.members.length;
  }

  // Total kills, wins
  let totalKills = 0;
  let totalMatches = matchData.matches.length;

  matchData.matches.forEach((m) => {
    m.results.forEach((r) => {
      totalKills += r.kills || 0;
    });
  });

  return {
    tournament: t,
    teams: t.registeredTeams.length,
    maxTeams: t.maxTeams,
    players: totalPlayers,
    matches: totalMatches,
    totalKills,
    avgKills: totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : 0,
    fillRate: ((t.registeredTeams.length / t.maxTeams) * 100).toFixed(0),
  };
}

// ============================================================
// 10. TURNIR SHABLONI
// ============================================================
async function saveTemplate(name, data, createdBy) {
  const id = generateId('tpl');
  const tpl = {
    id, name, data, createdBy,
    createdAt: new Date().toISOString(),
  };
  await store.update(TPL_FILE, (d) => {
    if (!d.templates) d.templates = {};
    d.templates[id] = tpl;
    return tpl;
  });
  return tpl;
}

async function listTemplates() {
  const data = await store.read(TPL_FILE);
  return Object.values(data.templates || {});
}

async function getTemplate(id) {
  const data = await store.read(TPL_FILE);
  return data.templates?.[id] || null;
}

async function deleteTemplate(id) {
  return store.update(TPL_FILE, (d) => {
    if (d.templates) delete d.templates[id];
  });
}

// ============================================================
// 11. KO'P ETAP
// ============================================================
async function setTournamentStage(tournamentId, stage) {
  return tournamentService.updateTournament(tournamentId, { stage });
}

async function getTournamentStage(tournamentId) {
  const t = await tournamentService.getTournament(tournamentId);
  return t?.stage || 'single';
}

// ============================================================
// 13. TURNIR KALENDARI (oylik)
// ============================================================
async function getTournamentCalendar(year, month) {
  const all = await tournamentService.getAllTournaments();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return all
    .filter((t) => t.date && t.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildCalendarText(tours, year, month) {
  const monthNames = [
    '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  ];

  const lines = [];
  lines.push(`📅 <b>${monthNames[month]} ${year}</b>`);
  lines.push(`📊 Jami: <b>${tours.length}</b> ta turnir`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (!tours.length) {
    lines.push('<i>Bu oyda turnir yo\'q</i>');
    return lines.join('\n');
  }

  // Kun bo'yicha guruhlash
  const byDay = {};
  tours.forEach((t) => {
    const day = t.date.slice(8, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  });

  Object.keys(byDay).sort().forEach((day) => {
    lines.push(`📌 <b>${day}-kun:</b>`);
    byDay[day].forEach((t) => {
      lines.push(`   ⏰ ${t.startTime} — <b>${escapeHtml(t.title)}</b>`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================
// 33. TURNIR HISOBOTI
// ============================================================
async function buildTournamentReport(tournamentId) {
  const t = await tournamentService.getTournament(tournamentId);
  if (!t) throw new Error('Turnir topilmadi');

  const matchData = await matchService.getTournamentMatches(tournamentId);
  const teamsMap = {};
  for (const tid of t.registeredTeams) {
    const team = await teamService.getTeam(tid);
    if (team) teamsMap[tid] = team;
  }

  const pointsService = require('./pointsService');
  const standings = pointsService.calculateStandings(t, matchData, teamsMap);

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`  📊 <b>TURNIR HISOBOTI</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`🏆 <b>${escapeHtml(t.title)}</b>`);
  lines.push(`📅 ${t.date} | ⏰ ${t.startTime}`);
  if (t.etapa) lines.push(`⭐️ Etap: <b>${escapeHtml(t.etapa)}</b>`);
  if (t.prize) lines.push(`💲 PRIZ: <b>${escapeHtml(t.prize)}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`👥 Komandalar: <b>${t.registeredTeams.length}</b>`);
  lines.push(`🎮 Kartalar: <b>${matchData.matches.length}</b>`);
  lines.push('');

  // Top 3
  if (standings.length >= 1) {
    lines.push('🥇 <b>TOP-3 G\'OLIBLAR:</b>');
    lines.push('');
    const medals = ['🥇', '🥈', '🥉'];
    for (let i = 0; i < Math.min(3, standings.length); i++) {
      const s = standings[i];
      lines.push(`${medals[i]} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`);
      lines.push(`   💯 ${s.totalPoints} pts | 🎯 ${s.totalKills} kill | 🏆 ${s.wins} win`);
      lines.push('');
    }
  }

  // To'liq jadval
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📋 <b>TO\'LIQ JADVAL:</b>');
  lines.push('');
  lines.push('<pre>');
  lines.push('No Team              Win Place Kill Total');
  lines.push('─────────────────────────────────────────');

  standings.forEach((s, i) => {
    const no = String(i + 1).padEnd(3);
    const name = s.name.slice(0, 17).padEnd(18);
    const w = String(s.wins).padEnd(4);
    const p = String(s.totalPlacementPoints).padEnd(6);
    const k = String(s.totalKills).padEnd(5);
    const tot = String(s.totalPoints);
    lines.push(`${no}${name}${w}${p}${k}${tot}`);
  });
  lines.push('</pre>');

  return lines.join('\n');
}

// ============================================================
// 34. G'OLIBLARNI E'LON QILISH
// ============================================================
async function buildWinnersAnnouncement(tournamentId) {
  const t = await tournamentService.getTournament(tournamentId);
  if (!t) throw new Error('Turnir topilmadi');

  const matchData = await matchService.getTournamentMatches(tournamentId);
  const teamsMap = {};
  for (const tid of t.registeredTeams) {
    const team = await teamService.getTeam(tid);
    if (team) teamsMap[tid] = team;
  }

  const pointsService = require('./pointsService');
  const standings = pointsService.calculateStandings(t, matchData, teamsMap);

  if (!standings.length) return null;

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   🏆 <b>G'OLIBLAR</b> 🏆`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`🎮 <b>${escapeHtml(t.title)}</b>`);
  lines.push(`📅 ${t.date}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  const medals = ['🥇', '🥈', '🥉'];
  const rankNames = ['1-O\'RIN', '2-O\'RIN', '3-O\'RIN'];

  for (let i = 0; i < Math.min(3, standings.length); i++) {
    const s = standings[i];
    lines.push(`${medals[i]} <b>${rankNames[i]}</b>`);
    lines.push(`🏷 <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`);
    lines.push(`💯 <b>${s.totalPoints}</b> ball`);
    lines.push(`🎯 ${s.totalKills} kill`);
    lines.push(`🏆 ${s.wins} win`);
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('🎉 <b>Barcha ishtirokchilarga rahmat!</b>');

  return { text: lines.join('\n'), winners: standings.slice(0, 3) };
}

// ============================================================
// 35. SOVRIN TARQATISH
// ============================================================
async function distributePrize(tournamentId, winners, prizeText) {
  const t = await tournamentService.getTournament(tournamentId);
  if (!t) throw new Error('Turnir topilmadi');

  const results = [];
  for (const w of winners) {
    const team = await teamService.getTeam(w.teamId);
    if (!team) continue;
    const captain = team.captainId;
    results.push({
      teamId: team.id,
      teamName: team.name,
      captainId: captain,
      prize: prizeText,
    });
  }

  await tournamentService.updateTournament(tournamentId, {
    prizeDistributedAt: new Date().toISOString(),
    winners: results,
  });

  return results;
}

module.exports = {
  cloneTournament,
  cancelTournament,
  getTournamentHistory,
  buildTournamentLink,
  getTournamentStats,
  saveTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  setTournamentStage,
  getTournamentStage,
  getTournamentCalendar,
  buildCalendarText,
  buildTournamentReport,
  buildWinnersAnnouncement,
  distributePrize,
};