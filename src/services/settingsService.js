const store = require('../storage/jsonStore');
const FILE = 'settings.json';

async function getSettings() {
  return store.read(FILE);
}

async function updateSettings(patch) {
  return store.update(FILE, (data) => {
    Object.assign(data, patch);
    return data;
  });
}

module.exports = { getSettings, updateSettings };