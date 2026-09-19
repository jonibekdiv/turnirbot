// Lokal JSON fayllar bilan xavfsiz ishlash
const fs = require('fs/promises');
const path = require('path');
const { withLock } = require('./fileLock');
const { DATA_DIR } = require('../config');

const DEFAULTS = {
  'users.json': {},
  'teams.json': {},
  'tournaments.json': {},
  'hosts.json': {},
  'admins.json': {},
  'organizers.json': {},
  'messages.json': {},
  'matches.json': {},           // ← YANGI
  'settings.json': {
    allowAdminAddAdmin: false,
    minTeamMembers: 1,
    maxTeamMembers: 8,
    maxTeamsPerTournament: 18,
    reminder10Minutes: 10,
    reminder5Minutes: 5,
  },
};

function fullPath(file) {
  return path.join(DATA_DIR, file);
}

async function ensureFile(file) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const p = fullPath(file);
  try {
    await fs.access(p);
  } catch {
    const def = DEFAULTS[file] ?? {};
    await fs.writeFile(p, JSON.stringify(def, null, 2), 'utf8');
  }
}

async function ensureAllFiles() {
  for (const f of Object.keys(DEFAULTS)) {
    await ensureFile(f);
  }
}

async function read(file) {
  await ensureFile(file);
  const p = fullPath(file);
  const raw = await fs.readFile(p, 'utf8');
  if (!raw.trim()) return JSON.parse(JSON.stringify(DEFAULTS[file] ?? {}));
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      const bak = await fs.readFile(p + '.bak', 'utf8');
      const parsed = JSON.parse(bak);
      await fs.writeFile(p, JSON.stringify(parsed, null, 2), 'utf8');
      return parsed;
    } catch {
      throw new Error(`${file} fayli buzilgan va backup mavjud emas`);
    }
  }
}

async function write(file, data) {
  await ensureFile(file);
  const p = fullPath(file);
  try {
    const existing = await fs.readFile(p, 'utf8');
    if (existing.trim()) {
      await fs.writeFile(p + '.bak', existing, 'utf8');
    }
  } catch {}
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, p);
}

async function update(file, updater) {
  return withLock(file, async () => {
    const data = await read(file);
    const result = await updater(data);
    await write(file, data);
    return result;
  });
}

module.exports = { read, write, update, ensureFile, ensureAllFiles };