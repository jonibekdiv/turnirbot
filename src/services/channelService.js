// ============================================================
// CHANNEL SERVICE — Kanallar + obuna tekshiruvi + e'lon
// ============================================================
const store = require('../storage/jsonStore');
const settingsService = require('./settingsService');
const { generateId } = require('../utils/idGenerator');
const { escapeHtml } = require('../utils/telegramUtils');
const config = require('../config');

const CH_FILE = 'channels.json';

// ============================================================
// ASOSIY KANAL (Admin e'lon qiladigan)
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
// KANALNI TEKSHIRISH (bot adminmi?)
// ============================================================
async function verifyChannel(bot, channelIdOrUsername) {
  try {
    const chat = await bot.telegram.getChat(channelIdOrUsername);

    // Bot admin ekanligini tekshirish
    let isBotAdmin = false;
    let botStatus = 'not_admin';

    try {
      const me = await bot.telegram.getMe();
      const member = await bot.telegram.getChatMember(chat.id, me.id);
      isBotAdmin = ['administrator', 'creator'].includes(member.status);
      botStatus = member.status;
    } catch (e) {
      isBotAdmin = false;
      botStatus = 'error';
    }

    return {
      ok: true,
      chat: {
        id: chat.id,
        title: chat.title || chat.username || chat.first_name || 'Nomsiz',
        username: chat.username || null,
        type: chat.type,
        inviteLink: chat.username
          ? `https://t.me/${chat.username}`
          : null,
      },
      isBotAdmin,
      botStatus,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e.response?.description || e.message || "Kanalga ulanib bo'lmadi",
    };
  }
}

// ============================================================
// KANALNI SAQLASH
// ============================================================
async function saveChannel({
  channelId,
  title,
  username,
  inviteLink,
  addedBy,
}) {
  const id = generateId('ch');
  const channel = {
    id,
    channelId: String(channelId),
    title,
    username: username || null,
    inviteLink: inviteLink || (username ? `https://t.me/${username}` : null),
    verified: true,
    addedBy: Number(addedBy),
    createdAt: new Date().toISOString(),
  };
  await store.update(CH_FILE, (data) => {
    data[id] = channel;
    return channel;
  });
  return channel;
}

// ============================================================
// KANALNI OLISH
// ============================================================
async function getChannelById(id) {
  const data = await store.read(CH_FILE);
  return data[id] || null;
}

async function findByChannelId(channelId) {
  const data = await store.read(CH_FILE);
  return Object.values(data).find((c) => c.channelId === String(channelId)) || null;
}

// ============================================================
// BARCHA KANALLAR
// ============================================================
async function listChannels() {
  const data = await store.read(CH_FILE);
  return Object.values(data).sort((a, b) => a.title.localeCompare(b.title));
}

// ============================================================
// KANALNI O'CHIRISH
// ============================================================
async function deleteChannel(id) {
  return store.update(CH_FILE, (data) => {
    delete data[id];
  });
}

// ============================================================
// OBUNA HOLATINI TEKSHIRISH
// ============================================================
async function checkSubscription(bot, channelIdOrUsername, userId) {
  try {
    const member = await bot.telegram.getChatMember(
      channelIdOrUsername,
      userId
    );
    const status = member.status;

    if (['member', 'administrator', 'creator'].includes(status)) {
      return { subscribed: true, status };
    }
    return { subscribed: false, status: status || 'left' };
  } catch (e) {
    // Foydalanuvchi topilmadi yoki kanal topilmadi
    return { subscribed: false, status: 'not_found', error: e.message };
  }
}

// ============================================================
// TURNIR UCHUN BARCHA KANALLARGA OBUNA TEKSHIRUVI
// ============================================================
async function checkAllSubscriptions(bot, userId, channels) {
  const results = [];
  for (const ch of channels) {
    const target = ch.channelId || ch.username;
    const res = await checkSubscription(bot, target, userId);
    results.push({
      channel: ch,
      subscribed: res.subscribed,
      status: res.status,
    });
  }
  return results;
}

// ============================================================
// ASOSIY KANALGA E'LON
// ============================================================
async function announceToChannel(bot, tournament) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  const link = `https://t.me/${config.BOT_USERNAME}?start=${tournament.id}`;

  const typeLabel =
    tournament.type === 'paid'
      ? `💳 Pullik (${tournament.payment?.amount || '?'} ${tournament.payment?.currency || ''})`
      : '🆓 Bepul';

  const text =
    `🏆 <b>YANGI TURNIR!</b>\n\n` +
    `🎯 <b>${escapeHtml(tournament.title)}</b>\n` +
    `${typeLabel}\n\n` +
    `📅 ${tournament.date} | ⏰ ${tournament.startTime}\n` +
    `🎮 ${escapeHtml(tournament.mode)}\n` +
    (tournament.prize ? `💲 PRIZ: <b>${escapeHtml(tournament.prize)}</b>\n` : '') +
    (tournament.mapTag ? `♾️ MAP: <b>${escapeHtml(tournament.mapTag)}</b>\n` : '') +
    (tournament.etapa ? `⭐️ Etap: <b>${escapeHtml(tournament.etapa)}</b>\n` : '') +
    `👥 ${tournament.registeredTeams.length}/${tournament.maxTeams}\n\n` +
    `👇 Ro'yxatdan o'tish uchun:`;

  const kb = {
    inline_keyboard: [[{ text: '🎮 Turnirga kirish', url: link }]],
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
// IXTIYORIY REKLAMA
// ============================================================
async function sendCustomText(bot, text, buttonText, buttonUrl) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  const kb =
    buttonText && buttonUrl
      ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
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

async function sendCustomPhoto(bot, fileId, caption, buttonText, buttonUrl) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  const kb =
    buttonText && buttonUrl
      ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
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
      reason: e.response?.description || e.message || "Kanalga ulanib bo'lmadi",
    };
  }
}

module.exports = {
  setChannel,
  getChannel,
  unsetChannel,
  verifyChannel,
  saveChannel,
  getChannelById,
  findByChannelId,
  listChannels,
  deleteChannel,
  checkSubscription,
  checkAllSubscriptions,
  announceToChannel,
  sendCustomText,
  sendCustomPhoto,
  testChannel,
};