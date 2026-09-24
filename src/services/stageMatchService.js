// ============================================================
// STAGE MATCH SERVICE — Match CRUD + maps + reyting (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const stageService = require('./stageService');
const bracketService = require('./bracketService');
const {
  MATCH_RESULT_STATUS,
  STAGE_STATUS,
  LIMITS,
  PLACEMENT_POINTS,
} = require('../constants');

const FILE = 'stageMatches.json';

// ============================================================
// SANA YORDAMCHI
// ============================================================
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00+05:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ============================================================
// BALL HISOBLASH
// ============================================================
function getPlacementPoints(place) {
  return PLACEMENT_POINTS[place] || 0;
}

function getKillPoints(kills) {
  const k = parseInt(kills, 10);
  return isNaN(k) || k < 0 ? 0 : k;
}

function calculateTotal(place, kills) {
  return getPlacementPoints(place) + getKillPoints(kills);
}

// ============================================================
// MATCHLAR YARATISH (XARITALAR BILAN)
// ============================================================
async function createMatchesForStage(stageId) {
  const stage = await stageService.getStage(stageId);
  if (!stage) throw new Error('Etap topilmadi');

  const rules = stage.rules || {};
  const numberOfDays = rules.numberOfDays || 1;
  const matchesPerDay = rules.matchesPerDay || 4;
  const teamsPerMatch = rules.teamsPerMatch || 16;

  const dayMaps = bracketService.getMapsForDay(matchesPerDay);

  const createdMatches = [];

  for (let day = 1; day <= numberOfDays; day++) {
    for (let m = 1; m <= matchesPerDay; m++) {
      const matchNumber = (day - 1) * matchesPerDay + m;
      const matchDate = addDays(stage.date, day - 1);
      const map = dayMaps[m - 1] || 'Erangel';

      const id = generateId('mt');

      const match = {
        id,
        tournamentId: stage.tournamentId,
        stageId: stage.id,
        dayNumber: day,
        matchNumber,
        dayMatchNumber: m,
        date: matchDate,
        startTime: stage.startTime || '20:00',
        map: map,
        hostId: null,
        roomId: null,
        roomPassword: null,
        teams: [],
        results: [],
        topTeams: [],
        teamsPerMatch,
        resultStatus: MATCH_RESULT_STATUS.PENDING,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        rejectedReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.update(FILE, (data) => {
        data[id] = match;
        return match;
      });

      await stageService.addMatchToStage(stageId, id);
      createdMatches.push(match);
    }
  }

  return createdMatches;
}

// ============================================================
// GET
// ============================================================
async function getMatch(matchId) {
  if (!matchId) return null;
  const data = await store.read(FILE);
  return data[matchId] || null;
}

async function getStageMatches(stageId) {
  if (!stageId) return [];
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((m) => m.stageId === stageId)
    .sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.matchNumber - b.matchNumber;
    });
}

async function getMatchesByDay(stageId, dayNumber) {
  const list = await getStageMatches(stageId);
  return list.filter((m) => m.dayNumber === dayNumber);
}

async function getStageDays(stageId) {
  const matches = await getStageMatches(stageId);
  const days = [...new Set(matches.map((m) => m.dayNumber))];
  return days.sort((a, b) => a - b);
}

async function getTournamentMatches(tournamentId) {
  const data = await store.read(FILE);
  return Object.values(data).filter((m) => m.tournamentId === tournamentId);
}

// ============================================================
// UPDATE
// ============================================================
async function updateMatch(matchId, patch) {
  return store.update(FILE, (data) => {
    if (!data[matchId]) return null;
    Object.assign(data[matchId], patch, { updatedAt: new Date().toISOString() });
    return data[matchId];
  });
}

async function deleteMatch(matchId) {
  return store.update(FILE, (data) => {
    delete data[matchId];
  });
}

async function deleteStageMatches(stageId) {
  return store.update(FILE, (data) => {
    let count = 0;
    for (const [id, m] of Object.entries(data)) {
      if (m.stageId === stageId) {
        delete data[id];
        count++;
      }
    }
    return count;
  });
}

