// ============================================================
// PROMOTION SERVICE — Kun bo'yicha top N (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const stageService = require('./stageService');
const stageMatchService = require('./stageMatchService');
const teamService = require('./teamService');
const auditService = require('./auditService');
const {
  PROMOTION_STATUS,
  MATCH_RESULT_STATUS,
  STAGE_TYPE,
} = require('../constants');

const FILE = 'promotions.json';

// ============================================================
// PROMOTION YARATISH
// ============================================================
async function createPromotion({
  tournamentId,
  fromStageId,
  toStageId,
  fromDayNumber,
  fromMatchId,
  teamId,
  teamName,
  teamTag,
  captainId,
  place,
  points,
  kills,
  wins,
  matches,
  createdBy,
}) {
  const id = generateId('prm');
  const now = new Date().toISOString();

  const promotion = {
    id,
    tournamentId,
    fromStageId,
    toStageId,
    fromDayNumber: fromDayNumber || null,
    fromMatchId: fromMatchId || null,
    teamId,
    teamName: teamName || '',
    teamTag: teamTag || '',
    captainId: captainId || null,
    place: Number(place) || 0,
    points: Number(points) || 0,
    kills: Number(kills) || 0,
    wins: Number(wins) || 0,
    matches: Number(matches) || 0,
    status: PROMOTION_STATUS.QUALIFIED,
    promotedAt: null,
    invitationSent: false,
    invitationId: null,
    registeredToNextStage: false,
    declinedAt: null,
    declinedReason: null,
    cancelledAt: null,
    cancelledReason: null,
    createdAt: now,
    updatedAt: now,
    createdBy: createdBy || null,
  };

  await store.update(FILE, (data) => {
    data[id] = promotion;
    return promotion;
  });

  return promotion;
}

// ============================================================
// GET
// ============================================================
async function getPromotion(id) {
  if (!id) return null;
  const data = await store.read(FILE);
  return data[id] || null;
}

