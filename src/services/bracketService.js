// ============================================================
// BRACKET SERVICE — Bracket konfiguratsiya + maps
// ============================================================
const { DEFAULT_BRACKET, LIMITS, STAGE_TYPE } = require('../constants');

// ============================================================
// XARITALAR
// ============================================================
const AVAILABLE_MAPS = [
  'Erangel',
  'Miramar',
  'Rondo',
  'Sanhok',
  'Vikendi',
  'Taego',
  'Deston',
  'Karakin',
  'Paramo',
];

// Default kunlik xarita aylanishi (4 match uchun)
const DEFAULT_DAY_MAPS = ['Erangel', 'Miramar', 'Rondo', 'Erangel'];

// ============================================================
// STAGE NOMLARI
// ============================================================
const STAGE_LABELS = {
  quarter_final: '1/4 Final',
  semi_final: '1/2 Final',
  final: 'Final',
};

const STAGE_ORDER = {
  quarter_final: 1,
  semi_final: 2,
  final: 3,
};

// ============================================================
// DEFAULT KONFIGURATSIYA (matchesPerDay: 4)
// ============================================================
function getDefaultBracket() {
  return {
    quarter_final: {
      numberOfDays: 3,
      matchesPerDay: 4,          // ⚡️ 4 match per day
      teamsPerMatch: 16,         // PUBG standard 16
      qualifiersPerDay: 3,       // Top 3 per day
    },
    semi_final: {
      numberOfDays: 3,
      matchesPerDay: 4,
      teamsPerMatch: 16,
      qualifiersPerDay: 3,
    },
    final: {
      numberOfDays: 1,
      matchesPerDay: 4,
      teamsPerMatch: 16,
      qualifiersPerDay: 0,
    },
  };
}

