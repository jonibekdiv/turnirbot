// Input validatsiyasi
function cleanText(s, max = 200) {
  if (s === null || s === undefined) return '';
  return String(s).trim().slice(0, max);
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

function isValidTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function isPositiveInt(s) {
  return /^\d+$/.test(s) && Number(s) > 0;
}

module.exports = { cleanText, isValidDate, isValidTime, isPositiveInt };