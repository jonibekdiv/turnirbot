// Host uchun yupqa wrapper
const roleService = require('./roleService');

async function addHost(userId, addedBy) {
  return roleService.add('host', userId, addedBy);
}

async function removeHost(userId) {
  return roleService.remove('host', userId);
}

async function isHost(userId) {
  return roleService.has('host', userId);
}

async function listHosts() {
  return roleService.list('host');
}

module.exports = { addHost, removeHost, isHost, listHosts };