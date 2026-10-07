const c = require('../lib/common');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s) {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? dt : null;
}

module.exports = async (req, res) => {
  try {
    const me = await c.getAuthUser(req);
    if (!me) return res.status(401).json({ error: 'Sesión no válida' });
    const userKey = c.normUser(me.username);
    const body = await c.readBody(req);
    const type = req.query && req.query.type; // 'shift' | 'weekend'

    if (req.method === 'POST' && type === 'shift') {
      const dt = parseDate(body.date);
      if (!dt || !c.SHIFTS.includes(body.shiftId)) return res.status(400).json({ error: 'Datos inválidos' });
      const dow = dt.getUTCDay();
      if (dow === 0 || dow === 6) return res.status(400).json({ error: 'Solo lunes a viernes.' });
      const key = `${body.date}_${body.shiftId}`;
      const rec = { key, dateStr: body.date, shiftId: body.shiftId, username: me.username, userKey, phone: me.phone, dept: me.dept, createdAt: Date.now() };
      const ok = await c.cmd('HSETNX', 'bookings', key, JSON.stringify(rec));
      if (!ok) return res.status(409).json({ error: 'Este turno ya está reservado por otro usuario y se encuentra bloqueado.' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE' && type === 'shift') {
      const raw = await c.cmd('HGET', 'bookings', String(req.query.key || ''));
      if (!raw) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (JSON.parse(raw).userKey !== userKey) return res.status(403).json({ error: 'Solo el titular puede cancelar su reserva.' });
      await c.cmd('HDEL', 'bookings', req.query.key);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && type === 'weekend') {
      const m = /^weekend_(\d{4}-\d{2}-\d{2})$/.exec(body.id || '');
      const fri = m && parseDate(m[1]);
      const address = String(body.address || '').trim();
      if (!fri || fri.getUTCDay() !== 5 || !address) return res.status(400).json({ error: 'Datos inválidos' });
      const mon = new Date(fri.getTime() + 3 * 86400000).toISOString().slice(0, 10);
      const rec = { id: body.id, fridayDateStr: m[1], mondayDateStr: mon, username: me.username, userKey, phone: me.phone, address, createdAt: Date.now() };
      const ok = await c.cmd('HSETNX', 'weekends', body.id, JSON.stringify(rec));
      if (!ok) return res.status(409).json({ error: 'Este fin de semana ya está reservado y bloqueado.' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE' && type === 'weekend') {
      const raw = await c.cmd('HGET', 'weekends', String(req.query.id || ''));
      if (!raw) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (JSON.parse(raw).userKey !== userKey) return res.status(403).json({ error: 'Solo el titular puede cancelar su reserva.' });
      await c.cmd('HDEL', 'weekends', req.query.id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Solicitud inválida' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
