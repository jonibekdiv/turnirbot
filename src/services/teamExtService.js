// Komanda qo'shimcha funksiyalari
const teamService = require('./teamService');
const userService = require('./userService');
const tournamentService = require('./tournamentService');
const matchService = require('./matchService');
const { escapeHtml, displayName } = require('../utils/telegramUtils');

// ============================================================
// 14. KOMANDANI TAHRIRLASH
// ============================================================
async function editTeam(teamId, patch) {
  return teamService.updateTeam(teamId, patch);
}

// ============================================================
// 16. KOMANDA STATISTIKASI
// ============================================================
async function getTeamStats(teamId) {
  const team = await teamService.getTeam(teamId);
  if (!team) return null;

  const allTours = await tournamentService.getAllTournaments();
  let totalMatches = 0;
  let totalKills = 0;
  let totalWins = 0;
  let totalPoints = 0;
  let totalPlacement = 0;

  for (const t of allTours) {
    if (!t.registeredTeams.includes(teamId)) continue;
    const matchData = await matchService.getTournamentMatches(t.id);

    for (const m of matchData.matches) {
      const r = m.results.find((x) => x.teamId === teamId);
      if (!r) continue;
      totalMatches++;
      totalKills += r.kills || 0;
      totalPlacement += r.placement || 0;
      if (r.placement === 1) totalWins++;
      totalPoints += require('./pointsService').calculateTotal(r.placement, r.kills);
    }
  }

  return {
    team,
    matches: totalMatches,
    wins: totalWins,
    kills: totalKills,
    points: totalPoints,
    avgPlacement: totalMatches > 0 ? (totalPlacement / totalMatches).toFixed(1) : 0,
    avgKills: totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : 0,
    winRate: totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(0) : 0,
  };
}

// ============================================================
// 17. KOMANDA TARIXI
// ============================================================
async function getTeamHistory(teamId, limit = 15) {
  const allTours = await tournamentService.getAllTournaments();
  const history = [];

  for (const t of allTours) {
    if (!t.registeredTeams.includes(teamId)) continue;
    const matchData = await matchService.getTournamentMatches(t.id);
    let teamPoints = 0;
    let teamKills = 0;
    let teamWins = 0;

    for (const m of matchData.matches) {
      const r = m.results.find((x) => x.teamId === teamId);
      if (!r) continue;
      teamKills += r.kills || 0;
      if (r.placement === 1) teamWins++;
      teamPoints += require('./pointsService').calculateTotal(r.placement, r.kills);
    }

    history.push({
      tournament: t,
      matches: matchData.matches.length,
      points: teamPoints,
      kills: teamKills,
      wins: teamWins,
    });
  }

  return history
    .sort((a, b) => new Date(b.tournament.createdAt) - new Date(a.tournament.createdAt))
    .slice(0, limit);
}

// ============================================================
// 19. CAPTAIN O'ZGARTIRISH
// ============================================================
async function changeCaptain(teamId, newCaptainId, byUserId) {
  const team = await teamService.getTeam(teamId);
  if (!team) throw new Error('Komanda topilmadi');
  if (team.captainId !== byUserId) throw new Error('Faqat captain o\'zgartira oladi');
  if (!team.members.includes(newCaptainId)) throw new Error('Bu a\'zo komandada emas');
  if (newCaptainId === team.captainId) throw new Error('U allaqachon captain');

  await teamService.updateTeam(teamId, { captainId: newCaptainId });
  return { oldCaptainId: team.captainId, newCaptainId };
}

// ============================================================
// 20. KOMANDA LOGOTIPI (Emoji + Rang)
// ============================================================
const LOGO_EMOJIS = ['🔥', '⚡', '👑', '🦅', '🐉', '🦁', '🐺', '💎', '⭐', '🎯', '⚔', '🛡'];

function generateTeamLogo(teamName) {
  // Deterministik — har nom uchun bir xil
  const hash = [...teamName].reduce((a, c) => a + c.charCodeAt(0), 0);
  const emoji = LOGO_EMOJIS[hash % LOGO_EMOJIS.length];
  return {
    emoji,
    display: `${emoji} ${teamName}`,
  };
}

// ============================================================
// 21. KOMANDA BIO
// ============================================================
async function setTeamBio(teamId, bio, byUserId) {
  const team = await teamService.getTeam(teamId);
  if (!team) throw new Error('Komanda topilmadi');
  if (team.captainId !== byUserId) throw new Error('Faqat captain o\'zgartira oladi');
  return teamService.updateTeam(teamId, { bio: bio.slice(0, 150) });
}

// ============================================================
// 22. KOMANDA A'ZOLARI RO'YXATI
// ============================================================
async function getTeamMembersDetailed(teamId) {
  const team = await teamService.getTeam(teamId);
  if (!team) return null;

  const members = [];
  for (let i = 0; i < team.members.length; i++) {
    const userId = team.members[i];
    const user = await userService.getUser(userId);
    members.push({
      number: i + 1,
      userId,
      user,
      isCaptain: userId === team.captainId,
      pubgId: user?.pubgId || null,
    });
  }
  return { team, members };
}

module.exports = {
  editTeam,
  getTeamStats,
  getTeamHistory,
  changeCaptain,
  generateTeamLogo,
  setTeamBio,
  getTeamMembersDetailed,
  LOGO_EMOJIS,
};