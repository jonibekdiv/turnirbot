// ============================================================
// WALLET SERVICE — Hamyon tizimi (3 tilda)
// ============================================================
const store = require('../storage/jsonStore');
const { generateId } = require('../utils/idGenerator');
const { LIMITS } = require('../constants');

const WALLET_FILE = 'wallets.json';
const TX_FILE = 'transactions.json';
const REQ_FILE = 'wallet_requests.json';

// ============================================================
// WALLET OLISH / YARATISH
// ============================================================
async function getOrCreate(userId) {
  return store.update(WALLET_FILE, (data) => {
    const key = String(userId);
    if (!data[key]) {
      data[key] = {
        userId: Number(userId),
        balance: 0,
        totalIn: 0,
        totalOut: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return data[key];
  });
}

async function getWallet(userId) {
  const data = await store.read(WALLET_FILE);
  return data[String(userId)] || null;
}

async function getAllWallets() {
  const data = await store.read(WALLET_FILE);
  return Object.values(data).sort((a, b) => b.balance - a.balance);
}

// ============================================================
// TRANZAKSIYA
// ============================================================
async function addTransaction({
  userId,
  type,
  amount,
  balanceBefore,
  balanceAfter,
  reason,
  adminId,
  relatedId,
}) {
  return store.update(TX_FILE, (data) => {
    if (!data.transactions) data.transactions = [];
    const tx = {
      id: generateId('tx'),
      userId: Number(userId),
      type,
      amount: Number(amount),
      balanceBefore,
      balanceAfter,
      reason: reason || null,
      adminId: adminId ? Number(adminId) : null,
      relatedId: relatedId || null,
      at: new Date().toISOString(),
    };
    data.transactions.push(tx);
    if (data.transactions.length > 5000) {
      data.transactions = data.transactions.slice(-5000);
    }
    return tx;
  });
}

// ============================================================
// BALANSNI O'ZGARTIRISH
// ============================================================
async function adjustBalance(userId, amount, type, reason, adminId, relatedId) {
  const result = await store.update(WALLET_FILE, (data) => {
    const key = String(userId);
    if (!data[key]) {
      data[key] = {
        userId: Number(userId),
        balance: 0,
        totalIn: 0,
        totalOut: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const before = data[key].balance;
    const after = before + Number(amount);

    if (after < 0) throw new Error("Balans manfiy bo'lishi mumkin emas");

    data[key].balance = after;
    if (amount > 0) data[key].totalIn += Number(amount);
    else data[key].totalOut += Math.abs(Number(amount));
    data[key].updatedAt = new Date().toISOString();

    return { wallet: data[key], before, after };
  });

  await addTransaction({
    userId,
    type,
    amount,
    balanceBefore: result.before,
    balanceAfter: result.after,
    reason,
    adminId,
    relatedId,
  });

  return result.wallet;
}

// ============================================================
// TRANZAKSIYALAR RO'YXATI
// ============================================================
async function getUserTransactions(userId, limit = 20, offset = 0) {
  const data = await store.read(TX_FILE);
  const all = (data.transactions || [])
    .filter((t) => Number(t.userId) === Number(userId))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  return {
    total: all.length,
    transactions: all.slice(offset, offset + limit),
  };
}

async function getAllTransactions(limit = 50) {
  const data = await store.read(TX_FILE);
  return (data.transactions || [])
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

// ============================================================
// DEPOSIT SO'ROVI
// ============================================================
async function createDepositRequest({
  userId,
  username,
  amount,
  proofFileId,
  proofType,
  note,
}) {
  return store.update(REQ_FILE, (data) => {
    if (!data.requests) data.requests = {};

    const active = Object.values(data.requests).find(
      (r) =>
        Number(r.userId) === Number(userId) &&
        r.type === 'deposit' &&
        r.status === 'pending'
    );
    if (active) throw new Error("Sizda allaqachon faol deposit so'rovi bor");

    const id = generateId('wreq');
    const req = {
      id,
      userId: Number(userId),
      username: username || null,
      type: 'deposit',
      amount: Number(amount),
      proofFileId: proofFileId || null,
      proofType: proofType || null,
      note: note || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      rejectReason: null,
    };

    data.requests[id] = req;
    return req;
  });
}

// ============================================================
// WITHDRAW SO'ROVI
// ============================================================
async function createWithdrawRequest({
  userId,
  username,
  amount,
  cardNumber,
  cardOwner,
}) {
  return store.update(REQ_FILE, (data) => {
    if (!data.requests) data.requests = {};

    const active = Object.values(data.requests).find(
      (r) =>
        Number(r.userId) === Number(userId) &&
        r.type === 'withdraw' &&
        r.status === 'pending'
    );
    if (active) throw new Error("Sizda allaqachon faol withdraw so'rovi bor");

    const id = generateId('wreq');
    const req = {
      id,
      userId: Number(userId),
      username: username || null,
      type: 'withdraw',
      amount: Number(amount),
      cardNumber,
      cardOwner,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      rejectReason: null,
    };

    data.requests[id] = req;
    return req;
  });
}

// ============================================================
// SO'ROVLAR GET
// ============================================================
async function getRequests(status = 'pending', type = null) {
  const data = await store.read(REQ_FILE);
  const list = Object.values(data.requests || {});
  return list
    .filter((r) => r.status === status && (!type || r.type === type))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getRequest(id) {
  const data = await store.read(REQ_FILE);
  return data.requests?.[id] || null;
}

async function getUserRequests(userId) {
  const data = await store.read(REQ_FILE);
  return Object.values(data.requests || {})
    .filter((r) => Number(r.userId) === Number(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ============================================================
// TASDIQLASH / RAD ETISH
// ============================================================
async function approveDeposit(requestId, adminId) {
  const req = await getRequest(requestId);
  if (!req) throw new Error('Request topilmadi');
  if (req.status !== 'pending') throw new Error("Allaqachon ko'rilgan");

  await adjustBalance(req.userId, req.amount, 'deposit', 'Admin tasdiqladi', adminId, requestId);

  return store.update(REQ_FILE, (data) => {
    const r = data.requests[requestId];
    r.status = 'approved';
    r.reviewedAt = new Date().toISOString();
    r.reviewedBy = Number(adminId);
    return r;
  });
}

async function approveWithdraw(requestId, adminId) {
  const req = await getRequest(requestId);
  if (!req) throw new Error('Request topilmadi');
  if (req.status !== 'pending') throw new Error("Allaqachon ko'rilgan");

  const wallet = await getWallet(req.userId);
  if (!wallet || wallet.balance < req.amount) {
    throw new Error('Foydalanuvchi balansi yetarli emas');
  }

  await adjustBalance(req.userId, -req.amount, 'withdraw', "Admin to'lovni tasdiqladi", adminId, requestId);

  return store.update(REQ_FILE, (data) => {
    const r = data.requests[requestId];
    r.status = 'approved';
    r.reviewedAt = new Date().toISOString();
    r.reviewedBy = Number(adminId);
    return r;
  });
}

async function rejectRequest(requestId, adminId, reason) {
  return store.update(REQ_FILE, (data) => {
    const r = data.requests[requestId];
    if (!r) return null;
    if (r.status !== 'pending') return r;
    r.status = 'rejected';
    r.rejectReason = reason || 'Sababsiz';
    r.reviewedAt = new Date().toISOString();
    r.reviewedBy = Number(adminId);
    return r;
  });
}

// ============================================================
// STATISTIKA
// ============================================================
async function getStats() {
  const wallets = await store.read(WALLET_FILE);
  const reqs = await store.read(REQ_FILE);

  const all = Object.values(wallets);
  const requests = Object.values(reqs.requests || {});

  return {
    totalUsers: all.length,
    totalBalance: all.reduce((s, w) => s + (w.balance || 0), 0),
    totalIn: all.reduce((s, w) => s + (w.totalIn || 0), 0),
    totalOut: all.reduce((s, w) => s + (w.totalOut || 0), 0),
    pendingDeposits: requests.filter(
      (r) => r.status === 'pending' && r.type === 'deposit'
    ).length,
    pendingWithdraws: requests.filter(
      (r) => r.status === 'pending' && r.type === 'withdraw'
    ).length,
  };
}

// ============================================================
// FORMAT (3 tilda)
// ============================================================
function formatAmount(n) {
  return Number(n || 0).toLocaleString('uz-UZ').replace(/,/g, ' ');
}

function txTypeLabel(type, t) {
  if (typeof t !== 'function') t = (k) => k;

  const keyMap = {
    deposit: 'wallet_deposit_type',
    withdraw: 'wallet_withdraw_type',
    admin_add: 'wallet_admin_add_example',
    admin_sub: 'wallet_admin_sub_example',
    tournament_win: 'promotion_stat_promoted',
    tournament_pay: 'wallet_pay_to_pay',
    refund: 'btn_retry',
  };

  return t(keyMap[type]) || type;
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  getOrCreate,
  getWallet,
  getAllWallets,
  adjustBalance,
  addTransaction,
  getUserTransactions,
  getAllTransactions,
  createDepositRequest,
  createWithdrawRequest,
  getRequests,
  getRequest,
  getUserRequests,
  approveDeposit,
  approveWithdraw,
  rejectRequest,
  getStats,
  formatAmount,
  txTypeLabel,
};