// ============================================================
// CHANNEL SERVICE — Kanallar + obuna + e'lon qilish
// ============================================================
const store = require('../storage/jsonStore');
const settingsService = require('./settingsService');
const { generateId } = require('../utils/idGenerator');
const { escapeHtml } = require('../utils/telegramUtils');
const config = require('../config');

const CH_FILE = 'channels.json';

// ============================================================
// ASOSIY KANAL
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
// KANALNI TEKSHIRISH
// ============================================================
async function verifyChannel(bot, channelIdOrUsername) {
  try {
    const chat = await bot.telegram.getChat(channelIdOrUsername);

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
        inviteLink: chat.username ? `https://t.me/${chat.username}` : null,
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
async function saveChannel({ channelId, title, username, inviteLink, addedBy }) {
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

async function getChannelById(id) {
  const data = await store.read(CH_FILE);
  return data[id] || null;
}

async function findByChannelId(channelId) {
  const data = await store.read(CH_FILE);
  return Object.values(data).find((c) => c.channelId === String(channelId)) || null;
}

async function listChannels() {
  const data = await store.read(CH_FILE);
  return Object.values(data).sort((a, b) => a.title.localeCompare(b.title));
}

async function deleteChannel(id) {
  return store.update(CH_FILE, (data) => {
    delete data[id];
  });
}

// ============================================================
// OBUNA TEKSHIRISH
// ============================================================
async function checkSubscription(bot, channelIdOrUsername, userId) {
  try {
    const member = await bot.telegram.getChatMember(channelIdOrUsername, userId);
    const status = member.status;

    if (['member', 'administrator', 'creator'].includes(status)) {
      return { subscribed: true, status };
    }
    return { subscribed: false, status: status || 'left' };
  } catch (e) {
    return { subscribed: false, status: 'not_found', error: e.message };
  }
}

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
// ⚡️ TURNIRNI KANALGA E'LON QILISH (asosiy)
// ============================================================
async function announceToChannel(bot, tournament) {
  const channelId = await getChannel();
  if (!channelId) {
    return { ok: false, reason: 'Kanal ulanmagan' };
  }

  if (!tournament) {
    return { ok: false, reason: 'Turnir topilmadi' };
  }

  // ⚡️ Deep-link
  const link = `https://t.me/${config.BOT_USERNAME.replace('@', '')}?start=${tournament.id}`;

  // ⚡️ Turi
  const typeLabel =
    tournament.type === 'paid'
      ? `💳 Pullik (${tournament.payment?.amount || '?'} ${tournament.payment?.currency || ''})`
      : '🆓 Bepul';

  // ⚡️ Sana oralig'i
  let dateStr = tournament.date;
  if (tournament.endDate && tournament.endDate !== tournament.date) {
    dateStr = `${tournament.date} — ${tournament.endDate}`;
  }

  // ⚡️ Etablar
  const stagesInfo = tournament.hasStages
    ? `\n📊 Etaplar: <b>${tournament.totalStageDays || 7}</b> kun`
    : '';

  // ⚡️ Xabar matni
  const text =
    `╔══════════════════════╗\n` +
    `   🏆 <b>YANGI TURNIR!</b>\n` +
    `╚══════════════════════╝\n\n` +
    `🎯 <b>${escapeHtml(tournament.title)}</b>\n` +
    `${typeLabel}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📅 <b>Sana:</b> ${dateStr}${stagesInfo}\n` +
    `⏰ <b>Vaqt:</b> ${tournament.startTime}\n` +
    `🎮 <b>Rejim:</b> ${escapeHtml(tournament.mode)}\n` +
    `🗺 <b>Xarita:</b> ${escapeHtml(tournament.map || 'Erangel')}\n` +
    (tournament.prize
      ? `💲 <b>PRIZ:</b> ${escapeHtml(tournament.prize)}\n`
      : '') +
    (tournament.mapTag
      ? `♾️ <b>MAP:</b> ${escapeHtml(tournament.mapTag)}\n`
      : '') +
    (tournament.etapa
      ? `⭐️ <b>Etap:</b> ${escapeHtml(tournament.etapa)}\n`
      : '') +
    `\n👥 <b>Komandalar:</b> ${tournament.registeredTeams.length}/${tournament.maxTeams}\n` +
    `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    (tournament.description
      ? `📄 ${escapeHtml(tournament.description)}\n\n`
      : '') +
    `👇 <b>Ro'yxatdan o'tish uchun:</b>`;

  // ⚡️ Tugma
  const kb = {
    inline_keyboard: [[{ text: '🎮 Turnirga kirish', url: link }]],
  };

  // ⚡️ Yuborish
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
        disable_web_page_preview: true,
      });
    }

    console.log(`✅ Kanalga e'lon qilindi: ${tournament.title}`);
    return { ok: true, messageId: sent.message_id };
  } catch (e) {
    console.error('❌ Kanalga e\'lon qilishda xato:', e.message);
    return {
      ok: false,
      reason: e.response?.description || e.message || 'Xatolik',
    };
  }
}

// ============================================================
// IXTIYORIY REKLAMA (MATN)
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

// ============================================================
// IXTIYORIY REKLAMA (RASM)
// ============================================================
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

// ============================================================
// TEST
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
      reason: e.response?.description || e.message || "Kanalga ulanib bo'lmadi",
    };
  }
}

// ============================================================
// TURNIR NATIJALARINI KANALGA
// ============================================================
async function publishTournamentResults(bot, tournament, standings) {
  const channelId = await getChannel();
  if (!channelId) return { ok: false, reason: 'Kanal ulanmagan' };

  const lines = [
    `╔══════════════════════╗`,
    `   🏆 <b>TURNIR YAKUNLANDI!</b>`,
    `╚══════════════════════╝`,
    '',
    `🎯 <b>${escapeHtml(tournament.title)}</b>`,
    `📅 ${tournament.date}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🥇 <b>TOP-3:</b>`,
    '',
  ];

  const medals = ['🥇', '🥈', '🥉'];
  for (let i = 0; i < Math.min(3, standings.length); i++) {
    const s = standings[i];
    lines.push(
      `${medals[i]} <b>${escapeHtml(s.name || 'Team')}</b> [${escapeHtml(s.tag || '')}]`
    );
    lines.push(`   💯 ${s.totalPoints} | 💥 ${s.totalKills} | 🏆 ${s.wins}`);
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('🎉 <b>Barcha ishtirokchilarga rahmat!</b>');

  try {
    let sent;
    if (tournament.imageFileId) {
      sent = await bot.telegram.sendPhoto(channelId, tournament.imageFileId, {
        caption: lines.join('\n'),
        parse_mode: 'HTML',
      });
    } else {
      sent = await bot.telegram.sendMessage(channelId, lines.join('\n'), {
        parse_mode: 'HTML',
      });
    }
    return { ok: true, messageId: sent.message_id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ============================================================
// EKSPORT
// ============================================================
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
  publishTournamentResults,
};