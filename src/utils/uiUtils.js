// Loading animatsiya va UX yordamchilari

// Chat action yuborish (yozayapti...)
async function sendTyping(ctx) {
  try { await ctx.sendChatAction('typing'); } catch {}
}

async function sendUploading(ctx) {
  try { await ctx.sendChatAction('upload_photo'); } catch {}
}

async function sendRecordVoice(ctx) {
  try { await ctx.sendChatAction('record_voice'); } catch {}
}

// Loading message yuborish
async function loadingMessage(ctx, text = '⏳ Yuklanmoqda...') {
  try {
    return await ctx.reply(text);
  } catch {
    return null;
  }
}

// Loading messageni o'chirish
async function removeMessage(ctx, messageId) {
  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
  } catch {}
}

// Emoji raqamni chiqarish (1 → 1️⃣)
const EMOJI_NUMBERS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function emojiNumber(n) {
  if (n < 0 || n > 9) return String(n);
  return EMOJI_NUMBERS[n];
}

function emojiNumberMulti(n) {
  return String(n).split('').map((c) => emojiNumber(parseInt(c, 10))).join('');
}

// Progress bar
function progressBar(current, max, length = 10) {
  const filled = Math.round((current / max) * length);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, length - filled));
}

// Medal
function medal(rank) {
  return ['🥇', '🥈', '🥉'][rank - 1] || `${rank}.`;
}

// Status emoji
function statusEmoji(t) {
  if (t.status === 'cancelled') return '🚫';
  if (t.registeredTeams.length >= t.maxTeams) return '🔴';
  if (t.registrationDeadline && new Date(t.registrationDeadline) < new Date()) return '⚫️';
  return '🟢';
}

// Vaqt formatlash — "5 daqiqa oldin"
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return 'hozir';
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return `${Math.floor(diff / 86400)} kun oldin`;
}

module.exports = {
  sendTyping,
  sendUploading,
  sendRecordVoice,
  loadingMessage,
  removeMessage,
  emojiNumber,
  emojiNumberMulti,
  progressBar,
  medal,
  statusEmoji,
  timeAgo,
};