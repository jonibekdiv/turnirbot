// ============================================================
// INVITATION SERVICE — 3 tilda
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const {
  generateUniqueCode,
  normalizeCode,
} = require('../utils/randomCode');
const stageService = require('./stageService');
const stageMatchService = require('./stageMatchService');
const promotionService = require('./promotionService');
const teamService = require('./teamService');
const userService = require('./userService');
const auditService = require('./auditService');
const langService = require('./langService');
const {
  INVITATION_STATUS,
  PROMOTION_STATUS,
  LIMITS,
} = require('../constants');

const FILE = 'invitations.json';

// ============================================================
// YANGI TAKLIFNOMA
// ============================================================
async function createInvitation({
  tournamentId,
  fromStageId,
  toStageId,
  teamId,
  captainId,
  matchId,
  roomId,
  roomPassword,
  imageFileId,
  createdBy,
}) {
  const existing = await getAllInvitations();
  const existingCodes = existing.map((i) => i.invitationCode);
  const invitationCode = generateUniqueCode(existingCodes, 8);

  const id = generateId('inv');
  const now = new Date().toISOString();

  const invitation = {
    id,
    tournamentId,
    fromStageId,
    toStageId,
    teamId,
    captainId: Number(captainId) || null,
    matchId: matchId || null,
    invitationCode,
    roomId: roomId || null,
    roomPassword: roomPassword || null,
    imageFileId: imageFileId || null,
    sentToCaptain: false,
    sentToMembers: false,
    sentAt: null,
    accepted: false,
    acceptedAt: null,
    declined: false,
    declinedAt: null,
    declinedReason: null,
    status: INVITATION_STATUS.CREATED,
    createdAt: now,
    updatedAt: now,
    createdBy: createdBy || null,
  };

  await store.update(FILE, (data) => {
    data[id] = invitation;
    return invitation;
  });

  return invitation;
}

// ============================================================
// GET
// ============================================================
async function getAllInvitations() {
  const data = await store.read(FILE);
  return Object.values(data);
}

async function getInvitation(id) {
  if (!id) return null;
  const data = await store.read(FILE);
  return data[id] || null;
}

async function getInvitationByCode(code) {
  if (!code) return null;
  const clean = normalizeCode(code);
  const data = await store.read(FILE);
  return (
    Object.values(data).find(
      (i) => normalizeCode(i.invitationCode) === clean
    ) || null
  );
}

