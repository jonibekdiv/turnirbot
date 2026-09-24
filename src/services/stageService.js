// ============================================================
// STAGE SERVICE — Etaplar CRUD + Final paid slots (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { STAGE_TYPE, STAGE_STATUS, STAGE_NAMES } = require('../constants');

const FILE = 'stages.json';

// ============================================================
// SANA YORDAMCHI
// ============================================================
function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00+05:00');
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// ============================================================
// DEFAULT ETAPLAR YARATISH
// ============================================================
async function createDefaultStages(tournamentId, bracketConfig, baseDate, baseTime) {
  if (!tournamentId) throw new Error('tournamentId majburiy');
  if (!bracketConfig) throw new Error('bracketConfig majburiy');

  const qfRule = bracketConfig.quarter_final || {};
  const sfRule = bracketConfig.semi_final || {};
  const fRule = bracketConfig.final || {};

  const qfStart = baseDate || toDateString(new Date());
  const qfDays = qfRule.numberOfDays || 1;
  const sfDays = sfRule.numberOfDays || 1;

  const sfStart = addDays(qfStart, qfDays + 1);
  const fStart = addDays(sfStart, sfDays + 1);

  const qfId = generateId('stage');
  const sfId = generateId('stage');
  const fId = generateId('stage');

  const now = new Date().toISOString();

  const qfQualifiersPerDay = qfRule.qualifiersPerDay || 3;
  const sfQualifiersPerDay = sfRule.qualifiersPerDay || 3;

  const qfTotalQualified = (qfRule.numberOfDays || 1) * qfQualifiersPerDay;
  const sfTotalQualified = (sfRule.numberOfDays || 1) * sfQualifiersPerDay;

  const fTotalTeams =
    (fRule.numberOfDays || 1) *
    (fRule.matchesPerDay || 4) *
    (fRule.teamsPerMatch || 16);

  const fPaidMax = Math.max(0, fTotalTeams - sfTotalQualified) || 9;

  const stagesList = [
    {
      id: qfId,
      tournamentId,
      name: STAGE_NAMES.quarter_final,
      stageType: STAGE_TYPE.QUARTER_FINAL,
      order: 1,
      previousStageId: null,
      nextStageId: sfId,
      date: qfStart,
      startTime: baseTime || '20:00',
      endTime: null,
      numberOfDays: qfDays,
      status: STAGE_STATUS.PLANNED,
      teams: [],
      matches: [],
      qualifiedTeams: [],
      rules: {
        ...qfRule,
        qualifiersPerDay: qfQualifiersPerDay,
        totalQualifiers: qfTotalQualified,
      },
      paidSlots: [],
      paidSlotsCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sfId,
      tournamentId,
      name: STAGE_NAMES.semi_final,
      stageType: STAGE_TYPE.SEMI_FINAL,
      order: 2,
      previousStageId: qfId,
      nextStageId: fId,
      date: sfStart,
      startTime: baseTime || '20:00',
      endTime: null,
      numberOfDays: sfDays,
      status: STAGE_STATUS.PLANNED,
      teams: [],
      matches: [],
      qualifiedTeams: [],
      rules: {
        ...sfRule,
        qualifiersPerDay: sfQualifiersPerDay,
        totalQualifiers: sfTotalQualified,
      },
      paidSlots: [],
      paidSlotsCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: fId,
      tournamentId,
      name: STAGE_NAMES.final,
      stageType: STAGE_TYPE.FINAL,
      order: 3,
      previousStageId: sfId,
      nextStageId: null,
      date: fStart,
      startTime: baseTime || '20:00',
      endTime: null,
      numberOfDays: fRule.numberOfDays || 1,
      status: STAGE_STATUS.PLANNED,
      teams: [],
      matches: [],
      qualifiedTeams: [],
      rules: {
        ...fRule,
        qualifiersPerDay: 0,
        totalQualifiers: 0,
      },
      totalSlots: fTotalTeams,
      paidSlots: [],
      paidSlotsCount: 0,
      paidSlotsMax: fPaidMax,
      paidSlotPrice: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await store.update(FILE, (data) => {
    for (const s of stagesList) {
      data[s.id] = s;
    }
  });

  return stagesList;
}

// ============================================================
// GET
// ============================================================
async function getStage(id) {
  if (!id) return null;
  const data = await store.read(FILE);
  return data[id] || null;
}

async function getTournamentStages(tournamentId) {
  if (!tournamentId) return [];
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((s) => s.tournamentId === tournamentId)
    .sort((a, b) => a.order - b.order);
}

async function getStageByType(tournamentId, stageType) {
  const stages = await getTournamentStages(tournamentId);
  return stages.find((s) => s.stageType === stageType) || null;
}

// ============================================================
// UPDATE
// ============================================================
async function updateStage(stageId, patch) {
  return store.update(FILE, (data) => {
    if (!data[stageId]) return null;
    Object.assign(data[stageId], patch, { updatedAt: new Date().toISOString() });
    return data[stageId];
  });
}

async function setStageStatus(stageId, status) {
  return updateStage(stageId, { status });
}

// ============================================================
// TEAMS
// ============================================================
async function addTeamsToStage(stageId, teamIds) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return null;

    const ids = Array.isArray(teamIds) ? teamIds : [teamIds];
    for (const tid of ids) {
      if (!s.teams.includes(tid)) s.teams.push(tid);
    }
    s.updatedAt = new Date().toISOString();
    return s;
  });
}

