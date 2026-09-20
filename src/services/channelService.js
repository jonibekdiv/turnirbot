// ============================================================
// KANAL XIZMATI — Turnir e'loni + Ixtiyoriy reklama
// ============================================================
const store = require('../storage/jsonStore');
const settingsService = require('./settingsService');
const { escapeHtml } = require('../utils/telegramUtils');
const config = require('../config');

const SETTINGS_FILE = 'settings.json';

// ============================================================
// KANALNI SOZLASH
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

// ============================================================
// TURNIRNI KANALGA E'LON QILISH
// ============================================================
async function announceToChannel(bot, tournament) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  // ✅ TUZATILDI: t.id allaqachon tour_ bilan boshlanadi
  const link = `https://t.me/${config.BOT_USERNAME}?start=${tournament.id}`;

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

  const kb = {
    inline_keyboard: [
      [{ text: '🎮 Turnirga kirish', url: link }],
    ],
  };

  try {
    let sent;
    if (tournament.imageFileId) {
      sent = await bot.telegram.sendPhoto(channelId, tournament.imageFileId, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } else {
      sent = await bot.telegram.sendMessage(channelId, text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    }
    return { ok: true, messageId: sent.message_id };
  } catch (e) {
    return {
      ok: false,
      reason: e.response?.description || e.message || 'Xatolik',
    };
  }
}

// ============================================================
// IXTIYORIY REKLAMA — Matn
// ============================================================
async function sendCustomText(bot, text, buttonText, buttonUrl) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  const kb = buttonText && buttonUrl
    ? {
        inline_keyboard: [
          [{ text: buttonText, url: buttonUrl }],
        ],
      }
    : undefined;

  try {
    const msg = await bot.telegram.sendMessage(channelId, text, {
      parse_mode: 'HTML',
      ...(kb ? { reply_markup: kb } : {}),
    });
    return { ok: true, messageId: msg.message_id };
  } catch (e) {
    return {
      ok: false,
      reason: e.response?.description || e.message || 'Xatolik',
    };
  }
}

// ============================================================
// IXTIYORIY REKLAMA — Rasm + Caption
// ============================================================
async function sendCustomPhoto(bot, fileId, caption, buttonText, buttonUrl) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  const kb = buttonText && buttonUrl
    ? {
        inline_keyboard: [
          [{ text: buttonText, url: buttonUrl }],
        ],
      }
    : undefined;

  try {
    const msg = await bot.telegram.sendPhoto(channelId, fileId, {
      caption: caption || undefined,
      parse_mode: 'HTML',
      ...(kb ? { reply_markup: kb } : {}),
    });
    return { ok: true, messageId: msg.message_id };
  } catch (e) {
    return {
      ok: false,
      reason: e.response?.description || e.message || 'Xatolik',
    };
  }
}

// ============================================================
// KANALNI TEKSHIRISH
// ============================================================
async function testChannel(bot) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  try {
    const chat = await bot.telegram.getChat(channelId);
    return {
      ok: true,
      title: chat.title || chat.username || channelId,
      type: chat.type,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e.response?.description || e.message || 'Kanalga ulanib bo\'lmadi',
    };
  }
}

module.exports = {
  setChannel,
  getChannel,
  unsetChannel,
  announceToChannel,
  sendCustomText,
  sendCustomPhoto,
  testChannel,
};