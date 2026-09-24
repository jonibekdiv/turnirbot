// ============================================================
// STAGE KEYBOARD — Etaplar tizimi klaviaturalari
// ============================================================
const { Markup } = require('telegraf');
const { CALLBACK, STAGE_STATUS, STAGE_TYPE } = require('../constants');

// ============================================================
// ETAPLAR MENYUSI
// ============================================================
function stageMenuKeyboard(tournamentId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "📋 Etaplar ro'yxati",
        CALLBACK.STAGE_LIST + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        '➕ Etaplarni yaratish',
        CALLBACK.STAGE_CREATE + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        '⚙️ Bracket sozlamalari',
        CALLBACK.STAGE_BRACKET_SETUP + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        '⬅️ Turnirga qaytish',
        CALLBACK.TOUR_OPEN + tournamentId
      ),
    ],
  ]);
}

// ============================================================
// ETAPLAR RO'YXATI
// ============================================================
function stageListKeyboard(stages, tournamentId) {
  const rows = [];

  for (const s of stages) {
    const statusEmoji = {
      planned: '📋',
      registration_open: '🟢',
      in_progress: '🔴',
      waiting_results: '⏳',
      completed: '✅',
      cancelled: '❌',
    };

    const emoji = statusEmoji[s.status] || '•';

    rows.push([
      Markup.button.callback(
        `${emoji} ${s.name}`,
        CALLBACK.STAGE_VIEW + s.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      '⬅️ Turnirga qaytish',
      CALLBACK.TOUR_OPEN + tournamentId
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// BRACKET SETUP
// ============================================================
function bracketSetupKeyboard(tournamentId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '⚡️ Default sozlamalar',
        CALLBACK.STAGE_BRACKET_USE_DEFAULT + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        "✏️ Qo'lda sozlash",
        CALLBACK.STAGE_BRACKET_STEP + tournamentId + ':start'
      ),
    ],
    [
      Markup.button.callback(
        '⬅️ Orqaga',
        CALLBACK.STAGE_LIST + tournamentId
      ),
    ],
  ]);
}

// ============================================================
// BRACKET TASDIQLASH
// ============================================================
function bracketConfirmKeyboard(tournamentId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Tasdiqlash',
        CALLBACK.STAGE_BRACKET_CONFIRM + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        '🔁 Qayta kiritish',
        CALLBACK.STAGE_BRACKET_SETUP + tournamentId
      ),
    ],
    [
      Markup.button.callback(
        '❌ Bekor qilish',
        CALLBACK.STAGE_LIST + tournamentId
      ),
    ],
  ]);
}

// ============================================================
// BITTA ETAP KO'RINISHI
// ============================================================
function stageViewKeyboard(stage, tournamentId) {
  const rows = [];

  // Komandalar
  rows.push([
    Markup.button.callback(
      `👥 Komandalar (${(stage.teams || []).length})`,
      CALLBACK.STAGE_TEAMS_MENU + stage.id
    ),
  ]);

  // Matchlar
  rows.push([
    Markup.button.callback(
      `🎮 Matchlar (${(stage.matches || []).length})`,
      CALLBACK.STAGE_MATCHES_LIST + stage.id
    ),
  ]);

  // Promotion
  if (stage.nextStageId) {
    rows.push([
      Markup.button.callback(
        '⬆️ Promotion',
        CALLBACK.PROMOTION_LIST + stage.id
      ),
    ]);
  }

  // Statusga qarab
  if (stage.status === STAGE_STATUS.PLANNED) {
    rows.push([
      Markup.button.callback(
        '▶️ Boshlash',
        CALLBACK.STAGE_START + stage.id
      ),
    ]);
  }

  if (stage.status === STAGE_STATUS.IN_PROGRESS) {
    rows.push([
      Markup.button.callback(
        '✅ Yakunlash',
        CALLBACK.STAGE_FINISH + stage.id
      ),
    ]);
  }

  // Tahrirlash
  rows.push([
    Markup.button.callback(
      '✏️ Tahrirlash',
      CALLBACK.STAGE_BRACKET_EDIT + stage.id
    ),
  ]);

  rows.push([
    Markup.button.callback(
      '⬅️ Turnirga qaytish',
      CALLBACK.TOUR_OPEN + tournamentId
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// KOMANDALAR TAQSIMLASH
// ============================================================
function teamDistributionKeyboard(stageId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🎲 Random taqsimlash',
        CALLBACK.STAGE_TEAMS_RANDOM + stageId
      ),
    ],
    [
      Markup.button.callback(
        "⭐️ Reyting bo'yicha",
        CALLBACK.STAGE_TEAMS_RATING + stageId
      ),
    ],
    [
      Markup.button.callback(
        "✋ Qo'lda taqsimlash",
        CALLBACK.STAGE_TEAMS_MANUAL + stageId
      ),
    ],
    [
      Markup.button.callback('⬅️ Orqaga', CALLBACK.STAGE_VIEW + stageId),
    ],
  ]);
}

