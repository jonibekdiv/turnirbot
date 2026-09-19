const userService = require('./userService');
const { LIMITS } = require('../constants');
const { escapeHtml, displayName } = require('../utils/telegramUtils');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Barcha foydalanuvchilarga e'lon yuborish
async function broadcastToAllUsers(bot, { image, caption, button }) {
  const users = await userService.getAllUsers();
  let sent = 0, failed = 0;

  const extra = {
    parse_mode: 'HTML',
    ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {}),
  };

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (u.status === 'inactive') { failed++; continue; }
    try {
      if (image) {
        await bot.telegram.sendPhoto(u.id, image, { caption, ...extra });
      } else {
        await bot.telegram.sendMessage(u.id, caption, extra);
      }
      sent++;
    } catch (e) {
      failed++;
      const desc = e?.response?.description || '';
      if (desc.includes('blocked') || desc.includes('chat not found') || e?.response?.error_code === 403) {
        await userService.markInactive(u.id);
      }
      if (e?.response?.error_code === 429) {
        await sleep(1500);
      }
    }
    if (i % LIMITS.BROADCAST_BATCH === LIMITS.BROADCAST_BATCH - 1) {
      await sleep(LIMITS.BROADCAST_DELAY_MS * 10);
    } else {
      await sleep(LIMITS.BROADCAST_DELAY_MS);
    }
  }
  return { sent, failed, total: users.length };
}

// Faqat turnir ishtirokchilariga yuborish
async function sendToTournamentParticipants(bot, tournament, teamService, { text, image, extra = {} }) {
  const memberIds = new Set();
  for (const teamId of tournament.registeredTeams) {
    const team = await teamService.getTeam(teamId);
    if (!team) continue;
    team.members.forEach((m) => memberIds.add(m));
  }
  let sent = 0, failed = 0;
  for (const uid of memberIds) {
    try {
      if (image) {
        await bot.telegram.sendPhoto(uid, image, { caption: text, parse_mode: 'HTML', ...extra });
      } else {
        await bot.telegram.sendMessage(uid, text, { parse_mode: 'HTML', ...extra });
      }
      sent++;
    } catch { failed++; }
    await sleep(LIMITS.BROADCAST_DELAY_MS);
  }
  return { sent, failed, total: memberIds.size };
}

module.exports = { broadcastToAllUsers, sendToTournamentParticipants };