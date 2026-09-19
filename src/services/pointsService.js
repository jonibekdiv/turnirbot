// PTS tizimi — ball hisoblash va standings
const { PLACEMENT_POINTS } = require('../constants');
const { escapeHtml } = require('../utils/telegramUtils');

// O'rin uchun ball
function getPlacementPoints(placement) {
  return PLACEMENT_POINTS[placement] || 0;
}

// Kill uchun ball (1 kill = 1 pts)
function getKillPoints(kills) {
  const k = parseInt(kills, 10);
  return isNaN(k) || k < 0 ? 0 : k;
}

// Bitta karta uchun jami ball
function calculateTotal(placement, kills) {
  return getPlacementPoints(placement) + getKillPoints(kills);
}

// ============================================================
// STANDINGS HISOBLASH
// ============================================================
function calculateStandings(tournament, matchData, teamsMap) {
  const standings = {};

  // Barcha ro'yxatdan o'tgan komandalarni boshlash
  (tournament.registeredTeams || []).forEach((teamId) => {
    const t = teamsMap[teamId];
    standings[teamId] = {
      teamId,
      name: t?.name || 'Noma\'lum',
      tag: t?.tag || '?',
      matches: 0,
      wins: 0,
      totalKills: 0,
      totalPlacementPoints: 0,
      totalKillPoints: 0,
      totalPoints: 0,
      placements: [],
    };
  });

  // Har bir karta natijalarini qo'shish
  if (matchData && matchData.matches) {
    matchData.matches.forEach((match) => {
      match.results.forEach((r) => {
        const s = standings[r.teamId];
        if (!s) return;
        s.matches++;
        s.placements.push(r.placement);
        s.totalKills += r.kills;
        s.totalPlacementPoints += getPlacementPoints(r.placement);
        s.totalKillPoints += getKillPoints(r.kills);
        s.totalPoints += calculateTotal(r.placement, r.kills);
        if (r.placement === 1) s.wins++;
      });
    });
  }

  // Saralash
  const list = Object.values(standings).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return 0;
  });

  return list;
}

// ============================================================
// INPUT PARSER — Hostning matnini tahlil qilish
// Format: har qatorda <tag> - <kill>
// Tartib = o'rin (1-chi qator = 1-o'rin)
// ============================================================
function parseMatchInput(text, registeredTeams) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) throw new Error('Bo\'sh xabar yuborildi');

  // Tag → team map
  const teamByTag = {};
  registeredTeams.forEach((t) => {
    teamByTag[t.tag.toUpperCase()] = t;
  });

  const results = [];
  const usedTeams = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Formatlarni qabul qilish:
    // "UP - 5"  "UP | 5"  "UP: 5"  "UP 5"
    let m = line.match(/^([A-Za-z0-9_]+)\s*[-|:]\s*(\d+)$/);
    if (!m) m = line.match(/^([A-Za-z0-9_]+)\s+(\d+)$/);
    if (!m) {
      // Raqamli prefiks: "1. UP - 5" yoki "1) UP 5"
      m = line.match(/^\d+[.)\s]\s*([A-Za-z0-9_]+)\s*[-|:]\s*(\d+)$/);
    }
    if (!m) {
      // Raqamli prefiks: "1. UP 5"
      m = line.match(/^\d+[.)\s]\s*([A-Za-z0-9_]+)\s+(\d+)$/);
    }

    if (!m) {
      throw new Error(
        `❌ ${i + 1}-qator noto'g'ri formatda:\n<code>${escapeHtml(line)}</code>\n\n` +
        `To'g'ri format: <code>TAG - KILL</code>`
      );
    }

    const tag = m[1].toUpperCase();
    const kills = parseInt(m[2], 10);

    const team = teamByTag[tag];
    if (!team) {
      throw new Error(`❌ "${tag}" tegi topilmadi. Komandalar ro'yxatini tekshiring.`);
    }
    if (usedTeams.has(team.id)) {
      throw new Error(`❌ "${tag}" ikki marta kiritilgan.`);
    }
    if (isNaN(kills) || kills < 0) {
      throw new Error(`❌ "${tag}" uchun kill noto'g'ri.`);
    }

    usedTeams.add(team.id);
    results.push({
      teamId: team.id,
      placement: i + 1,
      kills,
    });
  }

  // Tekshirish: barcha komandalar kiritilganmi
  const missing = registeredTeams.filter((t) => !usedTeams.has(t.id));
  if (missing.length > 0) {
    throw new Error(
      `❌ Quyidagi komandalar yo'q:\n` +
      missing.map((t) => `<b>${t.tag}</b> — ${escapeHtml(t.name)}`).join('\n')
    );
  }

  return results;
}

