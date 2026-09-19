// Turnir komandalar ro'yxatini chiroyli formatda tayyorlaydi
const teamService = require('./teamService');
const userService = require('./userService');
const { escapeHtml } = require('../utils/telegramUtils');

// Doim bo'sh ko'rsatiladigan o'rinlar (1 va 2)
const EMPTY_SLOTS = 2;

// Asosiy funksiya — turnir kartasini tayyorlash
async function buildTeamList(tournament) {
  // Ro'yxatdan o'tgan komandalarni yig'amiz
  const teams = [];
  for (const teamId of tournament.registeredTeams) {
    const t = await teamService.getTeam(teamId);
    if (!t) continue;

    const captain = await userService.getUser(t.captainId);
    const capName = captain?.username ? '@' + captain.username : null;

    teams.push({
      id: t.id,
      name: t.name,
      tag: t.tag,
      captainName: capName,
    });
  }

  // Sarlavha qismi (shablon)
  const lines = [];
  lines.push(`<b>${escapeHtml(tournament.title.toUpperCase())}</b>🇺🇿`);
  lines.push('');

  // 💲 PRIZ
  if (tournament.prize) {
    lines.push(`💲PRIZ :  <b>${escapeHtml(tournament.prize)}</b>`);
  }

  // ♾️ MAP
  if (tournament.mapTag) {
    lines.push(`♾️MAP: <b>${escapeHtml(tournament.mapTag)}</b>`);
  }

  // ⭐️ Etap
  if (tournament.etapa) {
    lines.push(`⭐️Etap:  <b>${escapeHtml(tournament.etapa)}</b> 😎`);
  }

  // 🌛 VAQTI — UZ va RU (-2 soat)
  const timeUz = tournament.startTime || '-';
  const timeRu = subtractHours(tournament.startTime, 2);
  lines.push(`🌛VAQTI: <b>${escapeHtml(timeUz)}</b>🇺🇿 <b>${escapeHtml(timeRu)}</b>🇷🇺`);

  // 🌛 KUNI — DD.MM.YY formatda
  const day = formatDay(tournament.date);
  lines.push(`🌛KUNI: <b>${escapeHtml(day)}</b>`);

  lines.push('');

  // 1 va 2 — EMPTY
  for (let i = 0; i < EMPTY_SLOTS; i++) {
    lines.push(`➡️<b>${i + 1} EMPY</b>`);
  }

  // 3+ — komandalar
  const startIndex = EMPTY_SLOTS + 1;
  const maxSlots = tournament.maxTeams || 18;

  for (let i = 0; i < teams.length; i++) {
    const num = startIndex + i;
    const t = teams[i];
    const capPart = t.captainName ? ` ${t.captainName}` : '';
    lines.push(`⭐️<b>${num}</b> - <b>${escapeHtml(t.name)}</b>${capPart}`);
  }

  // Qolgan bo'sh o'rinlar
  const filled = EMPTY_SLOTS + teams.length;
  for (let i = filled; i < maxSlots; i++) {
    lines.push(`⭐️<b>${i + 1}</b> - `);
  }

  return lines.join('\n');
}

// Sana "2026-09-20" → "20.09.26"
function formatDay(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}.${m}.${y.slice(2)}`;
}

// "20:00" → "18:00" (2 soat ayirish)
function subtractHours(timeStr, hours) {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const newH = (h - hours + 24) % 24;
  return String(newH).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

module.exports = { buildTeamList, formatDay, subtractHours };