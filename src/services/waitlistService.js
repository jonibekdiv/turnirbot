// ============================================================
// WAITLIST SERVICE — Kutish ro'yxati (#3)
// ============================================================
const store = require('../storage/jsonStore');
const { LIMITS } = require('../constants');

const FILE = 'waitlists.json';

// ============================================================
// KUTISH RO'YXATIGA QO'SHISH
// ============================================================
async function addToWaitlist(tournamentId, teamId, captainId) {
  return store.update(FILE, (data) => {
    if (!data[tournamentId]) {
      data[tournamentId] = [];
    }

    const list = data[tournamentId];

    // Allaqachon bormi?
    if (list.find((e) => e.teamId === teamId)) {
      return { ok: false, reason: 'already' };
    }

    // Limit
    if (list.length >= LIMITS.WAITLIST_MAX_PER_TOUR) {
      return { ok: false, reason: 'full' };
    }

    const entry = {
      teamId,
      captainId,
      joinedAt: new Date().toISOString(),
      position: list.length + 1,
      notifiedAt: null,
    };

    list.push(entry);
    return { ok: true, position: entry.position };
  });
}

// ============================================================
// KUTISH RO'YXATIDAN CHIQISH
// ============================================================
async function removeFromWaitlist(tournamentId, teamId) {
  return store.update(FILE, (data) => {
    if (!data[tournamentId]) return { ok: false };

    const before = data[tournamentId].length;
    data[tournamentId] = data[tournamentId].filter(
      (e) => e.teamId !== teamId
    );

    // Pozitsiyalarni qayta hisoblash
    data[tournamentId].forEach((e, i) => {
      e.position = i + 1;
    });

    return { ok: data[tournamentId].length < before };
  });
}

// ============================================================
// RO'YXATNI OLISH
// ============================================================
async function getWaitlist(tournamentId) {
  const data = await store.read(FILE);
  return data[tournamentId] || [];
}

// ============================================================
// TURNIR UCHUN BIRINCHI KUTAYOTGAN
// ============================================================
async function getNextInLine(tournamentId) {
  const list = await getWaitlist(tournamentId);
  return list[0] || null;
}

// ============================================================
// FOYDALANUVCHI KUTISHLARI
// ============================================================
async function getUserWaitlist(captainId) {
  const data = await store.read(FILE);
  const result = [];

  for (const [tournamentId, list] of Object.entries(data)) {
    const entry = list.find((e) => Number(e.captainId) === Number(captainId));
    if (entry) {
      result.push({
        tournamentId,
        position: entry.position,
        joinedAt: entry.joinedAt,
      });
    }
  }

  return result;
}

// ============================================================
// BIRINCHINI KO'TARISH
// ============================================================
async function popFirst(tournamentId) {
  return store.update(FILE, (data) => {
    if (!data[tournamentId] || !data[tournamentId].length) return null;
    const first = data[tournamentId].shift();
    data[tournamentId].forEach((e, i) => {
      e.position = i + 1;
    });
    return first;
  });
}

// ============================================================
// TURNIR RO'YXATINI O'CHIRISH
// ============================================================
async function clearTournament(tournamentId) {
  return store.update(FILE, (data) => {
    delete data[tournamentId];
  });
}

module.exports = {
  addToWaitlist,
  removeFromWaitlist,
  getWaitlist,
  getNextInLine,
  getUserWaitlist,
  popFirst,
  clearTournament,
};