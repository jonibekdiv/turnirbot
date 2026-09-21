// ============================================================
// CARD SERVICE — Kartalar boshqaruvi
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');

const FILE = 'cards.json';

// ============================================================
// KARTA YARATISH
// ============================================================
async function createCard({
  number,
  owner,
  phone,
  type,
  bank,
  addedBy,
}) {
  const id = generateId('card');
  const card = {
    id,
    number: number.trim(),
    owner: owner.trim(),
    phone: phone ? phone.trim() : null,
    type: type || 'other',
    bank: bank ? bank.trim() : null,
    addedBy: Number(addedBy),
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  await store.update(FILE, (data) => {
    data[id] = card;
    return card;
  });
  return card;
}

// ============================================================
// KARTANI OLISH
// ============================================================
async function getCard(id) {
  const data = await store.read(FILE);
  return data[id] || null;
}

// ============================================================
// BARCHA KARTALAR
// ============================================================
async function getAllCards() {
  const data = await store.read(FILE);
  return Object.values(data).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

// ============================================================
// ADMIN/ORGANIZER KARTALARI
// ============================================================
async function getUserCards(userId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((c) => Number(c.addedBy) === Number(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ============================================================
// DEFAULT KARTA
// ============================================================
async function getDefaultCard() {
  const data = await store.read(FILE);
  return Object.values(data).find((c) => c.isDefault) || null;
}

// ============================================================
// KARTANI O'CHIRISH
// ============================================================
async function deleteCard(id) {
  return store.update(FILE, (data) => {
    delete data[id];
  });
}

// ============================================================
// DEFAULT QILIB BELGILASH
// ============================================================
async function setDefault(id) {
  return store.update(FILE, (data) => {
    // Barcha kartalardan default belgisini olib tashlash
    Object.values(data).forEach((c) => {
      c.isDefault = false;
    });
    // Yangi default
    if (data[id]) {
      data[id].isDefault = true;
    }
    return data[id];
  });
}

// ============================================================
// KARTANI YANGILASH
// ============================================================
async function updateCard(id, patch) {
  return store.update(FILE, (data) => {
    if (!data[id]) return null;
    Object.assign(data[id], patch);
    return data[id];
  });
}

// ============================================================
// KARTA RAQAMINI FORMATLASH
// ============================================================
function formatCardNumber(number) {
  if (!number) return '-';
  const clean = String(number).replace(/\s/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

// ============================================================
// KARTA RAQAMINI YASHIRISH (xavfsizlik)
// ============================================================
function maskCardNumber(number) {
  if (!number) return '-';
  const clean = String(number).replace(/\s/g, '');
  if (clean.length < 8) return clean;
  return clean.slice(0, 4) + ' **** **** ' + clean.slice(-4);
}

// ============================================================
// TELEFON RAQAMINI FORMATLASH
// ============================================================
function formatPhone(phone) {
  if (!phone) return '-';
  const clean = String(phone).replace(/\D/g, '');

  // +998 XX XXX XX XX
  if (clean.length === 12 && clean.startsWith('998')) {
    return `+998 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10, 12)}`;
  }
  // +998XXXXXXXXX
  if (clean.length === 9) {
    return `+998 ${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)}`;
  }
  return phone;
}

// ============================================================
// TELEFON VALIDATSIYASI
// ============================================================
function isValidPhone(phone) {
  if (!phone) return false;
  const clean = String(phone).replace(/\D/g, '');
  return clean.length >= 9 && clean.length <= 15;
}

// ============================================================
// KARTA RAQAMINI VALIDATSIYA
// ============================================================
function isValidCardNumber(number) {
  if (!number) return false;
  const clean = String(number).replace(/\D/g, '');
  return clean.length >= 16 && clean.length <= 19;
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createCard,
  getCard,
  getAllCards,
  getUserCards,
  getDefaultCard,
  deleteCard,
  setDefault,
  updateCard,
  formatCardNumber,
  maskCardNumber,
  formatPhone,
  isValidPhone,
  isValidCardNumber,
};