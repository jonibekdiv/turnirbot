// ============================================================
// TOURNAMENT CREATE — Type/Channel FSM integratsiyasi
// Bu handler tournamentHandler.js FSM'ini to'ldiradi
// ============================================================
const { tournamentTypeKeyboard } = require('../keyboards/paymentKeyboard');
const { STATES } = require('../constants');

module.exports = (bot) => {
  // ============================================================
  // YANGI TURNIR BOSHLASH (override)
  // ============================================================
  // Bu handler tournamentHandler.js dagi TOUR_CREATE handler
  // ishga tushgandan keyin 1-qadam (nom) tugagach
  // "TOUR_CREATE_TYPE" ga o'tishi kerak.

  // TOUR_CREATE_TYPE holatida keyingi qadam
  bot.on('text', async (ctx, next) => {
    const s = ctx.session?.state;
    if (s !== STATES.TOUR_CREATE_TYPE) return next();

    // Bu holatda foydalanuvchi tur tanlashni kutmoqda
    // lekin u matn yozdi — tugmalarni ko'rsatamiz
    return ctx.reply(
      `💳 <b>Turnir turini tanlang:</b>\n\n` +
        `<i>Tugmalardan birini bosing.</i>`,
      { parse_mode: 'HTML', ...tournamentTypeKeyboard() }
    );
  });
};