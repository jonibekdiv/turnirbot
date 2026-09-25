// ============================================================
// GEMINI SERVICE — Skrinshotdan natija o'qish (AI Vision)
// ============================================================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const TMP_DIR = path.join(os.tmpdir(), 'pubg-gemini');

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ============================================================
// API KALITNI TEKSHIRISH
// ============================================================
const API_KEY = process.env.GEMINI_API_KEY || '';

let genAI = null;
let model = null;

if (API_KEY) {
  try {
   model = genAI.getGenerativeModel(
  {
    model: 'gemini-3.8-flash',
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  },
  { apiVersion: 'v1beta' } // <-- MUHIM: API versiyasini majburiy belgilash
);
    console.log('✅ Gemini xizmati ishga tushdi');
  } catch (e) {
    console.log('⚠️ Gemini ishga tushmadi:', e.message);
  }
} else {
  console.log('⚠️ GEMINI_API_KEY .env da ko\'rsatilmagan');
}

// ============================================================
// 1. RASMNI YUKLAB OLISH
// ============================================================
async function downloadTelegramPhoto(bot, fileId) {
  ensureTmp();
  const link = await bot.telegram.getFileLink(fileId);
  const fileName = `gemini_${Date.now()}.jpg`;
  const filePath = path.join(TMP_DIR, fileName);

  await new Promise((resolve, reject) => {
    https
      .get(link.href, (res) => {
        const ws = fs.createWriteStream(filePath);
        res.pipe(ws);
        ws.on('finish', () => ws.close(resolve));
        ws.on('error', reject);
      })
      .on('error', reject);
  });

  return filePath;
}

// ============================================================
// 2. RASMNI BASE64 FORMATGA O'TKAZISH
// ============================================================
function imageToBase64(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  return buffer.toString('base64');
}

// ============================================================
// 3. PROMPT — Gemini uchun ko'rsatma
// ============================================================
function buildPrompt(registeredTags = []) {
  const tagsList = registeredTags.length
    ? `\n\nRo'yxatdan o'tgan komandalar teglari:\n${registeredTags.join(', ')}\n\nFaqat shu teglarga mos keladiganlarini qaytar.`
    : '';

  return `Sen PUBG Mobile turnir natijalarini tahlil qiluvchi assistantsan.

Bu rasmda PUBG Mobile turnir natijalari ko'rsatilgan.

Vazifang:
1. Rasmdagi BARCHA komandalar teglarini va kill sonlarini aniqla
2. Har bir teg uchun jami kill soni (yig'indi)
3. O'rin raqamlari (1, 2, 3, ... — jadval bo'yicha)
4. Faqat aniq ko'ringan ma'lumotlarni qaytar
5. Hech narsa o'ylab topma

DIQQAT:
- Bir xil teg bir necha marta uchrasa — kill'larni qo'shib yubor
- Teg odatda 2-5 belgidan iborat (masalan: UP, N1, XPZ, S7)
- Kill — bu o'yinchi o'ldirish soni
- Place — o'rin (1, 2, 3, ...)${tagsList}

Javobni FAQAT JSON formatida qaytar (boshqa hech narsa yozma):

{
  "teams": [
    { "tag": "UP", "kills": 12, "place": 1 },
    { "tag": "N1", "kills": 8, "place": 2 }
  ],
  "confidence": "high"
}

Agar rasmda natijalar ko'rinmasa:
{
  "teams": [],
  "confidence": "low",
  "reason": "natijalar ko'rinmaydi"
}`;
}

// ============================================================
// 4. GEMINI'GA SO'ROV YUBORISH
// ============================================================
async function analyzeImage(imagePath, registeredTags = []) {
  if (!model) {
    throw new Error("Gemini ishga tushmagan. GEMINI_API_KEY ni tekshiring.");
  }

  const base64 = imageToBase64(imagePath);
  const prompt = buildPrompt(registeredTags);

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64,
        mimeType: 'image/jpeg',
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();

  return text;
}