async function getTournamentPromotions(tournamentId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((p) => p.tournamentId === tournamentId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getStagePromotions(stageId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((p) => p.fromStageId === stageId)
    .sort((a, b) => {
      if (a.fromDayNumber !== b.fromDayNumber) {
        return (a.fromDayNumber || 0) - (b.fromDayNumber || 0);
      }
      return a.place - b.place;
    });
}

async function getDayPromotions(stageId, dayNumber) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((p) => p.fromStageId === stageId && p.fromDayNumber === dayNumber)
    .sort((a, b) => a.place - b.place);
}

async function getNextStagePromotions(stageId) {
  const data = await store.read(FILE);
  return Object.values(data).filter((p) => p.toStageId === stageId);
}

async function getMatchPromotions(matchId) {
  const data = await store.read(FILE);
  return Object.values(data).filter((p) => p.fromMatchId === matchId);
}

async function getTeamPromotions(teamId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function updatePromotion(promotionId, patch) {
  return store.update(FILE, (data) => {
    if (!data[promotionId]) return null;
    Object.assign(data[promotionId], patch, { updatedAt: new Date().toISOString() });
    return data[promotionId];
  });
}

// ============================================================
// KUN UCHUN PROMOTION (topN customizable)
// ============================================================
async function createPromotionsForDay(stageId, dayNumber, topN, createdBy) {
  const stage = await stageService.getStage(stageId);
  if (!stage) throw new Error('Etap topilmadi');

  if (!stage.nextStageId) {
    throw new Error("Bu oxirgi etap. Keyingi etap yo'q");
  }

  const dayApproved = await stageMatchService.isDayAllApproved(stageId, dayNumber);
  if (!dayApproved) {
    throw new Error(`Kun ${dayNumber} matchlari hali tasdiqlanmagan.`);
  }

  const standings = await stageMatchService.getDayOverallStandings(stageId, dayNumber);
  if (!standings.length) {
    throw new Error(`Kun ${dayNumber} uchun natijalar yo'q`);
  }

  let finalTopN = topN || stage.rules?.qualifiersPerDay || 3;
  if (finalTopN < 1) finalTopN = 3;
  if (finalTopN > standings.length) finalTopN = standings.length;

  const existing = await getDayPromotions(stageId, dayNumber);
  const existingIds = new Set(
    existing
      .filter((p) => p.status !== PROMOTION_STATUS.CANCELLED)
      .map((p) => p.teamId)
  );

  const topTeams = standings.slice(0, finalTopN);
  const createdPromotions = [];

  for (let i = 0; i < topTeams.length; i++) {
    const s = topTeams[i];
    if (existingIds.has(s.teamId)) continue;

    const team = await teamService.getTeam(s.teamId);
    if (!team) continue;

    const promotion = await createPromotion({
      tournamentId: stage.tournamentId,
      fromStageId: stageId,
      toStageId: stage.nextStageId,
      fromDayNumber: dayNumber,
      fromMatchId: null,
      teamId: s.teamId,
      teamName: team.name,
      teamTag: team.tag,
      captainId: team.captainId,
      place: i + 1,
      points: s.totalPoints,
      kills: s.kills,
      wins: s.wins,
      matches: s.matches,
      createdBy,
    });

    createdPromotions.push(promotion);
  }

  if (topN && topN !== stage.rules?.qualifiersPerDay) {
    await stageService.updateStage(stageId, {
      rules: { ...stage.rules, qualifiersPerDay: finalTopN },
    });
  }

  await auditService.log({
    action: 'CREATE_PROMOTIONS_DAY',
    actorId: createdBy,
    tournamentId: stage.tournamentId,
    stageId,
    details: { dayNumber, count: createdPromotions.length, topN: finalTopN },
  });

  return {
    stage,
    dayNumber,
    promotions: createdPromotions,
    total: createdPromotions.length,
    topN: finalTopN,
    standings,
  };
}

// ============================================================
// BUTUN STAGE UCHUN (barcha kunlar)
// ============================================================
async function createPromotionsForStage(stageId, topNPerDay, createdBy) {
  const stage = await stageService.getStage(stageId);
  if (!stage) throw new Error('Etap topilmadi');

  if (!stage.nextStageId) {
    throw new Error("Bu oxirgi etap. Keyingi etap yo'q");
  }

  const nextStage = await stageService.getStage(stage.nextStageId);
  if (!nextStage) throw new Error('Keyingi etap topilmadi');

  const allApproved = await stageMatchService.isStageAllApproved(stageId);
  if (!allApproved) {
    const matches = await stageMatchService.getStageMatches(stageId);
    const notApproved = matches.filter(
      (m) => m.resultStatus !== MATCH_RESULT_STATUS.APPROVED
    ).length;
    throw new Error(`${notApproved} ta match hali tasdiqlanmagan.`);
  }

  const days = await stageMatchService.getStageDays(stageId);
  if (!days.length) throw new Error('Kunlar topilmadi');

  const allCreated = [];
  const dayResults = [];

  for (const dayNumber of days) {
    try {
      const res = await createPromotionsForDay(stageId, dayNumber, topNPerDay, createdBy);
      allCreated.push(...res.promotions);
      dayResults.push(res);
    } catch (e) {
      dayResults.push({
        dayNumber,
        error: e.message,
        promotions: [],
        total: 0,
      });
    }
  }

  return {
    stage,
    nextStage,
    days: dayResults,
    promotions: allCreated,
    total: allCreated.length,
    totalDays: days.length,
  };
}

// ============================================================
// PROMOTE
// ============================================================
async function promoteTeam(promotionId, promotedBy) {
  const promo = await getPromotion(promotionId);
  if (!promo) throw new Error('Promotion topilmadi');

  if (promo.status === PROMOTION_STATUS.PROMOTED) throw new Error('Allaqachon bajarilgan');
  if (promo.status === PROMOTION_STATUS.CANCELLED) throw new Error('Bekor qilingan');
  if (promo.status === PROMOTION_STATUS.DECLINED) throw new Error('Komanda rad etgan');

  const nextStage = await stageService.getStage(promo.toStageId);
  if (!nextStage) throw new Error('Keyingi etap topilmadi');

  await stageService.addTeamsToStage(promo.toStageId, promo.teamId);
  await stageService.addQualifiedTeams(promo.toStageId, promo.teamId);

  const updated = await updatePromotion(promotionId, {
    status: PROMOTION_STATUS.PROMOTED,
    promotedAt: new Date().toISOString(),
    registeredToNextStage: true,
  });

  await auditService.log({
    action: 'PROMOTE_TEAM',
    actorId: promotedBy,
    tournamentId: promo.tournamentId,
    stageId: promo.fromStageId,
    teamId: promo.teamId,
    details: { toStageId: promo.toStageId, fromDayNumber: promo.fromDayNumber },
  });

  return updated;
}

async function promoteAllForStage(stageId, promotedBy) {
  const promotions = await getStagePromotions(stageId);
  const qualified = promotions.filter((p) => p.status === PROMOTION_STATUS.QUALIFIED);

  const results = [];
  for (const promo of qualified) {
    try {
      const updated = await promoteTeam(promo.id, promotedBy);
      results.push({ ok: true, promotion: updated });
    } catch (e) {
      results.push({ ok: false, promotionId: promo.id, error: e.message });
    }
  }

  return {
    total: qualified.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

async function cancelPromotion(promotionId, reason, cancelledBy) {
  const promo = await getPromotion(promotionId);
  if (!promo) throw new Error('Promotion topilmadi');
  if (promo.status === PROMOTION_STATUS.CANCELLED) {
    throw new Error('Allaqachon bekor qilingan');
  }

  if (promo.registeredToNextStage) {
    await stageService.removeTeamFromStage(promo.toStageId, promo.teamId);
  }

  const updated = await updatePromotion(promotionId, {
    status: PROMOTION_STATUS.CANCELLED,
    cancelledAt: new Date().toISOString(),
    cancelledReason: reason || 'Sababsiz',
    registeredToNextStage: false,
  });

  await auditService.log({
    action: 'CANCEL_PROMOTION',
    actorId: cancelledBy,
    tournamentId: promo.tournamentId,
    stageId: promo.fromStageId,
    teamId: promo.teamId,
    details: { reason },
  });

  return updated;
}

async function declinePromotion(promotionId, reason) {
  const promo = await getPromotion(promotionId);
  if (!promo) throw new Error('Promotion topilmadi');
  if (promo.status === PROMOTION_STATUS.DECLINED) {
    throw new Error('Allaqachon rad etilgan');
  }

  if (promo.registeredToNextStage) {
    await stageService.removeTeamFromStage(promo.toStageId, promo.teamId);
  }

  return updatePromotion(promotionId, {
    status: PROMOTION_STATUS.DECLINED,
    declinedAt: new Date().toISOString(),
    declinedReason: reason || "Komanda qatnasha olmaydi",
    registeredToNextStage: false,
  });
}

async function markInvitationSent(promotionId, invitationId) {
  return updatePromotion(promotionId, {
    status: PROMOTION_STATUS.INVITATION_SENT,
    invitationSent: true,
    invitationId,
    invitationSentAt: new Date().toISOString(),
  });
}

// ============================================================
// STATISTIKA
// ============================================================
async function getStageStats(stageId) {
  const promotions = await getStagePromotions(stageId);

  const byDay = {};
  for (const p of promotions) {
    const day = p.fromDayNumber || 0;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(p);
  }

  return {
    total: promotions.length,
    qualified: promotions.filter((p) => p.status === PROMOTION_STATUS.QUALIFIED).length,
    promoted: promotions.filter((p) => p.status === PROMOTION_STATUS.PROMOTED).length,
    invitationSent: promotions.filter((p) => p.status === PROMOTION_STATUS.INVITATION_SENT).length,
    registered: promotions.filter((p) => p.status === PROMOTION_STATUS.REGISTERED).length,
    declined: promotions.filter((p) => p.status === PROMOTION_STATUS.DECLINED).length,
    cancelled: promotions.filter((p) => p.status === PROMOTION_STATUS.CANCELLED).length,
    promotions,
    byDay,
  };
}

// ============================================================
// FORMAT (3 tilda)
// ============================================================
function statusEmoji(status) {
  const map = {
    qualified: '✅',
    promoted: '⬆️',
    invitation_sent: '📨',
    registered: '🎯',
    rejected: '❌',
    declined: '🚫',
    cancelled: '🗑',
  };
  return map[status] || '•';
}

function statusName(status, t) {
  if (typeof t !== 'function') t = (k) => k;
  const keyMap = {
    qualified: 'promotion_status_qualified',
    promoted: 'promotion_status_promoted',
    invitation_sent: 'promotion_status_invitation_sent',
    registered: 'promotion_status_registered',
    rejected: 'promotion_status_rejected',
    declined: 'promotion_status_declined',
    cancelled: 'promotion_status_cancelled',
  };
  return t(keyMap[status]) || status;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPromotion(promo, fromStage, toStage, t) {
  if (typeof t !== 'function') t = (k) => k;

  const emoji = statusEmoji(promo.status);
  const status = statusName(promo.status, t);

  return (
    `${emoji} <b>${escapeHtml(promo.teamName)}</b> [${escapeHtml(promo.teamTag)}]\n` +
    (promo.fromDayNumber ? `   📅 ${t('promotion_day')} ${promo.fromDayNumber}\n` : '') +
    `   📍 ${promo.place}-${t('promotion_place')} | 💯 ${promo.points} | 💥 ${promo.kills}\n` +
    (fromStage ? `   ⬅️ ${escapeHtml(fromStage.name)}\n` : '') +
    (toStage ? `   ➡️ ${escapeHtml(toStage.name)}\n` : '') +
    `   📊 ${status}`
  );
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createPromotion,
  getPromotion,
  getTournamentPromotions,
  getStagePromotions,
  getDayPromotions,
  getNextStagePromotions,
  getMatchPromotions,
  getTeamPromotions,
  updatePromotion,
  createPromotionsForDay,
  createPromotionsForStage,
  promoteTeam,
  promoteAllForStage,
  cancelPromotion,
  declinePromotion,
  markInvitationSent,
  getStageStats,
  formatPromotion,
  statusEmoji,
  statusName,
};