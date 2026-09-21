// ============================================================
// ROLE SERVICE — Admin / Organizer / Host rollari
// ============================================================
const store = require('../storage/jsonStore');
const config = require('../config');

// ============================================================
// FAYLLAR
// ============================================================
const FILES = {
  admin: 'admins.json',
  organizer: 'organizers.json',
  host: 'hosts.json',
};

// ============================================================
// ROL QO'SHISH
// ============================================================
async function add(role, userId, addedBy) {
  const file = FILES[role];
  if (!file) {
    throw new Error("Noto'g'ri rol: " + role);
  }

  // Telegram ID validatsiya
  const id = Number(userId);
  if (!id || id < 100 || id > 9999999999) {
    throw new Error("Noto'g'ri Telegram ID: " + userId);
  }

  // Super Admin'ni qo'shib bo'lmaydi (u .env da)
  if (id === Number(config.SUPER_ADMIN_ID)) {
    throw new Error("Super Admin allaqachon mavjud.");
  }

  return store.update(file, (data) => {
    data[String(id)] = {
      id,
      addedBy: addedBy ? Number(addedBy) : null,
      addedAt: new Date().toISOString(),
    };
    return data[String(id)];
  });
}

// ============================================================
// ROL O'CHIRISH
// ============================================================
async function remove(role, userId) {
  const file = FILES[role];
  if (!file) {
    throw new Error("Noto'g'ri rol: " + role);
  }

  const id = Number(userId);
  if (!id) {
    throw new Error("Noto'g'ri Telegram ID: " + userId);
  }

  // Super Admin'ni o'chirib bo'lmaydi
  if (id === Number(config.SUPER_ADMIN_ID)) {
    throw new Error("Super Admin'ni o'chirib bo'lmaydi.");
  }

  return store.update(file, (data) => {
    if (!data[String(id)]) {
      throw new Error("Bu foydalanuvchi " + role + " emas.");
    }
    delete data[String(id)];
    return true;
  });
}

// ============================================================
// ROL MAVJUDLIGINI TEKSHIRISH
// ============================================================
async function has(role, userId) {
  const file = FILES[role];
  if (!file) return false;

  const id = String(userId);

  // Super Admin har doim "ha"
  if (role === 'admin' && Number(id) === Number(config.SUPER_ADMIN_ID)) {
    return true;
  }

  try {
    const data = await store.read(file);
    return !!data[id];
  } catch (e) {
    return false;
  }
}

// ============================================================
// ROL RO'YXATINI OLISH
// ============================================================
async function list(role) {
  const file = FILES[role];
  if (!file) return [];

  try {
    const data = await store.read(file);
    return Object.values(data);
  } catch (e) {
    return [];
  }
}

// ============================================================
// FOYDALANUVCHINING BARCHA ROLLARINI OLISH
// ============================================================
async function getUserRoles(userId) {
  const roles = [];
  for (const role of Object.keys(FILES)) {
    if (await has(role, userId)) {
      roles.push(role);
    }
  }
  return roles;
}

// ============================================================
// ROLNI TEKSHIRISH + FOYDALANUVCHI MA'LUMOTI
// ============================================================
async function getRoleInfo(role, userId) {
  const file = FILES[role];
  if (!file) return null;

  try {
    const data = await store.read(file);
    return data[String(userId)] || null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// BARCHA ROLLARNI TOZALASH (o'chirilgan foydalanuvchilar)
// ============================================================
async function cleanupDeletedUsers() {
  const userService = require('./userService');
  const allUsers = await userService.getAllUsers();
  const userIds = new Set(allUsers.map((u) => String(u.id)));

  let cleaned = 0;

  for (const role of Object.keys(FILES)) {
    const file = FILES[role];
    await store.update(file, (data) => {
      for (const id of Object.keys(data)) {
        if (!userIds.has(id)) {
          delete data[id];
          cleaned++;
        }
      }
      return data;
    });
  }

  return cleaned;
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  add,
  remove,
  has,
  list,
  getUserRoles,
  getRoleInfo,
  cleanupDeletedUsers,
  FILES,
};