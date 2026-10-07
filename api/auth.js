const c = require('../lib/common');

function publicUser(u) {
  return { username: u.username, phone: u.phone, dept: u.dept };
}

module.exports = async (req, res) => {
  try {
    const action = req.query && req.query.action;

    if (req.method === 'GET' && action === 'me') {
      const u = await c.getAuthUser(req);
      if (!u) return res.status(401).json({ error: 'Sesión no válida' });
      return res.status(200).json({ user: publicUser(u) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const body = await c.readBody(req);

    if (action === 'register') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const phone = String(body.phone || '').trim();
      const dept = String(body.dept || '').trim();
      if (!username || !password || !phone || !dept) {
        return res.status(400).json({ error: 'Completa usuario, contraseña, teléfono y área.' });
      }
      const key = c.normUser(username);
      const salt = c.crypto.randomBytes(16).toString('hex');
      const user = { username, phone, dept, salt, hash: c.hashPassword(password, salt), createdAt: Date.now() };
      const ok = await c.cmd('HSETNX', 'users', key, JSON.stringify(user));
      if (!ok) return res.status(409).json({ error: 'Ese usuario ya existe. Elige otro o inicia sesión.' });
      const token = await c.createSession(key);
      return res.status(200).json({ token, user: publicUser(user) });
    }

    if (action === 'login') {
      const key = c.normUser(body.username);
      const raw = key ? await c.cmd('HGET', 'users', key) : null;
      const user = raw ? JSON.parse(raw) : null;
      if (!user || c.hashPassword(body.password || '', user.salt) !== user.hash) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      }
      const token = await c.createSession(key);
      return res.status(200).json({ token, user: publicUser(user) });
    }

    if (action === 'logout') {
      const h = req.headers['authorization'] || '';
      if (h.startsWith('Bearer ')) await c.cmd('DEL', `session:${h.slice(7)}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
