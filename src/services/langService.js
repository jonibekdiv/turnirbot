// ============================================================
// LANG SERVICE — Ko'p tilli tizim
// ============================================================
const store = require('../storage/jsonStore');

const USERS_FILE = 'users.json';
const DEFAULT_LANG = 'uz';
const SUPPORTED = ['uz', 'en', 'ru'];

// Tillar kesh (bir marta yuklab olinadi)
const locales = {
  uz: require('../locales/uz.json'),
  en: require('../locales/en.json'),
  ru: require('../locales/ru.json'),
};

// ============================================================
// FOYDALANUVCHI TILINI OLISH
// ============================================================
async function getUserLang(userId) {
  try {
    const data = await store.read(USERS_FILE);
    const user = data[String(userId)];
    if (user?.lang && SUPPORTED.includes(user.lang)) return user.lang;
  } catch (e) {}
  return DEFAULT_LANG;
}

// ============================================================
// FOYDALANUVCHI TILINI SAQLASH
// ============================================================
async function setUserLang(userId, lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  return store.update(USERS_FILE, (data) => {
    const u = data[String(userId)];
    if (u) {
      u.lang = lang;
      u.updatedAt = new Date().toISOString();
    }
    return u;
  });
}

// ============================================================
// TARJIMA OLISH
// ============================================================
function t(lang, key, vars = {}) {
  const locale = locales[lang] || locales[DEFAULT_LANG];
  let text = locale[key];
  if (text === undefined) {
    // Fallback: o'zbek tilidan izlash
    text = locales[DEFAULT_LANG][key];
  }
  if (text === undefined) return key; // kalit topilmasa — kalitni qaytaramiz

  // O'zgaruvchilarni almashtirish {name} → value
  return String(text).replace(/\{(\w+)\}/g, (_, k) => {
    return vars[k] !== undefined ? String(vars[k]) : `{${k}}`;
  });
}

// ============================================================
// KONTEKST UCHUN `t` FUNKSIYASI
// Har bir ctx uchun `ctx.t(key, vars)` ishlatish mumkin
// ============================================================
function createContextT(lang) {
  return (key, vars = {}) => t(lang, key, vars);
}

// ============================================================
// TIL NOMI (to'liq)
// ============================================================
function getLangName(lang) {
  const names = {
    uz: "🇺🇿 O'zbek",
    en: '🇬🇧 English',
    ru: '🇷🇺 Русский',
  };
  return names[lang] || names[DEFAULT_LANG];
}

module.exports = {
  getUserLang,
  setUserLang,
  t,
  createContextT,
  getLangName,
  SUPPORTED,
  DEFAULT_LANG,
};