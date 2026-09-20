// ============================================================
// JSON STORE — Xavfsiz fayl saqlash
// ============================================================
const fs = require('fs/promises');
const path = require('path');
const { withLock } = require('./fileLock');
const { DATA_DIR } = require('../config');

// Standart fayllar
const DEFAULTS = {
  'users.json': {},
  'teams.json': {},
  'tournaments.json': {},
  'hosts.json': {},
  'admins.json': {},
  'organizers.json': {},
  'messages.json': {},
  'matches.json': {},
  'bans.json': {},
  'actions.json': { actions: [] },
  'achievements.json': {},
  'templates.json': { templates: {} },
  'settings.json': {
    allowAdminAddAdmin: false,
    minTeamMembers: 1,
    maxTeamMembers: 8,
    maxTeamsPerTournament: 18,
    reminder10Minutes: 10,
    reminder5Minutes: 5,
    channelId: null,
  },
};

function fullPath(file) {
  return path.join(DATA_DIR, file);
}

// ============================================================
// FAYL MAVJUDLIGINI TEKSHIRISH / YARATISH
// ============================================================
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

// ============================================================
// O'QISH (buzilgan bo'lsa .bak dan tiklaymiz)
// ============================================================
async function read(file) {
  await ensureFile(file);
  const p = fullPath(file);
  const raw = await fs.readFile(p, 'utf8');

  if (!raw.trim()) {
    return JSON.parse(JSON.stringify(DEFAULTS[file] ?? {}));
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    // Buzilgan — .bak dan tiklash
    try {
      const bak = await fs.readFile(p + '.bak', 'utf8');
      const parsed = JSON.parse(bak);
      await fs.writeFile(p, JSON.stringify(parsed, null, 2), 'utf8');
      console.log(`⚠️ ${file} buzilgan, .bak dan tiklandi`);
      return parsed;
    } catch {
      throw new Error(`${file} buzilgan va backup mavjud emas`);
    }
  }
}

// ============================================================
// XAVFSIZ YOZISH (atomik + backup)
// ============================================================
async function write(file, data) {
  await ensureFile(file);
  const p = fullPath(file);

  // 1. Eski faylni .bak ga nusxalash
  try {
    const existing = await fs.readFile(p, 'utf8');
    if (existing.trim()) {
      await fs.writeFile(p + '.bak', existing, 'utf8');
    }
  } catch (e) {}

  // 2. Temp faylga yozish
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');

  // 3. Atomik almashtirish (rename)
  await fs.rename(tmp, p);
}

// ============================================================
// UPDATE (lock bilan)
// ============================================================
async function update(file, updater) {
  return withLock(file, async () => {
    const data = await read(file);
    const result = await updater(data);
    await write(file, data);
    return result;
  });
}

module.exports = {
  read,
  write,
  update,
  ensureFile,
  ensureAllFiles,
};