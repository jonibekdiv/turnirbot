// ============================================================
// OCR SERVICE — Skrinshotdan natija o'qish (Tesseract.js)
// ============================================================
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const TMP_DIR = path.join(os.tmpdir(), 'pubg-ocr');

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

async function downloadTelegramPhoto(bot, fileId) {
  ensureTmp();
  const link = await bot.telegram.getFileLink(fileId);
  const fileName = `ocr_${Date.now()}.jpg`;
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

async function readTextFromImage(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, 'eng', {
    logger: () => {},
  });
  return data.text || '';
}

function extractTagKillPairs(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const pairs = [];

  for (const line of lines) {
    let match = null;
    let place = null;
    let tag = null;
    let kills = null;

    match = line.match(/^#?(\d+)[.)\s]+([A-Z0-9]{2,6})\s*[-–—:|\s]+\s*(\d+)/i);
    if (match) {
      place = parseInt(match[1], 10);
      tag = match[2].toUpperCase();
      kills = parseInt(match[3], 10);
    }

    if (!match) {
      match = line.match(/^([A-Z0-9]{2,6})\s*[-–—:|\s]+\s*(\d+)\s*(?:kills?)?$/i);
      if (match) {
        tag = match[1].toUpperCase();
        kills = parseInt(match[2], 10);
        place = null;
      }
    }

    if (!match) {
      match = line.match(/^(\d+)[.)\s]+([A-Z0-9]{2,6})\s+(\d+)\s*$/i);
      if (match) {
        place = parseInt(match[1], 10);
        tag = match[2].toUpperCase();
        kills = parseInt(match[3], 10);
      }
    }

    if (tag && kills !== null && !isNaN(kills) && kills >= 0 && kills < 100) {
      pairs.push({ tag, kills, place, raw: line });
    }
  }

  return pairs;
}

function groupByTag(pairs, minOccurrences = 2) {
  const groups = {};

  for (const p of pairs) {
    if (!groups[p.tag]) {
      groups[p.tag] = {
        tag: p.tag,
        occurrences: 0,
        totalKills: 0,
        place: null,
        lines: [],
      };
    }
    groups[p.tag].occurrences++;
    groups[p.tag].totalKills += p.kills;
    groups[p.tag].lines.push(p.raw);
    if (groups[p.tag].place === null && p.place !== null) {
      groups[p.tag].place = p.place;
    }
  }

  const result = [];
  const ignored = [];

  for (const g of Object.values(groups)) {
    if (g.occurrences >= minOccurrences) {
      result.push({
        tag: g.tag,
        occurrences: g.occurrences,
        kills: g.totalKills,
        place: g.place,
        lines: g.lines,
      });
    } else {
      ignored.push({
        tag: g.tag,
        occurrences: g.occurrences,
        kills: g.totalKills,
        lines: g.lines,
      });
    }
  }

  result.sort((a, b) => {
    if (a.place === null && b.place === null) return 0;
    if (a.place === null) return 1;
    if (b.place === null) return -1;
    return a.place - b.place;
  });

  let nextPlace = 1;
  for (const r of result) {
    if (r.place === null) {
      while (result.some((x) => x.place === nextPlace)) nextPlace++;
      r.place = nextPlace;
      nextPlace++;
    }
  }

  return { confirmed: result, ignored };
}

async function processScreenshot(bot, fileId, registeredTeams = []) {
  const imagePath = await downloadTelegramPhoto(bot, fileId);

  try {
    const rawText = await readTextFromImage(imagePath);
    const pairs = extractTagKillPairs(rawText);
    const grouped = groupByTag(pairs, 2);

    const registeredMap = {};
    for (const team of registeredTeams) {
      registeredMap[(team.tag || '').toUpperCase()] = team;
    }

    const matched = [];
    const unmatched = [];

    for (const g of grouped.confirmed) {
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

    return {
      ok: true,
      rawText,
      totalPairs: pairs.length,
      confirmed: grouped.confirmed,
      ignored: grouped.ignored,
      matched,
      unmatched,
      imagePath,
    };
  } catch (e) {
    cleanup(imagePath);
    return { ok: false, reason: e.message };
  }
}

function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
}

module.exports = {
  downloadTelegramPhoto,
  readTextFromImage,
  extractTagKillPairs,
  groupByTag,
  processScreenshot,
  cleanup,
};