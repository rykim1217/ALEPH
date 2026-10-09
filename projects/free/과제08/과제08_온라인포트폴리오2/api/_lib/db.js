import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export function getSQL() {
  if (!process.env.DATABASE_URL) {
    const err = new Error('DATABASE_URL_NOT_CONFIGURED');
    err.statusCode = 503;
    throw err;
  }
  return neon(process.env.DATABASE_URL);
}

export async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS t08_users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    webauthn_user_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS t08_challenges (
    user_id TEXT PRIMARY KEY REFERENCES t08_users(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS t08_passkeys (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES t08_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    device_type TEXT,
    backed_up BOOLEAN NOT NULL DEFAULT FALSE,
    transports TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS t08_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES t08_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS t08_private_items (
    user_id TEXT NOT NULL REFERENCES t08_users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    position INTEGER NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY(user_id, category, position)
  )`;
}

export function requestedAccount(req) {
  const raw = String(req.query?.account || req.body?.account || '').trim();
  return raw === 'review-demo' ? 'review-demo' : 'rayeon-demo';
}

export async function getOrCreateDemoUser(sql, id='rayeon-demo') {
  const safeId = id === 'review-demo' ? 'review-demo' : 'rayeon-demo';
  const displayName = safeId === 'review-demo' ? 'REVIEW DEMO' : 'KIM RAYEON';
  let rows = await sql`SELECT * FROM t08_users WHERE id=${safeId}`;
  if (!rows.length) {
    const webauthnUserID = crypto.randomBytes(32).toString('base64url');
    rows = await sql`INSERT INTO t08_users(id, display_name, webauthn_user_id) VALUES(${safeId}, ${displayName}, ${webauthnUserID}) RETURNING *`;
  }
  await seedPrivateData(sql, safeId);
  return rows[0];
}

async function seedPrivateData(sql, userId) {
  const a={portfolio:['과제02 — 내가 설계한 미니게임','과제03 — 짤카드 스튜디오','과제04 — 오늘의 진짜 정보판','과제05 — 오늘의 진짜 정보판 2 - AI협업','과제06 — 계획한 나와 실제의 나','과제07 — 계획한 나와 실제의 나 2 - 로그인'],learning:['Programming — Python / C / Java','Database — SQL / DB','Network — VLAN / NAT / ACL','Security — Kali Linux / Nmap / Nikto / Wireshark','Server — Docker / Nginx','AI Tools — AI 협업 / CLI 활용'],schedule:['09.21 — 정보처리기사 실기 접수','10.12 — SQLD 접수','10.25 — 정보처리기사 실기 시험','11.14 — SQLD 시험']};
  const b={portfolio:['DEMO-B — 공개와 비공개 경계 확인','DEMO-B — 패스키 계정 격리 확인','DEMO-B — 서버 권한 검사 기록'],learning:['Demo Track — WebAuthn','Demo Track — Session isolation','Demo Track — Server authorization'],schedule:['09.05 — DEMO-B 검증','09.12 — DEMO-B 재검증','09.19 — DEMO-B 종료']};
  const data=userId==='review-demo'?b:a;
  for(const [category,items] of Object.entries(data)) for(let i=0;i<items.length;i++) await sql`INSERT INTO t08_private_items(user_id,category,position,content) VALUES(${userId},${category},${i},${items[i]}) ON CONFLICT DO NOTHING`;
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(req) {
  const cookie = String(req.headers.cookie || '');
  const match = cookie.match(/(?:^|;\s*)t08_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSessionUser(req, sql) {
  const token = readSessionToken(req);
  if (!token) return null;
  const hash = tokenHash(token);
  const rows = await sql`SELECT s.user_id, u.display_name FROM t08_sessions s
    JOIN t08_users u ON u.id=s.user_id
    WHERE s.token_hash=${hash} AND s.expires_at > NOW()`;
  return rows[0] || null;
}
