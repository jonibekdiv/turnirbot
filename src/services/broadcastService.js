// ============================================================
// BROADCAST SERVICE — Reklama tarqatish
// ============================================================
const userService = require('./userService');
const teamService = require('./teamService');
const { LIMITS } = require('../constants');
const { escapeHtml } = require('../utils/telegramUtils');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// BARCHA FOYDALANUVCHILARGA REKLAMA
// ============================================================
async function broadcastToAllUsers(bot, { image, caption, button }) {
  const users = await userService.getAllUsers();
  let sent = 0;
  let failed = 0;
  let blocked = 0;

  const extra = {
    parse_mode: 'HTML',
    ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {}),
  };

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (u.status === 'inactive') {
      failed++;
      continue;
    }

    try {
      if (image) {
        await bot.telegram.sendPhoto(u.id, image, { caption, ...extra });
      } else {
        await bot.telegram.sendMessage(u.id, caption, extra);
      }
      sent++;
    } catch (e) {
      failed++;
      const code = e?.response?.error_code;
      const desc = e?.response?.description || '';

      // Bloklagan foydalanuvchini inactive qilamiz
      if (
        code === 403 ||
        desc.includes('blocked') ||
        desc.includes('chat not found') ||
        desc.includes('user is deactivated')
      ) {
        await userService.markInactive(u.id);
        blocked++;
      }

      // 429 Too Many Requests
      if (code === 429) {
        const retry = e?.response?.parameters?.retry_after || 30;
        await sleep((retry + 1) * 1000);
      }
    }

    // Rate limiting
    if (i % LIMITS.BROADCAST_BATCH === LIMITS.BROADCAST_BATCH - 1) {
      await sleep(LIMITS.BROADCAST_DELAY_MS * 10);
    } else {
      await sleep(LIMITS.BROADCAST_DELAY_MS);
    }
  }

  return {
    total: users.length,
    sent,
    failed,
    blocked,
  };
}

// ============================================================
// TURNIR ISHTIROKCHILARIGA XABAR
// ============================================================
async function sendToTournamentParticipants(bot, tournament, teamServiceArg, { text, image, extra = {} }) {
  // teamServiceArg ixtiyoriy — moslik uchun
  const tSvc = teamServiceArg || teamService;

  const memberIds = new Set();
  for (const teamId of tournament.registeredTeams) {
    const team = await tSvc.getTeam(teamId);
    if (!team) continue;
    team.members.forEach((m) => memberIds.add(m));
  }

  let sent = 0;
  let failed = 0;

  const opts = {
    parse_mode: 'HTML',
    ...extra,
  };

  for (const uid of memberIds) {
    try {
      if (image) {
        await bot.telegram.sendPhoto(uid, image, { caption: text, ...opts });
      } else {
        await bot.telegram.sendMessage(uid, text, opts);
      }
      sent++;
    } catch (e) {
      failed++;
    }
    await sleep(LIMITS.BROADCAST_DELAY_MS);
  }

  return {
    total: memberIds.size,
    sent,
    failed,
  };
}

// ============================================================
// TURNIR REKLAMASI — BARCHA FOYDALANUVCHILARGA
// ✅ TUZATILDI: URL endi `?start=${t.id}` (t.id allaqachon tour_ bilan boshlanadi)
// ============================================================
async function broadcastTournament(bot, tournament, options = {}) {
  const { buttonText = '🎮 Turnirga kirish', botUsername } = options;
  const config = require('../config');

  // ✅ TUZATILDI: t.id allaqachon "tour_" prefiksiga ega
  const link = `https://t.me/${botUsername || config.BOT_USERNAME}?start=${tournament.id}`;

  const caption =
    `🏆 <b>${escapeHtml(tournament.title)}</b>\n\n` +
    `📅 ${tournament.date} | ⏰ ${tournament.startTime}\n` +
    `🎮 ${escapeHtml(tournament.mode)} | 🗺 ${escapeHtml(tournament.map || 'Erangel')}\n` +
    (tournament.prize ? `💲 PRIZ: <b>${escapeHtml(tournament.prize)}</b>\n` : '') +
    (tournament.mapTag ? `♾️ MAP: <b>${escapeHtml(tournament.mapTag)}</b>\n` : '') +
    (tournament.etapa ? `⭐️ Etap: <b>${escapeHtml(tournament.etapa)}</b>\n` : '') +
    `👥 Komandalar: <b>${tournament.registeredTeams.length}/${tournament.maxTeams}</b>\n` +
    (tournament.description ? `\n📄 ${escapeHtml(tournament.description)}\n` : '') +
    `\n👇 Ro'yxatdan o'tish uchun:`;

  const button = { text: buttonText, url: link };

  return broadcastToAllUsers(bot, {
    image: tournament.imageFileId,
    caption,
    button,
  });
}

// ============================================================
// SHAXSIY XABAR YUBORISH
// ============================================================
async function sendPersonalMessage(bot, userId, text, image = null) {
  try {
    if (image) {
      await bot.telegram.sendPhoto(userId, image, { caption: text, parse_mode: 'HTML' });
    } else {
      await bot.telegram.sendMessage(userId, text, { parse_mode: 'HTML' });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.response?.description || e.message };
  }
}

module.exports = {
  broadcastToAllUsers,
  sendToTournamentParticipants,
  broadcastTournament,
  sendPersonalMessage,
};