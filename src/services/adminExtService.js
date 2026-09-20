// ============================================================
// ADMIN EXT SERVICE — Ban, log, sozlamalar
// ============================================================
const fs = require('fs');
const path = require('path');
const store = require('../storage/jsonStore');
const userService = require('./userService');
const { LOGS_DIR } = require('../config');
const { escapeHtml } = require('../utils/telegramUtils');

const BAN_FILE = 'bans.json';
const ACTIONS_FILE = 'actions.json';
const SETTINGS_FILE = 'settings.json';

// ============================================================
// BAN TIZIMI
// ============================================================
async function banUser(userId, reason, byAdmin) {
  return store.update(BAN_FILE, (data) => {
    data[String(userId)] = {
      userId: Number(userId),
      reason: reason || 'Sababsiz',
      bannedBy: byAdmin,
      bannedAt: new Date().toISOString(),
    };
    return data[String(userId)];
  });
}

async function unbanUser(userId) {
  return store.update(BAN_FILE, (data) => {
    delete data[String(userId)];
  });
}

async function isBanned(userId) {
  const data = await store.read(BAN_FILE);
  return !!data[String(userId)];
}

async function listBanned() {
  const data = await store.read(BAN_FILE);
  return Object.values(data);
}

// ============================================================
// ADMIN AMALLAR TARIXI
// ============================================================
async function logAction(adminId, action, details = {}) {
  return store.update(ACTIONS_FILE, (data) => {
    if (!data.actions) data.actions = [];
    data.actions.push({
      adminId,
      action,
      details,
      at: new Date().toISOString(),
    });
    // Oxirgi 500 ta
    if (data.actions.length > 500) {
      data.actions = data.actions.slice(-500);
    }
  });
}

async function getActions(limit = 20, offset = 0) {
  const data = await store.read(ACTIONS_FILE);
  const all = data.actions || [];
  return {
    total: all.length,
    actions: all.slice().reverse().slice(offset, offset + limit),
  };
}

function formatActions(actions) {
  if (!actions.length) return "📭 Amallar yo'q.";

  const lines = [];
  lines.push('📜 <b>Oxirgi amallar</b>');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  actions.forEach((a, i) => {
    const dt = new Date(a.at);
    const dateStr = dt.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    lines.push(`<b>${i + 1}.</b> <code>${a.adminId}</code>`);
    lines.push(`   🔧 ${escapeHtml(a.action)}`);
    lines.push(`   📅 ${dateStr}`);
    if (a.details?.target) lines.push(`   🎯 ${escapeHtml(String(a.details.target))}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================
// SOZLAMALAR
// ============================================================
async function getSettings() {
  return store.read(SETTINGS_FILE);
}

async function updateSetting(key, value) {
  return store.update(SETTINGS_FILE, (data) => {
    data[key] = value;
    return data;
  });
}

// ============================================================
// XATO LOGLARINI KO'RISH
// ============================================================
async function getRecentLogs(limit = 20) {
  try {
    const logPath = path.join(LOGS_DIR, 'error.log');
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).reverse();
  } catch (e) {
    return [];
  }
}

function formatLogs(lines) {
  if (!lines.length) return "📭 Xatolar yo'q. ✅";

  const output = [];
  output.push(`🐛 <b>Oxirgi xatolar (${lines.length})</b>`);
  output.push('');
  output.push('━━━━━━━━━━━━━━━━━━━━');
  output.push('');
  output.push('<pre>');

  lines.slice(0, 10).forEach((line, i) => {
    const short = line.length > 200 ? line.slice(0, 200) + '...' : line;
    output.push(`${i + 1}. ${escapeHtml(short)}`);
    output.push('');
  });

  output.push('</pre>');
  return output.join('\n');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  banUser,
  unbanUser,
  isBanned,
  listBanned,
  logAction,
  getActions,
  formatActions,
  getSettings,
  updateSetting,
  getRecentLogs,
  formatLogs,
};