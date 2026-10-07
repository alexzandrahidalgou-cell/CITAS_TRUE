// Test de integración en proceso (sin red): node test/api.test.js
const assert = require('assert');
const auth = require('../api/auth');
const book = require('../api/book');
const data = require('../api/data');

function call(h, { method = 'GET', query = {}, body = {}, token } = {}) {
  return new Promise(resolve => {
    const req = { method, query, body, headers: token ? { authorization: 'Bearer ' + token } : {} };
    const res = { headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, ...o }); } };
    h(req, res);
  });
}

(async () => {
  const reg = (u, p, ph, d) => call(auth, { method: 'POST', query: { action: 'register' }, body: { username: u, password: p, phone: ph, dept: d } });
  const a = await reg('ana', 'ana', '311', 'RRHH');
  const b = await reg('beto', 'beto', '312', 'TI');
  assert(a.token && b.token);
  assert.strictEqual((await reg('ANA', 'x', '1', 'x')).code, 409);
  assert.strictEqual((await reg('zoe', '', '1', 'x')).code, 400);
  assert.strictEqual((await call(auth, { method: 'POST', query: { action: 'login' }, body: { username: 'ana', password: 'mal' } })).code, 401);
  assert((await call(auth, { method: 'POST', query: { action: 'login' }, body: { username: 'Ana', password: 'ana' } })).token);

  let d = new Date(); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  const date = d.toISOString().slice(0, 10);
  const key = `${date}_shift-tarde`;
  assert.strictEqual((await call(book, { method: 'POST', query: { type: 'shift' }, body: { date, shiftId: 'shift-tarde' }, token: a.token })).code, 200);
  assert.strictEqual((await call(book, { method: 'POST', query: { type: 'shift' }, body: { date, shiftId: 'shift-tarde' }, token: b.token })).code, 409);
  assert.strictEqual((await call(book, { method: 'POST', query: { type: 'shift' }, body: { date: '2026-10-10', shiftId: 'shift-tarde' }, token: b.token })).code, 400); // sábado
  assert.strictEqual((await call(book, { method: 'DELETE', query: { type: 'shift', key }, token: b.token })).code, 403);
  const seen = await call(data, { token: b.token });
  assert.strictEqual(seen.bookings[key].username, 'ana');
  assert.strictEqual(seen.bookings[key].mine, false);
  assert.strictEqual((await call(data, {})).code, 401);
  assert.strictEqual((await call(book, { method: 'DELETE', query: { type: 'shift', key }, token: a.token })).code, 200);
  assert.strictEqual(Object.keys((await call(data, { token: a.token })).bookings).length, 0);

  assert.strictEqual((await call(book, { method: 'POST', query: { type: 'weekend' }, body: { id: 'weekend_2026-10-09', address: 'Calle 1' }, token: a.token })).code, 200);
  assert.strictEqual((await call(book, { method: 'POST', query: { type: 'weekend' }, body: { id: 'weekend_2026-10-09', address: 'x' }, token: b.token })).code, 409);
  const w = await call(data, { token: b.token });
  assert.strictEqual(w.weekends['weekend_2026-10-09'].address, undefined);
  console.log('OK: todos los tests pasaron');
})().catch(e => { console.error(e); process.exit(1); });
