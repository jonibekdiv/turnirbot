// ============================================================
// PAYMENT SERVICE — To'lov tizimi
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { PAYMENT_STATUS } = require('../constants');

const FILE = 'payments.json';

// ============================================================
// YANGI TO'LOV YARATISH
// ============================================================
async function createPayment({
  tournamentId,
  teamId,
  captainId,
  organizerId,
  receiptFileId,
  receiptType,
  receiptCaption,
  amount,
  currency,
}) {
  // Bir komandaga bir turnir uchun faqat bitta aktiv payment
  const existing = await getActivePayment(tournamentId, teamId);
  if (existing) {
    throw new Error(
      "Bu komanda uchun aktiv to'lov mavjud. Avval uni yakunlang."
    );
  }

  const id = generateId('pay');
  const payment = {
    id,
    tournamentId,
    teamId,
    captainId,
    organizerId,
    receiptFileId: receiptFileId || null,
    receiptType: receiptType || null,
    receiptCaption: receiptCaption || '',
    amount: amount || null,
    currency: currency || null,
    status: PAYMENT_STATUS.PENDING,
    rejectReason: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };

  await store.update(FILE, (data) => {
    data[id] = payment;
    return payment;
  });
  return payment;
}

// ============================================================
// TO'LOVNI OLISH (ID bo'yicha)
// ============================================================
async function getPayment(paymentId) {
  const data = await store.read(FILE);
  return data[paymentId] || null;
}

// ============================================================
// TURNIR UCHUN BARCHA TO'LOVLAR
// ============================================================
async function getTournamentPayments(tournamentId) {
  const data = await store.read(FILE);
  return Object.values(data).filter((p) => p.tournamentId === tournamentId);
}

// ============================================================
// KOMPANDA UCHUN TO'LOVLAR
// ============================================================
async function getTeamPayments(tournamentId, teamId) {
  const data = await store.read(FILE);
  return Object.values(data).filter(
    (p) => p.tournamentId === tournamentId && p.teamId === teamId
  );
}

// ============================================================
// AKTIV TO'LOV (pending yoki approved)
// ============================================================
async function getActivePayment(tournamentId, teamId) {
  const all = await getTeamPayments(tournamentId, teamId);
  return (
    all.find(
      (p) =>
        p.status === PAYMENT_STATUS.PENDING ||
        p.status === PAYMENT_STATUS.APPROVED
    ) || null
  );
}

// ============================================================
// CAPTAIN UCHUN HAMMA TO'LOVLAR
// ============================================================
async function getCaptainPayments(captainId) {
  const data = await store.read(FILE);
  return Object.values(data)
    .filter((p) => p.captainId === Number(captainId))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

// ============================================================
// ORGANIZER UCHUN TO'LOVLAR
// ============================================================
async function getOrganizerPayments(organizerId, status = null) {
  const data = await store.read(FILE);
  let list = Object.values(data).filter(
    (p) => p.organizerId === Number(organizerId)
  );
  if (status) {
    list = list.filter((p) => p.status === status);
  }
  return list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

// ============================================================
// BARCHA TO'LOVLAR (Admin uchun)
// ============================================================
async function getAllPayments(status = null) {
  const data = await store.read(FILE);
  let list = Object.values(data);
  if (status) {
    list = list.filter((p) => p.status === status);
  }
  return list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

// ============================================================
// TO'LOVNI TASDIQLASH
// ============================================================
async function approvePayment(paymentId, reviewerId) {
  return store.update(FILE, (data) => {
    const p = data[paymentId];
    if (!p) throw new Error("To'lov topilmadi");
    if (p.status !== PAYMENT_STATUS.PENDING) {
      throw new Error("Bu to'lov allaqachon ko'rib chiqilgan");
    }
    p.status = PAYMENT_STATUS.APPROVED;
    p.reviewedAt = new Date().toISOString();
    p.reviewedBy = Number(reviewerId);
    return p;
  });
}

// ============================================================
// TO'LOVNI RAD ETISH
// ============================================================
async function rejectPayment(paymentId, reviewerId, reason) {
  return store.update(FILE, (data) => {
    const p = data[paymentId];
    if (!p) throw new Error("To'lov topilmadi");
    if (p.status !== PAYMENT_STATUS.PENDING) {
      throw new Error("Bu to'lov allaqachon ko'rib chiqilgan");
    }
    p.status = PAYMENT_STATUS.REJECTED;
    p.rejectReason = reason || 'Sababsiz';
    p.reviewedAt = new Date().toISOString();
    p.reviewedBy = Number(reviewerId);
    return p;
  });
}

// ============================================================
// TO'LOVNI BEKOR QILISH
// ============================================================
async function cancelPayment(paymentId) {
  return store.update(FILE, (data) => {
    const p = data[paymentId];
    if (!p) return null;
    if (p.status !== PAYMENT_STATUS.PENDING) return p;
    p.status = PAYMENT_STATUS.CANCELLED;
    p.reviewedAt = new Date().toISOString();
    return p;
  });
}

// ============================================================
// CHEK YANGILASH (rad etilgandan keyin qayta yuborish)
// ============================================================
async function resendReceipt(paymentId, {
  receiptFileId,
  receiptType,
  receiptCaption,
}) {
  return store.update(FILE, (data) => {
    const p = data[paymentId];
    if (!p) throw new Error("To'lov topilmadi");
    if (p.status !== PAYMENT_STATUS.REJECTED) {
      throw new Error("Faqat rad etilgan to'lovni qayta yuborish mumkin");
    }
    p.receiptFileId = receiptFileId;
    p.receiptType = receiptType;
    p.receiptCaption = receiptCaption || '';
    p.status = PAYMENT_STATUS.PENDING;
    p.rejectReason = null;
    p.submittedAt = new Date().toISOString();
    p.reviewedAt = null;
    p.reviewedBy = null;
    return p;
  });
}

// ============================================================
// TURNIR UCHUN STATISTIKA
// ============================================================
async function getTournamentStats(tournamentId) {
  const all = await getTournamentPayments(tournamentId);
  return {
    total: all.length,
    pending: all.filter((p) => p.status === PAYMENT_STATUS.PENDING).length,
    approved: all.filter((p) => p.status === PAYMENT_STATUS.APPROVED).length,
    rejected: all.filter((p) => p.status === PAYMENT_STATUS.REJECTED).length,
    cancelled: all.filter((p) => p.status === PAYMENT_STATUS.CANCELLED).length,
  };
}

module.exports = {
  createPayment,
  getPayment,
  getTournamentPayments,
  getTeamPayments,
  getActivePayment,
  getCaptainPayments,
  getOrganizerPayments,
  getAllPayments,
  approvePayment,
  rejectPayment,
  cancelPayment,
  resendReceipt,
  getTournamentStats,
};