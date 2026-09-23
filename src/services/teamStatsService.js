// ============================================================
// TEAM STATS SERVICE — Komanda statistikasi va arxivi (#10, #15)
// ============================================================
const tournamentService = require('./tournamentService');
const teamService = require('./teamService');
const matchService = require('./matchService');
const pointsService = require('./pointsService');

// ============================================================
// TO'LIQ STATISTIKA
// ============================================================
async function getTeamFullStats(teamId) {
  const team = await teamService.getTeam(teamId);
  if (!team) return null;

  const allTours = await tournamentService.getAllTournaments();

  let matches = 0;
  let wins = 0;
  let totalKills = 0;
  let totalPoints = 0;
  let totalPlacement = 0;
  let top3Count = 0;
  let bestPlacement = Infinity;
  const placements = [];

  for (const t of allTours) {
    if (!t.registeredTeams.includes(teamId)) continue;
    const md = await matchService.getTournamentMatches(t.id);

    for (const m of md.matches) {
      const r = m.results.find((x) => x.teamId === teamId);
      if (!r) continue;

      matches++;
      totalKills += r.kills || 0;
      totalPlacement += r.placement || 0;
      placements.push(r.placement);
      if (r.placement === 1) wins++;
      if (r.placement && r.placement <= 3) top3Count++;
      if (r.placement && r.placement < bestPlacement) bestPlacement = r.placement;
      totalPoints += pointsService.calculateTotal(r.placement, r.kills);
    }
  }

  return {
    team,
    matches,
    wins,
    top3: top3Count,
    kills: totalKills,
    points: totalPoints,
    bestPlacement: bestPlacement === Infinity ? null : bestPlacement,
    avgPlacement: matches > 0 ? (totalPlacement / matches).toFixed(1) : 0,
    avgKills: matches > 0 ? (totalKills / matches).toFixed(1) : 0,
    winRate: matches > 0 ? ((wins / matches) * 100).toFixed(0) : 0,
    placements,
  };
}

// ============================================================
// REYTING (barcha komandalar orasida)
// ============================================================
async function getTeamRank(teamId) {
  const allTeams = await teamService.getAllTeams();
  const rankings = [];

  for (const team of allTeams) {
    const stats = await getTeamFullStats(team.id);
    if (!stats || stats.matches === 0) continue;

    rankings.push({
      teamId: team.id,
      name: team.name,
      tag: team.tag,
      points: stats.points,
      kills: stats.kills,
      wins: stats.wins,
      matches: stats.matches,
    });
  }

  rankings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.wins - a.wins;
  });

  const idx = rankings.findIndex((r) => r.teamId === teamId);
  return {
    rank: idx >= 0 ? idx + 1 : null,
    total: rankings.length,
    rankings,
  };
}

// ============================================================
// TOP-10 REYTING
// ============================================================
async function getLeaderboard(limit = 10) {
  const allTeams = await teamService.getAllTeams();
  const rankings = [];

  for (const team of allTeams) {
    const stats = await getTeamFullStats(team.id);
    if (!stats || stats.matches === 0) continue;

    rankings.push({
      teamId: team.id,
      name: team.name,
      tag: team.tag,
      points: stats.points,
      kills: stats.kills,
      wins: stats.wins,
      matches: stats.matches,
      winRate: stats.winRate,
    });
  }

  rankings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.wins - a.wins;
  });

  return rankings.slice(0, limit);
}

// ============================================================
// TARIX (o'tgan turnirlar) (#15)
// ============================================================
async function getTeamFullHistory(teamId, limit = 20) {
  const allTours = await tournamentService.getAllTournaments();
  const history = [];

  for (const t of allTours) {
    if (!t.registeredTeams.includes(teamId)) continue;

    const md = await matchService.getTournamentMatches(t.id);
    let teamPoints = 0;
    let teamKills = 0;
    let teamWins = 0;
    let bestPlacement = null;

    for (const m of md.matches) {
      const r = m.results.find((x) => x.teamId === teamId);
      if (!r) continue;
      teamKills += r.kills || 0;
      if (r.placement === 1) teamWins++;
      if (bestPlacement === null || r.placement < bestPlacement) {
        bestPlacement = r.placement;
      }
      teamPoints += pointsService.calculateTotal(r.placement, r.kills);
    }

    history.push({
      tournament: t,
      matches: md.matches.length,
      points: teamPoints,
      kills: teamKills,
      wins: teamWins,
      bestPlacement,
      registered: true,
    });
  }

  history.sort(
    (a, b) =>
      new Date(b.tournament.createdAt) - new Date(a.tournament.createdAt)
  );

  return history.slice(0, limit);
}

module.exports = {
  getTeamFullStats,
  getTeamRank,
  getLeaderboard,
  getTeamFullHistory,
};