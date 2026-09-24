// ============================================================
// LANGUAGE HANDLER — 3 tilda
// ============================================================
const { Markup } = require('telegraf');
const langService = require('../services/langService');
const { CALLBACK } = require('../constants');
const { safeEdit, safeAnswer } = require('../utils/telegramUtils');

function langKeyboard(t) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('language_uz'), 'lang:set:uz')],
    [Markup.button.callback(t('language_en'), 'lang:set:en')],
    [Markup.button.callback(t('language_ru'), 'lang:set:ru')],
    [Markup.button.callback(t('btn_back'), 'lang:back')],
  ]);
}

module.exports = (bot) => {
  // ============================================================
  // TIL MENYUSI
  // ============================================================
  bot.action(CALLBACK.MENU_LANGUAGE, async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;

    const current = ctx.state.lang || langService.DEFAULT_LANG;
    const currentName = langService.getLangName(current);

    await safeEdit(
      ctx,
      `${t('language_title')}\n\n${t('language_current', { lang: currentName })}`,
      langKeyboard(t)
    );
  });

  // ============================================================
  // TILNI O'ZGARTIRISH
  // ============================================================
  bot.action(/^lang:set:(uz|en|ru)$/, async (ctx) => {
    const newLang = ctx.match[1];
    await langService.setUserLang(ctx.from.id, newLang);

    ctx.state.lang = newLang;

    const newT = (key, vars) => langService.t(newLang, key, vars);

    await safeAnswer(
      ctx,
      newT('language_changed', { lang: langService.getLangName(newLang) })
    );

    const currentName = langService.getLangName(newLang);

    await safeEdit(
      ctx,
      `${newT('language_title')}\n\n${newT('language_current', { lang: currentName })}`,
      langKeyboard(newT)
    );
  });

  // ============================================================
  // ORQAGA
  // ============================================================
  bot.action('lang:back', async (ctx) => {
    await safeAnswer(ctx);
    const t = ctx.t;
    const { mainKeyboard } = require('../keyboards/mainKeyboard');
    await safeEdit(
      ctx,
      `🏠 ${t('menu_main')}`,
      mainKeyboard(ctx.state.role, ctx.state.lang)
    );
  });
};