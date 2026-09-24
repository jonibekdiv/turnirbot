// ============================================================
// ROOM NOTIFY SERVICE — 3 tilda
// ============================================================
const teamService = require('./teamService');
const langService = require('./langService');
const { escapeHtml } = require('../utils/telegramUtils');
const { LIMITS } = require('../constants');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// ROOM MA'LUMOTLARINI YUBORISH (3 tilda)
// ============================================================
async function sendRoomInfo(bot, tournament, options = {}) {
  const { isUpdate = false, notifyCaptainsOnly = false } = options;

  if (!tournament.roomId || !tournament.roomPassword) {
    return { ok: false, reason: 'incomplete', sent: 0, failed: 0 };
  }

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

  let sent = 0;
  let failed = 0;
  const failedIds = [];

  for (const uid of memberIds) {
    try {
      const userLang = await langService.getUserLang(uid);
      const t = (key, vars) => langService.t(userLang, key, vars);

      const text = buildRoomMessage(tournament, isUpdate, t);

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: t('btn_copy_room_id'), copy_text: { text: String(tournament.roomId) } }],
            [{ text: t('btn_copy_password'), copy_text: { text: String(tournament.roomPassword) } }],
            [
              {
                text: t('btn_copy_all'),
                copy_text: {
                  text: `Room ID: ${tournament.roomId}\n${t('password')}: ${tournament.roomPassword}`,
                },
              },
            ],
          ],
        },
      };

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
// XABAR MATNI (3 tilda)
// ============================================================
function buildRoomMessage(tournament, isUpdate, t) {
  if (typeof t !== 'function') t = (k) => k;

  const header = isUpdate
    ? `🔄 <b>${t('host_room_resend')}!</b>`
    : `🔑 <b>${t('host_stage_room_info')}!</b>`;

  const lines = [];
  lines.push('╔══════════════════════╗');
  lines.push(`   ${header}`);
  lines.push('╚══════════════════════╝');
  lines.push('');
  lines.push(`🏆 <b>${escapeHtml(tournament.title)}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`📅 <b>${t('date')}:</b> ${tournament.date}`);
  lines.push(`⏰ <b>${t('time')}:</b> ${tournament.startTime} (${tournament.timezone || 'Asia/Tashkent'})`);
  if (tournament.mode) lines.push(`🎮 <b>${t('mode')}:</b> ${escapeHtml(tournament.mode)}`);
  if (tournament.etapa) lines.push(`⭐️ <b>${t('stage')}:</b> ${escapeHtml(tournament.etapa)}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`🆔 <b>Room ID:</b>`);
  lines.push(`<code>${escapeHtml(String(tournament.roomId))}</code>`);
  lines.push('');
  lines.push(`🔒 <b>${t('password')}:</b>`);
  lines.push(`<code>${escapeHtml(String(tournament.roomPassword))}</code>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`⚡️ <i>${t('sub_wait_room')}</i>`);
  lines.push(`🏅 <i>${t('success')}!</i>`);

  return lines.join('\n');
}

// ============================================================
// FAQAT CAPTAIN'LARGA
// ============================================================
async function sendRoomInfoToCaptains(bot, tournament) {
  return sendRoomInfo(bot, tournament, { notifyCaptainsOnly: true });
}

module.exports = {
  sendRoomInfo,
  sendRoomInfoToCaptains,
  buildRoomMessage,
};