// ============================================================
// MATCHLAR RO'YXATI
// ============================================================
function matchesListKeyboard(matches, stageId) {
  const rows = [];

  for (const m of matches) {
    const statusEmoji = {
      pending: '⏳',
      submitted: '📤',
      approved: '✅',
      rejected: '❌',
    };

    const emoji = statusEmoji[m.resultStatus] || '•';
    const hostEmoji = m.hostId ? '🎙' : '⚠️';

    rows.push([
      Markup.button.callback(
        `${emoji} Kun ${m.dayNumber} #${m.dayMatchNumber || m.matchNumber} (${m.map || 'Erangel'}) ${hostEmoji}`,
        CALLBACK.STAGE_MATCH_VIEW + m.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('⬅️ Orqaga', CALLBACK.STAGE_VIEW + stageId),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// MATCH ACTIONS
// ============================================================
function matchActionsKeyboard(match, stageId) {
  const rows = [];

  if (!match.hostId) {
    rows.push([
      Markup.button.callback(
        '🎙 Host biriktirish',
        CALLBACK.STAGE_MATCH_HOST_ASSIGN + match.id
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        `🎙 Host: ${match.hostId}`,
        CALLBACK.STAGE_MATCH_HOST_ASSIGN + match.id
      ),
    ]);
  }

  if (match.roomId && match.roomPassword) {
    rows.push([
      Markup.button.callback(
        '🔄 Room qayta yuborish',
        CALLBACK.STAGE_MATCH_ROOM_SEND + match.id
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        "🆔 Room ma'lumotlarini kiritish",
        CALLBACK.STAGE_MATCH_ROOM_INPUT + match.id
      ),
    ]);
  }

  if (match.resultStatus === 'pending') {
    rows.push([
      Markup.button.callback(
        '📊 Natijalarni kiritish',
        CALLBACK.STAGE_MATCH_RESULTS_INPUT + match.id
      ),
    ]);
  } else if (match.resultStatus === 'submitted') {
    rows.push([
      Markup.button.callback(
        "👁 Natijalarni ko'rish",
        CALLBACK.STAGE_MATCH_RESULTS_VIEW + match.id
      ),
    ]);
    rows.push([
      Markup.button.callback(
        '✅ Natijalarni tasdiqlash',
        CALLBACK.STAGE_RESULTS_APPROVE + match.id
      ),
    ]);
    rows.push([
      Markup.button.callback(
        '❌ Rad etish',
        CALLBACK.STAGE_RESULTS_REJECT + match.id
      ),
    ]);
  } else if (match.resultStatus === 'approved') {
    rows.push([
      Markup.button.callback(
        '👁 Natijalar (tasdiqlangan)',
        CALLBACK.STAGE_MATCH_RESULTS_VIEW + match.id
      ),
    ]);
    rows.push([
      Markup.button.callback(
        '🔓 Qayta ochish',
        CALLBACK.STAGE_RESULTS_REOPEN + match.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      "⬅️ Matchlar ro'yxati",
      CALLBACK.STAGE_MATCHES_LIST + stageId
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// HOST TANLASH
// ============================================================
function hostPickerKeyboard(hosts, matchId) {
  const rows = [];

  for (const h of hosts.slice(0, 15)) {
    rows.push([
      Markup.button.callback(
        `🎙 Host ID: ${h.id}`,
        CALLBACK.STAGE_MATCH_HOST_SET + matchId + ':' + h.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('⬅️ Orqaga', CALLBACK.STAGE_MATCH_VIEW + matchId),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// PROMOTION
// ============================================================
function promotionListKeyboard(promotions, stageId) {
  const rows = [];

  for (const p of promotions) {
    const statusEmoji = {
      qualified: '✅',
      promoted: '⬆️',
      invitation_sent: '📨',
      registered: '🎯',
      rejected: '❌',
      declined: '🚫',
      cancelled: '🗑',
    };

    const emoji = statusEmoji[p.status] || '•';

    rows.push([
      Markup.button.callback(
        `${emoji} ${p.teamName} [${p.teamTag}]`,
        CALLBACK.PROMOTION_VIEW + p.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      "⬆️ Barchasini ko'tarish",
      CALLBACK.PROMOTION_CONFIRM_ALL + stageId
    ),
  ]);

  rows.push([
    Markup.button.callback('⬅️ Orqaga', CALLBACK.STAGE_VIEW + stageId),
  ]);

  return Markup.inlineKeyboard(rows);
}

function promotionViewKeyboard(promotion) {
  const rows = [];

  if (promotion.status === 'qualified') {
    rows.push([
      Markup.button.callback(
        "⬆️ Keyingi etapga ko'tarish",
        CALLBACK.PROMOTION_APPROVE + promotion.id
      ),
    ]);
  }

  if (!promotion.invitationSent) {
    rows.push([
      Markup.button.callback(
        '📨 Taklifnoma yuborish',
        CALLBACK.PROMOTION_SEND_INVITE + promotion.id
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        '🔄 Taklifnomani qayta yuborish',
        CALLBACK.PROMOTION_RESEND_INVITE + promotion.id
      ),
    ]);
  }

  if (promotion.status !== 'cancelled') {
    rows.push([
      Markup.button.callback(
        '🗑 Bekor qilish',
        CALLBACK.PROMOTION_CANCEL + promotion.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      '⬅️ Orqaga',
      CALLBACK.PROMOTION_LIST + promotion.fromStageId
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// ⚡️ TOP N TANLASH (3/4/5)
// ============================================================
function qualifiersCountKeyboard(stageId, dayNumber) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🥇 Top 3',
        `prm:createtop:${stageId}:${dayNumber}:3`
      ),
      Markup.button.callback(
        '🥇 Top 4',
        `prm:createtop:${stageId}:${dayNumber}:4`
      ),
    ],
    [
      Markup.button.callback(
        '🥇 Top 5',
        `prm:createtop:${stageId}:${dayNumber}:5`
      ),
    ],
    [
      Markup.button.callback(
        '⬅️ Orqaga',
        CALLBACK.PROMOTION_LIST + stageId
      ),
    ],
  ]);
}

// ============================================================
// INVITATION KEYBOARD (Captain)
// ============================================================
function invitationKeyboard(invitationId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Qatnashishni tasdiqlash',
        CALLBACK.INV_ACCEPT + invitationId
      ),
    ],
    [
      Markup.button.callback(
        '❌ Qatnasha olmayman',
        CALLBACK.INV_DECLINE + invitationId
      ),
    ],
    [
      Markup.button.callback(
        'ℹ️ Keyingi etap haqida',
        CALLBACK.INV_INFO + invitationId
      ),
    ],
    [
      Markup.button.callback(
        '💬 Hostga yozish',
        CALLBACK.INV_CONTACT_HOST + invitationId
      ),
    ],
  ]);
}

// ============================================================
// MENING TAKLIFNOMALARIM
// ============================================================
function myInvitationsKeyboard(invitations) {
  const rows = [];

  for (const inv of invitations.slice(0, 10)) {
    const statusEmoji = {
      created: '📝',
      sent: '📨',
      accepted: '✅',
      declined: '❌',
      expired: '⌛',
    };

    const emoji = statusEmoji[inv.status] || '•';

    rows.push([
      Markup.button.callback(
        `${emoji} Taklifnoma — ${inv.invitationCode}`,
        CALLBACK.INV_VIEW + inv.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('🏠 Asosiy menyu', CALLBACK.MENU_MAIN),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// HOST STAGE
// ============================================================
function hostStageMatchesKeyboard(matches, hostId) {
  const rows = [];

  for (const m of matches) {
    const statusEmoji = {
      pending: '⏳',
      submitted: '📤',
      approved: '✅',
      rejected: '❌',
    };

    const emoji = statusEmoji[m.resultStatus] || '•';

    rows.push([
      Markup.button.callback(
        `${emoji} Kun ${m.dayNumber} — #${m.dayMatchNumber || m.matchNumber} (${m.map || 'Erangel'})`,
        CALLBACK.HOST_STAGE_MATCH + m.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('⬅️ Orqaga', CALLBACK.HOST_STAGE_TOURS),
  ]);

  return Markup.inlineKeyboard(rows);
}

function hostStageMatchKeyboard(match, stageId) {
  const rows = [];

  rows.push([
    Markup.button.callback(
      '🆔 Room ID yuborish',
      CALLBACK.HOST_STAGE_ROOM + match.id + ':id'
    ),
  ]);

  rows.push([
    Markup.button.callback(
      '🔒 Parol yuborish',
      CALLBACK.HOST_STAGE_ROOM + match.id + ':pass'
    ),
  ]);

  rows.push([
    Markup.button.callback(
      '📨 ID va parolni birga',
      CALLBACK.HOST_STAGE_ROOM + match.id + ':both'
    ),
  ]);

  if (match.resultStatus === 'pending') {
    rows.push([
      Markup.button.callback(
        '📊 Natijalarni kiritish',
        CALLBACK.HOST_STAGE_RESULTS + match.id
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        '👁 Natijalar',
        CALLBACK.HOST_STAGE_RESULTS + match.id
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      "✅ Kim o'tdi?",
      CALLBACK.HOST_STAGE_QUALIFIED + match.id
    ),
  ]);

  rows.push([
    Markup.button.callback(
      "⬅️ Matchlar ro'yxati",
      CALLBACK.HOST_STAGE_LIST + stageId
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// FINAL PAID SLOTS
// ============================================================
function finalSlotsKeyboard(stageId, status) {
  const rows = [];

  if (!status?.isFull) {
    rows.push([
      Markup.button.callback(
        "➕ Slot qo'shish (qo'lda)",
        'final:add:' + stageId
      ),
    ]);
  }

  if (status?.paidCount > 0) {
    rows.push([
      Markup.button.callback(
        '🗑 Slot olib tashlash',
        'final:remove:' + stageId
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('🔄 Yangilash', 'final:slots:' + stageId),
  ]);

  rows.push([
    Markup.button.callback('⬅️ Orqaga', CALLBACK.STAGE_VIEW + stageId),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  stageMenuKeyboard,
  stageListKeyboard,
  bracketSetupKeyboard,
  bracketConfirmKeyboard,
  stageViewKeyboard,
  teamDistributionKeyboard,
  matchesListKeyboard,
  matchActionsKeyboard,
  hostPickerKeyboard,
  promotionListKeyboard,
  promotionViewKeyboard,
  qualifiersCountKeyboard, // ⚡️ YANGI
  invitationKeyboard,
  myInvitationsKeyboard,
  hostStageMatchesKeyboard,
  hostStageMatchKeyboard,
  finalSlotsKeyboard, // ⚡️ YANGI
};