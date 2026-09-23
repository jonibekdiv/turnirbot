// ============================================================
// ACHIEVEMENTS SERVICE — Yutuqlar (#11)
// ============================================================
const store = require('../storage/jsonStore');
const teamService = require('./teamService');
const tournamentService = require('./tournamentService');
const matchService = require('./matchService');
const userService = require('./userService');
const referralService = require('./referralService');

const FILE = 'achievements.json';

// ============================================================
// YUTUQLAR RO'YXATI
// ============================================================
const ACHIEVEMENTS = {
  FIRST_MATCH: {
    id: 'first_match',
    emoji: '🎮',
    name: 'Birinchi qadam',
    desc: 'Birinchi marta turnirda qatnashish',
  },
  FIRST_KILL: {
    id: 'first_kill',
    emoji: '🎯',
    name: 'Birinchi qon',
    desc: 'Birinchi kill',
  },
  FIRST_WIN: {
    id: 'first_win',
    emoji: '🥇',
    name: "Birinchi g'alaba",
    desc: "Birinchi marta 1-o'rin",
  },
  CHICKEN_DINNER: {
    id: 'chicken_dinner',
    emoji: '🍗',
    name: 'Winner Winner',
    desc: 'Chicken Dinner',
  },
  HUNDRED_KILLS: {
    id: 'hundred_kills',
    emoji: '💯',
    name: '100 kill',
    desc: '100 ta kill',
  },
  FIVE_WINS: {
    id: 'five_wins',
    emoji: '🏆',
    name: "5 g'alaba",
    desc: "5 marta 1-o'rin",
  },
  TEN_MATCHES: {
    id: 'ten_matches',
    emoji: '📊',
    name: "10 o'yin",
    desc: '10 kartada qatnashish',
  },
  FIFTY_MATCHES: {
    id: 'fifty_matches',
    emoji: '📈',
    name: "50 o'yin",
    desc: '50 kartada qatnashish',
  },
  CAPTAIN: {
    id: 'captain',
    emoji: '👑',
    name: 'Captain',
    desc: "Komanda captain'i bo'lish",
  },
  REFERRER: {
    id: 'referrer',
    emoji: '🎁',
    name: 'Taklif qiluvchi',
    desc: "Birinchi do'stni taklif qilish",
  },
  SUPER_REFERRER: {
    id: 'super_referrer',
    emoji: '🌟',
    name: 'Super taklif qiluvchi',
    desc: "10 ta do'stni taklif qilish",
  },
  TOP_1: {
    id: 'top_1',
    emoji: '🏅',
    name: 'Chempion',
    desc: "Reytingda 1-o'rin",
  },
  TOP_10: {
    id: 'top_10',
    emoji: '🎖️',
    name: 'Top 10',
    desc: 'Reytingda Top-10',
  },
  PAID_PLAYER: {
    id: 'paid_player',
    emoji: '💳',
    name: "Pullik o'yinchi",
    desc: 'Pullik turnirda qatnashish',
  },
  VETERAN: {
    id: 'veteran',
    emoji: '🎗️',
    name: 'Veteran',
    desc: '6 oydan beri botdan foydalanish',
  },
};

// ============================================================
// ACHIEVEMENT BERISH
// ============================================================
async function grant(userId, achId) {
  return store.update(FILE, (data) => {
    const key = String(userId);
    if (!data[key]) {
      data[key] = {
        userId: Number(userId),
        achievements: [],
        lastChecked: null,
      };
    }

    if (!data[key].achievements.find((a) => a.id === achId)) {
      data[key].achievements.push({
        id: achId,
        grantedAt: new Date().toISOString(),
      });
      return { granted: true, achId };
    }
    return { granted: false, achId };
  });
}

// ============================================================
// FOYDALANUVCHI YUTUQLARI
// ============================================================
async function getUserAchievements(userId) {
  const data = await store.read(FILE);
  const userAch = data[String(userId)]?.achievements || [];
  const userAchIds = userAch.map((a) => a.id);

  return Object.values(ACHIEVEMENTS).map((ach) => ({
    ...ach,
    earned: userAchIds.includes(ach.id),
    earnedAt: userAch.find((a) => a.id === ach.id)?.grantedAt || null,
  }));
}

