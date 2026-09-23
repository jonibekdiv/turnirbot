// ============================================================
// REFERRAL SERVICE — Referral tizimi (#7)
// ============================================================
const store = require('../storage/jsonStore');
const { generateJoinCode } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'referrals.json';

// ============================================================
// USER KODINI OLISH YOKI YARATISH
// ============================================================
async function getUserCode(userId) {
  return store.update(FILE, (data) => {
    if (!data.codes) data.codes = {};

    // Mavjud kodni tekshirish
    for (const [code, entry] of Object.entries(data.codes)) {
      if (Number(entry.ownerId) === Number(userId)) {
        return code;
      }
    }

    // Yangi kod yaratish
    let code = generateJoinCode(8);
    let attempts = 0;
    while (data.codes[code] && attempts < 100) {
      code = generateJoinCode(8);
      attempts++;
    }

    data.codes[code] = {
      code,
      ownerId: Number(userId),
      createdAt: new Date().toISOString(),
      uses: 0,
    };

    return code;
  });
}

// ============================================================
// KODNI QO'LLASH (yangi user)
// ============================================================
async function applyReferral(newUserId, code) {
  return store.update(FILE, (data) => {
    if (!data.codes || !data.codes[code]) {
      return { ok: false, reason: 'invalid_code' };
    }

    const codeEntry = data.codes[code];

    // O'z-o'ziga referral?
    if (Number(codeEntry.ownerId) === Number(newUserId)) {
      return { ok: false, reason: 'self_referral' };
    }

    // Allaqachon ishlatilgan?
    if (!data.uses) data.uses = {};
    if (data.uses[String(newUserId)]) {
      return { ok: false, reason: 'already_used' };
    }

    // Limit
    const maxUses = LIMITS.REFERRAL_MAX_PER_USER || 50;
    if (codeEntry.uses >= maxUses) {
      return { ok: false, reason: 'limit_reached' };
    }

    const bonusPoints = LIMITS.REFERRAL_BONUS_POINTS || 50;

    // Yozish
    data.uses[String(newUserId)] = {
      userId: Number(newUserId),
      code,
      ownerId: codeEntry.ownerId,
      appliedAt: new Date().toISOString(),
      bonusPoints,
    };

    codeEntry.uses += 1;

    return {
      ok: true,
      ownerId: codeEntry.ownerId,
      bonusPoints,
    };
  });
}

// ============================================================
// USER STATISTIKASI
// ============================================================
async function getUserReferralStats(userId) {
  const data = await store.read(FILE);
  if (!data.uses) {
    return { invited: 0, bonusPoints: 0, code: null, invitedList: [] };
  }

  const invited = Object.values(data.uses).filter(
    (u) => Number(u.ownerId) === Number(userId)
  );

  let code = null;
  if (data.codes) {
    for (const [c, entry] of Object.entries(data.codes)) {
      if (Number(entry.ownerId) === Number(userId)) {
        code = c;
        break;
      }
    }
  }

  return {
    invited: invited.length,
    bonusPoints: invited.reduce((s, u) => s + (u.bonusPoints || 0), 0),
    code,
    invitedList: invited
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
      .slice(0, 20),
  };
}

// ============================================================
// TOP REFERRERS
// ============================================================
async function getTopReferrers(limit = 10) {
  const data = await store.read(FILE);
  if (!data.uses) return [];

  const counts = {};
  for (const u of Object.values(data.uses)) {
    const owner = String(u.ownerId);
    counts[owner] = (counts[owner] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([userId, invited]) => ({ userId: Number(userId), invited }))
    .sort((a, b) => b.invited - a.invited)
    .slice(0, limit);
}

// ============================================================
// FOYDALANUVCHI ISHLATGAN KOD
// ============================================================
async function getUsedCode(userId) {
  const data = await store.read(FILE);
  return data.uses?.[String(userId)] || null;
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  getUserCode,
  applyReferral,
  getUserReferralStats,
  getTopReferrers,
  getUsedCode,
};