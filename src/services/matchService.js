// Karta (match) boshqaruvi
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');

const FILE = 'matches.json';

// Turnirning match konteynerini olish yoki yaratish
async function getTournamentMatches(tournamentId) {
  const data = await store.read(FILE);
  return data[tournamentId] || { tournamentId, matches: [] };
}

// Yangi karta qo'shish
async function addMatch(tournamentId, results, createdBy) {
  return store.update(FILE, (data) => {
    if (!data[tournamentId]) {
      data[tournamentId] = { tournamentId, matches: [] };
    }
    const number = data[tournamentId].matches.length + 1;
    const match = {
      id: generateId('m'),
      number,
      results,        // [{ teamId, placement, kills }]
      createdAt: new Date().toISOString(),
      createdBy,
    };
    data[tournamentId].matches.push(match);
    return match;
  });
}

// Karta o'chirish
async function deleteMatch(tournamentId, matchId) {
  return store.update(FILE, (data) => {
    if (!data[tournamentId]) return false;
    const before = data[tournamentId].matches.length;
    data[tournamentId].matches = data[tournamentId].matches.filter((m) => m.id !== matchId);
    // Qayta raqamlash
    data[tournamentId].matches.forEach((m, i) => { m.number = i + 1; });
    return data[tournamentId].matches.length < before;
  });
}

// Kartani ID bo'yicha olish
async function getMatch(tournamentId, matchId) {
  const data = await store.read(FILE);
  const t = data[tournamentId];
  if (!t) return null;
  return t.matches.find((m) => m.id === matchId) || null;
}

// Turnirning barcha kartalarini o'chirish
async function clearTournamentMatches(tournamentId) {
  return store.update(FILE, (data) => {
    delete data[tournamentId];
  });
}

module.exports = {
  getTournamentMatches,
  addMatch,
  deleteMatch,
  getMatch,
  clearTournamentMatches,
};