// ============================================================
// SUBSCRIPTION SERVICE — A'zolar obunasini kuzatish
// ============================================================
const store = require('../storage/jsonStore');

const FILE = 'subscriptions.json';

function key(tournamentId, teamId) {
  return `${tournamentId}_${teamId}`;
}

// ============================================================
// A'ZONI TASDIQLASH
// ============================================================
async function markVerified(tournamentId, teamId, userId) {
  return store.update(FILE, (data) => {
    const k = key(tournamentId, teamId);
    if (!data[k]) {
      data[k] = {
        tournamentId,
        teamId,
        verifiedMembers: [],
        createdAt: new Date().toISOString(),
      };
    }
    const uid = Number(userId);
    if (!data[k].verifiedMembers.includes(uid)) {
      data[k].verifiedMembers.push(uid);
    }
    return data[k];
  });
}

// ============================================================
// A'ZO TASDIQLANGANMI?
// ============================================================
async function isVerified(tournamentId, teamId, userId) {
  const data = await store.read(FILE);
  const k = key(tournamentId, teamId);
  return data[k]?.verifiedMembers?.includes(Number(userId)) || false;
}

// ============================================================
// TASDIQLANGAN A'ZOLAR RO'YXATI
// ============================================================
async function getVerifiedMembers(tournamentId, teamId) {
  const data = await store.read(FILE);
  const k = key(tournamentId, teamId);
  return data[k]?.verifiedMembers || [];
}

// ============================================================
// KOMANDA TASDIQLASH HOLATI
// ============================================================
async function getTeamVerification(tournamentId, teamId) {
  const data = await store.read(FILE);
  const k = key(tournamentId, teamId);
  return data[k] || null;
}

// ============================================================
// A'ZONI O'CHIRISH (komandadan chiqsa)
// ============================================================
async function removeMember(tournamentId, teamId, userId) {
  return store.update(FILE, (data) => {
    const k = key(tournamentId, teamId);
    if (data[k]?.verifiedMembers) {
      data[k].verifiedMembers = data[k].verifiedMembers.filter(
        (id) => id !== Number(userId)
      );
    }
    return data[k];
  });
}

module.exports = {
  markVerified,
  isVerified,
  getVerifiedMembers,
  getTeamVerification,
  removeMember,
};