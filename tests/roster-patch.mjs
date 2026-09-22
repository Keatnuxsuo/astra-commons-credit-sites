import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the real application module against SQLite, using D1's transactional
// batch contract. This suite contains synthetic attendees and credit values only.
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const validation = moduleUrl(await readFile(new URL('../lib/validation.ts', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../lib/roster-patch.ts', import.meta.url), 'utf8')).replace("'./validation'", JSON.stringify(validation));
const { applyRosterPatch } = await import(moduleUrl(source));
const schema = await readFile(new URL('../drizzle/0000_mushy_medusa.sql', import.meta.url), 'utf8');
const registration = id => ({ id:`test-${id}`, name:`Test Builder ${id}`, email:`builder${id}@example.test`, pairId:id });
const patch = () => ({revision:'synthetic-1', expectedGuestCount:3, removed:[registration(2), registration(3)], added:[{...registration(4), pairId:2}]});
function fixture() {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON'); sql.exec(schema);
  for (let i=1;i<=3;i++) {
    sql.prepare('INSERT INTO reward_pairs VALUES(?,?,?,NULL)').run(i,`TEST-API-${i}`,`https://example.test/codex/${i}`);
    sql.prepare('INSERT INTO guests VALUES(?,?,?,?,?)').run(`test-${i}`,`Test Builder ${i}`,`builder${i}@example.test`,`test builder ${i}`,i);
    sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`session-${i}`,`test-${i}`,9999999999999);
  }
  sql.prepare('INSERT INTO settings VALUES(?,?)').run('claims_open','false');
  const d = {
    prepare(query) {return { query, params:[], bind(...params) {return {...this,params};}, async first() {return sql.prepare(this.query).get(...this.params)??null;} };},
    async batch(statements) {
      sql.exec('BEGIN');
      try {const results=statements.map(s=>sql.prepare(s.query).run(...s.params));sql.exec('COMMIT');return results;}
      catch(e){sql.exec('ROLLBACK');throw e;}
    },
  };
  const snapshot = () => JSON.stringify(['guests','reward_pairs','sessions','settings'].map(t=>sql.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()));
  return {sql,d,snapshot};
}

test('removes cancelled eligibility and sessions, archives identities, preserves issued credits, and allocates once',async()=>{
  const {sql,d,snapshot}=fixture();
  sql.prepare('UPDATE reward_pairs SET issued_at=? WHERE id=1').run('2026-09-18T00:00:00Z');
  const rewardsBefore=JSON.stringify(sql.prepare('SELECT * FROM reward_pairs ORDER BY id').all());
  await applyRosterPatch(d,JSON.stringify(patch()));
  assert.deepEqual(sql.prepare('SELECT id,pair_id FROM guests ORDER BY id').all().map(r=>({...r})),[{id:'test-1',pair_id:1},{id:'test-4',pair_id:2}]);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
  assert.equal(JSON.stringify(sql.prepare('SELECT * FROM reward_pairs ORDER BY id').all()),rewardsBefore);
  const audit=JSON.parse(sql.prepare("SELECT value FROM settings WHERE key='roster_patch:synthetic-1'").get().value);
  assert.equal(audit.removed.length,2);assert.equal(audit.added.length,1);assert.ok(audit.appliedAt);
  assert.equal(sql.prepare("SELECT value FROM settings WHERE key='claims_open'").get().value,'false');
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM settings WHERE key='roster_patch_guard'").get().n,0);
  const applied=snapshot();await applyRosterPatch(d,JSON.stringify(patch()));assert.equal(snapshot(),applied);sql.close();
});

test('concurrent applications make exactly one change and one audit',async()=>{
  const {sql,d}=fixture();await Promise.all([applyRosterPatch(d,JSON.stringify(patch())),applyRosterPatch(d,JSON.stringify(patch()))]);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM guests').get().n,2);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM settings WHERE key LIKE 'roster_patch:%'").get().n,1);sql.close();
});

for (const [label,change] of [
  ['issued cancellation',({sql})=>sql.exec("UPDATE reward_pairs SET issued_at='issued' WHERE id=2")],
  ['claims already open',({sql})=>sql.exec("UPDATE settings SET value='true' WHERE key='claims_open'")],
  ['changed attendee identity',({sql})=>sql.exec("UPDATE guests SET email='changed@example.test' WHERE id='test-2'")],
  ['conflicting new email',({sql})=>sql.exec("UPDATE guests SET email='builder4@example.test' WHERE id='test-1'")],
  ['late insert failure',({sql})=>sql.exec("CREATE TRIGGER reject_new BEFORE INSERT ON guests BEGIN SELECT RAISE(ABORT,'synthetic failure'); END")],
]) test(`${label} rolls back the complete update`,async()=>{
  const f=fixture();change(f);const before=f.snapshot();await assert.rejects(applyRosterPatch(f.d,JSON.stringify(patch())));assert.equal(f.snapshot(),before);f.sql.close();
});

test('duplicate allocation and malformed input are rejected without mutation',async()=>{
  const f=fixture(),before=f.snapshot(),p=patch();p.added.push({...registration(5),pairId:2});
  await assert.rejects(applyRosterPatch(f.d,JSON.stringify(p)));await assert.rejects(applyRosterPatch(f.d,'{broken'));
  assert.equal(f.snapshot(),before);f.sql.close();
});