async function getTournamentInvitations(tournamentId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((i) => i.tournamentId === tournamentId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getStageInvitations(stageId) {
  const data = await store.read(FILE);
  return Object.values(data).filter((i) => i.toStageId === stageId);
}

async function getTeamInvitations(teamId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((i) => i.teamId === teamId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getCaptainInvitations(captainId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((i) => Number(i.captainId) === Number(captainId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function updateInvitation(id, patch) {
  return store.update(FILE, (data) => {
    if (!data[id]) return null;
    Object.assign(data[id], patch, { updatedAt: new Date().toISOString() });
    return data[id];
  });
}

// ============================================================
// TAKLIFNOMA YUBORISH — CAPTAIN
// ============================================================
async function sendInvitationToCaptain(bot, invitationId) {
  const inv = await getInvitation(invitationId);
  if (!inv) throw new Error('Taklifnoma topilmadi');
  if (inv.sentToCaptain) throw new Error('Allaqachon yuborilgan');

  const team = await teamService.getTeam(inv.teamId);
  if (!team) throw new Error('Komanda topilmadi');

  const fromStage = await stageService.getStage(inv.fromStageId);
  const toStage = await stageService.getStage(inv.toStageId);

  const captainLang = await langService.getUserLang(inv.captainId);
  const t = (key, vars) => langService.t(captainLang, key, vars);

  const text = buildInvitationText({
    invitation: inv,
    team,
    fromStage,
    toStage,
    t,
  });

  const keyboard = {
    inline_keyboard: [
      [{ text: t('inv_accept'), callback_data: `inv:a:${inv.id}` }],
      [{ text: t('inv_decline'), callback_data: `inv:d:${inv.id}` }],
      [{ text: t('inv_info'), callback_data: `inv:i:${inv.id}` }],
      [{ text: t('inv_contact_host'), callback_data: `inv:h:${inv.id}` }],
    ],
  };

  try {
    if (inv.imageFileId) {
      await bot.telegram.sendPhoto(inv.captainId, inv.imageFileId, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      await bot.telegram.sendMessage(inv.captainId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }

    await updateInvitation(inv.id, {
      sentToCaptain: true,
      sentAt: new Date().toISOString(),
      status: INVITATION_STATUS.SENT,
    });

    const promotions = await promotionService.getStagePromotions(inv.fromStageId);
    const promo = promotions.find((p) => p.teamId === inv.teamId);
    if (promo) {
      await promotionService.markInvitationSent(promo.id, inv.id);
    }

    await auditService.log({
      action: 'SEND_INVITATION_CAPTAIN',
      tournamentId: inv.tournamentId,
      stageId: inv.toStageId,
      teamId: inv.teamId,
      details: { invitationId: inv.id },
    });

    return { ok: true, invitation: inv };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ============================================================
// TAKLIFNOMA — BARCHA A'ZOLARGA
// ============================================================
async function sendInvitationToMembers(bot, invitationId) {
  const inv = await getInvitation(invitationId);
  if (!inv) throw new Error('Taklifnoma topilmadi');

  const team = await teamService.getTeam(inv.teamId);
  if (!team) throw new Error('Komanda topilmadi');

  const fromStage = await stageService.getStage(inv.fromStageId);
  const toStage = await stageService.getStage(inv.toStageId);

  let sent = 0;
  let failed = 0;

  for (const memberId of team.members) {
    if (Number(memberId) === Number(team.captainId)) continue;

    try {
      const memberLang = await langService.getUserLang(memberId);
      const t = (key, vars) => langService.t(memberLang, key, vars);

      const text = buildMemberInvitationText({
        invitation: inv,
        team,
        fromStage,
        toStage,
        t,
      });

      await bot.telegram.sendMessage(memberId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: t('inv_info'), callback_data: `inv:i:${inv.id}` }],
          ],
        },
      });
      sent++;
    } catch (e) {
      failed++;
    }

    await new Promise((r) => setTimeout(r, LIMITS.BROADCAST_DELAY_MS));
  }

  await updateInvitation(inv.id, { sentToMembers: true });

  return { ok: true, sent, failed };
}

// ============================================================
// CAPTAIN TASDIQLASH
// ============================================================
async function acceptInvitation(invitationId, userId) {
  const inv = await getInvitation(invitationId);
  if (!inv) throw new Error('Taklifnoma topilmadi');

  const team = await teamService.getTeam(inv.teamId);
  if (!team) throw new Error('Komanda topilmadi');

  if (Number(team.captainId) !== Number(userId)) {
    throw new Error("Faqat captain tasdiqlay oladi");
  }

  if (inv.accepted) throw new Error('Allaqachon tasdiqlangan');
  if (inv.declined) throw new Error('Rad etilgan');

  const updated = await updateInvitation(inv.id, {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    status: INVITATION_STATUS.ACCEPTED,
  });

  await auditService.log({
    action: 'ACCEPT_INVITATION',
    actorId: userId,
    tournamentId: inv.tournamentId,
    stageId: inv.toStageId,
    teamId: inv.teamId,
    details: { invitationId: inv.id },
  });

  return updated;
}

// ============================================================
// CAPTAIN RAD ETISH
// ============================================================
async function declineInvitation(invitationId, userId, reason) {
  const inv = await getInvitation(invitationId);
  if (!inv) throw new Error('Taklifnoma topilmadi');

  const team = await teamService.getTeam(inv.teamId);
  if (!team) throw new Error('Komanda topilmadi');

  if (Number(team.captainId) !== Number(userId)) {
    throw new Error("Faqat captain rad eta oladi");
  }

  if (inv.accepted) throw new Error('Allaqachon tasdiqlangan');
  if (inv.declined) throw new Error('Allaqachon rad etilgan');

  const updated = await updateInvitation(inv.id, {
    declined: true,
    declinedAt: new Date().toISOString(),
    declinedReason: reason || 'Sababsiz',
    status: INVITATION_STATUS.DECLINED,
  });

  const promotions = await promotionService.getStagePromotions(inv.fromStageId);
  const promo = promotions.find((p) => p.teamId === inv.teamId);
  if (promo) {
    await promotionService.declinePromotion(promo.id, reason);
  }

  await auditService.log({
    action: 'DECLINE_INVITATION',
    actorId: userId,
    tournamentId: inv.tournamentId,
    stageId: inv.toStageId,
    teamId: inv.teamId,
    details: { invitationId: inv.id, reason },
  });

  return updated;
}

// ============================================================
// MATN YARATISH
// ============================================================
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildInvitationText({ invitation, team, fromStage, toStage, t }) {
  if (typeof t !== 'function') t = (k) => k;

  const lines = [];

  lines.push('╔══════════════════════╗');
  lines.push(`   🎉 <b>${t('inv_congrats')}</b>`);
  lines.push('╚══════════════════════╝');
  lines.push('');

  lines.push(`🏆 <b>${escapeHtml(team.name)}</b> [${escapeHtml(team.tag)}]`);
  lines.push('');

  lines.push(
    `${t('inv_from_stage')} <b>${escapeHtml(fromStage?.name || '-')}</b> ${t('inv_from_desc')}!`
  );
  lines.push('');

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  lines.push(`🎯 <b>${t('inv_next_stage')}: ${escapeHtml(toStage?.name || '-')}</b>`);
  lines.push('');
  lines.push(`📅 ${t('date')}: <b>${toStage?.date || '-'}</b>`);
  lines.push(`⏰ ${t('time')}: <b>${toStage?.startTime || '-'}</b>`);

  if (invitation.matchId) {
    lines.push(`🎮 ${t('stage_match_num')}: <code>${invitation.matchId}</code>`);
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (invitation.roomId) {
    lines.push(`🆔 <b>${t('tour_room_info')}:</b>`);
    lines.push(`<code>${escapeHtml(invitation.roomId)}</code>`);
    lines.push('');
  }

  if (invitation.roomPassword) {
    lines.push(`🔒 <b>${t('password')}:</b>`);
    lines.push(`<code>${escapeHtml(invitation.roomPassword)}</code>`);
    lines.push('');
  }

  lines.push(`🎫 <b>${t('inv_code_label')}:</b>`);
  lines.push(`<code>${escapeHtml(invitation.invitationCode)}</code>`);
  lines.push('');

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`✅ <i>${t('inv_auto_registered')}</i>`);

  return lines.join('\n');
}

function buildMemberInvitationText({ invitation, team, fromStage, toStage, t }) {
  if (typeof t !== 'function') t = (k) => k;

  const lines = [];

  lines.push('╔══════════════════════╗');
  lines.push(`   🎉 <b>${t('inv_congrats')}</b>`);
  lines.push('╚══════════════════════╝');
  lines.push('');

  lines.push(`🏆 <b>${escapeHtml(team.name)}</b> [${escapeHtml(team.tag)}]`);
  lines.push('');
  lines.push(
    `${t('sub_registered')} <b>${escapeHtml(fromStage?.name || '-')}</b>!`
  );
  lines.push('');
  lines.push(`🎯 <b>${t('inv_next_stage')}: ${escapeHtml(toStage?.name || '-')}</b>`);
  lines.push(`📅 ${toStage?.date || '-'} | ⏰ ${toStage?.startTime || '-'}`);
  lines.push('');
  lines.push(`<i>${t('sub_captain_needs')}</i>`);

  return lines.join('\n');
}

// ============================================================
// STATISTIKA
// ============================================================
async function getStageInvitationStats(stageId) {
  const list = await getStageInvitations(stageId);

  return {
    total: list.length,
    sent: list.filter((i) => i.sentToCaptain).length,
    accepted: list.filter((i) => i.accepted).length,
    declined: list.filter((i) => i.declined).length,
    pending: list.filter((i) => !i.sentToCaptain && !i.declined).length,
    invitations: list,
  };
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createInvitation,
  getAllInvitations,
  getInvitation,
  getInvitationByCode,
  getTournamentInvitations,
  getStageInvitations,
  getTeamInvitations,
  getCaptainInvitations,
  updateInvitation,
  sendInvitationToCaptain,
  sendInvitationToMembers,
  acceptInvitation,
  declineInvitation,
  buildInvitationText,
  buildMemberInvitationText,
  getStageInvitationStats,
};