// ============================================================
// 5. JSON'NI XAVFSIZ PARSE QILISH
// ============================================================
function parseGeminiResponse(text) {
  if (!text) return { teams: [], confidence: 'low', reason: 'bo\'sh javob' };

  let cleaned = String(text).trim();

  // ```json ... ``` bloklarini olib tashlash
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // Birinchi { dan oxirgi } gacha
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    return { teams: [], confidence: 'low', reason: 'JSON topilmadi' };
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed.teams || !Array.isArray(parsed.teams)) {
      return { teams: [], confidence: 'low', reason: 'teams yo\'q' };
    }

    // Tozalash
    parsed.teams = parsed.teams
      .filter((t) => t && t.tag && typeof t.kills === 'number')
      .map((t) => ({
        tag: String(t.tag).toUpperCase().trim(),
        kills: Math.max(0, parseInt(t.kills, 10) || 0),
        place: t.place ? parseInt(t.place, 10) : null,
      }));

    return parsed;
  } catch (e) {
    return { teams: [], confidence: 'low', reason: 'JSON parse xato: ' + e.message };
  }
}

// ============================================================
// 6. GURUHLASH — bir xil teglarni birlashtirish
// ============================================================
function groupByTag(teams) {
  const groups = {};

  for (const t of teams) {
    if (!groups[t.tag]) {
      groups[t.tag] = {
        tag: t.tag,
        kills: 0,
        place: t.place,
        occurrences: 0,
      };
    }
    groups[t.tag].kills += t.kills;
    groups[t.tag].occurrences++;
    if (groups[t.tag].place === null && t.place !== null) {
      groups[t.tag].place = t.place;
    }
  }

  const result = Object.values(groups);

  // Place bo'yicha saralash
  result.sort((a, b) => {
    if (a.place === null && b.place === null) return 0;
    if (a.place === null) return 1;
    if (b.place === null) return -1;
    return a.place - b.place;
  });

  // Place yo'q bo'lsa — tartib raqami berish
  let nextPlace = 1;
  for (const r of result) {
    if (r.place === null) {
      while (result.some((x) => x.place === nextPlace)) nextPlace++;
      r.place = nextPlace;
      nextPlace++;
    }
  }

  return result;
}

// ============================================================
// 7. ASOSIY FUNKSIYA
// ============================================================
async function processScreenshot(bot, fileId, registeredTeams = []) {
  const imagePath = await downloadTelegramPhoto(bot, fileId);

  try {
    const registeredTags = registeredTeams.map((t) =>
      (t.tag || '').toUpperCase()
    );

    const rawText = await analyzeImage(imagePath, registeredTags);
    const parsed = parseGeminiResponse(rawText);
    const grouped = groupByTag(parsed.teams || []);

    // Ro'yxatdan o'tgan teglar bilan solishtirish
    const registeredMap = {};
    for (const team of registeredTeams) {
      registeredMap[(team.tag || '').toUpperCase()] = team;
    }

    const matched = [];
    const unmatched = [];

    for (const g of grouped) {
      const team = registeredMap[g.tag];
      if (team) {
        matched.push({
          teamId: team.id,
          teamName: team.name,
          teamTag: team.tag,
          place: g.place,
          kills: g.kills,
          occurrences: g.occurrences,
        });
      } else {
        unmatched.push({
          tag: g.tag,
          place: g.place,
          kills: g.kills,
          occurrences: g.occurrences,
        });
      }
    }

    // Cleanup
    cleanup(imagePath);

    return {
      ok: true,
      rawText,
      totalPairs: (parsed.teams || []).length,
      confirmed: grouped,
      ignored: [],
      matched,
      unmatched,
      confidence: parsed.confidence || 'medium',
      reason: parsed.reason || null,
    };
  } catch (e) {
    cleanup(imagePath);
    return { ok: false, reason: e.message };
  }
}

// ============================================================
// 8. TOZALASH
// ============================================================
function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
}

// ============================================================
// EKSPORT
// ============================================================
module.exports = {
  processScreenshot,
  downloadTelegramPhoto,
  analyzeImage,
  parseGeminiResponse,
  groupByTag,
  cleanup,
  isEnabled: () => !!model,
};