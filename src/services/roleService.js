// Admin / Organizer / Host rol fayllari bilan umumiy ishlash
const store = require('../storage/jsonStore');

const FILES = {
  admin: 'admins.json',
  organizer: 'organizers.json',
  host: 'hosts.json',
};

async function add(role, userId, addedBy) {
  const file = FILES[role];
  if (!file) throw new Error('Noto\'g\'ri rol');
  return store.update(file, (data) => {
    data[String(userId)] = {
      id: Number(userId),
      addedBy: addedBy ? Number(addedBy) : null,
      addedAt: new Date().toISOString(),
    };
    return data[String(userId)];
  });
}

async function remove(role, userId) {
  const file = FILES[role];
  if (!file) throw new Error('Noto\'g\'ri rol');
  return store.update(file, (data) => {
    delete data[String(userId)];
  });
}

async function has(role, userId) {
  const file = FILES[role];
  if (!file) return false;
  const data = await store.read(file);
  return !!data[String(userId)];
}

async function list(role) {
  const file = FILES[role];
  if (!file) return [];
  const data = await store.read(file);
  return Object.values(data);
}

module.exports = { add, remove, has, list, FILES };