async function deleteTournamentMatches(tournamentId) {
  return store.update(FILE, (data) => {
    let count = 0;
    for (const [id, m] of Object.entries(data)) {
      if (m.tournamentId === tournamentId) {
        delete data[id];
        count++;
      }
    }
    return count;
  });
}

// ============================================================
// HOST
// ============================================================
async function assignHost(matchId, hostId) {
  return updateMatch(matchId, { hostId });
}

async function setRoom(matchId, { roomId, roomPassword }) {
  const patch = {};
  if (roomId !== undefined) patch.roomId = roomId;
  if (roomPassword !== undefined) patch.roomPassword = roomPassword;
  return updateMatch(matchId, patch);
}

async function setMap(matchId, map) {
  if (!bracketService.isValidMap(map)) {
    throw new Error("Noto'g'ri xarita: " + map);
  }
  return updateMatch(matchId, { map });
}

// ============================================================
// TEAMS
// ============================================================
async function setTeams(matchId, teamIds) {
  const ids = Array.isArray(teamIds) ? teamIds : [teamIds];
  return updateMatch(matchId, { teams: ids });
}

async function addTeamToMatch(matchId, teamId) {
  return store.update(FILE, (data) => {
    const m = data[matchId];
    if (!m) return null;
    if (!m.teams) m.teams = [];
    if (!m.teams.includes(teamId)) m.teams.push(teamId);
    m.updatedAt = new Date().toISOString();
    return m;
  });
}

async function removeTeamFromMatch(matchId, teamId) {
  return store.update(FILE, (data) => {
    const m = data[matchId];
    if (!m) return null;
    m.teams = (m.teams || []).filter((t) => t !== teamId);
    m.updatedAt = new Date().toISOString();
    return m;
  });
}

// ============================================================
// RANDOM TAQSIMLASH
// ============================================================
async function distributeTeamsRandomly(stageId) {
  const stage = await stageService.getStage(stageId);
  if (!stage) throw new Error('Etap topilmadi');

  const matches = await getStageMatches(stageId);
  const allTeams = stage.teams || [];

  if (!matches.length) throw new Error("Matchlar yo'q");
  if (!allTeams.length) throw new Error("Komandalar yo'q");

  const matchesPerDay = stage.rules?.matchesPerDay || 4;

  const byDay = {};
  matches.forEach((m) => {
    if (!byDay[m.dayNumber]) byDay[m.dayNumber] = [];
    byDay[m.dayNumber].push(m);
  });

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const dayTeams = shuffle(allTeams);

  for (const dayMatches of Object.values(byDay)) {
    for (const match of dayMatches) {
      await setTeams(match.id, dayTeams);
    }
  }

  return { distributed: dayTeams.length, total: allTeams.length };
}

async function distributeTeamsManual(stageId, distribution) {
  const results = [];
  for (const [matchId, teamIds] of Object.entries(distribution)) {
    const match = await getMatch(matchId);
    if (!match) continue;
    if (teamIds.length > (match.teamsPerMatch || 999)) {
      throw new Error(`Match #${match.matchNumber}: juda ko'p komanda`);
    }
    await setTeams(matchId, teamIds);
    results.push({ matchId, count: teamIds.length });
  }
  return results;
}

// ============================================================
// NATIJALAR
// ============================================================
async function setResults(matchId, results, submittedBy) {
  if (!Array.isArray(results) || !results.length) {
    throw new Error("Natijalar bo'sh");
  }

  const places = results.map((r) => r.place);
  const uniquePlaces = new Set(places);
  if (uniquePlaces.size !== places.length) {
    throw new Error("O'rin raqamlari takrorlanmasin");
  }

  const enriched = results.map((r) => ({
    teamId: r.teamId,
    teamName: r.teamName || '',
    place: Number(r.place),
    kills: Number(r.kills) || 0,
    points: getPlacementPoints(Number(r.place)),
    killPoints: getKillPoints(Number(r.kills)),
    totalPoints: calculateTotal(Number(r.place), Number(r.kills)),
    submittedBy: submittedBy || null,
    submittedAt: new Date().toISOString(),
  }));

  const sorted = [...enriched].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.place - b.place;
  });

  const matchTop = sorted.slice(0, 3).map((r) => r.teamId);

  return updateMatch(matchId, {
    results: enriched,
    topTeams: matchTop,
    resultStatus: MATCH_RESULT_STATUS.SUBMITTED,
    submittedBy,
    submittedAt: new Date().toISOString(),
  });
}