async function removeTeamFromStage(stageId, teamId) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return null;
    s.teams = s.teams.filter((t) => t !== teamId);
    s.updatedAt = new Date().toISOString();
    return s;
  });
}

async function setTeamsToStage(stageId, teamIds) {
  const ids = Array.isArray(teamIds) ? teamIds : [teamIds];
  return updateStage(stageId, { teams: ids });
}

// ============================================================
// QUALIFIED
// ============================================================
async function addQualifiedTeams(stageId, teamIds) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return null;

    if (!s.qualifiedTeams) s.qualifiedTeams = [];

    const ids = Array.isArray(teamIds) ? teamIds : [teamIds];
    for (const tid of ids) {
      if (!s.qualifiedTeams.includes(tid)) s.qualifiedTeams.push(tid);
    }
    s.updatedAt = new Date().toISOString();
    return s;
  });
}

async function removeQualifiedTeam(stageId, teamId) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return null;
    if (!s.qualifiedTeams) s.qualifiedTeams = [];
    s.qualifiedTeams = s.qualifiedTeams.filter((t) => t !== teamId);
    s.updatedAt = new Date().toISOString();
    return s;
  });
}

// ============================================================
// MATCHES
// ============================================================
async function addMatchToStage(stageId, matchId) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return null;

    if (!s.matches) s.matches = [];
    if (!s.matches.includes(matchId)) s.matches.push(matchId);
    s.updatedAt = new Date().toISOString();
    return s;
  });
}

// ============================================================
// DELETE
// ============================================================
async function deleteStage(stageId) {
  return store.update(FILE, (data) => {
    delete data[stageId];
  });
}

async function deleteTournamentStages(tournamentId) {
  return store.update(FILE, (data) => {
    let count = 0;
    for (const [id, s] of Object.entries(data)) {
      if (s.tournamentId === tournamentId) {
        delete data[id];
        count++;
      }
    }
    return count;
  });
}

async function getStagesByStatus(status) {
  const data = await store.read(FILE);
  return Object.values(data).filter((s) => s.status === status);
}

async function getStageStats(stageId) {
  const s = await getStage(stageId);
  if (!s) return null;

  return {
    stage: s,
    totalTeams: (s.teams || []).length,
    totalMatches: (s.matches || []).length,
    totalQualified: (s.qualifiedTeams || []).length,
    paidSlots: (s.paidSlots || []).length,
    status: s.status,
  };
}

// ============================================================
// QUALIFIERS PER DAY
// ============================================================
async function setQualifiersPerDay(stageId, n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num < 1 || num > 20) {
    throw new Error("Noto'g'ri raqam (1-20)");
  }

  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return null;

    if (!s.rules) s.rules = {};
    s.rules.qualifiersPerDay = num;
    s.updatedAt = new Date().toISOString();
    return s;
  });
}

// ============================================================
// PAID SLOTS (FINAL)
// ============================================================
async function addPaidSlotToFinal(stageId, teamId, paidBy, amount) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return { ok: false, reason: 'not_found' };
    if (s.stageType !== STAGE_TYPE.FINAL) return { ok: false, reason: 'not_final' };

    if (!s.paidSlots) s.paidSlots = [];

    if (s.paidSlots.find((p) => p.teamId === teamId)) {
      return { ok: false, reason: 'already' };
    }

    const maxPaid = s.paidSlotsMax || 9;
    if (s.paidSlots.length >= maxPaid) {
      return { ok: false, reason: 'full' };
    }

    s.paidSlots.push({
      teamId,
      paidBy: paidBy ? Number(paidBy) : null,
      amount: amount || null,
      paidAt: new Date().toISOString(),
    });

    if (!s.teams.includes(teamId)) s.teams.push(teamId);

    s.paidSlotsCount = s.paidSlots.length;
    s.updatedAt = new Date().toISOString();

    return { ok: true, stage: s };
  });
}

