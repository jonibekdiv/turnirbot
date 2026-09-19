const store = require('../storage/jsonStore');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

const FILE = 'messages.json';

// O'yinchi → Host
async function relayToHost(bot, { fromUser, tournament, team, playerNumber, message }) {
  if (!tournament.hostId) throw new Error('Bu turnirga host biriktirilmagan');

  const header =
    `📩 <b>Turnir ishtirokchisidan xabar</b>\n\n` +
    `Turnir: <b>${escapeHtml(tournament.title)}</b>\n` +
    `Komanda: <b>${escapeHtml(team?.name || '-')}</b>\n` +
    `Komanda tegi: <b>${escapeHtml(team?.tag || '-')}</b>\n` +
    `O'yinchi raqami: <b>${playerNumber}</b>\n` +
    `O'yinchi: <b>${escapeHtml(fromUser.username ? '@' + fromUser.username : (fromUser.firstName || 'ID:' + fromUser.id))}</b>\n` +
    `Telegram ID: <code>${fromUser.id}</code>\n`;

  let sent;
  if (message.photo && message.photo.length) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    const caption = header + (message.caption ? `\n\n${escapeHtml(message.caption.slice(0, LIMITS.MAX_CAPTION_LEN))}` : '');
    sent = await bot.telegram.sendPhoto(tournament.hostId, fileId, {
      caption, parse_mode: 'HTML',
    });
  } else {
    const text = header + `\n\n${escapeHtml((message.text || '').slice(0, 2000))}`;
    sent = await bot.telegram.sendMessage(tournament.hostId, text, { parse_mode: 'HTML' });
  }

  // mapping yozamiz — host reply qilganda topish uchun
  await store.update(FILE, (data) => {
    data[`${tournament.hostId}_${sent.message_id}`] = {
      hostId: tournament.hostId,
      hostMessageId: sent.message_id,
      fromUserId: fromUser.id,
      tournamentId: tournament.id,
      teamId: team?.id || null,
      createdAt: new Date().toISOString(),
    };
  });
  return sent;
}

// Host → O'yinchi (reply orqali)
async function relayHostReply(bot, ctx) {
  const replyTo = ctx.message?.reply_to_message?.message_id;
  if (!replyTo) return false;

  const key = `${ctx.from.id}_${replyTo}`;
  const data = await store.read(FILE);
  const entry = data[key];
  if (!entry) return false;

  const header = `📨 <b>Hostdan javob</b>\n\n`;
  try {
    if (ctx.message.photo && ctx.message.photo.length) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      await bot.telegram.sendPhoto(entry.fromUserId, fileId, {
        caption: header + escapeHtml(ctx.message.caption || ''),
        parse_mode: 'HTML',
      });
    } else {
      await bot.telegram.sendMessage(
        entry.fromUserId,
        header + escapeHtml(ctx.message.text || ''),
        { parse_mode: 'HTML' }
      );
    }
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { relayToHost, relayHostReply };