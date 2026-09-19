const store = require('../storage/jsonStore');
const userService = require('./userService');
const { generateId, generateJoinCode } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'teams.json';

async function createTeam({ name, tag, avatarFileId, managerUsername, creatorId }) {
  const id = generateId('team');
  const joinCode = generateJoinCode(10);
  const team = {
    id, name, tag,
    avatarFileId: avatarFileId || null,
    managerUsername: managerUsername || null,
    captainId: creatorId,
    members: [creatorId],
    joinCode,
    createdAt: new Date().toISOString(),
  };
  await store.update(FILE, (data) => { data[id] = team; return team; });
  await userService.setUserTeam(creatorId, id);
  return team;
}

async function getTeam(id) {
  if (!id) return null;
  const data = await store.read(FILE);
  return data[id] || null;
}

async function getTeamByCode(code) {
  if (!code) return null;
  const data = await store.read(FILE);
  const upper = String(code).toUpperCase();
  return Object.values(data).find((t) => t.joinCode === upper) || null;
}

async function getAllTeams() {
  const data = await store.read(FILE);
  return Object.values(data);
}

async function addMember(teamId, userId) {
  return store.update(FILE, (data) => {
    const t = data[teamId];
    if (!t) return null;
    if (!t.members.includes(userId)) t.members.push(userId);
    return t;
  });
}

async function removeMember(teamId, userId) {
  const data = await store.read(FILE);
  const team = data[teamId];
  if (!team) return null;

  // Captain chiqsa — boshqasiga topshiramiz, a'zo bo'lmasa o'chiramiz
  if (team.captainId === userId) {
    const others = team.members.filter((m) => m !== userId);
    if (others.length === 0) {
      await store.update(FILE, (d) => { delete d[teamId]; });
      await userService.setUserTeam(userId, null);
      return { deleted: true };
    }
    const newCaptain = others[0];
    await store.update(FILE, (d) => {
      d[teamId].captainId = newCaptain;
      d[teamId].members = others;
    });
    await userService.setUserTeam(userId, null);
    return { captainTransferred: newCaptain };
  }

  await store.update(FILE, (d) => {
    d[teamId].members = d[teamId].members.filter((m) => m !== userId);
  });
  await userService.setUserTeam(userId, null);
  return { left: true };
}

async function updateTeam(teamId, patch) {
  return store.update(FILE, (data) => {
    if (!data[teamId]) return null;
    Object.assign(data[teamId], patch);
    return data[teamId];
  });
}

async function memberCount(teamId) {
  const t = await getTeam(teamId);
  return t ? t.members.length : 0;
}

async function canAddMember(teamId) {
  const count = await memberCount(teamId);
  return count < LIMITS.MAX_PLAYERS_PER_TEAM;
}

module.exports = {
  createTeam, getTeam, getTeamByCode, getAllTeams,
  addMember, removeMember, updateTeam, memberCount, canAddMember,
};