async function removePaidSlotFromFinal(stageId, teamId) {
  return store.update(FILE, (data) => {
    const s = data[stageId];
    if (!s) return { ok: false };
    if (!s.paidSlots) return { ok: false };

    const before = s.paidSlots.length;
    s.paidSlots = s.paidSlots.filter((p) => p.teamId !== teamId);

    const isQualified = (s.qualifiedTeams || []).includes(teamId);
    if (!isQualified) {
      s.teams = s.teams.filter((t) => t !== teamId);
    }

    s.paidSlotsCount = s.paidSlots.length;
    s.updatedAt = new Date().toISOString();

    return { ok: s.paidSlots.length < before, stage: s };
  });
}

async function getFinalPaidSlots(stageId) {
  const s = await getStage(stageId);
  if (!s || s.stageType !== STAGE_TYPE.FINAL) return [];
  return s.paidSlots || [];
}

async function getFinalSlotStatus(stageId) {
  const s = await getStage(stageId);
  if (!s || s.stageType !== STAGE_TYPE.FINAL) return null;

  const totalSlots = s.totalSlots || 18;
  const qualifiedCount = (s.qualifiedTeams || []).length;
  const paidCount = (s.paidSlots || []).length;
  const used = qualifiedCount + paidCount;
  const free = Math.max(0, totalSlots - used);

  return {
    totalSlots,
    qualifiedCount,
    paidCount,
    paidMax: s.paidSlotsMax || 9,
    used,
    free,
    isFull: used >= totalSlots,
  };
}

// ============================================================
// FORMAT (3 tilda)
// ============================================================
function formatStageText(stage, t) {
  if (!stage) return '';
  if (typeof t !== 'function') t = (k) => k;

  const statusEmoji = {
    planned: '📋',
    registration_open: '🟢',
    in_progress: '🔴',
    waiting_results: '⏳',
    completed: '✅',
    cancelled: '❌',
  };

  const statusKey = 'stage_status_' + stage.status;
  const emoji = statusEmoji[stage.status] || '•';
  const status = t(statusKey) || stage.status;

  const lines = [];
  lines.push(`<b>${stage.name}</b>`);
  lines.push(`   ${emoji} ${status}`);
  lines.push(`   📅 ${stage.date} | ⏰ ${stage.startTime}`);
  lines.push(`   📆 ${t('stage_days_label')}: <b>${stage.numberOfDays || 1}</b>`);
  lines.push(`   🎮 ${t('stage_matches_per_day')}: <b>${stage.rules?.matchesPerDay || 4}</b>`);
  lines.push(`   👥 ${t('stage_teams_menu')}: <b>${(stage.teams || []).length}</b>`);
  lines.push(`   🎮 ${t('stage_matches_menu')}: <b>${(stage.matches || []).length}</b>`);

  if (stage.rules?.qualifiersPerDay > 0) {
    const totalQ = (stage.rules.qualifiersPerDay || 0) * (stage.numberOfDays || 0);
    lines.push(
      `   🏅 ${t('stage_qualifiers_per_day')}: <b>${stage.rules.qualifiersPerDay}</b> (${t('promotion_total')} ${totalQ})`
    );
  }

  if (stage.qualifiedTeams?.length > 0) {
    lines.push(
      `   🎯 ${t('promotion_stat_qualified')}: <b>${stage.qualifiedTeams.length}</b>`
    );
  }

  if (stage.stageType === STAGE_TYPE.FINAL) {
    const paid = (stage.paidSlots || []).length;
    const paidMax = stage.paidSlotsMax || 9;
    const totalSlots = stage.totalSlots || 18;
    const qualified = (stage.qualifiedTeams || []).length;

    lines.push('');
    lines.push(`   🏆 <b>${t('promotion_status_label')}:</b>`);
    lines.push(`      👥 ${t('promotion_total')}: <b>${totalSlots}</b>`);
    lines.push(`      ✅ ${t('promotion_stat_qualified')}: <b>${qualified}</b>`);
    lines.push(`      💰 ${t('wallet_deposit_type')}: <b>${paid}/${paidMax}</b>`);
    lines.push(
      `      🎯 ${t('promo_status_active')}: <b>${Math.max(0, totalSlots - qualified - paid)}</b>`
    );
  }

  return lines.join('\n');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  createDefaultStages,
  getStage,
  getTournamentStages,
  getStageByType,
  updateStage,
  setStageStatus,
  addTeamsToStage,
  removeTeamFromStage,
  setTeamsToStage,
  addQualifiedTeams,
  removeQualifiedTeam,
  addMatchToStage,
  deleteStage,
  deleteTournamentStages,
  getStagesByStatus,
  getStageStats,
  setQualifiersPerDay,
  formatStageText,
  toDateString,
  addDays,
  addPaidSlotToFinal,
  removePaidSlotFromFinal,
  getFinalPaidSlots,
  getFinalSlotStatus,
};