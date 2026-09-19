const store = require('../storage/jsonStore');
const FILE = 'users.json';

async function upsertUser(tgUser) {
  return store.update(FILE, (data) => {
    const id = String(tgUser.id);
    const prev = data[id] || {};
    data[id] = {
      id: tgUser.id,
      username: tgUser.username || null,
      firstName: tgUser.first_name || '',
      lastName: tgUser.last_name || '',
      languageCode: tgUser.language_code || null,
      teamId: prev.teamId || null,
      status: 'active',
      createdAt: prev.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return data[id];
  });
}

async function getUser(id) {
  const data = await store.read(FILE);
  return data[String(id)] || null;
}

async function getAllUsers() {
  const data = await store.read(FILE);
  return Object.values(data);
}

async function setUserTeam(userId, teamId) {
  return store.update(FILE, (data) => {
    const u = data[String(userId)];
    if (u) { u.teamId = teamId; u.updatedAt = new Date().toISOString(); }
    return u;
  });
}

async function markInactive(userId) {
  return store.update(FILE, (data) => {
    const u = data[String(userId)];
    if (u) u.status = 'inactive';
  });
}

module.exports = { upsertUser, getUser, getAllUsers, setUserTeam, markInactive };