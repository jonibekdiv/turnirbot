// Sana va vaqt bilan ishlash
const { TIMEZONE } = require('../config');

function parseDateTime(dateStr, timeStr) {
  // YYYY-MM-DD + HH:mm -> Date (+05:00 Toshkent)
  if (!dateStr || !timeStr) return null;
  const iso = `${dateStr}T${timeStr}:00+05:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('uz-UZ', {
    timeZone: TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function minutesUntil(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return Math.floor((dt.getTime() - Date.now()) / 60000);
}

function isSameDayTashkent(a, b) {
  const f = (x) => new Date(x).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  return f(a) === f(b);
}

module.exports = { parseDateTime, formatDateTime, minutesUntil, isSameDayTashkent };