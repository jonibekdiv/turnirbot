// ============================================================
// TEMPLATE SERVICE — Turnir shablonlari (#9)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'templates.json';

// ============================================================
// SHABLON YARATISH (turnirdan)
// ============================================================
async function saveFromTournament(tournament, name, createdBy) {
  return store.update(FILE, (data) => {
    if (!data.templates) data.templates = {};

    // Limit
    const userTemplates = Object.values(data.templates).filter(
      (t) => Number(t.createdBy) === Number(createdBy)
    );
    if (userTemplates.length >= (LIMITS.TEMPLATE_MAX_PER_USER || 20)) {
      throw new Error(
        `Limit: ${LIMITS.TEMPLATE_MAX_PER_USER || 20} ta shablon`
      );
    }

    const id = generateId('tpl');
    const tpl = {
      id,
      name,
      // Turnirdan ko'chiriladigan ma'lumotlar
      data: {
        title: tournament.title,
        imageFileId: tournament.imageFileId,
        type: tournament.type,
        mode: tournament.mode,
        map: tournament.map,
        prize: tournament.prize,
        mapTag: tournament.mapTag,
        etapa: tournament.etapa,
        maxTeams: tournament.maxTeams,
        description: tournament.description,
        payment: tournament.payment,
        requiredChannels: tournament.requiredChannels || [],
      },
      createdBy: Number(createdBy),
      createdAt: new Date().toISOString(),
      uses: 0,
      lastUsedAt: null,
    };

    data.templates[id] = tpl;
    return tpl;
  });
}

// ============================================================
// SHABLONNI OLISH
// ============================================================
async function getTemplate(id) {
  const data = await store.read(FILE);
  return data.templates?.[id] || null;
}

// ============================================================
// FOYDALANUVCHI SHABLONLARI
// ============================================================
async function getUserTemplates(userId) {
  const data = await store.read(FILE);
  return Object.values(data.templates || {})
    .filter((t) => Number(t.createdBy) === Number(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ============================================================
// BARCHA SHABLONLAR
// ============================================================
async function getAllTemplates() {
  const data = await store.read(FILE);
  return Object.values(data.templates || {}).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

// ============================================================
// SHABLONNI O'CHIRISH
// ============================================================
async function deleteTemplate(id) {
  return store.update(FILE, (data) => {
    if (data.templates) delete data.templates[id];
  });
}

// ============================================================
// ISHLATILGAN DEB BELGILASH
// ============================================================
async function markUsed(id) {
  return store.update(FILE, (data) => {
    const t = data.templates?.[id];
    if (t) {
      t.uses = (t.uses || 0) + 1;
      t.lastUsedAt = new Date().toISOString();
    }
    return t;
  });
}

// ============================================================
// SHABLONNI YANGILASH
// ============================================================
async function updateTemplate(id, patch) {
  return store.update(FILE, (data) => {
    const t = data.templates?.[id];
    if (!t) return null;
    Object.assign(t, patch);
    return t;
  });
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  saveFromTournament,
  getTemplate,
  getUserTemplates,
  getAllTemplates,
  deleteTemplate,
  markUsed,
  updateTemplate,
};