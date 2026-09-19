// Bir vaqtda kelgan bir xil faylga yozishlarni navbatga qo'yadi
const locks = new Map();

function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(() => fn());
  // zanjir buzilmasin — xatoni yutamiz
  locks.set(key, run.catch(() => {}));
  return run;
}

module.exports = { withLock };