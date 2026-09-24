// ============================================================
// RANDOM CODE — Invitation code generator (xavfsiz)
// ============================================================
const crypto = require('crypto');

// Xavfsiz harflar (chalkashtiruvchi olib tashlangan: O, 0, I, l, 1)
const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ============================================================
// ASOSIY GENERATOR
// ============================================================
function generateInvitationCode(length = 8) {
  if (length < 6) length = 6;
  if (length > 20) length = 20;

  let code = '';
  const bytes = crypto.randomBytes(length * 2);

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    code += SAFE_CHARS[byte % SAFE_CHARS.length];
  }

  return code;
}

// Alias
function generateRandomCode(length = 8) {
  return generateInvitationCode(length);
}

// ============================================================
// PREFIX BILAN KOD (masalan: QF-8X92K)
// ============================================================
function generatePrefixedCode(prefix, length = 6) {
  const clean = String(prefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return `${clean}-${generateInvitationCode(length)}`;
}

// ============================================================
// STAGE UCHUN PREFIX
// ============================================================
function getStagePrefix(stageType) {
  const map = {
    quarter_final: 'QF',
    semi_final: 'SF',
    final: 'FN',
  };
  return map[stageType] || 'TN';
}

function generateStageCode(stageType, length = 6) {
  return generatePrefixedCode(getStagePrefix(stageType), length);
}

// ============================================================
// TAKRORLANMAS KOD
// ============================================================
function generateUniqueCode(existingCodes, length = 8) {
  const set = new Set((existingCodes || []).map((c) => String(c).toUpperCase()));

  for (let attempt = 0; attempt < 100; attempt++) {
    const code = generateInvitationCode(length);
    if (!set.has(code)) return code;
  }

  // Fallback — uzunroq
  return generateInvitationCode(length + 4);
}

// ============================================================
// ROOM PAROL
// ============================================================
function generateRoomPassword(length = 6) {
  if (length < 4) length = 4;
  if (length > 12) length = 12;

  // Parol uchun faqat raqam va katta harflar
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let pwd = '';
  const bytes = crypto.randomBytes(length * 2);

  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i] % chars.length];
  }

  return pwd;
}

// ============================================================
// ROOM ID
// ============================================================
function generateRoomId() {
  // 6 xonali raqam
  const num = crypto.randomInt(100000, 999999);
  return String(num);
}

// ============================================================
// VALIDATSIYA
// ============================================================
function isValidCodeFormat(code) {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9-]{4,25}$/.test(code.toUpperCase());
}

function normalizeCode(code) {
  if (!code) return '';
  return String(code).toUpperCase().trim().replace(/\s+/g, '');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  SAFE_CHARS,
  generateInvitationCode,
  generateRandomCode,
  generatePrefixedCode,
  generateStageCode,
  getStagePrefix,
  generateUniqueCode,
  generateRoomPassword,
  generateRoomId,
  isValidCodeFormat,
  normalizeCode,
};