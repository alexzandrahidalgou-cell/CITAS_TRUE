const c = require('../lib/common');

module.exports = async (req, res) => {
  try {
    const me = await c.getAuthUser(req);
    if (!me) return res.status(401).json({ error: 'Sesión no válida' });
    const [b, w] = await Promise.all([c.hgetallObj('bookings'), c.hgetallObj('weekends')]);

    const bookings = {};
    for (const [k, v] of Object.entries(b)) {
      bookings[k] = { key: k, dateStr: v.dateStr, shiftId: v.shiftId, username: v.username, mine: v.userKey === c.normUser(me.username) };
    }
    const weekends = {};
    for (const [k, v] of Object.entries(w)) {
      const mine = v.userKey === c.normUser(me.username);
      weekends[k] = { id: k, fridayDateStr: v.fridayDateStr, mondayDateStr: v.mondayDateStr, username: v.username, mine, address: mine ? v.address : undefined };
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ bookings, weekends });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