async function approveResults(matchId, approvedBy) {
  const match = await getMatch(matchId);
  if (!match) throw new Error('Match topilmadi');
  if (match.resultStatus === MATCH_RESULT_STATUS.APPROVED) {
    throw new Error('Allaqachon tasdiqlangan');
  }
  if (!match.results || !match.results.length) {
    throw new Error("Natijalar yo'q");
  }

  return updateMatch(matchId, {
    resultStatus: MATCH_RESULT_STATUS.APPROVED,
    approvedBy,
    approvedAt: new Date().toISOString(),
  });
}

async function rejectResults(matchId, reason) {
  return updateMatch(matchId, {
    resultStatus: MATCH_RESULT_STATUS.REJECTED,
    rejectedReason: reason || 'Sababsiz',
  });
}

async function reopenResults(matchId) {
  const match = await getMatch(matchId);
  if (!match) throw new Error('Match topilmadi');
  if (match.resultStatus !== MATCH_RESULT_STATUS.APPROVED) {
    throw new Error('Faqat tasdiqlangan natijani qayta ochish mumkin');
  }

  return updateMatch(matchId, {
    resultStatus: MATCH_RESULT_STATUS.SUBMITTED,
    approvedBy: null,
    approvedAt: null,
    topTeams: [],
  });
}

// ============================================================
// SARALASH
// ============================================================
function sortResults(results) {
  return [...results].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (a.place !== b.place) return a.place - b.place;
    return 0;
  });
}

function getTopTeams(match, count = 3) {
  if (!match || !match.results) return [];
  return sortResults(match.results).slice(0, count);
}

// ============================================================
// STATUS TEKSHIRUVI
// ============================================================
async function isStageAllApproved(stageId) {
  const matches = await getStageMatches(stageId);
  if (!matches.length) return false;
  return matches.every((m) => m.resultStatus === MATCH_RESULT_STATUS.APPROVED);
}

async function isDayAllApproved(stageId, dayNumber) {
  const matches = await getMatchesByDay(stageId, dayNumber);
  if (!matches.length) return false;
  return matches.every((m) => m.resultStatus === MATCH_RESULT_STATUS.APPROVED);
}

// ============================================================
// KUN BO'YICHA REYTING
// ============================================================
async function getDayOverallStandings(stageId, dayNumber) {
  const matches = await getMatchesByDay(stageId, dayNumber);
  if (!matches.length) return [];

  const approvedMatches = matches.filter(
    (m) => m.resultStatus === MATCH_RESULT_STATUS.APPROVED
  );
  if (!approvedMatches.length) return [];

  const standings = {};

  for (const match of approvedMatches) {
    for (const r of match.results || []) {
      if (!standings[r.teamId]) {
        standings[r.teamId] = {
          teamId: r.teamId,
          teamName: r.teamName || '',
          matches: 0,
          wins: 0,
          top3: 0,
          kills: 0,
          placementPoints: 0,
          totalPoints: 0,
          places: [],
          bestPlace: 99,
          perMatch: [],
        };
      }

      const s = standings[r.teamId];
      const place = Number(r.place) || 99;
      const kills = Number(r.kills) || 0;
      const placePts = getPlacementPoints(place);

      s.matches++;
      s.kills += kills;
      s.placementPoints += placePts;
      s.totalPoints += placePts + kills;
      s.places.push(place);

      s.perMatch.push({
        matchId: match.id,
        matchNumber: match.matchNumber,
        dayMatchNumber: match.dayMatchNumber,
        map: match.map,
        place,
        kills,
        points: placePts + kills,
      });

      if (place === 1) s.wins++;
      if (place <= 3) s.top3++;
      if (place < s.bestPlace) s.bestPlace = place;
    }
  }

  const list = Object.values(standings).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.top3 !== a.top3) return b.top3 - a.top3;
    if (a.bestPlace !== b.bestPlace) return a.bestPlace - b.bestPlace;
    return 0;
  });

  list.forEach((s, i) => {
    s.rank = i + 1;
    s.avgPlace =
      s.matches > 0
        ? (s.places.reduce((sum, p) => sum + p, 0) / s.matches).toFixed(1)
        : '-';
  });

  return list;
}

