// ============================================================
// INVITATION IMAGE GENERATOR — Taklifnoma PNG
// ============================================================
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');

// ============================================================
// VAQTINCHALIK PAPKA
// ============================================================
const TMP_DIR = path.join(os.tmpdir(), 'pubg-invitations');

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

// ============================================================
// RANGLAR
// ============================================================
const COLORS = {
  bgDark: '#0f1218',
  bgCard: '#1a1f2a',
  bgAccent: '#252d3d',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  accent: '#00d4ff',
  accentPurple: '#8b5cf6',
  textPrimary: '#ffffff',
  textSecondary: '#a0a8b8',
  textMuted: '#6a7180',
  divider: '#2a2f3a',
  success: '#22c55e',
};

// ============================================================
// ASOSIY GENERATOR
// ============================================================
async function generateInvitationImage({
  tournament,
  team,
  fromStage,
  toStage,
  match,
  invitation,
  stageType,
  rank = 1,
}) {
  ensureTmpDir();

  const width = 800;
  const height = 1100;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ---------- Fon ----------
  drawBackground(ctx, width, height);

  // ---------- Yuqori banner ----------
  drawTopBanner(ctx, width, { rank, stageType });

  // ---------- Tabrik ----------
  drawCongrats(ctx, width, 250, tournament, fromStage, toStage);

  // ---------- Komanda ----------
  drawTeamCard(ctx, width, 420, team, rank);

  // ---------- Keyingi etap ----------
  drawNextStageInfo(ctx, width, 620, toStage, match);

  // ---------- Room info ----------
  drawRoomInfo(ctx, width, 800, invitation, match);

  // ---------- Invitation code ----------
  drawInvitationCode(ctx, width, 970, invitation.invitationCode);

  // ---------- Footer ----------
  drawFooter(ctx, width, height);

  // ---------- Saqlash ----------
  const fileName = `inv_${invitation.id}_${Date.now()}.png`;
  const filePath = path.join(TMP_DIR, fileName);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);

  // 30 daqiqadan keyin o'chirish
  setTimeout(() => {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  }, 30 * 60 * 1000);

  return filePath;
}

// ============================================================
// FON
// ============================================================
function drawBackground(ctx, width, height) {
  // Asosiy gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0a0e14');
  grad.addColorStop(0.5, '#141922');
  grad.addColorStop(1, '#0a0e14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Diagonal chiziqlar
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let i = -width; i < height + width; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  // Radial accents
  const accent1 = ctx.createRadialGradient(0, 200, 0, 0, 200, 500);
  accent1.addColorStop(0, 'rgba(255, 215, 0, 0.1)');
  accent1.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.fillStyle = accent1;
  ctx.fillRect(0, 0, width, 600);

  const accent2 = ctx.createRadialGradient(
    width,
    height - 200,
    0,
    width,
    height - 200,
    500
  );
  accent2.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
  accent2.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = accent2;
  ctx.fillRect(0, height - 600, width, 600);
}

// ============================================================
// YUQORI BANNER
// ============================================================
function drawTopBanner(ctx, width, { rank, stageType }) {
  // Ramka
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  roundRect(ctx, 30, 30, width - 60, 90, 15);
  ctx.stroke();

  // Matn
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('🏆 TABRIKLAYMIZ!', width / 2, 75);

  // Rank badge
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`${rankEmoji} ${rank}-O'RIN`, width / 2, 145);
}

// ============================================================
// TABRIK
// ============================================================
function drawCongrats(ctx, width, y, tournament, fromStage, toStage) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  const title = tournament?.title || 'PUBG Turnir';
  ctx.fillText(title.slice(0, 35), width / 2, y);

  ctx.font = '18px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  const from = fromStage?.name || '1/4 Final';
  const to = toStage?.name || '1/2 Final';
  ctx.fillText(`Siz "${from}" dan "${to}"ga o'tdingiz!`, width / 2, y + 40);

  // Accent chiziq
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 60, y + 70);
  ctx.lineTo(width / 2 + 60, y + 70);
  ctx.stroke();
}

