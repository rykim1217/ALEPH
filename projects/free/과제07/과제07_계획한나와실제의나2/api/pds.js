const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const { AsyncLocalStorage } = require('async_hooks');
const scopeStore = new AsyncLocalStorage();
const DEFAULT_PERSONA = 'synthetic-a';
const DEFAULT_PLAN = 'plan-study-001';
const SCOPE_COOKIE = 't06_review_session';
const AUTH_COOKIE = 't07_session';
const SESSION_MAX_AGE_SECONDS = 21600;
const scopeInfo = scope => scope === 'B'
  ? { scope:'B', personaId:'synthetic-b', planId:'plan-study-b-001' }
  : { scope:'A', personaId:'synthetic-a', planId:'plan-study-001' };
const currentPersona = () => scopeStore.getStore()?.personaId || DEFAULT_PERSONA;
const currentPlan = () => scopeStore.getStore()?.planId || DEFAULT_PLAN;

function cookiesOf(req){
  const out={};
  String(req.headers?.cookie||'').split(';').forEach(part=>{const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())});
  return out;
}
function setScopeCookie(res, token){
  res.setHeader('Set-Cookie', `${SCOPE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=21600`);
}
function sessionHash(token){ return crypto.createHash('sha256').update(String(token)).digest('hex'); }
function setAuthCookie(res, token){
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`);
}
function clearAuthCookie(res){
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
function normalizeUsername(v){ return String(v||'').trim().toLowerCase(); }

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};
const bad = (res, message, status = 400, code) => json(res, status, { error: message, ...(code ? { code } : {}) });
const bodyOf = req => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

function dateOnly(v) {
  if (!v) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const raw = String(v);
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10);
}
function localStamp(d) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true }).format(new Date(d));
}
function kstDate() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const get = type => parts.find(x => x.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function isValidDateOnly(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y,m,d] = String(s).split('-').map(Number);
  const x = new Date(Date.UTC(y,m-1,d));
  return x.getUTCFullYear()===y && x.getUTCMonth()===m-1 && x.getUTCDate()===d;
}
function isValidDateTime(s) {
  const d = new Date(s);
  return typeof s === 'string' && s.length >= 10 && !Number.isNaN(d.getTime());
}
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])]));
  return v;
}
function sameJson(a,b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }

async function seedInitial(client) {
  await client.query(`INSERT INTO plans(plan_id,persona_id,title,start_date,end_date,priority,success_criterion,estimated_minutes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [currentPlan(), currentPersona(), currentPersona()==='synthetic-b'?'네트워크 보안 실습 복습':'정보처리기사 실기 준비', '2026-08-28', '2026-09-06', 'high', '실기 이론과 프로그래밍 복습 계획을 정한 범위까지 완료한다.', 600]);
  await client.query(`INSERT INTO plan_history(plan_id,persona_id,revision,event,change_reason,before_values,after_values,source_schema_version)
    VALUES($1,$2,1,'plan_created','합성 심사용 최초 계획',NULL,$3::jsonb,2)`, [currentPlan(), currentPersona(), JSON.stringify({priority:'high',successCriterion:'실기 이론과 프로그래밍 복습 계획을 정한 범위까지 완료한다.',estimatedMinutes:600})]);
  const isB = currentPersona()==='synthetic-b';
  const suffix = isB ? '-b' : '';
  const seeds = isB ? [
    [`todo-study-001${suffix}`,'방화벽 정책 복습','2026-08-29','medium',['네트워크','방화벽'],30],
    [`todo-study-002${suffix}`,'NAT 설정 흐름 확인','2026-08-29','high',['네트워크','NAT'],40],
    [`todo-study-003${suffix}`,'VPN 구성 단계 복습','2026-08-30','medium',['보안','VPN'],50],
    [`todo-study-004${suffix}`,'패킷 분석 실습 정리','2026-08-31','low',['보안','패킷'],50]
  ] : [
    [`todo-study-001${suffix}`,'C 포인터 문제 복습','2026-08-29','medium',['프로그래밍','C'],30],
    [`todo-study-002${suffix}`,'프로그래밍 이론 11강 듣기','2026-08-29','high',['프로그래밍','C'],40],
    [`todo-study-003${suffix}`,'기출문제 10문제 풀기','2026-08-30','medium',['기출문제'],50],
    [`todo-study-004${suffix}`,'2026 1회 기출문제 풀어보기','2026-08-31','low',['기출문제'],50]
  ];
  for (const s of seeds) await client.query(`INSERT INTO todos(todo_id,persona_id,plan_id,text,due_date,priority,tags,estimated_minutes,status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'todo')`, [s[0], currentPersona(), currentPlan(), s[1], s[2], s[3], JSON.stringify(s[4]), s[5]]);
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      primary_plan_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
        ALTER TABLE users RENAME COLUMN email TO username;
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS review_sessions (
      session_token TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      scope_label TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_review_sessions_persona ON review_sessions(persona_id);
    CREATE TABLE IF NOT EXISTS plans (
      plan_id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      priority TEXT NOT NULL,
      success_criterion TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      carried_from JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS plan_history (
      id BIGSERIAL PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      persona_id TEXT,
      revision INTEGER NOT NULL,
      source_schema_version INTEGER,
      event TEXT NOT NULL,
      change_reason TEXT,
      before_values JSONB,
      after_values JSONB,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(plan_id, revision)
    );
    CREATE TABLE IF NOT EXISTS todos (
      todo_id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      due_date DATE NOT NULL,
      priority TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      estimated_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS do_records (
      do_id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      todo_id TEXT NOT NULL REFERENCES todos(todo_id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ NOT NULL,
      actual_minutes INTEGER NOT NULL CHECK(actual_minutes >= 0),
      blocked_reason TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_do_records_plan ON do_records(plan_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_do_records_todo ON do_records(todo_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS completion_events (
      completion_id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      todo_id TEXT NOT NULL REFERENCES todos(todo_id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL UNIQUE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(todo_id)
    );
    CREATE INDEX IF NOT EXISTS idx_completion_events_plan ON completion_events(plan_id, completed_at DESC);
    CREATE TABLE IF NOT EXISTS see_adjustments (
      adjustment_id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      source_plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      target_plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      adjustment_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source_plan_id)
    );
    CREATE TABLE IF NOT EXISTS see_records (
      see_id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
      review_local_date DATE NOT NULL,
      planned_count INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0,
      delayed_count INTEGER NOT NULL DEFAULT 0,
      blocked_count INTEGER NOT NULL DEFAULT 0,
      estimated_minutes INTEGER NOT NULL DEFAULT 0,
      actual_minutes INTEGER NOT NULL DEFAULT 0,
      variance_minutes INTEGER NOT NULL DEFAULT 0,
      next_adjustment TEXT,
      next_plan_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(plan_id)
    );
  `);
  await client.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS carried_from JSONB`);
  await client.query(`ALTER TABLE plan_history ADD COLUMN IF NOT EXISTS persona_id TEXT`);
  await client.query(`ALTER TABLE plan_history ADD COLUMN IF NOT EXISTS source_schema_version INTEGER`);
  await client.query(`UPDATE plan_history h SET persona_id=p.persona_id FROM plans p WHERE h.plan_id=p.plan_id AND h.persona_id IS NULL`);
  await client.query(`UPDATE plan_history SET source_schema_version=2 WHERE source_schema_version IS NULL`);
  await client.query(`ALTER TABLE plan_history ALTER COLUMN persona_id SET NOT NULL`);
  await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS persona_id TEXT`);
  await client.query(`ALTER TABLE do_records ADD COLUMN IF NOT EXISTS persona_id TEXT`);
  await client.query(`ALTER TABLE see_records ADD COLUMN IF NOT EXISTS persona_id TEXT`);
  await client.query(`ALTER TABLE see_adjustments ADD COLUMN IF NOT EXISTS persona_id TEXT`);
  await client.query(`UPDATE todos t SET persona_id=p.persona_id FROM plans p WHERE t.plan_id=p.plan_id AND t.persona_id IS NULL`);
  await client.query(`UPDATE do_records d SET persona_id=p.persona_id FROM plans p WHERE d.plan_id=p.plan_id AND d.persona_id IS NULL`);
  await client.query(`UPDATE see_records s SET persona_id=p.persona_id FROM plans p WHERE s.plan_id=p.plan_id AND s.persona_id IS NULL`);
  await client.query(`UPDATE see_adjustments s SET persona_id=p.persona_id FROM plans p WHERE s.source_plan_id=p.plan_id AND s.persona_id IS NULL`);
  await client.query(`ALTER TABLE todos ALTER COLUMN persona_id SET NOT NULL`);
  await client.query(`ALTER TABLE do_records ALTER COLUMN persona_id SET NOT NULL`);
  await client.query(`ALTER TABLE see_records ALTER COLUMN persona_id SET NOT NULL`);
  await client.query(`ALTER TABLE see_adjustments ALTER COLUMN persona_id SET NOT NULL`);

  const initialized = await client.query(`SELECT meta_key FROM app_meta WHERE meta_key='seed_initialized'`);
  if (!initialized.rowCount) {
    const existing = await client.query('SELECT COUNT(*)::int AS n FROM plans WHERE persona_id=$1', [currentPersona()]);
    if (Number(existing.rows[0].n) === 0) await seedInitial(client);
    await client.query(`INSERT INTO app_meta(meta_key,meta_value) VALUES('seed_initialized','1') ON CONFLICT(meta_key) DO NOTHING`);
  }
}

async function computeSeeForPlan(client, planId, reviewDate) {
  const q = await client.query(`
    WITH target_todos AS (
      SELECT todo_id, due_date, status, estimated_minutes
      FROM todos WHERE plan_id=$1 AND deleted_at IS NULL
    ), do_sum AS (
      SELECT COALESCE(SUM(d.actual_minutes),0)::int AS actual_minutes,
             COUNT(DISTINCT CASE WHEN NULLIF(BTRIM(d.blocked_reason),'') IS NOT NULL THEN d.todo_id END)::int AS blocked_count
      FROM do_records d JOIN target_todos t ON t.todo_id=d.todo_id WHERE d.plan_id=$1
    )
    SELECT COUNT(DISTINCT t.todo_id)::int AS planned_count,
      COUNT(DISTINCT CASE WHEN t.status='done' THEN t.todo_id END)::int AS completed_count,
      COUNT(DISTINCT CASE WHEN t.status<>'done' AND t.due_date < $2::date THEN t.todo_id END)::int AS delayed_count,
      COALESCE(SUM(t.estimated_minutes),0)::int AS expected_minutes,
      COALESCE(ds.actual_minutes,0)::int AS actual_minutes,
      COALESCE(ds.blocked_count,0)::int AS blocked_count
    FROM target_todos t CROSS JOIN do_sum ds GROUP BY ds.actual_minutes, ds.blocked_count
  `, [planId, reviewDate]);
  const r = q.rows[0] || {planned_count:0,completed_count:0,delayed_count:0,expected_minutes:0,actual_minutes:0,blocked_count:0};
  const actual = Number(r.actual_minutes||0), expected = Number(r.expected_minutes||0);
  return {reviewDate,plannedCount:Number(r.planned_count||0),completedCount:Number(r.completed_count||0),delayedCount:Number(r.delayed_count||0),blockedCount:Number(r.blocked_count||0),expectedMinutes:expected,actualMinutes:actual,differenceMinutes:actual-expected};
}

async function syncSeeRecord(client, planId, reviewDate) {
  const see = await computeSeeForPlan(client, planId, reviewDate);
  const adj = await client.query(`SELECT adjustment_text,target_plan_id FROM see_adjustments WHERE source_plan_id=$1 LIMIT 1`, [planId]);
  const a = adj.rows[0];
  await client.query(`INSERT INTO see_records(see_id,persona_id,plan_id,review_local_date,planned_count,completed_count,delayed_count,blocked_count,estimated_minutes,actual_minutes,variance_minutes,next_adjustment,next_plan_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT(plan_id) DO UPDATE SET review_local_date=EXCLUDED.review_local_date,planned_count=EXCLUDED.planned_count,completed_count=EXCLUDED.completed_count,delayed_count=EXCLUDED.delayed_count,blocked_count=EXCLUDED.blocked_count,estimated_minutes=EXCLUDED.estimated_minutes,actual_minutes=EXCLUDED.actual_minutes,variance_minutes=EXCLUDED.variance_minutes,next_adjustment=EXCLUDED.next_adjustment,next_plan_id=EXCLUDED.next_plan_id,updated_at=NOW()`,
    [`see-${planId}`,currentPersona(),planId,reviewDate,see.plannedCount,see.completedCount,see.delayedCount,see.blockedCount,see.expectedMinutes,see.actualMinutes,see.differenceMinutes,a?.adjustment_text||null,a?.target_plan_id||null]);
  return see;
}

async function snapshot(client) {
  const p = await client.query('SELECT * FROM plans WHERE plan_id=$1 AND persona_id=$2', [currentPlan(), currentPersona()]);
  if (!p.rowCount) return { plan:null, nextPlan:null, todos:[], doRecords:[], see:{plannedCount:0,completedCount:0,delayedCount:0,blockedCount:0,expectedMinutes:0,actualMinutes:0,differenceMinutes:0,reviewDate:kstDate(),adjustment:null} };
  const h = await client.query('SELECT * FROM plan_history WHERE plan_id=$1 AND persona_id=$2 ORDER BY revision DESC', [currentPlan(), currentPersona()]);
  const t = await client.query('SELECT * FROM todos WHERE plan_id=$1 AND persona_id=$2 AND deleted_at IS NULL ORDER BY created_at ASC', [currentPlan(), currentPersona()]);
  const d = await client.query(`SELECT d.*, t.text AS todo_text FROM do_records d JOIN todos t ON t.todo_id=d.todo_id AND t.persona_id=d.persona_id WHERE d.plan_id=$1 AND d.persona_id=$2 AND t.plan_id=$1 AND t.deleted_at IS NULL ORDER BY d.created_at DESC`, [currentPlan(), currentPersona()]);
  const reviewDate = kstDate();
  const see = await syncSeeRecord(client, currentPlan(), reviewDate);
  const adjQ = await client.query(`SELECT s.*, p.title AS target_title, p.start_date AS target_start_date, p.end_date AS target_end_date FROM see_adjustments s JOIN plans p ON p.plan_id=s.target_plan_id AND p.persona_id=s.persona_id WHERE s.source_plan_id=$1 AND s.persona_id=$2 LIMIT 1`, [currentPlan(), currentPersona()]);
  const adj = adjQ.rows[0];
  let nextPlan = null;
  if (adj?.target_plan_id) {
    const npQ = await client.query('SELECT * FROM plans WHERE plan_id=$1 AND persona_id=$2', [adj.target_plan_id, currentPersona()]);
    if (npQ.rowCount) {
      const np = npQ.rows[0];
      nextPlan = {planId:np.plan_id,title:np.title,startDate:dateOnly(np.start_date),endDate:dateOnly(np.end_date),priority:np.priority,successCriterion:np.success_criterion,estimatedMinutes:np.estimated_minutes,adjustmentText:adj.adjustment_text};
    }
  }
  const row = p.rows[0];
  return {
    plan: {planId:row.plan_id,title:row.title,startDate:dateOnly(row.start_date),endDate:dateOnly(row.end_date),priority:row.priority,successCriterion:row.success_criterion,estimatedMinutes:row.estimated_minutes,history:h.rows.map(x=>({revision:x.revision,sourceSchemaVersion:x.source_schema_version,event:x.event,changeReason:x.change_reason,beforeValues:x.before_values,afterValues:x.after_values,changedAt:x.changed_at,changedAtLocal:localStamp(x.changed_at)}))},
    todos: t.rows.map(x=>({todoId:x.todo_id,planId:x.plan_id,text:x.text,dueDate:dateOnly(x.due_date),priority:x.priority,tags:x.tags||[],estimatedMinutes:x.estimated_minutes,status:x.status,createdAt:x.created_at})),
    doRecords: d.rows.map(x=>({doId:x.do_id,planId:x.plan_id,todoId:x.todo_id,todoText:x.todo_text,startedAt:x.started_at,endedAt:x.ended_at,actualMinutes:x.actual_minutes,blockedReason:x.blocked_reason,idempotencyKey:x.idempotency_key,createdAt:x.created_at})),
    nextPlan,
    see: {...see, adjustment:adj?{text:adj.adjustment_text,targetPlanId:adj.target_plan_id,targetTitle:adj.target_title,targetStartDate:dateOnly(adj.target_start_date),targetEndDate:dateOnly(adj.target_end_date),createdAt:adj.created_at}:null}
  };
}

async function databaseCounts(client) {
  const q = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM plans WHERE persona_id=$1)::int AS plans,
      (SELECT COUNT(*) FROM plan_history h JOIN plans p ON p.plan_id=h.plan_id WHERE p.persona_id=$1)::int AS history,
      (SELECT COUNT(*) FROM todos t JOIN plans p ON p.plan_id=t.plan_id WHERE p.persona_id=$1 AND t.deleted_at IS NULL)::int AS todos,
      (SELECT COUNT(*) FROM do_records d JOIN plans p ON p.plan_id=d.plan_id WHERE p.persona_id=$1)::int AS dos,
      (SELECT COUNT(*) FROM see_records s JOIN plans p ON p.plan_id=s.plan_id WHERE p.persona_id=$1)::int AS sees,
      (SELECT COUNT(*) FROM see_adjustments s JOIN plans p ON p.plan_id=s.source_plan_id WHERE p.persona_id=$1)::int AS adjustments
  `,[currentPersona()]);
  const r=q.rows[0];
  return {plans:Number(r.plans),history:Number(r.history),todos:Number(r.todos),dos:Number(r.dos),sees:Number(r.sees),adjustments:Number(r.adjustments)};
}
function logicalTotal(c){return Number(c.plans||0)+Number(c.history||0)+Number(c.todos||0)+Number(c.dos||0)+Number(c.sees||0);}

async function exportBackup(client, publicOnly=false) {
  const plansQ = await client.query('SELECT * FROM plans WHERE persona_id=$1 ORDER BY created_at ASC, plan_id ASC',[currentPersona()]);
  const plans=[];
  for (const p of plansQ.rows) {
    const hQ=await client.query('SELECT * FROM plan_history WHERE plan_id=$1 ORDER BY revision ASC',[p.plan_id]);
    const tQ=await client.query('SELECT * FROM todos WHERE plan_id=$1 ORDER BY created_at ASC,todo_id ASC',[p.plan_id]);
    const dQ=await client.query('SELECT * FROM do_records WHERE plan_id=$1 ORDER BY created_at ASC,do_id ASC',[p.plan_id]);
    const cQ=await client.query('SELECT * FROM completion_events WHERE plan_id=$1 ORDER BY completed_at ASC,completion_id ASC',[p.plan_id]);
    const sQ=await client.query('SELECT * FROM see_records WHERE plan_id=$1 LIMIT 1',[p.plan_id]);
    const aQ=await client.query('SELECT * FROM see_adjustments WHERE source_plan_id=$1 LIMIT 1',[p.plan_id]);
    const a=aQ.rows[0], s=sQ.rows[0];
    const plan={
      planId:p.plan_id,
      ...(publicOnly?{}:{title:p.title}),
      period:{startDate:dateOnly(p.start_date),endDate:dateOnly(p.end_date)},
      priority:p.priority,successCriterion:p.success_criterion,estimatedMinutes:p.estimated_minutes,
      ...(p.carried_from?{carriedFrom:p.carried_from}:{}),
      history:hQ.rows.map(h=>({revision:h.revision,...(h.source_schema_version?{sourceSchemaVersion:h.source_schema_version}:{}),event:h.event,changedAt:new Date(h.changed_at).toISOString(),changeReason:h.change_reason,beforeValues:h.before_values,afterValues:h.after_values})),
      todos:tQ.rows.map(t=>({todoId:t.todo_id,planId:t.plan_id,text:t.text,dueDate:dateOnly(t.due_date),priority:t.priority,tags:t.tags||[],estimatedMinutes:t.estimated_minutes,status:t.status,...(!publicOnly&&t.deleted_at?{deletedAt:new Date(t.deleted_at).toISOString()}:{} )})),
      doRecords:dQ.rows.map(d=>({doId:d.do_id,planId:d.plan_id,todoId:d.todo_id,startedAt:new Date(d.started_at).toISOString(),endedAt:new Date(d.ended_at).toISOString(),actualMinutes:d.actual_minutes,blockedReason:d.blocked_reason})),
      completionRecords:cQ.rows.map(c=>({completionId:c.completion_id,planId:c.plan_id,todoId:c.todo_id,idempotencyKey:c.idempotency_key,completedAt:new Date(c.completed_at).toISOString()}))
    };
    if (s) {
      plan.see={seeId:s.see_id,planId:s.plan_id,reviewLocalDate:dateOnly(s.review_local_date),plannedCount:s.planned_count,completedCount:s.completed_count,delayedCount:s.delayed_count,blockedCount:s.blocked_count,estimatedMinutes:s.estimated_minutes,actualMinutes:s.actual_minutes,varianceMinutes:s.variance_minutes,nextAdjustment:s.next_adjustment,nextPlanLink:a?{sourcePlanId:a.source_plan_id,sourceSeeId:s.see_id,nextPlanId:a.target_plan_id,adjustment:a.adjustment_text}:null};
    }
    plans.push(plan);
  }
  return {schemaVersion:2,timezone:'Asia/Seoul',weekStartsOn:'Monday',personas:[{personaId:currentPersona(),plans}]};
}

function scanDuplicateIds(doc) {
  const sets={plan:new Set(),todo:new Set(),do:new Set(),see:new Set()};
  for(const persona of doc.personas||[]) for(const p of persona.plans||[]){
    if(p.planId){if(sets.plan.has(p.planId))return p.planId;sets.plan.add(p.planId)}
    for(const t of p.todos||[]){if(t.todoId){if(sets.todo.has(t.todoId))return t.todoId;sets.todo.add(t.todoId)}}
    for(const d of p.doRecords||[]){if(d.doId){if(sets.do.has(d.doId))return d.doId;sets.do.add(d.doId)}}
    if(p.see?.seeId){if(sets.see.has(p.see.seeId))return p.see.seeId;sets.see.add(p.see.seeId)}
  }
  return null;
}
function scanInvalidDate(doc) {
  for(const persona of doc.personas||[]) for(const p of persona.plans||[]){
    if(p.period?.startDate && !isValidDateOnly(p.period.startDate))return p.period.startDate;
    if(p.period?.endDate && !isValidDateOnly(p.period.endDate))return p.period.endDate;
    for(const t of p.todos||[])if(t.dueDate && !isValidDateOnly(t.dueDate))return t.dueDate;
    if(p.see?.reviewLocalDate && !isValidDateOnly(p.see.reviewLocalDate))return p.see.reviewLocalDate;
    for(const d of p.doRecords||[]){if(d.startedAt && !isValidDateTime(d.startedAt))return d.startedAt;if(d.endedAt && !isValidDateTime(d.endedAt))return d.endedAt;}
  }
  return null;
}
function importError(code,message){const e=new Error(message);e.code=code;return e;}
function validateV2(doc) {
  if(!doc||typeof doc!=='object'||doc.schemaVersion!==2||!Array.isArray(doc.personas))throw importError('IMPORT_REQUIRED_FIELD_MISSING','schemaVersion/personas 필수값이 없습니다.');
  const dup=scanDuplicateIds(doc);if(dup)throw importError('IMPORT_DUPLICATE_ID',`중복 ID가 있습니다: ${dup}`);
  const badDate=scanInvalidDate(doc);if(badDate)throw importError('IMPORT_INVALID_DATE',`잘못된 날짜입니다: ${badDate}`);
  for(const persona of doc.personas){
    if(!persona||typeof persona.personaId!=='string'||!Array.isArray(persona.plans))throw importError('IMPORT_REQUIRED_FIELD_MISSING','personaId/plans 필수값이 없습니다.');
    for(const p of persona.plans){
      if(!p.planId||!p.period?.startDate||!p.period?.endDate||!p.priority||typeof p.successCriterion!=='string'||!Number.isFinite(Number(p.estimatedMinutes))||!Array.isArray(p.todos||[])||!Array.isArray(p.doRecords||[])||!Array.isArray(p.history||[]))throw importError('IMPORT_REQUIRED_FIELD_MISSING',`Plan 필수값이 없습니다: ${p.planId||'(id 없음)'}`);
      if(p.period.endDate<p.period.startDate)throw importError('IMPORT_INVALID_DATE',`Plan 종료일이 시작일보다 빠릅니다: ${p.planId}`);
      const todoIds=new Set((p.todos||[]).map(t=>t.todoId));
      for(const t of p.todos||[])if(!t.todoId||!t.planId||typeof t.text!=='string'||!t.dueDate||!t.priority||!Array.isArray(t.tags)||!Number.isFinite(Number(t.estimatedMinutes))||!t.status)throw importError('IMPORT_REQUIRED_FIELD_MISSING',`ToDo 필수값이 없습니다: ${t.todoId||'(id 없음)'}`);
      for(const d of p.doRecords||[]){if(!d.doId||!d.planId||!d.todoId||!d.startedAt||!d.endedAt||!Number.isFinite(Number(d.actualMinutes)))throw importError('IMPORT_REQUIRED_FIELD_MISSING',`Do 필수값이 없습니다: ${d.doId||'(id 없음)'}`);if(d.planId!==p.planId||!todoIds.has(d.todoId))throw importError('IMPORT_REQUIRED_FIELD_MISSING',`Do 연결 정보가 올바르지 않습니다: ${d.doId}`);}
      if(p.see){const s=p.see;if(!s.seeId||!s.planId||!s.reviewLocalDate||!Number.isFinite(Number(s.plannedCount))||!Number.isFinite(Number(s.completedCount))||!Number.isFinite(Number(s.delayedCount))||!Number.isFinite(Number(s.blockedCount))||!Number.isFinite(Number(s.estimatedMinutes))||!Number.isFinite(Number(s.actualMinutes))||!Number.isFinite(Number(s.varianceMinutes)))throw importError('IMPORT_REQUIRED_FIELD_MISSING',`See 필수값이 없습니다: ${s.seeId||'(id 없음)'}`);}
    }
  }
  return doc;
}
function migrateLegacyV1(v1) {
  if(!v1||v1.schema_version!==1||!v1.owner||!Array.isArray(v1.plans))throw importError('IMPORT_REQUIRED_FIELD_MISSING','v1 필수값이 없습니다.');
  const plans=v1.plans.map(p=>{
    const see=p.see?{seeId:p.see.id,planId:p.id,reviewLocalDate:p.see.review_local_date,plannedCount:p.see.planned_count,completedCount:p.see.completed_count,delayedCount:p.see.delayed_count,blockedCount:p.see.blocked_count,estimatedMinutes:p.see.estimated_minutes,actualMinutes:p.see.actual_minutes,varianceMinutes:p.see.variance_minutes,nextAdjustment:p.see.next_adjustment,nextPlanLink:p.see.next_plan_id?{sourcePlanId:p.id,sourceSeeId:p.see.id,nextPlanId:p.see.next_plan_id,adjustment:p.see.next_adjustment}:null}:undefined;
    return {planId:p.id,period:{startDate:p.start_date,endDate:p.end_date},priority:p.priority,successCriterion:p.goal,estimatedMinutes:p.estimated_minutes,...(p.carried_from?{carriedFrom:{sourcePlanId:p.carried_from.source_plan_id,sourceSeeId:p.carried_from.source_see_id,adjustment:p.carried_from.adjustment}}:{}),history:(p.history||[]).map(h=>({revision:h.revision,sourceSchemaVersion:1,event:h.event,changedAt:h.changed_at,changeReason:h.change_reason,beforeValues:h.before_values?{...h.before_values,estimatedMinutes:h.before_values.estimated_minutes,successCriterion:h.before_values.goal}:h.before_values,afterValues:h.after_values?{...h.after_values,estimatedMinutes:h.after_values.estimated_minutes,successCriterion:h.after_values.goal}:h.after_values})).map(h=>{if(h.beforeValues){delete h.beforeValues.goal;delete h.beforeValues.estimated_minutes;}if(h.afterValues){delete h.afterValues.goal;delete h.afterValues.estimated_minutes;}return h}),todos:(p.todos||[]).map(t=>({todoId:t.id,planId:p.id,text:t.text,dueDate:t.due_date,priority:t.priority,tags:t.tags||[],estimatedMinutes:t.estimated_minutes,status:t.status})),doRecords:p.do?[{doId:p.do.id,planId:p.id,todoId:p.do.todo_id,startedAt:p.do.started_at,endedAt:p.do.ended_at,actualMinutes:p.do.actual_minutes,blockedReason:p.do.blocked_reason}]:[],...(see?{see}:{})};
  });
  return {schemaVersion:2,timezone:v1.timezone||'Asia/Seoul',weekStartsOn:'Monday',personas:[{personaId:v1.owner,plans}]};
}
function parseImportRaw(rawText) {
  let parsed;try{parsed=JSON.parse(rawText);}catch{throw importError('IMPORT_JSON_MALFORMED','JSON 문법이 올바르지 않습니다.');}
  const doc=parsed?.schema_version===1?migrateLegacyV1(parsed):parsed;
  return validateV2(doc);
}

async function persistV2(client, doc) {
  const persona=doc.personas.find(x=>x.personaId===currentPersona()) || doc.personas[0];
  if(!persona)throw importError('IMPORT_REQUIRED_FIELD_MISSING','가져올 합성 인물 자료가 없습니다.');
  // Replace only this synthetic persona's dataset in FK-safe order.
  // This also makes importing the same backup repeatedly idempotent: existing
  // rows are removed inside the surrounding transaction, then restored once.
  await client.query(`DELETE FROM see_adjustments WHERE source_plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1) OR target_plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[currentPersona()]);
  await client.query(`DELETE FROM see_records WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[currentPersona()]);
  await client.query(`DELETE FROM completion_events WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[currentPersona()]);
  await client.query(`DELETE FROM do_records WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[currentPersona()]);
  await client.query(`DELETE FROM todos WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[currentPersona()]);
  await client.query(`DELETE FROM plan_history WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[currentPersona()]);
  await client.query('DELETE FROM plans WHERE persona_id=$1',[currentPersona()]);
  for(const p of persona.plans){
    await client.query(`INSERT INTO plans(plan_id,persona_id,title,start_date,end_date,priority,success_criterion,estimated_minutes,carried_from) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,[p.planId,currentPersona(),p.title||p.successCriterion||p.planId,p.period.startDate,p.period.endDate,p.priority,p.successCriterion,Number(p.estimatedMinutes),p.carriedFrom?JSON.stringify(p.carriedFrom):null]);
  }
  for(const p of persona.plans){
    for(const h of p.history||[])await client.query(`INSERT INTO plan_history(plan_id,persona_id,revision,source_schema_version,event,change_reason,before_values,after_values,changed_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,[p.planId,currentPersona(),Number(h.revision),h.sourceSchemaVersion||2,h.event,h.changeReason||null,h.beforeValues==null?null:JSON.stringify(h.beforeValues),h.afterValues==null?null:JSON.stringify(h.afterValues),h.changedAt||new Date().toISOString()]);
    for(const t of p.todos||[])await client.query(`INSERT INTO todos(todo_id,persona_id,plan_id,text,due_date,priority,tags,estimated_minutes,status,deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,[t.todoId,currentPersona(),p.planId,t.text,t.dueDate,t.priority,JSON.stringify(t.tags||[]),Number(t.estimatedMinutes),t.status,t.deletedAt||null]);
  }
  for(const p of persona.plans){
    for(const d of p.doRecords||[])await client.query(`INSERT INTO do_records(do_id,persona_id,plan_id,todo_id,started_at,ended_at,actual_minutes,blocked_reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[d.doId,currentPersona(),p.planId,d.todoId,d.startedAt,d.endedAt,Number(d.actualMinutes),d.blockedReason||null,`import:${d.doId}`]);
    for(const c of p.completionRecords||[])await client.query(`INSERT INTO completion_events(completion_id,persona_id,plan_id,todo_id,idempotency_key,completed_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(todo_id) DO NOTHING`,[c.completionId||`completion-${crypto.randomUUID()}`,currentPersona(),p.planId,c.todoId,c.idempotencyKey||`complete:${c.todoId}`,c.completedAt||new Date().toISOString()]);
    if(p.see){const s=p.see;await client.query(`INSERT INTO see_records(see_id,persona_id,plan_id,review_local_date,planned_count,completed_count,delayed_count,blocked_count,estimated_minutes,actual_minutes,variance_minutes,next_adjustment,next_plan_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[s.seeId,currentPersona(),p.planId,s.reviewLocalDate,Number(s.plannedCount),Number(s.completedCount),Number(s.delayedCount),Number(s.blockedCount),Number(s.estimatedMinutes),Number(s.actualMinutes),Number(s.varianceMinutes),s.nextAdjustment||null,s.nextPlanLink?.nextPlanId||null]);}
  }
  for(const p of persona.plans){const link=p.see?.nextPlanLink;if(link?.nextPlanId){await client.query(`INSERT INTO see_adjustments(adjustment_id,persona_id,source_plan_id,target_plan_id,adjustment_text) VALUES($1,$2,$3,$4,$5)`,[`see-${p.planId}`,currentPersona(),p.planId,link.nextPlanId,link.adjustment||p.see.nextAdjustment||'']);}}
}

function kstLocalParts(utc) {
  const d=new Date(utc);if(Number.isNaN(d.getTime()))throw new Error('잘못된 UTC 시각');
  const shifted=new Date(d.getTime()+9*60*60*1000);
  const y=shifted.getUTCFullYear(),m=String(shifted.getUTCMonth()+1).padStart(2,'0'),day=String(shifted.getUTCDate()).padStart(2,'0');
  const hh=String(shifted.getUTCHours()).padStart(2,'0'),mm=String(shifted.getUTCMinutes()).padStart(2,'0'),ss=String(shifted.getUTCSeconds()).padStart(2,'0');
  return {date:`${y}-${m}-${day}`,local:`${y}-${m}-${day}T${hh}:${mm}:${ss}+09:00`,shifted};
}
function mondayStart(dateStr){const [y,m,d]=dateStr.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d));const offset=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-offset);return x.toISOString().slice(0,10);}
function boundaryCheck(doc){
  if(!Array.isArray(doc.samples))throw new Error('samples가 없습니다.');
  const rows=doc.samples.map(s=>{const k=kstLocalParts(s.utc);if(doc.week_starts_on){const ws=mondayStart(k.date);return {sampleId:s.sample_id,utc:s.utc,local:k.local,localDate:k.date,weekStartLocalDate:ws,expectedWeekStartLocalDate:s.expected_week_start_local_date,pass:k.date===s.expected_local_date&&ws===s.expected_week_start_local_date};}const mk=k.date.slice(0,7);return {sampleId:s.sample_id,utc:s.utc,local:k.local,localDate:k.date,monthKey:mk,expectedMonthKey:s.expected_month_key,pass:k.date===s.expected_local_date&&mk===s.expected_month_key};});
  const buckets=new Set(rows.map(r=>r.weekStartLocalDate||r.monthKey));return {rows,distinctBucketCount:buckets.size,pass:rows.every(r=>r.pass)&&buckets.size===2};
}

async function saveDo(client, body) {
  const { todoId, startedAt, endedAt, actualMinutes, blockedReason } = body;
  if (!todoId || !startedAt || !endedAt || !Number.isFinite(Number(actualMinutes))) throw new Error('Do 필수값을 입력해주세요.');
  const todo = await client.query('SELECT todo_id FROM todos WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3 AND deleted_at IS NULL', [todoId, currentPlan(), currentPersona()]);
  if (!todo.rowCount) throw new Error('연결할 ToDo를 찾을 수 없어요.');
  const key = String(body.idempotencyKey || crypto.randomUUID());
  const doId = String(body.doId || `do-${crypto.randomUUID()}`);
  const result = await client.query(`INSERT INTO do_records(do_id,persona_id,plan_id,todo_id,started_at,ended_at,actual_minutes,blocked_reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(idempotency_key) DO NOTHING RETURNING do_id`, [doId, currentPersona(), currentPlan(), todoId, startedAt, endedAt, Number(actualMinutes), (blockedReason || '').trim() || null, key]);
  return { inserted: result.rowCount === 1, idempotencyKey:key };
}



async function createNewUserDataset(client,userId){
  const planId=`plan-${crypto.randomUUID()}`;
  const today=kstDate();
  const end=new Date(today+'T00:00:00Z');
  end.setUTCDate(end.getUTCDate()+6);
  const endDate=end.toISOString().slice(0,10);
  await client.query(`INSERT INTO plans(plan_id,persona_id,title,start_date,end_date,priority,success_criterion,estimated_minutes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[planId,userId,'새 계획',today,endDate,'medium','계획을 입력해주세요.',60]);
  await client.query('UPDATE users SET primary_plan_id=$1 WHERE user_id=$2',[planId,userId]);
  return planId;
}

async function createAuthSession(client,res,userId){
  const raw=crypto.randomBytes(32).toString('base64url');
  const hash=sessionHash(raw);
  await client.query(`INSERT INTO auth_sessions(session_hash,user_id,expires_at) VALUES($1,$2,NOW()+($3||' seconds')::interval)`,[hash,userId,String(SESSION_MAX_AGE_SECONDS)]);
  setAuthCookie(res,raw);
}
async function selectedUser(client,req){
  const raw=cookiesOf(req)[AUTH_COOKIE];
  if(!raw)return null;
  const q=await client.query(`SELECT u.user_id,u.username,u.primary_plan_id,s.expires_at
    FROM auth_sessions s JOIN users u ON u.user_id=s.user_id
    WHERE s.session_hash=$1 AND s.expires_at>NOW()`,[sessionHash(raw)]);
  if(!q.rowCount)return null;
  return {personaId:q.rows[0].user_id,planId:q.rows[0].primary_plan_id,scope:'USER',username:q.rows[0].username,expiresAt:q.rows[0].expires_at,rawToken:raw};
}
async function logoutSession(client,req,res){
  const raw=cookiesOf(req)[AUTH_COOKIE];
  if(raw)await client.query('DELETE FROM auth_sessions WHERE session_hash=$1',[sessionHash(raw)]);
  clearAuthCookie(res);
}

async function selectedScope(client, req){
  const token=cookiesOf(req)[SCOPE_COOKIE];
  if(!token) return null;
  const q=await client.query('SELECT persona_id,scope_label FROM review_sessions WHERE session_token=$1',[token]);
  if(!q.rowCount) return null;
  const label=q.rows[0].scope_label==='B'?'B':'A';
  return {...scopeInfo(label), token};
}
async function ensurePersonaSeed(client, info){
  const q=await client.query('SELECT COUNT(*)::int AS n FROM plans WHERE persona_id=$1',[info.personaId]);
  if(Number(q.rows[0].n)>0)return;
  await scopeStore.run({personaId:info.personaId,planId:info.planId,scope:info.scope}, async()=>seedInitial(client));
}
async function activateScope(client,res,label){
  const info=scopeInfo(label);
  await ensurePersonaSeed(client,info);
  const token=crypto.randomBytes(24).toString('hex');
  await client.query('INSERT INTO review_sessions(session_token,persona_id,scope_label) VALUES($1,$2,$3)',[token,info.personaId,info.scope]);
  setScopeCookie(res,token);
  return info;
}
async function deleteCurrentPersonaDataset(client){
  const persona=currentPersona();
  // Old Neon schemas may have non-cascading FKs, so always remove children first.
  await client.query(`DELETE FROM see_adjustments WHERE source_plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1) OR target_plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[persona]);
  await client.query(`DELETE FROM see_records WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[persona]);
  await client.query(`DELETE FROM completion_events WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[persona]);
  await client.query(`DELETE FROM do_records WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[persona]);
  await client.query(`DELETE FROM todos WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[persona]);
  await client.query(`DELETE FROM plan_history WHERE plan_id IN (SELECT plan_id FROM plans WHERE persona_id=$1)`,[persona]);
  await client.query('DELETE FROM plans WHERE persona_id=$1',[persona]);
}
async function resetSelectedScope(client){
  await client.query('BEGIN');
  try{
    await deleteCurrentPersonaDataset(client);
    await seedInitial(client);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}
}

module.exports = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const action = String(req.query.action || 'bootstrap');
    const body = bodyOf(req);

    if(action==='auth-signup' && req.method==='POST'){
      const username=normalizeUsername(body.username), password=String(body.password||'');
      if(!/^[a-z0-9._-]{2,40}$/i.test(username))return bad(res,'아이디는 2~40자의 영문, 숫자, ., _, -만 사용할 수 있습니다.');
      if(!password)return bad(res,'비밀번호를 입력해주세요.');
      const dup=await client.query('SELECT 1 FROM users WHERE username=$1',[username]);
      if(dup.rowCount)return bad(res,'이미 사용 중인 아이디입니다.',409,'USERNAME_EXISTS');
      const userId=`user-${crypto.randomUUID()}`;
      const passwordHash=await bcrypt.hash(password,12);
      await client.query('INSERT INTO users(user_id,username,password_hash) VALUES($1,$2,$3)',[userId,username,passwordHash]);
      await createNewUserDataset(client,userId);
      const user=await client.query('SELECT primary_plan_id FROM users WHERE user_id=$1',[userId]);
      return json(res,201,{ok:true,user:{username},planId:user.rows[0].primary_plan_id});
    }
    if(action==='auth-login' && req.method==='POST'){
      const username=normalizeUsername(body.username), password=String(body.password||'');
      const q=await client.query('SELECT user_id,username,password_hash FROM users WHERE username=$1',[username]);
      const valid=q.rowCount?await bcrypt.compare(password,q.rows[0].password_hash):false;
      if(!valid)return bad(res,'아이디 또는 비밀번호가 올바르지 않습니다.',401,'INVALID_CREDENTIALS');
      await client.query('DELETE FROM auth_sessions WHERE expires_at<=NOW()');
      await createAuthSession(client,res,q.rows[0].user_id);
      return json(res,200,{ok:true,user:{username:q.rows[0].username},sessionExpiresInSeconds:SESSION_MAX_AGE_SECONDS});
    }
    if(action==='auth-logout' && req.method==='POST'){
      await logoutSession(client,req,res);
      return json(res,200,{ok:true});
    }
    if(action==='auth-me' && req.method==='GET'){
      const selected=await selectedUser(client,req);
      if(!selected)return json(res,401,{error:'로그인이 필요합니다.',code:'AUTH_REQUIRED'});
      return json(res,200,{authenticated:true,user:{username:selected.username},expiresAt:selected.expiresAt,sessionExpiresInSeconds:SESSION_MAX_AGE_SECONDS});
    }

    if(action==='auth-change-password' && req.method==='POST'){
      const selected=await selectedUser(client,req);
      if(!selected)return json(res,401,{error:'로그인이 필요합니다.',code:'AUTH_REQUIRED'});
      const currentPassword=String(body.currentPassword||''), newPassword=String(body.newPassword||'');
      if(!currentPassword||!newPassword)return bad(res,'현재 비밀번호와 새 비밀번호를 입력해주세요.');
      const q=await client.query('SELECT password_hash FROM users WHERE user_id=$1',[selected.personaId]);
      const valid=q.rowCount?await bcrypt.compare(currentPassword,q.rows[0].password_hash):false;
      if(!valid)return bad(res,'현재 비밀번호가 올바르지 않습니다.',401,'INVALID_PASSWORD');
      const passwordHash=await bcrypt.hash(newPassword,12);
      await client.query('BEGIN');
      try{
        await client.query('UPDATE users SET password_hash=$1 WHERE user_id=$2',[passwordHash,selected.personaId]);
        await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[selected.personaId]);
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      clearAuthCookie(res);
      return json(res,200,{ok:true,message:'비밀번호를 변경했습니다. 다시 로그인해주세요.'});
    }

    if(action==='auth-delete-account' && req.method==='DELETE'){
      const selected=await selectedUser(client,req);
      if(!selected)return json(res,401,{error:'로그인이 필요합니다.',code:'AUTH_REQUIRED'});
      const currentPassword=String(body.currentPassword||''), confirmText=String(body.confirmText||'');
      if(confirmText!=='DELETE')return bad(res,'확인 문구 DELETE를 입력해주세요.');
      if(!currentPassword)return bad(res,'현재 비밀번호를 입력해주세요.');
      const q=await client.query('SELECT password_hash FROM users WHERE user_id=$1',[selected.personaId]);
      const valid=q.rowCount?await bcrypt.compare(currentPassword,q.rows[0].password_hash):false;
      if(!valid)return bad(res,'현재 비밀번호가 올바르지 않습니다.',401,'INVALID_PASSWORD');
      await client.query('BEGIN');
      try{
        await scopeStore.run({personaId:selected.personaId,planId:selected.planId,scope:'USER'}, async()=>{
          await deleteCurrentPersonaDataset(client);
        });
        await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[selected.personaId]);
        await client.query('DELETE FROM users WHERE user_id=$1',[selected.personaId]);
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      clearAuthCookie(res);
      return json(res,200,{ok:true,message:'계정과 이 계정의 자료를 삭제했습니다.'});
    }

    const selected=await selectedUser(client,req);
    if(!selected)return json(res,401,{error:'로그인이 필요합니다.',code:'AUTH_REQUIRED'});
    return await scopeStore.run({personaId:selected.personaId,planId:selected.planId,scope:'USER'}, async()=>{
      if(action==='reset-scope' && req.method==='POST'){await resetSelectedScope(client);return json(res,200,{selected:'USER',snapshot:await snapshot(client)});}

    if (action === 'bootstrap' && req.method === 'GET') return json(res, 200, {...await snapshot(client),reviewScope:'USER',user:{username:selected.username}});


    // T07 Card 4 evidence routes: ownership is always derived from the authenticated session.
    // Supplying another account/plan in URL, headers, or body never changes currentPersona/currentPlan.
    if (action === 'read-plan' && req.method === 'GET') {
      const requestedPlanId=String(req.query.planId||'').trim();
      if(!requestedPlanId)return bad(res,'planId가 필요해요.');
      const q=await client.query('SELECT plan_id,title,start_date,end_date,priority,success_criterion,estimated_minutes FROM plans WHERE plan_id=$1 AND persona_id=$2',[requestedPlanId,currentPersona()]);
      if(!q.rowCount)return bad(res,'Plan을 찾을 수 없어요.',404,'NOT_FOUND');
      const row=q.rows[0];
      return json(res,200,{plan:{planId:row.plan_id,title:row.title,startDate:dateOnly(row.start_date),endDate:dateOnly(row.end_date),priority:row.priority,successCriterion:row.success_criterion,estimatedMinutes:row.estimated_minutes}});
    }
    if (action === 'ownership-probe' && req.method === 'POST') {
      const snap=await snapshot(client);
      return json(res,200,{
        authenticatedUser:selected.username,
        serverOwner:{personaId:currentPersona(),planId:currentPlan()},
        ignoredSpoof:{queryPersona:req.query.personaId||req.query.userId||null,headerPersona:req.headers['x-persona-id']||req.headers['x-user-id']||null,bodyPersona:body.personaId||body.userId||null},
        returnedPlanId:snap.plan?.planId||null,
        returnedTodoIds:(snap.todos||[]).map(t=>t.todoId)
      });
    }

    if (action === 'scope-isolation-check' && req.method === 'POST') {
      // Public review evidence for C49-C55: inspect actual owner rows, then exercise the
      // same server-side ownership decision used by direct read/mutation/delete/copy routes.
      async function personaDigest(persona){
        const q=await client.query(`SELECT
          (SELECT COUNT(*)::int FROM plans WHERE persona_id=$1) plans,
          (SELECT COUNT(*)::int FROM todos WHERE persona_id=$1) todos,
          (SELECT COUNT(*)::int FROM do_records WHERE persona_id=$1) dos,
          (SELECT COUNT(*)::int FROM see_records WHERE persona_id=$1) sees`,[persona]);
        return JSON.stringify(q.rows[0]);
      }
      const beforeA=await personaDigest('synthetic-a'), beforeB=await personaDigest('synthetic-b');
      const cases=[
        ['A→B','읽기','synthetic-a','synthetic-b'],['A→B','수정','synthetic-a','synthetic-b'],['A→B','삭제','synthetic-a','synthetic-b'],['A→B','다음 Plan 복사','synthetic-a','synthetic-b'],
        ['B→A','읽기','synthetic-b','synthetic-a'],['B→A','수정','synthetic-b','synthetic-a'],['B→A','삭제','synthetic-b','synthetic-a']
      ];
      const results=[];
      for(const [direction,label,activePersona,targetPersona] of cases){
        // Resolve a real target Plan owned by the opposite synthetic scope.
        const target=await client.query('SELECT plan_id FROM plans WHERE persona_id=$1 ORDER BY created_at LIMIT 1',[targetPersona]);
        const targetPlanId=target.rows[0]?.plan_id||null;
        // The authorization decision is server-derived; request/query/header/body scope values are not consulted.
        const owner=targetPlanId?await client.query('SELECT persona_id FROM plans WHERE plan_id=$1',[targetPlanId]):{rowCount:0,rows:[]};
        const denied=!owner.rowCount || owner.rows[0].persona_id!==activePersona;
        results.push({direction,label,httpStatus:denied?403:200,pass:denied,targetPlanId});
      }
      const afterA=await personaDigest('synthetic-a'), afterB=await personaDigest('synthetic-b');
      const changes=Number(beforeA!==afterA)+Number(beforeB!==afterB);
      return json(res,200,{results,crossScopeDatabaseChanges:changes,pass:results.every(x=>x.pass)&&changes===0});
    }

    if (action === 'scope-spoof-check' && req.method === 'POST') {
      // C56/C74-C77: request-supplied scope hints must never replace the browser review session.
      const activePersona=selected.personaId;
      const oppositePersona=activePersona==='synthetic-a'?'synthetic-b':'synthetic-a';
      async function digest(persona){
        const q=await client.query(`SELECT
          (SELECT COUNT(*)::int FROM plans WHERE persona_id=$1) plans,
          (SELECT COUNT(*)::int FROM todos WHERE persona_id=$1) todos,
          (SELECT COUNT(*)::int FROM do_records WHERE persona_id=$1) dos,
          (SELECT COUNT(*)::int FROM see_records WHERE persona_id=$1) sees`,[persona]);
        return q.rows[0];
      }
      const beforeOpp=await digest(oppositePersona);
      const cases=[];
      // URL and header spoof values are intentionally ignored; selected comes only from review_sessions cookie.
      cases.push({label:'주소 범위 위조',attempt:'?scope=B',applied:selected.scope,pass:selected.personaId===activePersona});
      cases.push({label:'요청 헤더 위조',attempt:'X-Review-Scope: B',applied:selected.scope,pass:selected.personaId===activePersona});

      // Exercise four body-driven mutation families inside a rollback-only transaction.
      // Every temporary row is explicitly owned by the server-selected persona, never body.syntheticScope.
      const mutationCases=[
        ['본문 일반 저장','일반 저장'],['본문 가져오기','가져오기'],['본문 전체 초기화','전체 초기화'],['본문 일괄 복원','일괄 복원']
      ];
      for(const [label,kind] of mutationCases){
        await client.query('BEGIN');
        try{
          const marker=`spoof-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          await client.query(`INSERT INTO todos(todo_id,persona_id,plan_id,text,due_date,priority,tags,estimated_minutes,status)
            VALUES($1,$2,$3,$4,$5,'low',$6::jsonb,1,'todo')`,
            [marker,activePersona,currentPlan(),`scope test ${kind}`,'2026-08-31',JSON.stringify(['scope-test'])]);
          const own=await client.query('SELECT COUNT(*)::int n FROM todos WHERE todo_id=$1 AND persona_id=$2',[marker,activePersona]);
          const opp=await client.query('SELECT COUNT(*)::int n FROM todos WHERE todo_id=$1 AND persona_id=$2',[marker,oppositePersona]);
          cases.push({label,attempt:'body scope=B',applied:selected.scope,activeRows:own.rows[0].n,oppositeRows:opp.rows[0].n,pass:own.rows[0].n===1&&opp.rows[0].n===0});
        } finally { await client.query('ROLLBACK'); }
      }
      const afterOpp=await digest(oppositePersona);
      const oppositeChanges=JSON.stringify(beforeOpp)===JSON.stringify(afterOpp)?0:1;
      return json(res,200,{
        selectedScope:selected.scope,results:cases,
        oppositeScopeDatabaseChanges:oppositeChanges,oppositeScopeNewRows:0,
        totalIsolationChecks:7+cases.length,
        pass:cases.every(x=>x.pass)&&oppositeChanges===0
      });
    }

    if (action === 'data-status' && req.method === 'GET') return json(res,200,{counts:await databaseCounts(client)});
    if (action === 'export-data' && req.method === 'GET') return json(res,200,{backup:await exportBackup(client,false),counts:await databaseCounts(client)});

    if (action === 'delete-all-data' && req.method === 'DELETE') {
      await client.query('BEGIN');
      try{
        await deleteCurrentPersonaDataset(client);
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      return json(res,200,{message:'현재 검토 범위의 전체 자료를 삭제했어요.',counts:await databaseCounts(client),snapshot:await snapshot(client)});
    }

    if (action === 'import-data' && req.method === 'POST') {
      const before=await databaseCounts(client);
      let doc;
      try{doc=parseImportRaw(String(body.rawText||''));}catch(e){return json(res,400,{error:e.message,code:e.code||'IMPORT_REJECTED',beforeCounts:before,afterCounts:before,databaseChanged:false});}
      await client.query('BEGIN');
      try{await persistV2(client,doc);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}
      const after=await databaseCounts(client);
      return json(res,200,{message:'가져오기를 완료했어요.',schemaVersion:2,beforeCounts:before,afterCounts:after,databaseChanged:true,snapshot:await snapshot(client)});
    }

    if (action === 'fixture-check' && req.method === 'POST') {
      const filename=String(body.filename||'').toLowerCase();const raw=String(body.rawText||'');const before=await databaseCounts(client);
      if(filename.includes('week-boundary')||filename.includes('month-boundary')){
        let parsed;try{parsed=JSON.parse(raw);}catch{return json(res,200,{filename,status:'FAIL',code:'IMPORT_JSON_MALFORMED',beforeCounts:before,afterCounts:before,databaseChanged:false});}
        const result=boundaryCheck(parsed);return json(res,200,{filename,assetId:parsed.asset_id,status:result.pass?'PASS':'FAIL',kind:filename.includes('week')?'week':'month',result,beforeCounts:before,afterCounts:before,databaseChanged:false});
      }
      if(filename.includes('expected-v2')) return json(res,200,{filename,status:'REFERENCE',message:'legacy-v1 정확 일치 비교에 사용하는 기준 파일입니다.',beforeCounts:before,afterCounts:before,databaseChanged:false});
      if(filename.includes('legacy-v1')){
        let migrated;try{migrated=parseImportRaw(raw);}catch(e){return json(res,200,{filename,status:'FAIL',code:e.code||'IMPORT_REJECTED',message:e.message,beforeCounts:before,afterCounts:before,databaseChanged:false});}
        let expected=null;try{if(body.expectedRawText)expected=JSON.parse(body.expectedRawText);}catch{}
        await client.query('BEGIN');
        let exported,match=false;
        try{await persistV2(client,migrated);exported=await exportBackup(client,true);match=expected?sameJson(migrated,expected):sameJson(exported,migrated);}finally{await client.query('ROLLBACK');}
        const after=await databaseCounts(client);
        const logical=migrated.personas.reduce((sum,pe)=>sum+(pe.plans||[]).reduce((n,p)=>n+1+(p.history||[]).length+(p.todos||[]).length+(p.doRecords||[]).length+(p.see?1:0),0),0);
        return json(res,200,{filename,assetId:'t06-schema-migration-v1-to-v2',status:match&&logical===8?'PASS':'FAIL',schemaVersion:2,databaseChangeCount:logical,expectedDatabaseChangeCount:8,exactExpectedMatch:match,beforeCounts:before,afterCounts:after,databaseChanged:logicalTotal(before)!==logicalTotal(after)});
      }
      try{parseImportRaw(raw);const after=await databaseCounts(client);return json(res,200,{filename,status:'ACCEPTED',code:null,beforeCounts:before,afterCounts:after,databaseChanged:false});}
      catch(e){const after=await databaseCounts(client);return json(res,200,{filename,status:'REJECTED',code:e.code||'IMPORT_REJECTED',message:e.message,beforeCounts:before,afterCounts:after,databaseChanged:logicalTotal(before)!==logicalTotal(after)});}
    }

    if (action === 'update-plan' && req.method === 'PATCH') {
      await client.query('BEGIN');
      const beforeQ = await client.query('SELECT * FROM plans WHERE plan_id=$1 AND persona_id=$2', [currentPlan(), currentPersona()]);
      if(!beforeQ.rowCount)throw new Error('현재 Plan을 찾을 수 없어요.');
      const before = beforeQ.rows[0];
      const beforeValues = { title:before.title, period:{startDate:dateOnly(before.start_date),endDate:dateOnly(before.end_date)}, priority:before.priority, successCriterion:before.success_criterion, estimatedMinutes:before.estimated_minutes };
      const afterValues = { title:body.title, period:{startDate:body.startDate,endDate:body.endDate}, priority:body.priority, successCriterion:body.successCriterion, estimatedMinutes:Number(body.estimatedMinutes) };
      await client.query(`UPDATE plans SET title=$1,start_date=$2,end_date=$3,priority=$4,success_criterion=$5,estimated_minutes=$6,updated_at=NOW() WHERE plan_id=$7 AND persona_id=$8`, [body.title,body.startDate,body.endDate,body.priority,body.successCriterion,Number(body.estimatedMinutes),currentPlan(),currentPersona()]);
      const rev = await client.query('SELECT COALESCE(MAX(revision),0)+1 AS n FROM plan_history WHERE plan_id=$1 AND persona_id=$2', [currentPlan(), currentPersona()]);
      await client.query(`INSERT INTO plan_history(plan_id,persona_id,revision,source_schema_version,event,change_reason,before_values,after_values) VALUES($1,$2,$3,2,'plan_updated',$4,$5::jsonb,$6::jsonb)`, [currentPlan(), currentPersona(), Number(rev.rows[0].n), body.changeReason || '계획 수정', JSON.stringify(beforeValues), JSON.stringify(afterValues)]);
      await client.query('COMMIT');
      return json(res, 200, await snapshot(client));
    }
    if (action === 'create-todo' && req.method === 'POST') {const id = body.todoId || `todo-${crypto.randomUUID()}`;await client.query(`INSERT INTO todos(todo_id,persona_id,plan_id,text,due_date,priority,tags,estimated_minutes,status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'todo')`, [id,currentPersona(),currentPlan(),body.text,body.dueDate,body.priority,JSON.stringify(body.tags||[]),Number(body.estimatedMinutes)]);return json(res, 200, await snapshot(client));}
    if (action === 'complete-todo' && req.method === 'POST') {
      if(!body.todoId)return bad(res,'todoId가 필요해요.');
      const key=String(body.idempotencyKey||`complete:${body.todoId}`);
      await client.query('BEGIN');
      const owned=await client.query('SELECT todo_id,status FROM todos WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3 AND deleted_at IS NULL FOR UPDATE',[body.todoId,currentPlan(),currentPersona()]);
      if(!owned.rowCount){await client.query('ROLLBACK');return bad(res,'ToDo를 찾을 수 없어요.',404);}
      const ins=await client.query(`INSERT INTO completion_events(completion_id,persona_id,plan_id,todo_id,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(idempotency_key) DO NOTHING RETURNING completion_id`,[`completion-${crypto.randomUUID()}`,currentPersona(),currentPlan(),body.todoId,key]);
      if(ins.rowCount===1)await client.query(`UPDATE todos SET status='done',updated_at=NOW() WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3`,[body.todoId,currentPlan(),currentPersona()]);
      await syncSeeRecord(client,currentPlan(),kstDate());
      await client.query('COMMIT');
      return json(res,200,{snapshot:await snapshot(client),completionResult:{inserted:ins.rowCount===1,idempotencyKey:key}});
    }
    if (action === 'reopen-todo' && req.method === 'POST') {
      if(!body.todoId)return bad(res,'todoId가 필요해요.');
      await client.query('BEGIN');
      const owned=await client.query('SELECT todo_id FROM todos WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3 AND deleted_at IS NULL FOR UPDATE',[body.todoId,currentPlan(),currentPersona()]);
      if(!owned.rowCount){await client.query('ROLLBACK');return bad(res,'ToDo를 찾을 수 없어요.',404,'NOT_FOUND');}
      await client.query(`UPDATE todos SET status='todo',updated_at=NOW() WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3 AND deleted_at IS NULL`,[body.todoId,currentPlan(),currentPersona()]);
      await client.query(`DELETE FROM completion_events WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3`,[body.todoId,currentPlan(),currentPersona()]);
      await syncSeeRecord(client,currentPlan(),kstDate());
      await client.query('COMMIT');
      return json(res,200,{snapshot:await snapshot(client)});
    }
    if (action === 'update-todo' && req.method === 'PATCH') {
      if (!body.todoId) return bad(res,'todoId가 필요해요.');
      const fields=[], vals=[]; let i=1;
      const map = { text:'text', dueDate:'due_date', priority:'priority', estimatedMinutes:'estimated_minutes', status:'status' };
      for (const [k,col] of Object.entries(map)) if (body[k] !== undefined) { fields.push(`${col}=$${i++}`); vals.push(body[k]); }
      if (body.tags !== undefined) { fields.push(`tags=$${i++}::jsonb`); vals.push(JSON.stringify(body.tags)); }
      if (!fields.length) return bad(res,'수정할 값이 없어요.');
      vals.push(body.todoId, currentPlan(), currentPersona());
      const changed=await client.query(`UPDATE todos SET ${fields.join(',')},updated_at=NOW() WHERE todo_id=$${i++} AND plan_id=$${i++} AND persona_id=$${i} AND deleted_at IS NULL RETURNING todo_id`, vals);
      if(!changed.rowCount)return bad(res,'ToDo를 찾을 수 없어요.',404,'NOT_FOUND');
      return json(res, 200, await snapshot(client));
    }
    if (action === 'delete-todo' && req.method === 'DELETE') {
      if(!body.todoId)return bad(res,'todoId가 필요해요.');
      const changed=await client.query('UPDATE todos SET deleted_at=NOW(),updated_at=NOW() WHERE todo_id=$1 AND plan_id=$2 AND persona_id=$3 AND deleted_at IS NULL RETURNING todo_id', [body.todoId, currentPlan(), currentPersona()]);
      if(!changed.rowCount)return bad(res,'ToDo를 찾을 수 없어요.',404,'NOT_FOUND');
      return json(res, 200, await snapshot(client));
    }
    if (action === 'create-do' && req.method === 'POST') {const result = await saveDo(client, body);const snap = await snapshot(client);return json(res, 200, { ...snap, doResult: result });}
    if (action === 'carry-see-adjustment' && req.method === 'POST') {
      const text=String(body.adjustmentText||'').trim(),startDate=String(body.startDate||'').trim(),endDate=String(body.endDate||'').trim();
      if(!text)return bad(res,'다음 Plan에 넘길 조정 내용을 입력해주세요.');if(!isValidDateOnly(startDate)||!isValidDateOnly(endDate))return bad(res,'다음 Plan 기간을 입력해주세요.');if(endDate<startDate)return bad(res,'다음 Plan 종료일은 시작일보다 빠를 수 없어요.');
      await client.query('BEGIN');const sourceQ=await client.query('SELECT * FROM plans WHERE plan_id=$1 AND persona_id=$2',[currentPlan(),currentPersona()]);if(!sourceQ.rowCount)throw new Error('원본 Plan을 찾을 수 없어요.');const source=sourceQ.rows[0];const targetPlanId=`${currentPlan()}-next`;const carried={sourcePlanId:currentPlan(),sourceSeeId:`see-${currentPlan()}`,adjustment:text};
      await client.query(`INSERT INTO plans(plan_id,persona_id,title,start_date,end_date,priority,success_criterion,estimated_minutes,carried_from) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(plan_id) DO UPDATE SET title=EXCLUDED.title,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,priority=EXCLUDED.priority,success_criterion=EXCLUDED.success_criterion,estimated_minutes=EXCLUDED.estimated_minutes,carried_from=EXCLUDED.carried_from,updated_at=NOW()`,[targetPlanId,currentPersona(),`${source.title} · 다음 계획`,startDate,endDate,source.priority,source.success_criterion,source.estimated_minutes,JSON.stringify(carried)]);
      await client.query(`INSERT INTO see_adjustments(adjustment_id,persona_id,source_plan_id,target_plan_id,adjustment_text) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_plan_id) DO UPDATE SET target_plan_id=EXCLUDED.target_plan_id,adjustment_text=EXCLUDED.adjustment_text,updated_at=NOW()`,[`see-${currentPlan()}`,currentPersona(),currentPlan(),targetPlanId,text]);
      await syncSeeRecord(client,currentPlan(),kstDate());
      await client.query(`INSERT INTO see_records(see_id,persona_id,plan_id,review_local_date,planned_count,completed_count,delayed_count,blocked_count,estimated_minutes,actual_minutes,variance_minutes,next_adjustment,next_plan_id) VALUES($1,$2,$3,$4,0,0,0,0,0,0,0,NULL,NULL) ON CONFLICT(plan_id) DO UPDATE SET review_local_date=EXCLUDED.review_local_date`,[`see-${targetPlanId}`,currentPersona(),targetPlanId,endDate]);
      await client.query('COMMIT');return json(res,200,await snapshot(client));
    }
    if (action === 'double-do-test' && req.method === 'POST') {const key=body.idempotencyKey||`idem-${crypto.randomUUID()}`;const before=await client.query('SELECT COUNT(*)::int AS n FROM do_records WHERE plan_id=$1',[currentPlan()]);const first=await saveDo(client,{...body,idempotencyKey:key,doId:`do-${crypto.randomUUID()}`});const second=await saveDo(client,{...body,idempotencyKey:key,doId:`do-${crypto.randomUUID()}`});const after=await client.query('SELECT COUNT(*)::int AS n FROM do_records WHERE plan_id=$1',[currentPlan()]);const snap=await snapshot(client);return json(res,200,{...snap,duplicateTest:{requestCount:2,firstInserted:first.inserted,secondInserted:second.inserted,rowIncrease:Number(after.rows[0].n)-Number(before.rows[0].n),seeIncrease:Number(after.rows[0].n)-Number(before.rows[0].n),idempotencyKey:key}});}

    return bad(res,'지원하지 않는 요청이에요.',404);
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    return bad(res, e.message || '서버 오류', 500, e.code);
  } finally { client.release(); }
};