async function getDayTopTeams(stageId, dayNumber, topN = 3) {
  const standings = await getDayOverallStandings(stageId, dayNumber);
  return standings.slice(0, topN);
}

// ============================================================
// BUTUN STAGE REYTING
// ============================================================
async function getStageOverallStandings(stageId) {
  const matches = await getStageMatches(stageId);
  if (!matches.length) return [];

  const approvedMatches = matches.filter(
    (m) => m.resultStatus === MATCH_RESULT_STATUS.APPROVED
  );
  if (!approvedMatches.length) return [];

  const standings = {};

  for (const match of approvedMatches) {
    for (const r of match.results || []) {
      if (!standings[r.teamId]) {
        standings[r.teamId] = {
          teamId: r.teamId,
          teamName: r.teamName || '',
          matches: 0,
          wins: 0,
          top3: 0,
          kills: 0,
          placementPoints: 0,
          totalPoints: 0,
          places: [],
          bestPlace: 99,
        };
      }

      const s = standings[r.teamId];
      const place = Number(r.place) || 99;
      const kills = Number(r.kills) || 0;
      const placePts = getPlacementPoints(place);

      s.matches++;
      s.kills += kills;
      s.placementPoints += placePts;
      s.totalPoints += placePts + kills;
      s.places.push(place);

      if (place === 1) s.wins++;
      if (place <= 3) s.top3++;
      if (place < s.bestPlace) s.bestPlace = place;
    }
  }

  const list = Object.values(standings).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.top3 !== a.top3) return b.top3 - a.top3;
    if (a.bestPlace !== b.bestPlace) return a.bestPlace - b.bestPlace;
    return 0;
  });

  list.forEach((s, i) => {
    s.rank = i + 1;
    s.avgPlace =
      s.matches > 0
        ? (s.places.reduce((sum, p) => sum + p, 0) / s.matches).toFixed(1)
        : '-';
  });

  return list;
}

async function getStageTopTeams(stageId, topN = 3) {
  const standings = await getStageOverallStandings(stageId);
  return standings.slice(0, topN);
}

async function getStageQualifiedTeams(stageId) {
  const matches = await getStageMatches(stageId);
  const qualified = [];

  for (const m of matches) {
    if (m.resultStatus !== MATCH_RESULT_STATUS.APPROVED) continue;
    if (!m.topTeams || !m.topTeams.length) continue;

    for (const teamId of m.topTeams) {
      qualified.push({
        teamId,
        fromMatchId: m.id,
        fromDayNumber: m.dayNumber,
        fromMatchNumber: m.matchNumber,
      });
    }
  }

  return qualified;
}

// ============================================================
// FORMAT (3 tilda)
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

