// Foydalanuvchi qo'shimcha funksiyalari
const store = require('../storage/jsonStore');
const userService = require('./userService');
const teamService = require('./teamService');
const tournamentService = require('./tournamentService');
const matchService = require('./matchService');
const { ACHIEVEMENTS } = require('../constants');
const { escapeHtml, displayName } = require('../utils/telegramUtils');

const U_FILE = 'users.json';
const A_FILE = 'achievements.json';

// ============================================================
// 24. PUBG ID SAQLASH
// ============================================================
async function setPubgId(userId, pubgId) {
  return store.update(U_FILE, (data) => {
    const u = data[String(userId)];
    if (u) {
      u.pubgId = pubgId;
      u.updatedAt = new Date().toISOString();
    }
    return u;
  });
}

async function getPubgId(userId) {
  const u = await userService.getUser(userId);
  return u?.pubgId || null;
}

// ============================================================
// 25. SHAXSIY STATISTIKA
// ============================================================
async function getUserStats(userId) {
  const user = await userService.getUser(userId);
  if (!user) return null;

  // Komanda bo'yicha
  let teamStats = null;
  if (user.teamId) {
    const team = await teamService.getTeam(user.teamId);
    if (team) {
      teamStats = await computeTeamStats(team.id);
    }
  }

  return {
    user,
    teamStats,
  };
}

async function computeTeamStats(teamId) {
  const allTours = await tournamentService.getAllTournaments();
  let matches = 0, kills = 0, wins = 0, points = 0;

  for (const t of allTours) {
    if (!t.registeredTeams.includes(teamId)) continue;
    const md = await matchService.getTournamentMatches(t.id);
    for (const m of md.matches) {
      const r = m.results.find((x) => x.teamId === teamId);
      if (!r) continue;
      matches++;
      kills += r.kills || 0;
      if (r.placement === 1) wins++;
      points += require('./pointsService').calculateTotal(r.placement, r.kills);
    }
  }

  return { matches, kills, wins, points };
}

// ============================================================
// 27. ACHIEVEMENTS
// ============================================================
async function checkAchievements(userId) {
  const user = await userService.getUser(userId);
  if (!user) return [];

  const earned = [];

  // 10 matches
  if (user.teamId) {
    const stats = await computeTeamStats(user.teamId);
    if (stats.matches >= 10) earned.push(ACHIEVEMENTS.TEN_MATCHES.id);
    if (stats.kills >= 100) earned.push(ACHIEVEMENTS.HUNDRED_KILLS.id);
    if (stats.wins >= 5) earned.push(ACHIEVEMENTS.FIVE_WINS.id);
    if (stats.wins >= 1) earned.push(ACHIEVEMENTS.CHICKEN_DINNER.id);

    const team = await teamService.getTeam(user.teamId);
    if (team && team.captainId === userId) earned.push(ACHIEVEMENTS.CAPTAIN_MASTER.id);
  }

  // Saqlash
  await store.update(A_FILE, (data) => {
    const key = String(userId);
    if (!data[key]) data[key] = { userId, achievements: [] };
    for (const id of earned) {
      if (!data[key].achievements.includes(id)) {
        data[key].achievements.push(id);
      }
    }
  });

  return earned;
}

async function getUserAchievements(userId) {
  const data = await store.read(A_FILE);
  const userAch = data[String(userId)]?.achievements || [];
  return Object.values(ACHIEVEMENTS).map((a) => ({
    ...a,
    earned: userAch.includes(a.id),
  }));
}

// ============================================================
// 28. LEADERBOARD
// ============================================================
async function getLeaderboard(limit = 10) {
  const teams = await teamService.getAllTeams();
  const allTours = await tournamentService.getAllTournaments();

  const stats = [];

  for (const team of teams) {
    let kills = 0, wins = 0, points = 0, matches = 0;

    for (const t of allTours) {
      if (!t.registeredTeams.includes(team.id)) continue;
      const md = await matchService.getTournamentMatches(t.id);
      for (const m of md.matches) {
        const r = m.results.find((x) => x.teamId === team.id);
        if (!r) continue;
        matches++;
        kills += r.kills || 0;
        if (r.placement === 1) wins++;
        points += require('./pointsService').calculateTotal(r.placement, r.kills);
      }
    }

    if (matches > 0) {
      stats.push({
        teamId: team.id,
        name: team.name,
        tag: team.tag,
        matches, kills, wins, points,
        avgPoints: (points / matches).toFixed(1),
      });
    }
  }

  stats.sort((a, b) => b.points - a.points || b.kills - a.kills);
  return stats.slice(0, limit);
}

function formatLeaderboard(list, mode = 'all') {
  if (!list.length) return '📭 Hozircha ma\'lumot yo\'q.';

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   🏆 <b>LEADERBOARD</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');

  if (mode === 'kills') {
    lines.push('🎯 <i>Kill bo\'yicha TOP</i>');
  } else if (mode === 'wins') {
    lines.push('🏆 <i>Win bo\'yicha TOP</i>');
  } else {
    lines.push('💯 <i>Ball bo\'yicha TOP</i>');
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  list.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    lines.push(`${medal} <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.tag)}]`);
    lines.push(`   💯 ${s.points} pts | 🎯 ${s.kills} kill | 🏆 ${s.wins} win`);
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = {
  setPubgId,
  getPubgId,
  getUserStats,
  computeTeamStats,
  checkAchievements,
  getUserAchievements,
  getLeaderboard,
  formatLeaderboard,
};