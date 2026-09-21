// ============================================================
// COMMANDS SERVICE — Bot menu buyruqlarini o'rnatish
// ============================================================

// ============================================================
// O'ZBEK TILI (default)
// ============================================================
const UZ_COMMANDS = [
  { command: 'start', description: '🏠 Botni ishga tushirish' },
  { command: 'tournaments', description: '🏆 Turnirlar' },
  { command: 'team', description: '👥 Komandam' },
  { command: 'profile', description: '👤 Profil' },
  { command: 'language', description: '🌐 Tilni o\'zgartirish' },
  { command: 'leaderboard', description: '🏅 Leaderboard' },
  { command: 'search', description: '🔍 Qidiruv' },
  { command: 'help', description: 'ℹ️ Yordam' },
  { command: 'cancel', description: '❌ Bekor qilish' },
];

// ============================================================
// INGLIZ TILI
// ============================================================
const EN_COMMANDS = [
  { command: 'start', description: '🏠 Start bot' },
  { command: 'tournaments', description: '🏆 Tournaments' },
  { command: 'team', description: '👥 My Team' },
  { command: 'profile', description: '👤 Profile' },
  { command: 'language', description: '🌐 Change language' },
  { command: 'leaderboard', description: '🏅 Leaderboard' },
  { command: 'search', description: '🔍 Search' },
  { command: 'help', description: 'ℹ️ Help' },
  { command: 'cancel', description: '❌ Cancel' },
];

// ============================================================
// RUS TILI
// ============================================================
const RU_COMMANDS = [
  { command: 'start', description: '🏠 Запустить бота' },
  { command: 'tournaments', description: '🏆 Турниры' },
  { command: 'team', description: '👥 Моя команда' },
  { command: 'profile', description: '👤 Профиль' },
  { command: 'language', description: '🌐 Изменить язык' },
  { command: 'leaderboard', description: '🏅 Таблица лидеров' },
  { command: 'search', description: '🔍 Поиск' },
  { command: 'help', description: 'ℹ️ Помощь' },
  { command: 'cancel', description: '❌ Отмена' },
];

// ============================================================
// BUYRUQLARNI O'RNATISH
// ============================================================
async function setupCommands(bot) {
  try {
    await bot.telegram.setMyCommands(UZ_COMMANDS);
    await bot.telegram.setMyCommands(EN_COMMANDS, { language_code: 'en' });
    await bot.telegram.setMyCommands(RU_COMMANDS, { language_code: 'ru' });
    console.log("✅ Buyruqlar menyusi o'rnatildi (UZ/EN/RU)");
  } catch (e) {
    console.error("❌ Buyruqlar o'rnatilmadi:", e.message);
  }
}

// ============================================================
// MENYU TUGMASINI SOZLASH
// ============================================================
async function setupMenuButton(bot) {
  try {
    await bot.telegram.setChatMenuButton({
      menuButton: { type: 'commands' },
    });
    console.log("✅ Menyu tugmasi o'rnatildi");
  } catch (e) {
    console.error("❌ Menyu tugmasi o'rnatilmadi:", e.message);
  }
}

// ============================================================
// BARCHA SOZLAMALAR
// ============================================================
async function setupAll(bot) {
  await setupCommands(bot);
  await setupMenuButton(bot);
}

module.exports = {
  setupCommands,
  setupMenuButton,
  setupAll,
  UZ_COMMANDS,
  EN_COMMANDS,
  RU_COMMANDS,
};