// ============================================================
// VALIDATSIYA
// ============================================================
function validateBracket(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ["Bracket config bo'sh"], warnings: [] };
  }

  for (const [stageKey, stageName] of Object.entries({
    quarter_final: '1/4 final',
    semi_final: '1/2 final',
    final: 'Final',
  })) {
    const rule = config[stageKey];
    if (!rule) continue;

    if (!rule.numberOfDays || rule.numberOfDays < 1) {
      errors.push(`${stageName}: kunlar kamida 1 bo'lishi kerak`);
    }
    if (rule.numberOfDays > LIMITS.STAGE_MAX_DAYS) {
      errors.push(`${stageName}: kunlar ${LIMITS.STAGE_MAX_DAYS} dan oshmasin`);
    }
    if (!rule.matchesPerDay || rule.matchesPerDay < 1) {
      errors.push(`${stageName}: kunlik matchlar kamida 1 bo'lishi kerak`);
    }
    if (rule.matchesPerDay > LIMITS.STAGE_MAX_MATCHES_PER_DAY) {
      errors.push(
        `${stageName}: kunlik matchlar ${LIMITS.STAGE_MAX_MATCHES_PER_DAY} dan oshmasin`
      );
    }
    if (!rule.teamsPerMatch || rule.teamsPerMatch < LIMITS.STAGE_MIN_TEAMS_PER_MATCH) {
      errors.push(
        `${stageName}: har matchda kamida ${LIMITS.STAGE_MIN_TEAMS_PER_MATCH} komanda`
      );
    }
    if (rule.teamsPerMatch > LIMITS.STAGE_MAX_TEAMS_PER_MATCH) {
      errors.push(
        `${stageName}: har matchda ${LIMITS.STAGE_MAX_TEAMS_PER_MATCH} komandadan oshmasin`
      );
    }
    if (
      rule.qualifiersPerDay !== undefined &&
      rule.qualifiersPerDay > 0 &&
      rule.qualifiersPerDay > rule.teamsPerMatch
    ) {
      errors.push(`${stageName}: o'tadiganlar qatnashchilardan ko'p`);
    }
  }

  // 1/4 → 1/2 sig'im
  const qf = config.quarter_final;
  const sf = config.semi_final;
  const f = config.final;

  if (qf && sf) {
    const qfQualified = (qf.qualifiersPerDay || 0) * (qf.numberOfDays || 0);
    const sfCapacity =
      (sf.numberOfDays || 0) *
      (sf.matchesPerDay || 0) *
      (sf.teamsPerMatch || 0);

    if (qfQualified > 0 && sfCapacity > 0 && qfQualified !== sfCapacity) {
      warnings.push(
        `⚠️ 1/4 dan <b>${qfQualified}</b> o'tadi, lekin 1/2 sig'imi <b>${sfCapacity}</b>`
      );
    }
  }

  if (sf && f) {
    const sfQualified = (sf.qualifiersPerDay || 0) * (sf.numberOfDays || 0);
    const fCapacity =
      (f.numberOfDays || 0) *
      (f.matchesPerDay || 0) *
      (f.teamsPerMatch || 0);

    if (sfQualified > 0 && fCapacity > 0 && sfQualified !== fCapacity) {
      warnings.push(
        `⚠️ 1/2 dan <b>${sfQualified}</b> o'tadi, lekin final sig'imi <b>${fCapacity}</b>`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// STAGE XULOSASI
// ============================================================
function getStageSummary(config) {
  const summary = {};

  for (const [stage, rule] of Object.entries(config || {})) {
    const totalMatches = (rule.numberOfDays || 0) * (rule.matchesPerDay || 0);
    const totalTeams = totalMatches * (rule.teamsPerMatch || 0);
    const totalQualified =
      (rule.qualifiersPerDay || 0) * (rule.numberOfDays || 0);

    summary[stage] = {
      stageLabel: STAGE_LABELS[stage] || stage,
      totalTeams,
      totalQualified,
      totalMatches,
      numberOfDays: rule.numberOfDays || 0,
      matchesPerDay: rule.matchesPerDay || 0,
      teamsPerMatch: rule.teamsPerMatch || 0,
      qualifiersPerDay: rule.qualifiersPerDay || 0,
    };
  }

  return summary;
}

// ============================================================
// MATNLASHTIRISH
// ============================================================
function formatBracketText(config) {
  const lines = [];

  lines.push('╔══════════════════════╗');
  lines.push('   📋 <b>BRACKET SOZLAMALARI</b>');
  lines.push('╚══════════════════════╝');
  lines.push('');

  const order = ['quarter_final', 'semi_final', 'final'];

  for (const key of order) {
    const rule = config[key];
    if (!rule) continue;

    const name = STAGE_LABELS[key] || key;
    const totalMatches = (rule.numberOfDays || 0) * (rule.matchesPerDay || 0);
    const totalQualified =
      (rule.qualifiersPerDay || 0) * (rule.numberOfDays || 0);

    lines.push(`<b>${name}</b>`);
    lines.push(`   📅 Kunlar: <b>${rule.numberOfDays}</b>`);
    lines.push(`   🎮 Kunlik matchlar: <b>${rule.matchesPerDay}</b>`);
    lines.push(`   🗺 Xaritalar: <b>${DEFAULT_DAY_MAPS.slice(0, rule.matchesPerDay || 4).join(', ')}</b>`);
    lines.push(`   👥 Komanda/match: <b>${rule.teamsPerMatch}</b>`);
    lines.push(`   📊 Jami matchlar: <b>${totalMatches}</b>`);

    if (rule.qualifiersPerDay > 0) {
      lines.push(`   ✅ Kunlik top: <b>${rule.qualifiersPerDay}</b>`);
      lines.push(`   🎯 Jami o'tadi: <b>${totalQualified}</b>`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// HISOBLASH
// ============================================================
function calculateMatchesPerStage(config) {
  const result = {};
  for (const [stage, rule] of Object.entries(config || {})) {
    const totalMatches = (rule.numberOfDays || 0) * (rule.matchesPerDay || 0);
    result[stage] = {
      totalMatches,
      totalTeams: totalMatches * (rule.teamsPerMatch || 0),
      totalQualified:
        (rule.qualifiersPerDay || 0) * (rule.numberOfDays || 0),
    };
  }
  return result;
}

function getNextStageType(currentType) {
  if (currentType === STAGE_TYPE.QUARTER_FINAL) return STAGE_TYPE.SEMI_FINAL;
  if (currentType === STAGE_TYPE.SEMI_FINAL) return STAGE_TYPE.FINAL;
  return null;
}

function getPreviousStageType(currentType) {
  if (currentType === STAGE_TYPE.SEMI_FINAL) return STAGE_TYPE.QUARTER_FINAL;
  if (currentType === STAGE_TYPE.FINAL) return STAGE_TYPE.SEMI_FINAL;
  return null;
}

// ============================================================
// MAPS
// ============================================================
function getMapsForDay(matchesPerDay = 4) {
  const cycle = ['Erangel', 'Miramar', 'Rondo', 'Erangel', 'Sanhok'];
  const result = [];
  for (let i = 0; i < matchesPerDay; i++) {
    result.push(cycle[i % cycle.length]);
  }
  return result;
}

function isValidMap(map) {
  return AVAILABLE_MAPS.includes(map);
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  AVAILABLE_MAPS,
  DEFAULT_DAY_MAPS,
  STAGE_LABELS,
  STAGE_ORDER,
  getDefaultBracket,
  validateBracket,
  getStageSummary,
  formatBracketText,
  calculateMatchesPerStage,
  getNextStageType,
  getPreviousStageType,
  getMapsForDay,
  isValidMap,
};