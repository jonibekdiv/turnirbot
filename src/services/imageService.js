// ============================================================
// IMAGE SERVICE — Standings jadvalini PNG formatda yaratish
// ============================================================
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const os = require('os');


// Vaqtinchalik fayllar papkasi
const TMP_DIR = path.join(os.tmpdir(), 'pubg-bot-images');

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

// ============================================================
// RANGLAR PALITRASI (rasmdagidek dark theme)
// ============================================================
const COLORS = {
  bgDark: '#1a1d24',
  bgCard: '#252932',
  bgRow: '#2a2f3a',
  bgRowAlt: '#2e3440',
  bgHeader: '#1f2329',
  textPrimary: '#ffffff',
  textSecondary: '#a0a8b8',
  textMuted: '#6a7180',
  accent: '#00d4ff',
  accentGold: '#ffd700',
  accentSilver: '#c0c0c0',
  accentBronze: '#cd7f32',
  divider: '#3a4050',
  top1Bg: '#3d3a2a',
  top2Bg: '#333740',
  top3Bg: '#3a3228',
};

// ============================================================
// ASOSIY FUNKSIYA — Standings PNG yaratish
// ============================================================
async function generateStandingsImage(tournament, standings) {
  ensureTmpDir();

  // O'lchamlar
  const width = 1000;
  const rowHeight = 60;
  const headerHeight = 80;
  const titleBlockHeight = 220;
  const footerHeight = 120;
  const padding = 40;
  const maxRows = Math.max(18, standings.length);
  const height = titleBlockHeight + headerHeight + maxRows * rowHeight + footerHeight + 80;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ---------- Fon ----------
  drawBackground(ctx, width, height);

  // ---------- Sarlavha ----------
  drawTitle(ctx, width, tournament, titleBlockHeight);

  // ---------- Jadval ----------
  const tableX = padding + 20;
  const tableY = titleBlockHeight;
  const tableWidth = width - (padding + 20) * 2;

  drawTable(ctx, {
    x: tableX,
    y: tableY,
    width: tableWidth,
    headerHeight,
    rowHeight,
    maxRows,
    standings,
  });

  // ---------- Footer ----------
  drawFooter(ctx, width, height, footerHeight);

  // ---------- Faylni saqlash ----------
  const fileName = `standings_${tournament.id}_${Date.now()}.png`;
  const filePath = path.join(TMP_DIR, fileName);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);

  // 10 daqiqadan keyin avtomatik o'chirish
  setTimeout(() => {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }, 10 * 60 * 1000);

  return filePath;
}

// ============================================================
// FON RASMI
// ============================================================
function drawBackground(ctx, width, height) {
  // Asosiy gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1d24');
  gradient.addColorStop(0.5, '#1f242d');
  gradient.addColorStop(1, '#161a21');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Diagonal chiziqlar (dekorativ)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
  ctx.lineWidth = 1;
  for (let i = -width; i < height + width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  // Yuqori o'ng burchak accent
  const accent = ctx.createRadialGradient(width - 100, 100, 0, width - 100, 100, 400);
  accent.addColorStop(0, 'rgba(0, 212, 255, 0.08)');
  accent.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 400);
}

// ============================================================
// SARLAVHA
// ============================================================
function drawTitle(ctx, width, tournament, blockHeight) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Asosiy sarlavha
  const title = (tournament.title || 'TOURNAMENT').toUpperCase();
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(title.slice(0, 30), width / 2, 100);

  // "OVERALL STANDINGS" subtitle
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('O V E R A L L   S T A N D I N G S', width / 2, 160);

  // Accent chiziq
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 50, 190);
  ctx.lineTo(width / 2 + 50, 190);
  ctx.stroke();

  // Etap / sana (agar mavjud bo'lsa)
  if (tournament.etapa || tournament.date) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    const info = [
      tournament.etapa ? `Etap: ${tournament.etapa}` : null,
      tournament.date ? tournament.date : null,
    ].filter(Boolean).join('  •  ');
    ctx.fillText(info, width / 2, blockHeight - 10);
  }
}

