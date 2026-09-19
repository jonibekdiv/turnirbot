const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'tournaments.json';

async function createTournament(data) {
  const id = generateId('tour');
  const tournament = {
    id,
    title: data.title,
    imageFileId: data.imageFileId || null,
    date: data.date,
    startTime: data.startTime,
    timezone: 'Asia/Tashkent',
    game: 'PUBG',
    mode: data.mode,
    map: data.map || 'Erangel',
    // 🆕 YANGI MAYDONLAR
    prize: data.prize || null,           // "400.000 MING"
    mapTag: data.mapTag || null,         // "E/M/R/E"
    etapa: data.etapa || null,           // "1/2"
    // Asosiy
    maxTeams: data.maxTeams || LIMITS.MAX_TEAMS_PER_TOURNAMENT,
    description: data.description || '',
    registrationDeadline: data.registrationDeadline || null,
    hostId: null,
    registeredTeams: [],
    roomId: null,
    roomPassword: null,
    status: 'open',
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
    reminder10Sent: false,
    reminder5Sent: false,
    roomCredentialsSent: false,
  };
  await store.update(FILE, (d) => { d[id] = tournament; return tournament; });
  return tournament;
}

async function getTournament(id) {
  const data = await store.read(FILE);
  return data[id] || null;
}

async function getAllTournaments() {
  const data = await store.read(FILE);
  return Object.values(data);
}

async function updateTournament(id, patch) {
  return store.update(FILE, (data) => {
    if (!data[id]) return null;
    Object.assign(data[id], patch);
    return data[id];
  });
}

async function deleteTournament(id) {
  return store.update(FILE, (data) => { delete data[id]; });
}

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

async function setHost(tournamentId, hostId) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    t.hostId = hostId;
    return t;
  });
}

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

async function markReminder(tournamentId, key) {
  return store.update(FILE, (data) => {
    const t = data[tournamentId];
    if (!t) return null;
    t[key] = true;
    return t;
  });
}

module.exports = {
  createTournament, getTournament, getAllTournaments,
  updateTournament, deleteTournament, registerTeam,
  setHost, setRoom, markReminder,
};