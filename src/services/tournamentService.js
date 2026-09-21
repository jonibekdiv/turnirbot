// ============================================================
// TOURNAMENT SERVICE — Turnir boshqaruvi (to'lov bilan)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'tournaments.json';

// ============================================================
// YANGI TURNIR YARATISH
// ============================================================
async function createTournament(data) {
  const id = generateId('tour');

  // Payment ma'lumotlari
  const payment = {
    required: data.type === 'paid',
    amount: data.type === 'paid' ? data.amount || null : null,
    currency: data.type === 'paid' ? data.currency || null : null,
    cardNumber: data.type === 'paid' ? data.cardNumber || null : null,
    cardOwner: data.type === 'paid' ? data.cardOwner || null : null,
    instruction: data.type === 'paid' ? data.instruction || null : null,
    deadline: data.type === 'paid' ? data.paymentDeadline || null : null,
  };

  const tournament = {
    id,
    title: data.title,
    type: data.type || 'free',
    imageFileId: data.imageFileId || null,
    date: data.date,
    startTime: data.startTime,
    timezone: 'Asia/Tashkent',
    game: 'PUBG',
    mode: data.mode,
    map: data.map || 'Erangel',
    prize: data.prize || null,
    mapTag: data.mapTag || null,
    etapa: data.etapa || null,
    maxTeams: data.maxTeams || LIMITS.MAX_TEAMS_PER_TOURNAMENT,
    description: data.description || '',
    registrationDeadline: data.registrationDeadline || null,
    payment,
    requiredChannels: data.requiredChannels || [],
    organizerId: data.createdBy || null,
    hostId: data.hostId || null,
    registeredTeams: [],
    roomId: null,
    roomPassword: null,
    status: 'open',
    createdBy: data.createdBy,
    createdByRole: data.createdByRole || null,
    createdAt: new Date().toISOString(),
    reminder10Sent: false,
    reminder5Sent: false,
    roomCredentialsSent: false,
  };

  await store.update(FILE, (d) => {
    d[id] = tournament;
    return tournament;
  });

  return tournament;
}

// ============================================================
// TURNIRNI OLISH
// ============================================================
async function getTournament(id) {
  const data = await store.read(FILE);
  return data[id] || null;
}

// ============================================================
// BARCHA TURNIRLAR
// ============================================================
async function getAllTournaments() {
  const data = await store.read(FILE);
  return Object.values(data);
}

// ============================================================
// TURNIRNI YANGILASH
// ============================================================
async function updateTournament(id, patch) {
  return store.update(FILE, (data) => {
    if (!data[id]) return null;
    Object.assign(data[id], patch);
    return data[id];
  });
}

// ============================================================
// TURNIRNI O'CHIRISH
// ============================================================
async function deleteTournament(id) {
  return store.update(FILE, (data) => {
    delete data[id];
  });
}

// ============================================================
// KOMANDANI RO'YXATDAN O'TKAZISH
// ============================================================
async function registerTeam(tournamentId, teamId) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return { ok: false, reason: 'not_found' };
    if (t.registeredTeams.includes(teamId)) return { ok: false, reason: 'already' };
    if (t.registeredTeams.length >= t.maxTeams) return { ok: false, reason: 'full' };
    t.registeredTeams.push(teamId);
    return { ok: true, tournament: t };
  });
}

// ============================================================
// KOMANDANI CHIQARISH
// ============================================================
async function unregisterTeam(tournamentId, teamId) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    t.registeredTeams = t.registeredTeams.filter((id) => id !== teamId);
    return t;
  });
}

// ============================================================
// HOST BIRIKTIRISH
// ============================================================
async function setHost(tournamentId, hostId) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    t.hostId = hostId;
    return t;
  });
}

// ============================================================
// ROOM MA'LUMOTLARINI O'RNATISH
// ============================================================
async function setRoom(tournamentId, { roomId, roomPassword }) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    if (roomId !== undefined) t.roomId = roomId;
    if (roomPassword !== undefined) t.roomPassword = roomPassword;
    t.roomCredentialsSent = !!(t.roomId && t.roomPassword);
    return t;
  });
}

// ============================================================
// ESLATMA BELGILASH
// ============================================================
async function markReminder(tournamentId, key) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    t[key] = true;
    return t;
  });
}

// ============================================================
// TURNIR STATUSI
// ============================================================
async function setStatus(tournamentId, status) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    t.status = status;
    return t;
  });
}

// ============================================================
// ORGANIZER TURNIRLARI
// ============================================================
async function getOrganizerTournaments(organizerId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter(
      (t) =>
        Number(t.organizerId) === Number(organizerId) ||
        Number(t.createdBy) === Number(organizerId)
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ============================================================
// TURI BO'YICHA TURNIRLAR
// ============================================================
async function getTournamentsByType(type) {
  const data = await store.read(FILE);
  return Object.values(data).filter((t) => t.type === type);
}

// ============================================================
// TURNIR QIDIRISH
// ============================================================
async function searchTournaments(query) {
  const data = await store.read(FILE);
  const q = String(query).toLowerCase();
  return Object.values(data).filter(
    (t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.id || '').toLowerCase().includes(q)
  );
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createTournament,
  getTournament,
  getAllTournaments,
  updateTournament,
  deleteTournament,
  registerTeam,
  unregisterTeam,
  setHost,
  setRoom,
  markReminder,
  setStatus,
  getOrganizerTournaments,
  getTournamentsByType,
  searchTournaments,
};