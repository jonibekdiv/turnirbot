// ============================================================
// TOURNAMENT CREATE — Type/Channel FSM integratsiyasi
// ============================================================
const { tournamentTypeKeyboard } = require('../keyboards/paymentKeyboard');
const { STATES } = require('../constants');

module.exports = (bot) => {
  // TOUR_CREATE_TYPE holatida foydalanuvchi matn yozsa — tugmalarni ko'rsatamiz
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.TOUR_CREATE_TYPE) return next();

    const t = ctx.t;

    return ctx.reply(
      `💳 <b>${t('tour_type_pick')}</b>\n\n` +
        `<i>Tugmalardan birini bosing.</i>`,
      { parse_mode: 'HTML', ...tournamentTypeKeyboard(ctx) }  // ✅ ctx qo'shildi
    );
  });
};