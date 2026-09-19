// Room ma'lumotlarini ro'yxatdan o'tgan o'yinchilarga tarqatish
const teamService = require('./teamService');
const tournamentService = require('./tournamentService');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// ROOM MA'LUMOTLARINI YUBORISH
// ============================================================
async function sendRoomInfo(bot, tournament, options = {}) {
  const { isUpdate = false, notifyCaptainsOnly = false } = options;

  if (!tournament.roomId || !tournament.roomPassword) {
    return { ok: false, reason: 'incomplete', sent: 0, failed: 0 };
  }

  // Barcha a'zolarni yig'amiz
  const memberIds = new Set();
  const captainIds = new Set();

  for (const teamId of tournament.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (!team) continue;
    captainIds.add(team.captainId);
    if (notifyCaptainsOnly) {
      memberIds.add(team.captainId);
    } else {
      team.members.forEach((m) => memberIds.add(m));
    }
  }

  const text = buildRoomMessage(tournament, isUpdate);

  // Reply keyboard inline (copy uchun qulay)
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📋 Room ID nusxalash',
            copy_text: { text: String(tournament.roomId) },
          },
        ],
        [
          {
            text: '📋 Parol nusxalash',
            copy_text: { text: String(tournament.roomPassword) },
          },
        ],
        [
          {
            text: '📋 Hammasini nusxalash',
            copy_text: {
              text: `Room ID: ${tournament.roomId}\nParol: ${tournament.roomPassword}`,
            },
          },
        ],
      ],
    },
  };

  let sent = 0;
  let failed = 0;
  const failedIds = [];

  for (const uid of memberIds) {
    try {
      // Rasm bo'lsa rasm bilan, yo'q bo'lsa matn bilan
      if (tournament.imageFileId && !isUpdate) {
        await bot.telegram.sendPhoto(uid, tournament.imageFileId, {
          caption: text,
          parse_mode: 'HTML',
          ...keyboard,
        });
      } else {
        await bot.telegram.sendMessage(uid, text, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      }
      sent++;
    } catch (e) {
      failed++;
      failedIds.push(uid);
    }
    await sleep(LIMITS.BROADCAST_DELAY_MS);
  }

  return {
    ok: true,
    sent,
    failed,
    failedIds,
    total: memberIds.size,
    captains: captainIds.size,
  };
}

// ============================================================
// XABAR MATNI
// ============================================================
function buildRoomMessage(tournament, isUpdate = false) {
  const header = isUpdate
    ? '🔄 <b>Room ma\'lumotlari YANGILANDI!</b>'
    : '🔑 <b>Room ma\'lumotlari tayyor!</b>';

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   ${header}`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`🏆 <b>${escapeHtml(tournament.title)}</b>`);
  lines.push('');
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push('');
  lines.push(`📅 <b>Sana:</b> ${tournament.date}`);
  lines.push(`⏰ <b>Vaqt:</b> ${tournament.startTime} (${tournament.timezone || 'Asia/Tashkent'})`);
  if (tournament.mode) lines.push(`🎮 <b>Rejim:</b> ${escapeHtml(tournament.mode)}`);
  if (tournament.etapa) lines.push(`⭐️ <b>Etap:</b> ${escapeHtml(tournament.etapa)}`);
  lines.push('');
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push('');
  lines.push(`🆔 <b>Room ID:</b>`);
  lines.push(`<code>${escapeHtml(String(tournament.roomId))}</code>`);
  lines.push('');
  lines.push(`🔒 <b>Parol:</b>`);
  lines.push(`<code>${escapeHtml(String(tournament.roomPassword))}</code>`);
  lines.push('');
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push('');
  lines.push(`⚡️ <i>Iltimos, PUBG Mobile'ni ochib, xonaga kiring!</i>`);
  lines.push(`🏅 <i>Omad tilaymiz!</i>`);

  return lines.join('\n');
}

// ============================================================
// FAQAT CAPTAIN'LARGA (agar kerak bo'lsa)
// ============================================================
async function sendRoomInfoToCaptains(bot, tournament) {
  return sendRoomInfo(bot, tournament, { notifyCaptainsOnly: true });
}

module.exports = {
  sendRoomInfo,
  sendRoomInfoToCaptains,
  buildRoomMessage,
};