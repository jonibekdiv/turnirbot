// Telegram kanalga post
const settingsService = require('./settingsService');
const { escapeHtml } = require('../utils/telegramUtils');
const config = require('../config');

// ============================================================
// 9, 59. KANALGA E'LON
// ============================================================
async function announceToChannel(bot, tournament) {
  const settings = await settingsService.getSettings();
  const channelId = settings.channelId;
  if (!channelId) return { ok: false, reason: 'no_channel' };

  const text =
    `🏆 <b>YANGI TURNIR!</b>\n\n` +
    `🎯 <b>${escapeHtml(tournament.title)}</b>\n\n` +
    `📅 ${tournament.date} | ⏰ ${tournament.startTime}\n` +
    `🎮 ${escapeHtml(tournament.mode)}\n` +
    (tournament.prize ? `💲 PRIZ: <b>${escapeHtml(tournament.prize)}</b>\n` : '') +
    (tournament.mapTag ? `♾️ MAP: <b>${escapeHtml(tournament.mapTag)}</b>\n` : '') +
    (tournament.etapa ? `⭐️ Etap: <b>${escapeHtml(tournament.etapa)}</b>\n` : '') +
    `👥 ${tournament.registeredTeams.length}/${tournament.maxTeams}\n\n` +
    `👇 Ro'yxatdan o'tish uchun:`;

  const link = `https://t.me/${config.BOT_USERNAME}?start=tour_${tournament.id}`;

  try {
    if (tournament.imageFileId) {
      await bot.telegram.sendPhoto(channelId, tournament.imageFileId, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 Turnirga kirish', url: link }]],
        },
      });
    } else {
      await bot.telegram.sendMessage(channelId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 Turnirga kirish', url: link }]],
        },
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ============================================================
// KANALNI ULASH
// ============================================================
async function setChannel(channelId) {
  return settingsService.updateSettings({ channelId });
}

async function getChannel() {
  const s = await settingsService.getSettings();
  return s.channelId || null;
}

async function unsetChannel() {
  return settingsService.updateSettings({ channelId: null });
}

module.exports = { announceToChannel, setChannel, getChannel, unsetChannel };