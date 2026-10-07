const crypto = require('crypto');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// ---- In-memory fallback (solo desarrollo local) ----
const mem = (globalThis.__trueMem = globalThis.__trueMem || { h: {}, k: {} });

function memCmd(args) {
  const [c, a, b, v] = args;
  switch (String(c).toUpperCase()) {
    case 'HGET': return (mem.h[a] || {})[b] ?? null;
    case 'HSET': (mem.h[a] = mem.h[a] || {})[b] = v; return 1;
    case 'HSETNX': {
      const h = (mem.h[a] = mem.h[a] || {});
      if (b in h) return 0;
      h[b] = v; return 1;
    }
    case 'HDEL': { const h = mem.h[a] || {}; const had = b in h; delete h[b]; return had ? 1 : 0; }
    case 'HGETALL': return Object.entries(mem.h[a] || {}).flat();
    case 'SET': {
      const e = { v: b, exp: null };
      if (String(v).toUpperCase() === 'EX') e.exp = Date.now() + Number(args[4]) * 1000;
      mem.k[a] = e; return 'OK';
    }
    case 'GET': {
      const e = mem.k[a];
      if (!e) return null;
      if (e.exp && e.exp < Date.now()) { delete mem.k[a]; return null; }
      return e.v;
    }
    case 'DEL': delete mem.k[a]; return 1;
    default: throw new Error('Comando no soportado: ' + c);
  }
}

async function cmd(...args) {
  if (!REDIS_URL) return memCmd(args);
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(args)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function hgetallObj(key) {
  const flat = (await cmd('HGETALL', key)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1]);
  return out;
}

// ---- Auth helpers ----
function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

function normUser(u) {
  return String(u || '').trim().toLowerCase();
}

async function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  await cmd('SET', `session:${token}`, username, 'EX', 60 * 60 * 24 * 30);
  return token;
}

async function getAuthUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const uname = await cmd('GET', `session:${token}`);
  if (!uname) return null;
  const raw = await cmd('HGET', 'users', uname);
  return raw ? JSON.parse(raw) : null;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

const SHIFTS = ['shift-tarde', 'shift-atardecer'];

module.exports = { cmd, hgetallObj, hashPassword, normUser, createSession, getAuthUser, readBody, SHIFTS, crypto };
