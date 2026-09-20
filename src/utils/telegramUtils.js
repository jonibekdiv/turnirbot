// ============================================================
// TELEGRAM UTILS — Yordamchi funksiyalar
// ============================================================

// ============================================================
// HTML ESCAPE
// ============================================================
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// FOYDALANUVCHI NOMI
// ============================================================
function displayName(user) {
  if (!user) return "Noma'lum";
  if (user.username) return '@' + user.username;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || `ID:${user.id}`;
}

// ============================================================
// MASSIVNI BO'LAKLARGA BO'LISH
// ============================================================
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================
// XAVFSIZ XABAR YUBORISH
// ============================================================
async function safeSend(telegram, chatId, text, extra = {}) {
  try {
    return await telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      ...extra,
    });
  } catch (e) {
    return null;
  }
}

// ============================================================
// XAVFSIZ EDIT MESSAGE (message is not modified)
// ============================================================
async function safeEdit(ctx, text, extra = {}) {
  const opts = { parse_mode: 'HTML', ...extra };

  try {
    return await ctx.editMessageText(text, opts);
  } catch (e) {
    const desc = e?.response?.description || e?.message || '';

    // Bir xil matn — hech narsa qilmaymiz
    if (desc.includes('message is not modified')) return null;

    // Xabar topilmadi (o'chirilgan yoki juda eski)
    if (
      desc.includes('message to edit not found') ||
      desc.includes('MESSAGE_ID_INVALID') ||
      desc.includes("message can't be edited")
    ) {
      try {
        return await ctx.reply(text, opts);
      } catch {
        return null;
      }
    }

    // Boshqa xatolar
    try {
      return await ctx.reply(text, opts);
    } catch {
      return null;
    }
  }
}

// ============================================================
// XAVFSIZ CALLBACK JAVOBI
// ============================================================
async function safeAnswer(ctx, text) {
  try {
    await ctx.answerCbQuery(text || undefined);
  } catch (e) {
    // Eski callback — jim
  }
}

// ============================================================
// XAVFSIZ RASM YUBORISH
// ============================================================
async function safeSendPhoto(ctx, fileId, caption, extra = {}) {
  try {
    return await ctx.replyWithPhoto(fileId, {
      caption,
      parse_mode: 'HTML',
      ...extra,
    });
  } catch (e) {
    // Rasm yuborilmasa — matnga o'tish
    return null;
  }
}

// ============================================================
// TELEGRAM XATOLARINI TAHLIL QILISH
// ============================================================
function parseTelegramError(e) {
  const code = e?.response?.error_code;
  const desc = e?.response?.description || e?.message || '';

  if (code === 403 || desc.includes('blocked') || desc.includes('chat not found')) {
    return { type: 'blocked', code };
  }
  if (code === 429) {
    const retry = e?.response?.parameters?.retry_after || 30;
    return { type: 'rate_limit', code, retry };
  }
  if (code === 400) {
    return { type: 'bad_request', code, desc };
  }
  return { type: 'unknown', code, desc };
}

module.exports = {
  escapeHtml,
  displayName,
  chunk,
  safeSend,
  safeEdit,
  safeAnswer,
  safeSendPhoto,
  parseTelegramError,
};