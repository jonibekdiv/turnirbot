// ============================================================
// SUPPORT SERVICE — Murojaatlar (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const FILE = 'support_tickets.json';

// ============================================================
// TYPES (faqat kalitlar)
// ============================================================
const TYPES = {
  bug: { id: 'bug', emoji: '🐛', key: 'support_type_bug' },
  payment: { id: 'payment', emoji: '💳', key: 'support_type_payment' },
  team: { id: 'team', emoji: '👥', key: 'support_type_team' },
  tournament: { id: 'tournament', emoji: '🏆', key: 'support_type_tournament' },
  complaint: { id: 'complaint', emoji: '🚫', key: 'support_type_complaint' },
  other: { id: 'other', emoji: '❓', key: 'support_type_other' },
};

const STATUS = {
  NEW: 'new',
  VIEWED: 'viewed',
  ANSWERED: 'answered',
  CLOSED: 'closed',
  REJECTED: 'rejected',
};

// ============================================================
// YANGI MUROJAAT
// ============================================================
async function createTicket({
  userId,
  username,
  type,
  text,
  attachmentFileId,
  attachmentType,
}) {
  return store.update(FILE, (data) => {
    const now = new Date();

    const userTickets = Object.values(data).filter(
      (t) => Number(t.userId) === Number(userId)
    );

    if (userTickets.length > 0) {
      const last = userTickets.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];
      const diffMin = (now - new Date(last.createdAt)) / 60000;
      if (diffMin < LIMITS.SUPPORT_COOLDOWN_MIN) {
        throw new Error(
          `Iltimos, ${Math.ceil(
            LIMITS.SUPPORT_COOLDOWN_MIN - diffMin
          )} daqiqadan keyin yuboring`
        );
      }
    }

    const active = userTickets.filter(
      (t) => t.status === STATUS.NEW || t.status === STATUS.VIEWED
    );
    if (active.length >= LIMITS.SUPPORT_MAX_ACTIVE) {
      throw new Error(
        `Sizda ${LIMITS.SUPPORT_MAX_ACTIVE} ta faol murojaat bor.`
      );
    }

    const id = generateId('sup');
    const ticketNumber = Object.keys(data).length + 1001;

    const ticket = {
      id,
      number: ticketNumber,
      userId: Number(userId),
      username: username || null,
      type,
      text,
      attachmentFileId: attachmentFileId || null,
      attachmentType: attachmentType || null,
      status: STATUS.NEW,
      createdAt: now.toISOString(),
      viewedAt: null,
      answeredAt: null,
      closedAt: null,
      answeredBy: null,
      reply: null,
    };

    data[id] = ticket;
    return ticket;
  });
}

// ============================================================
// GET
// ============================================================
async function getTicket(id) {
  const data = await store.read(FILE);
  return data[id] || null;
}

async function getUserTickets(userId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((t) => Number(t.userId) === Number(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getTicketsByStatus(status) {
  const data = await store.read(FILE);
  const list = Object.values(data);

  if (status === 'active') {
    return list
      .filter((t) => t.status === STATUS.NEW || t.status === STATUS.VIEWED)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  if (status === 'closed') {
    return list
      .filter(
        (t) => t.status === STATUS.CLOSED || t.status === STATUS.REJECTED
      )
      .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  }
  return list
    .filter((t) => t.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ============================================================
// STATISTIKA
// ============================================================
async function getStats() {
  const data = await store.read(FILE);
  const all = Object.values(data);
  const answered = all.filter((t) => t.answeredAt);

  let avgResponseMs = 0;
  if (answered.length) {
    const total = answered.reduce(
      (s, t) => s + (new Date(t.answeredAt) - new Date(t.createdAt)),
      0
    );
    avgResponseMs = total / answered.length;
  }

  return {
    total: all.length,
    new: all.filter((t) => t.status === STATUS.NEW).length,
    viewed: all.filter((t) => t.status === STATUS.VIEWED).length,
    answered: all.filter((t) => t.status === STATUS.ANSWERED).length,
    closed: all.filter((t) => t.status === STATUS.CLOSED).length,
    rejected: all.filter((t) => t.status === STATUS.REJECTED).length,
    avgResponseHours: (avgResponseMs / 3600000).toFixed(1),
  };
}

// ============================================================
// HOLATNI YANGILASH
// ============================================================
async function markViewed(id) {
  return store.update(FILE, (data) => {
    const t = data[id];
    if (!t) return null;
    if (t.status === STATUS.NEW) {
      t.status = STATUS.VIEWED;
      t.viewedAt = new Date().toISOString();
    }
    return t;
  });
}

async function answerTicket(id, adminId, reply) {
  return store.update(FILE, (data) => {
    const t = data[id];
    if (!t) return null;
    t.reply = reply;
    t.answeredBy = Number(adminId);
    t.answeredAt = new Date().toISOString();
    t.status = STATUS.ANSWERED;
    return t;
  });
}

async function closeTicket(id) {
  return store.update(FILE, (data) => {
    const t = data[id];
    if (!t) return null;
    t.status = STATUS.CLOSED;
    t.closedAt = new Date().toISOString();
    return t;
  });
}

async function rejectTicket(id, reason) {
  return store.update(FILE, (data) => {
    const t = data[id];
    if (!t) return null;
    t.status = STATUS.REJECTED;
    t.reply = reason || 'Asossiz';
    t.closedAt = new Date().toISOString();
    return t;
  });
}

// ============================================================
// HELPERS (3 tilda)
// ============================================================
function statusEmoji(status) {
  const map = {
    new: '🔔',
    viewed: '👁',
    answered: '💬',
    closed: '✅',
    rejected: '❌',
  };
  return map[status] || '•';
}

function statusName(status, t) {
  if (typeof t !== 'function') t = (k) => k;

  const keyMap = {
    new: 'support_status_new_short',
    viewed: 'support_status_viewed_short',
    answered: 'support_status_answered_short',
    closed: 'support_status_closed_short',
    rejected: 'support_status_rejected_short',
  };

  return t(keyMap[status]) || status;
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  TYPES,
  STATUS,
  createTicket,
  getTicket,
  getUserTickets,
  getTicketsByStatus,
  getStats,
  markViewed,
  answerTicket,
  closeTicket,
  rejectTicket,
  statusEmoji,
  statusName,
};