// ============================================================
// STANDINGS'NI CHIROYLI FORMATDA KO'RSATISH
// ============================================================
function formatStandings(standings, tournament) {
  if (!standings.length) return '📭 Hozircha natijalar yo\'q.';

  // Ustun kengliklari
  const W_NO = 3;
  const W_TEAM = 18;
  const W_WIN = 4;
  const W_PLACE = 6;
  const W_KILL = 5;
  const W_TOTAL = 5;

  function pad(str, len) {
    str = String(str);
    if (str.length >= len) return str.slice(0, len - 1) + ' ';
    return str + ' '.repeat(len - str.length);
  }

  const header =
    pad('No', W_NO) +
    pad('Team', W_TEAM) +
    pad('Win', W_WIN) +
    pad('Place', W_PLACE) +
    pad('Kill', W_KILL) +
    pad('Total', W_TOTAL);

  const divider = '─'.repeat(header.length);

  const rows = standings.map((s, i) => {
    return (
      pad(i + 1, W_NO) +
      pad(s.name.slice(0, W_TEAM - 1), W_TEAM) +
      pad(s.wins, W_WIN) +
      pad(s.totalPlacementPoints, W_PLACE) +
      pad(s.totalKills, W_KILL) +
      pad(s.totalPoints, W_TOTAL)
    );
  });

  const lines = [];
  lines.push(`🏆 <b>${escapeHtml(tournament.title)}</b>`);
  if (tournament.etapa) lines.push(`⭐️ Etap: <b>${escapeHtml(tournament.etapa)}</b>`);

  const totalMatches = standings[0]?.matches || 0;
  lines.push(`📊 Kartalar: <b>${totalMatches}</b>`);
  lines.push('');
  lines.push('<pre>' + header + '\n' + divider + '\n' + rows.join('\n') + '</pre>');

  return lines.join('\n');
}

// Bitta kartani ko'rsatish
function formatMatchCard(match, teamsMap) {
  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   🎮 <b>KARTA №${match.number}</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');

  // Saralash
  const sorted = [...match.results].sort((a, b) => a.placement - b.placement);

  const W_NO = 4;
  const W_TEAM = 18;
  const W_KILL = 5;
  const W_PTS = 5;

  function pad(str, len) {
    str = String(str);
    if (str.length >= len) return str.slice(0, len - 1) + ' ';
    return str + ' '.repeat(len - str.length);
  }

  const header =
    pad('#', W_NO) + pad('Team', W_TEAM) + pad('Kill', W_KILL) + pad('Pts', W_PTS);
  const divider = '─'.repeat(header.length);

  const rows = sorted.map((r) => {
    const team = teamsMap[r.teamId];
    const pts = calculateTotal(r.placement, r.kills);
    return (
      pad(r.placement, W_NO) +
      pad((team?.name || '?').slice(0, W_TEAM - 1), W_TEAM) +
      pad(r.kills, W_KILL) +
      pad(pts, W_PTS)
    );
  });

  lines.push('<pre>' + header + '\n' + divider + '\n' + rows.join('\n') + '</pre>');
  return lines.join('\n');
}

module.exports = {
  getPlacementPoints,
  getKillPoints,
  calculateTotal,
  calculateStandings,
  parseMatchInput,
  formatStandings,
  formatMatchCard,
};