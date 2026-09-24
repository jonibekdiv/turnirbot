// ============================================================
// PROMO SERVICE — Promo kodlar (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const PROMO_FILE = 'promos.json';
const USES_FILE = 'promo_uses.json';

// ============================================================
// YANGI PROMO
// ============================================================
async function createPromo({
  code,
  type,
  value,
  maxUses,
  expiresAt,
  tournamentId,
  createdBy,
}) {
  const cleanCode = String(code).toUpperCase().trim();

  return store.update(PROMO_FILE, (data) => {
    const exists = Object.values(data).find(
      (p) => p.code === cleanCode && p.active
    );
    if (exists) throw new Error('Bu kod allaqachon mavjud');

    const id = generateId('promo');
    const promo = {
      id,
      code: cleanCode,
      type,
      value: Number(value) || 0,
      maxUses: Number(maxUses) || LIMITS.PROMO_MAX_USES_DEFAULT,
      usedCount: 0,
      tournamentId: tournamentId || null,
      active: true,
      createdBy: Number(createdBy),
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,
    };

    data[id] = promo;
    return promo;
  });
}

// ============================================================
// GET
// ============================================================
async function getPromo(id) {
  const data = await store.read(PROMO_FILE);
  return data[id] || null;
}

async function getPromoByCode(code) {
  const data = await store.read(PROMO_FILE);
  const clean = String(code).toUpperCase().trim();
  return Object.values(data).find((p) => p.code === clean) || null;
}

async function getAllPromos() {
  const data = await store.read(PROMO_FILE);
  return Object.values(data).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

async function getActivePromos() {
  const all = await getAllPromos();
  const now = new Date();
  return all.filter(
    (p) =>
      p.active &&
      (!p.expiresAt || new Date(p.expiresAt) > now) &&
      p.usedCount < p.maxUses
  );
}

// ============================================================
// DELETE / TOGGLE
// ============================================================
async function deletePromo(id) {
  return store.update(PROMO_FILE, (data) => {
    delete data[id];
  });
}

async function toggleActive(id) {
  return store.update(PROMO_FILE, (data) => {
    const p = data[id];
    if (!p) return null;
    p.active = !p.active;
    return p;
  });
}

// ============================================================
// VALIDATSIYA
// ============================================================
async function validatePromo(code, userId, tournamentId, amount) {
  const promo = await getPromoByCode(code);
  if (!promo) return { ok: false, reason: 'not_found' };
  if (!promo.active) return { ok: false, reason: 'inactive' };
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { ok: false, reason: 'expired' };
  }
  if (promo.usedCount >= promo.maxUses) {
    return { ok: false, reason: 'limit_reached' };
  }
  if (promo.tournamentId && promo.tournamentId !== tournamentId) {
    return { ok: false, reason: 'wrong_tournament' };
  }

  const uses = await store.read(USES_FILE);
  const alreadyUsed = Object.values(uses).find(
    (u) =>
      u.promoId === promo.id &&
      Number(u.userId) === Number(userId) &&
      u.tournamentId === tournamentId
  );
  if (alreadyUsed) return { ok: false, reason: 'already_used' };

  let discount = 0;
  let finalAmount = amount;

  if (promo.type === 'percent') {
    discount = Math.floor((amount * promo.value) / 100);
    finalAmount = amount - discount;
  } else if (promo.type === 'fixed') {
    discount = Math.min(promo.value, amount);
    finalAmount = Math.max(0, amount - discount);
  } else if (promo.type === 'free') {
    discount = amount;
    finalAmount = 0;
  }

  return {
    ok: true,
    promo,
    discount,
    finalAmount,
    originalAmount: amount,
  };
}

// ============================================================
// PROMO ISHLATISH
// ============================================================
async function applyPromo(promoId, userId, tournamentId, teamId, discount, originalAmount, finalAmount) {
  await store.update(USES_FILE, (data) => {
    const id = generateId('pu');
    data[id] = {
      id,
      promoId,
      userId: Number(userId),
      tournamentId,
      teamId,
      discount,
      originalAmount,
      finalAmount,
      usedAt: new Date().toISOString(),
    };
  });

  await store.update(PROMO_FILE, (data) => {
    if (data[promoId]) {
      data[promoId].usedCount = (data[promoId].usedCount || 0) + 1;
    }
  });
}

// ============================================================
// STATISTIKA
// ============================================================
async function getPromoStats(promoId) {
  const uses = await store.read(USES_FILE);
  const list = Object.values(uses).filter((u) => u.promoId === promoId);
  return {
    totalUses: list.length,
    totalDiscount: list.reduce((s, u) => s + (u.discount || 0), 0),
    lastUsed: list.length
      ? list.sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))[0].usedAt
      : null,
    uses: list.slice(0, 20),
  };
}

// ============================================================
// FORMAT (3 tilda)
// ============================================================
function formatType(promo, t) {
  if (typeof t !== 'function') t = (k) => k;

  if (promo.type === 'percent') {
    return t('promo_type_percent_label', { value: promo.value });
  }
  if (promo.type === 'fixed') {
    return t('promo_type_fixed_label', { value: promo.value.toLocaleString() });
  }
  return t('promo_type_free_label');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createPromo,
  getPromo,
  getPromoByCode,
  getAllPromos,
  getActivePromos,
  deletePromo,
  toggleActive,
  validatePromo,
  applyPromo,
  getPromoStats,
  formatType,
};