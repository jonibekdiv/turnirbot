// Telegram bilan bog'liq yordamchi funksiyalar

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function displayName(user) {
  if (!user) return 'Noma\'lum';
  if (user.username) return '@' + user.username;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || `ID:${user.id}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function safeSend(telegram, chatId, text, extra = {}) {
  try {
    return await telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
  } catch (e) {
    return null;
  }
}

// ✅ YANGI: xavfsiz editMessageText
// "message is not modified" xatosini yutadi va boshqa xatolarda reply qiladi
async function safeEdit(ctx, text, extra = {}) {
  const opts = { parse_mode: 'HTML', ...extra };
  try {
    return await ctx.editMessageText(text, opts);
  } catch (e) {
    const desc = e?.response?.description || e?.message || '';

    // Bir xil matn — hech narsa qilmaymiz
    if (desc.includes('message is not modified')) return null;

    // Xabar topilmadi (o'chirilgan yoki juda eski) — yangi xabar yuboramiz
    if (
      desc.includes('message to edit not found') ||
      desc.includes('MESSAGE_ID_INVALID') ||
      desc.includes('message can\'t be edited')
    ) {
      try {
        return await ctx.reply(text, opts);
      } catch {
        return null;
      }
    }

    // Boshqa xatolar — yangi xabar yuborishga harakat qilamiz
    try {
      return await ctx.reply(text, opts);
    } catch {
      return null;
    }
  }
}

// ✅ YANGI: xavfsiz answerCbQuery
async function safeAnswer(ctx, text) {
  try {
    await ctx.answerCbQuery(text || undefined);
  } catch {
    // Eski callback — o'tkazib yuboramiz
  }
}

module.exports = { escapeHtml, displayName, chunk, safeSend, safeEdit, safeAnswer };