// ============================================================
// JADVAL
// ============================================================
function drawTable(ctx, opts) {
  const { x, y, width, headerHeight, rowHeight, maxRows, standings } = opts;

  // Ustun kengliklari (foizda)
  const columns = [
    { key: 'pos', label: 'POS', width: 0.08, align: 'center' },
    { key: 'name', label: 'TEAM NAME', width: 0.40, align: 'left' },
    { key: 'mp', label: 'MP', width: 0.10, align: 'center' },
    { key: 'cd', label: 'CD', width: 0.10, align: 'center' },
    { key: 'pp', label: 'PP', width: 0.10, align: 'center' },
    { key: 'kp', label: 'KP', width: 0.10, align: 'center' },
    { key: 'tt', label: 'TT', width: 0.12, align: 'center' },
  ];

  // Ustun koordinatalarini hisoblash
  let accX = x;
  columns.forEach((c) => {
    c.x = accX;
    c.absWidth = width * c.width;
    accX += c.absWidth;
  });

  // ---------- Header fon ----------
  ctx.fillStyle = COLORS.bgHeader;
  roundRect(ctx, x, y, width, headerHeight, 12);
  ctx.fill();

  // ---------- Header text ----------
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.textBaseline = 'middle';

  columns.forEach((c) => {
    if (c.align === 'left') {
      ctx.textAlign = 'left';
      ctx.fillText(c.label, c.x + 25, y + headerHeight / 2);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(c.label, c.x + c.absWidth / 2, y + headerHeight / 2);
    }
  });

  // ---------- Rows ----------
  let rowY = y + headerHeight;

  for (let i = 0; i < maxRows; i++) {
    const s = standings[i];

    // Fon rangi
    let bgColor = i % 2 === 0 ? COLORS.bgRow : COLORS.bgRowAlt;
    if (i === 0) bgColor = COLORS.top1Bg;
    else if (i === 1) bgColor = COLORS.top2Bg;
    else if (i === 2) bgColor = COLORS.top3Bg;

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, rowY, width, rowHeight);

    // Ajratuvchi chiziq
    ctx.strokeStyle = COLORS.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, rowY + rowHeight);
    ctx.lineTo(x + width, rowY + rowHeight);
    ctx.stroke();

    // Ma'lumot yo'q — bo'sh qator
    if (!s) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('•', x + width / 2, rowY + rowHeight / 2);
      rowY += rowHeight;
      continue;
    }

    // ---------- POS ----------
    const posStr = String(i + 1).padStart(2, '0');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // POS rangi (top 3 uchun)
    if (i === 0) ctx.fillStyle = COLORS.accentGold;
    else if (i === 1) ctx.fillStyle = COLORS.accentSilver;
    else if (i === 2) ctx.fillStyle = COLORS.accentBronze;
    else ctx.fillStyle = COLORS.textPrimary;

    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(posStr, columns[0].x + columns[0].absWidth / 2, rowY + rowHeight / 2);

    // ---------- TEAM NAME ----------
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 18px Arial, sans-serif';

    // Nomni qisqartirish
    let name = s.name || 'Unknown';
    if (name.length > 22) name = name.slice(0, 21) + '…';

    ctx.fillText(name, columns[1].x + 25, rowY + rowHeight / 2);

    // ---------- MP (Matches Played) ----------
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '16px Arial, sans-serif';
    const mp = String(s.matches || 0).padStart(2, '0');
    ctx.fillText(mp, columns[2].x + columns[2].absWidth / 2, rowY + rowHeight / 2);

    // ---------- CD (Chicken Dinners = wins) ----------
    ctx.fillStyle = s.wins > 0 ? COLORS.accentGold : COLORS.textSecondary;
    const cd = s.wins > 0 ? `x${s.wins}` : String(s.wins || 0).padStart(2, '0');
    ctx.fillText(cd, columns[3].x + columns[3].absWidth / 2, rowY + rowHeight / 2);

    // ---------- PP (Placement Points) ----------
    ctx.fillStyle = COLORS.textSecondary;
    const pp = String(s.totalPlacementPoints || 0).padStart(2, '0');
    ctx.fillText(pp, columns[4].x + columns[4].absWidth / 2, rowY + rowHeight / 2);

    // ---------- KP (Kill Points) ----------
    ctx.fillStyle = COLORS.textSecondary;
    const kp = String(s.totalKills || 0).padStart(2, '0');
    ctx.fillText(kp, columns[5].x + columns[5].absWidth / 2, rowY + rowHeight / 2);

    // ---------- TT (Total) ----------
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 20px Arial, sans-serif';
    const tt = String(s.totalPoints || 0).padStart(2, '0');
    ctx.fillText(tt, columns[6].x + columns[6].absWidth / 2, rowY + rowHeight / 2);

    rowY += rowHeight;
  }

  // ---------- Jadval tashqi ramkasi ----------
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, headerHeight + maxRows * rowHeight, 12);
  ctx.stroke();
}

// ============================================================
// FOOTER
// ============================================================
function drawFooter(ctx, width, height, footerHeight) {
  const y = height - footerHeight + 20;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, y - 15);
  ctx.lineTo(width - 60, y - 15);
  ctx.stroke();

  // "PRESENTED BY"
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText('P R E S E N T E D   B Y', width / 2, y + 10);

  // Bot username
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  const config = require('../config');
  ctx.fillText(`@${config.BOT_USERNAME || 'EsportArenaBot'}`, width / 2, y + 50);
}

// ============================================================
// YORDAMCHI: RoundRectangle
// ============================================================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// YORDAMCHI: Vaqtinchalik fayllarni tozalash
// ============================================================
function cleanupOldImages() {
  try {
    if (!fs.existsSync(TMP_DIR)) return;
    const files = fs.readdirSync(TMP_DIR);
    const now = Date.now();
    files.forEach((f) => {
      const fp = path.join(TMP_DIR, f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > 30 * 60 * 1000) {
          fs.unlinkSync(fp);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

module.exports = {
  generateStandingsImage,
  cleanupOldImages,
};