function formatMatchText(match, teamsMap = {}, t) {
  if (!match) return '';
  if (typeof t !== 'function') t = (k) => k;

  const statusEmoji = {
    pending: '⏳',
    submitted: '📤',
    approved: '✅',
    rejected: '❌',
  };
  const statusKey = {
    pending: 'payment_status_pending',
    submitted: 'stage_status_waiting_results',
    approved: 'stage_match_results_approved',
    rejected: 'stage_match_results_rejected',
  };

  const emoji = statusEmoji[match.resultStatus] || '•';
  const status = t(statusKey[match.resultStatus]) || match.resultStatus;

  const lines = [];
  lines.push(
    `🎮 <b>${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}</b>`
  );
  lines.push(`   🗺 <b>${escapeHtml(match.map || 'Erangel')}</b>`);
  lines.push(`   ${emoji} ${status}`);
  lines.push(`   📅 ${match.date} | ⏰ ${match.startTime}`);
  lines.push(
    `   👥 ${t('stage_match_teams')}: <b>${(match.teams || []).length}/${match.teamsPerMatch}</b>`
  );

  if (match.hostId) {
    lines.push(`   🎙 ${t('host_label')}: <code>${match.hostId}</code>`);
  } else {
    lines.push(`   🎙 ${t('host_label')}: <i>${t('stage_match_no_host')}</i>`);
  }

  if (match.roomId && match.roomPassword) {
    lines.push(`   🆔 ${t('tour_room_info')}: <code>${match.roomId}</code>`);
    lines.push(`   🔒 ${t('password')}: <code>${match.roomPassword}</code>`);
  } else {
    lines.push(`   🆔 ${t('tour_room_info')}: <i>${t('stage_match_no_host')}</i>`);
  }

  return lines.join('\n');
}

function formatMatchResults(match, teamsMap = {}, t) {
  if (!match || !match.results || !match.results.length) {
    if (typeof t !== 'function') t = (k) => k;
    return `📭 ${t('no_results_yet')}`;
  }
  if (typeof t !== 'function') t = (k) => k;

  const sorted = sortResults(match.results);

  const lines = [];
  lines.push(
    `📊 <b>${t('promotion_day')} ${match.dayNumber} — ${t('stage_match_num')} #${match.dayMatchNumber || match.matchNumber}</b>`
  );
  lines.push(`🗺 <b>${escapeHtml(match.map || 'Erangel')}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  sorted.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const name = teamsMap[r.teamId]?.name || r.teamName || r.teamId;
    const tag = teamsMap[r.teamId]?.tag || '';

    lines.push(
      `${medal} <b>${escapeHtml(name)}</b>${tag ? ` [${escapeHtml(tag)}]` : ''}`
    );
    lines.push(`   📍 #${r.place} | 💥 ${r.kills} | 💯 <b>${r.totalPoints}</b>`);
  });

  return lines.join('\n');
}

function formatStageStandings(standings, stage, teamsMap = {}, t) {
  if (typeof t !== 'function') t = (k) => k;

  if (!standings || !standings.length) {
    return `📭 ${t('no_results_yet')}`;
  }

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   📊 <b>${escapeHtml(stage?.name || t('stage_title'))} — ${t('standings_title')}</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`🎮 ${t('stage_matches_menu')}: <b>${stage?.matches?.length || '-'}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  standings.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const team = teamsMap[s.teamId];
    const name = team?.name || s.teamName || s.teamId;
    const tag = team?.tag || '';

    lines.push(
      `${medal} <b>${escapeHtml(name)}</b>${tag ? ` [${escapeHtml(tag)}]` : ''}`
    );
    lines.push(
      `   🎮 ${s.matches} | 💥 ${s.kills} | 🏆 ${s.wins} | 💯 <b>${s.totalPoints}</b>`
    );
  });

  return lines.join('\n');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createMatchesForStage,
  getMatch,
  getStageMatches,
  getMatchesByDay,
  getStageDays,
  getTournamentMatches,
  updateMatch,
  deleteMatch,
  deleteStageMatches,
  deleteTournamentMatches,
  assignHost,
  setRoom,
  setMap,
  setTeams,
  addTeamToMatch,
  removeTeamFromMatch,
  distributeTeamsRandomly,
  distributeTeamsManual,
  setResults,
  approveResults,
  rejectResults,
  reopenResults,
  sortResults,
  getTopTeams,
  isStageAllApproved,
  isDayAllApproved,
  getStageQualifiedTeams,
  getDayOverallStandings,
  getDayTopTeams,
  getStageOverallStandings,
  getStageTopTeams,
  formatStageStandings,
  formatMatchText,
  formatMatchResults,
  calculateTotal,
  getPlacementPoints,
  getKillPoints,
};