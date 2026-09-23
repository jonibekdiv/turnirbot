// ============================================================
// RESERVATION SERVICE — Joy bron qilish (#20)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'reservations.json';

// ============================================================
// BRON YARATISH (5 daqiqa)
// ============================================================
async function createReservation({ tournamentId, teamId, captainId }) {
  const id = generateId('res');
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + LIMITS.RESERVE_TIMEOUT_MIN * 60 * 1000
  );

  const reservation = {
    id,
    tournamentId,
    teamId,
    captainId,
    status: 'pending',         // pending | confirmed | expired | released
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmedAt: null,
  };

  await store.update(FILE, (data) => {
    data[id] = reservation;
    return reservation;
  });

  return reservation;
}

// ============================================================
// TASDIQLASH
// ============================================================
async function confirmReservation(reservationId) {
  return store.update(FILE, (data) => {
    const r = data[reservationId];
    if (!r) return { ok: false, reason: 'not_found' };
    if (r.status !== 'pending') return { ok: false, reason: 'already' };

    if (new Date(r.expiresAt) < new Date()) {
      r.status = 'expired';
      return { ok: false, reason: 'expired' };
    }

    r.status = 'confirmed';
    r.confirmedAt = new Date().toISOString();
    return { ok: true, reservation: r };
  });
}

// ============================================================
// BEKOR QILISH (release)
// ============================================================
async function releaseReservation(reservationId) {
  return store.update(FILE, (data) => {
    const r = data[reservationId];
    if (!r) return null;
    r.status = 'released';
    r.releasedAt = new Date().toISOString();
    return r;
  });
}

// ============================================================
// TUGAGAN BRONLARNI TEKSHIRISH
// ============================================================
async function getExpiredPending() {
  const data = await store.read(FILE);
  const now = new Date();
  return Object.values(data).filter(
    (r) => r.status === 'pending' && new Date(r.expiresAt) < now
  );
}

// ============================================================
// TURNIR UCHUN BRON
// ============================================================
async function getReservationByTeam(tournamentId, teamId) {
  const data = await store.read(FILE);
  return (
    Object.values(data).find(
      (r) =>
        r.tournamentId === tournamentId &&
        r.teamId === teamId &&
        r.status === 'pending'
    ) || null
  );
}

// ============================================================
// TURNIR UCHUN BARCHA BRONLAR
// ============================================================
async function getTournamentReservations(tournamentId) {
  const data = await store.read(FILE);
  return Object.values(data).filter(
    (r) => r.tournamentId === tournamentId
  );
}

// ============================================================
// ESKI BRONLARNI TOZALASH
// ============================================================
async function cleanupOld(daysOld = 7) {
  const limit = new Date();
  limit.setDate(limit.getDate() - daysOld);

  return store.update(FILE, (data) => {
    for (const [id, r] of Object.entries(data)) {
      if (r.status !== 'pending' && new Date(r.createdAt) < limit) {
        delete data[id];
      }
    }
  });
}

module.exports = {
  createReservation,
  confirmReservation,
  releaseReservation,
  getExpiredPending,
  getReservationByTeam,
  getTournamentReservations,
  cleanupOld,
};