// ============================================================
// AVTOMATIK TEKSHIRISH
// ============================================================
async function autoCheck(userId) {
  const granted = [];

  try {
    // User ma'lumotlarini olish
    const user = await userService.getUser(userId);
    if (!user) return granted;

    // Team check
    const userTeam = user.teamId
      ? await teamService.getTeam(user.teamId)
      : null;

    if (userTeam) {
      // Captain
      if (Number(userTeam.captainId) === Number(userId)) {
        const r = await grant(userId, ACHIEVEMENTS.CAPTAIN.id);
        if (r.granted) granted.push(ACHIEVEMENTS.CAPTAIN);
      }

      // Match stats
      const allTours = await tournamentService.getAllTournaments();
      let matches = 0;
      let totalKills = 0;
      let wins = 0;

      for (const tour of allTours) {
        if (!tour.registeredTeams.includes(userTeam.id)) continue;
        const md = await matchService.getTournamentMatches(tour.id);
        for (const m of md.matches) {
          const r = m.results.find((x) => x.teamId === userTeam.id);
          if (!r) continue;
          matches++;
          totalKills += r.kills || 0;
          if (r.placement === 1) wins++;
        }
      }

      if (matches >= 1) {
        const r = await grant(userId, ACHIEVEMENTS.FIRST_MATCH.id);
        if (r.granted) granted.push(ACHIEVEMENTS.FIRST_MATCH);
      }
      if (totalKills >= 1) {
        const r = await grant(userId, ACHIEVEMENTS.FIRST_KILL.id);
        if (r.granted) granted.push(ACHIEVEMENTS.FIRST_KILL);
      }
      if (wins >= 1) {
        const r = await grant(userId, ACHIEVEMENTS.FIRST_WIN.id);
        if (r.granted) granted.push(ACHIEVEMENTS.FIRST_WIN);

        const r2 = await grant(userId, ACHIEVEMENTS.CHICKEN_DINNER.id);
        if (r2.granted) granted.push(ACHIEVEMENTS.CHICKEN_DINNER);
      }
      if (totalKills >= 100) {
        const r = await grant(userId, ACHIEVEMENTS.HUNDRED_KILLS.id);
        if (r.granted) granted.push(ACHIEVEMENTS.HUNDRED_KILLS);
      }
      if (wins >= 5) {
        const r = await grant(userId, ACHIEVEMENTS.FIVE_WINS.id);
        if (r.granted) granted.push(ACHIEVEMENTS.FIVE_WINS);
      }
      if (matches >= 10) {
        const r = await grant(userId, ACHIEVEMENTS.TEN_MATCHES.id);
        if (r.granted) granted.push(ACHIEVEMENTS.TEN_MATCHES);
      }
      if (matches >= 50) {
        const r = await grant(userId, ACHIEVEMENTS.FIFTY_MATCHES.id);
        if (r.granted) granted.push(ACHIEVEMENTS.FIFTY_MATCHES);
      }
    }

    // Referral
    try {
      const refStats = await referralService.getUserReferralStats(userId);
      if (refStats.invited >= 1) {
        const r = await grant(userId, ACHIEVEMENTS.REFERRER.id);
        if (r.granted) granted.push(ACHIEVEMENTS.REFERRER);
      }
      if (refStats.invited >= 10) {
        const r = await grant(userId, ACHIEVEMENTS.SUPER_REFERRER.id);
        if (r.granted) granted.push(ACHIEVEMENTS.SUPER_REFERRER);
      }
    } catch (e) {}

    // Veteran
    if (user.createdAt) {
      const days = Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / 86400000
      );
      if (days >= 180) {
        const r = await grant(userId, ACHIEVEMENTS.VETERAN.id);
        if (r.granted) granted.push(ACHIEVEMENTS.VETERAN);
      }
    }
  } catch (e) {
    console.error('Achievements check xato:', e.message);
  }

  // Timestamp
  try {
    await store.update(FILE, (data) => {
      const key = String(userId);
      if (data[key]) data[key].lastChecked = new Date().toISOString();
    });
  } catch (e) {}

  return granted;
}

// ============================================================
// FORMAT MATNI
// ============================================================
async function formatAchievements(userId) {
  const list = await getUserAchievements(userId);
  const earned = list.filter((a) => a.earned).length;

  const lines = [];
  lines.push(`╔══════════════════════╗`);
  lines.push(`   🏅 <b>YUTUQLAR</b>`);
  lines.push(`╚══════════════════════╝`);
  lines.push('');
  lines.push(`📊 Jami: <b>${earned}/${list.length}</b>`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  list.forEach((a) => {
    const icon = a.earned ? '✅' : '🔒';
    lines.push(`${icon} ${a.emoji} <b>${a.name}</b>`);
    lines.push(`   <i>${a.desc}</i>`);
  });

  return lines.join('\n');
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  ACHIEVEMENTS,
  grant,
  getUserAchievements,
  autoCheck,
  formatAchievements,
};