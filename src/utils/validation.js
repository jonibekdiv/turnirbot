// ============================================================
// VALIDATION — Input tozalash va tekshirish
// ============================================================

// Matnni tozalash
function cleanText(s, max = 200) {
  if (s === null || s === undefined) return '';
  return String(s).trim().slice(0, max);
}

// Sana tekshiruvi (YYYY-MM-DD)
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

// Vaqt tekshiruvi (HH:mm)
function isValidTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

// Musbat butun son
function isPositiveInt(s) {
  return /^\d+$/.test(s) && Number(s) > 0;
}

// Telegram ID tekshiruvi
function isValidTelegramId(s) {
  return /^\d{5,15}$/.test(String(s));
}

// Username tekshiruvi
function isValidUsername(s) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(s);
}

// URL tekshiruvi
function isValidUrl(s) {
  try {
    new URL(s);
    return /^https?:\/\//i.test(s);
  } catch {
    return false;
  }
}

// Telefon raqam (UZ)
function isValidPhone(s) {
  return /^\+?998\d{9}$/.test(String(s).replace(/\s/g, ''));
}

// HTML escape (xavfsizlik)
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  cleanText,
  isValidDate,
  isValidTime,
  isPositiveInt,
  isValidTelegramId,
  isValidUsername,
  isValidUrl,
  isValidPhone,
  escapeHtml,
};