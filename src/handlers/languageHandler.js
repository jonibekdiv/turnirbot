// ============================================================
// LANGUAGE HANDLER — Til tanlash
// ============================================================
const { Markup } = require('telegraf');
const langService = require('../services/langService');
const { CALLBACK } = require('../constants');
const { safeEdit, safeAnswer } = require('../utils/telegramUtils');

// ============================================================
// TIL TANLASH MENYUSI
// ============================================================
function langKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇺🇿 O'zbek", 'lang:set:uz')],
    [Markup.button.callback('🇬🇧 English', 'lang:set:en')],
    [Markup.button.callback('🇷🇺 Русский', 'lang:set:ru')],
    [Markup.button.callback('⬅️ Orqaga', 'lang:back')],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // TIL MENYUSINI KO'RSATISH
  // ============================================================
  bot.action(CALLBACK.MENU_LANGUAGE, async (ctx) => {
    await safeAnswer(ctx);

    const current = ctx.state.lang || langService.DEFAULT_LANG;
    const currentName = langService.getLangName(current);

    await safeEdit(
      ctx,
      `🌐 <b>Tilni tanlang / Select language / Выберите язык</b>\n\n` +
        `${currentName}`,
      langKeyboard()
    );
  });

  // ============================================================
  // TILNI O'ZGARTIRISH
  // ============================================================
  bot.action(/^lang:set:(uz|en|ru)$/, async (ctx) => {
    const newLang = ctx.match[1];
    await langService.setUserLang(ctx.from.id, newLang);

    // Tilni yangilash
    ctx.state.lang = newLang;

    await safeAnswer(ctx, langService.t(newLang, 'language_changed', {
      lang: langService.getLangName(newLang),
    }));

    const currentName = langService.getLangName(newLang);

    await safeEdit(
      ctx,
      `🌐 <b>Tilni tanlang / Select language / Выберите язык</b>\n\n` +
        `${langService.t(newLang, 'language_current', { lang: currentName })}`,
      langKeyboard()
    );
  });

  // ============================================================
  // ORQAGA
  // ============================================================
  bot.action('lang:back', async (ctx) => {
    await safeAnswer(ctx);
    const { mainKeyboard } = require('../keyboards/mainKeyboard');
    await safeEdit(
      ctx,
      `🏠 ${ctx.t('menu_main')}`,
      mainKeyboard(ctx.state.role, ctx.state.lang)
    );
  });
};