// ============================================================
// KOMANDA KARTASI
// ============================================================
function drawTeamCard(ctx, width, y, team, rank) {
  const cardX = 60;
  const cardW = width - 120;
  const cardH = 140;

  // Karta foni
  const grad = ctx.createLinearGradient(cardX, y, cardX + cardW, y + cardH);
  grad.addColorStop(0, COLORS.bgCard);
  grad.addColorStop(1, COLORS.bgAccent);
  ctx.fillStyle = grad;
  roundRect(ctx, cardX, y, cardW, cardH, 15);
  ctx.fill();

  // Ramka
  const rankColor =
    rank === 1 ? COLORS.gold : rank === 2 ? COLORS.silver : COLORS.bronze;
  ctx.strokeStyle = rankColor;
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, y, cardW, cardH, 15);
  ctx.stroke();

  // Komanda nomi
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  const name = (team?.name || 'Team').slice(0, 25);
  ctx.fillText(name, width / 2, y + 55);

  // Teg
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillStyle = COLORS.accent;
  const tag = team?.tag || 'TEAM';
  ctx.fillText(`[${tag}]`, width / 2, y + 100);
}

// ============================================================
// KEYINGI ETAP
// ============================================================
function drawNextStageInfo(ctx, width, y, toStage, match) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '20px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('KEYINGI ETAP', width / 2, y);

  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(toStage?.name || '1/2 Final', width / 2, y + 45);

  // Sana / Vaqt / Match
  ctx.font = '20px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;

  const date = toStage?.date || '-';
  const time = toStage?.startTime || '-';
  ctx.fillText(`📅 ${date}  |  ⏰ ${time}`, width / 2, y + 90);

  if (match) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(
      `🎮 Kun ${match.dayNumber} — Match #${match.matchNumber}`,
      width / 2,
      y + 125
    );
  }
}

// ============================================================
// ROOM INFO
// ============================================================
function drawRoomInfo(ctx, width, y, invitation, match) {
  const cardX = 60;
  const cardW = width - 120;
  const cardH = 130;

  // Fon
  ctx.fillStyle = COLORS.bgCard;
  roundRect(ctx, cardX, y, cardW, cardH, 15);
  ctx.fill();

  // Ramka
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, y, cardW, cardH, 15);
  ctx.stroke();

  // Sarlavha
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('ROOM MA\'LUMOTLARI', width / 2, y + 25);

  // Room ID va Password
  const roomId = invitation?.roomId || match?.roomId || '—';
  const roomPass = invitation?.roomPassword || match?.roomPassword || '—';

  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`🆔 ${roomId}`, width / 2 - 100, y + 70);

  ctx.fillText(`🔒 ${roomPass}`, width / 2 + 100, y + 70);

  // Label
  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText('Room ID', width / 2 - 100, y + 100);
  ctx.fillText('Parol', width / 2 + 100, y + 100);
}

// ============================================================
// INVITATION CODE
// ============================================================
function drawInvitationCode(ctx, width, y, code) {
  const cardX = 150;
  const cardW = width - 300;
  const cardH = 90;

  // Fon — gradient gold
  const grad = ctx.createLinearGradient(cardX, y, cardX + cardW, y + cardH);
  grad.addColorStop(0, '#ffd700');
  grad.addColorStop(1, '#ff9500');
  ctx.fillStyle = grad;
  roundRect(ctx, cardX, y, cardW, cardH, 12);
  ctx.fill();

  // Sarlavha
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('INVITATION CODE', width / 2, y + 25);

  // Kod
  ctx.font = 'bold 42px "Courier New", monospace';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(code || 'XXXXXXXX', width / 2, y + 62);
}

// ============================================================
// FOOTER
// ============================================================
function drawFooter(ctx, width, height) {
  const y = height - 60;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Divider
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, y - 20);
  ctx.lineTo(width - 60, y - 20);
  ctx.stroke();

  // Bot username
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('PRESENTED BY', width / 2, y);

  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillStyle = COLORS.accent;
  const username = config.BOT_USERNAME || 'EsportArenaBot';
  ctx.fillText(`@${username.replace('@', '')}`, width / 2, y + 28);
}

// ============================================================
// YORDAMCHI: RoundRect
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
// TOZALASH
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
        if (now - stat.mtimeMs > 60 * 60 * 1000) {
          fs.unlinkSync(fp);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  generateInvitationImage,
  cleanupOldImages,
};