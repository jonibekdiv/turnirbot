// Bot konfiguratsiyasi — .env dan o'qiladi
require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  SUPER_ADMIN_ID: Number(process.env.SUPER_ADMIN_ID || 0),
  BOT_USERNAME: process.env.BOT_USERNAME || 'bot',
  TIMEZONE: 'Asia/Tashkent',
  DATA_DIR: 'data',
  LOGS_DIR: 'logs',
};